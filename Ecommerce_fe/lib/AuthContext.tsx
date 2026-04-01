'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { User } from './types'
import { apiClient, setLogoutCallback } from './apiClient'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  signup: (email: string, password: string, full_name: string, username: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Setup logout callback for apiClient
  useEffect(() => {
    setLogoutCallback(() => {
      console.log('[Auth] Auto logout triggered by API')
      logout()
    })
  }, [])

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    const savedRefreshToken = localStorage.getItem('refresh_token')
    console.log('[Auth] Restoring auth - saved token:', !!savedToken)
    
    if (savedToken) {
      setToken(savedToken)
      apiClient.setToken(savedToken)
      if (savedRefreshToken) {
        apiClient.setRefreshToken(savedRefreshToken)
      }
      loadProfile()
    } else {
      setIsLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      const response = await apiClient.getMe()
      if (response.data?.user) {
        setUser(response.data.user)
      } else if (response.data && !response.error) {
        setUser(response.data)
      } else if (response.error) {
        console.error('[Auth] Profile load error:', response.error)
      }
    } catch (error) {
      console.error('[Auth] Profile load error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.login(username, password)
      console.log('[Auth] Login response:', response)
      
      const newToken = response.token?.access_token
      const refreshToken = response.token?.refresh_token
      
      if (response.user && newToken) {
        setToken(newToken)
        setUser(response.user)
        apiClient.setToken(newToken)
        if (refreshToken) {
          apiClient.setRefreshToken(refreshToken)
          localStorage.setItem('refresh_token', refreshToken)
        }
        localStorage.setItem('auth_token', newToken)
      } else {
        console.error('[Auth] Token extraction failed:', { hasUser: !!response.user, token: newToken, response })
        throw new Error(response.error || 'Login failed - could not extract token')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(async (email: string, password: string, full_name: string, user_name: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.signup(email, password, full_name, user_name)
      if (!response.data?.id) {
        throw new Error(response.error || 'Signup failed')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    apiClient.setToken(null)
    apiClient.setRefreshToken(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
  }, [])

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    signup,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
