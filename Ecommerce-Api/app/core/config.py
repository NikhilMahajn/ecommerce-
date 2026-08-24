from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database Config
    db_username: str
    db_password: str
    db_hostname: str
    db_port: str
    db_name: str

    # JWT Config
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int

    # Groq API Config (Optional - for dynamic pricing)
    GROQ_API_KEY: str
    MODEL:str
    MAX_TOOL_ITERATIONS:int

    class Config:
        env_file = ".env"


settings = Settings()
