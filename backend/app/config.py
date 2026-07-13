from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./jobs.db"
    openrouter_model: str = "anthropic/claude-3-haiku"
    gigachat_auth_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
