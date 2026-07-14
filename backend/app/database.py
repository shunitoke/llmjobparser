import os
import sys

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


def _get_app_data_dir() -> str:
    """Return a directory where the bundled app can write persistent data."""
    env_dir = os.environ.get("APP_DATA_DIR")
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir
    if getattr(sys, "frozen", False):
        # PyInstaller sets sys.frozen and sys._MEIPASS
        exe_dir = os.path.dirname(sys.executable)
        data_dir = os.path.join(exe_dir, "vibejob-data")
        os.makedirs(data_dir, exist_ok=True)
        return data_dir
    return "."


def _resolve_database_url(settings) -> str:
    url = settings.database_url
    if url.startswith("sqlite") and "/./jobs.db" in url:
        data_dir = _get_app_data_dir()
        return url.replace("/./jobs.db", f"/{data_dir}/jobs.db".replace("\\", "/"))
    return url


engine = create_async_engine(_resolve_database_url(get_settings()), echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
