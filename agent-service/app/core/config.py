import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str = ""
    agent_model: str = "claude-sonnet-4-5-20250929"
    log_level: str = "INFO"
    allowed_origins: str = "http://localhost:3000"
    redis_url: str = "redis://localhost:6379"
    api_key: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
