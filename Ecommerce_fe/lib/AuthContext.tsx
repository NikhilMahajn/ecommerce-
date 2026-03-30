'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { User } from './types'
import { apiClient } from './apiClient'

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

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    console.log('[v0] Restoring auth - saved token:', !!savedToken)
    if (savedToken) {
      setToken(savedToken)
      apiClient.setToken(savedToken)
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
        // If response.data exists, try to set it as user directly
        setUser(response.data)
      } else if (response.error) {
        console.error('[v0] Profile load error:', response.error)
        // If profile fetch fails, still keep the token as we have it
        // The user can still perform actions with the token
      }
    } catch (error) {
      console.error('[v0] Profile load error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.login(username, password)
      console.log('Login response:', response)
      
      let newToken: string | null = null
      
      newToken = response.token.access_token
      
      if (response.user && newToken) {
        setToken(newToken)
        setUser(response.user)
        apiClient.setToken(newToken)
        localStorage.setItem('auth_token', newToken)
      } else {
        console.error('Token extraction failed:', { hasUser: !!response.user, token: newToken, response })
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
    localStorage.removeItem('auth_token')
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
