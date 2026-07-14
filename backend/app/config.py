from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gigachat_auth_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./jobs.db"
    gigachat_model: str = "GigaChat"
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_timeout_seconds: float = 60.0
    gigachat_max_retries: int = 4
    gigachat_concurrency: int = 3
    openai_model: str = "gpt-4o-mini"
    openrouter_model: str = "openai/gpt-4o-mini"
    anthropic_model: str = "claude-3-5-haiku-20241022"
    candidates_cap: int = Field(default=500, ge=1, le=2_000)
    selected_cap: int = Field(default=100, ge=1, le=500)
    telegram_channels: str = (
        "spb_rabota:vacancy,goodpeople_pro:vacancy,time2find:vacancy,"
        "polyaluzjob:freelance,zerocode_jobs:freelance"
    )

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
