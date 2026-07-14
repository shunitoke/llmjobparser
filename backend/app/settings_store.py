import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models import AppSetting

logger = logging.getLogger(__name__)

TELEGRAM_CHANNELS_KEY = "telegram_channels"
LLM_CONFIG_KEY = "llm_config"

DEFAULT_LLM_CONFIG: Dict[str, Any] = {
    "provider": "gigachat",
    "model": "",
}


def _parse_channels(raw: str) -> List[Dict[str, str]]:
    channels: List[Dict[str, str]] = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            name, category = part.split(":", 1)
            channels.append({"name": name.strip(), "category": category.strip()})
        else:
            channels.append({"name": part, "category": "vacancy"})
    return channels


def _serialize_channels(channels: List[Dict[str, str]]) -> str:
    return ",".join(f"{c['name']}:{c['category']}" for c in channels)


async def _get_setting(db: AsyncSession, key: str) -> AppSetting | None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    return result.scalar_one_or_none()


async def get_telegram_channels() -> List[Dict[str, str]]:
    """Return configured Telegram channels. DB value wins, env fallback."""
    try:
        async with async_session() as db:
            row = await _get_setting(db, TELEGRAM_CHANNELS_KEY)
            if row is not None:
                return _parse_channels(row.value)
    except Exception as exc:
        logger.warning("Failed to read telegram channels from DB: %s", exc)
    fallback = get_settings().telegram_channels
    return _parse_channels(fallback)


async def set_telegram_channels(channels: List[Dict[str, str]]) -> None:
    """Persist Telegram channels to DB."""
    value = _serialize_channels(channels)
    async with async_session() as db:
        row = await _get_setting(db, TELEGRAM_CHANNELS_KEY)
        if row is None:
            row = AppSetting(key=TELEGRAM_CHANNELS_KEY, value=value)
            db.add(row)
        else:
            row.value = value
        await db.commit()


async def get_llm_config() -> Dict[str, Any]:
    """Return LLM provider config (provider, model). API key is managed separately via KeyManager/DPAPI."""
    try:
        async with async_session() as db:
            row = await _get_setting(db, LLM_CONFIG_KEY)
            if row is not None:
                return json.loads(row.value)
    except Exception as exc:
        logger.warning("Failed to read LLM config from DB: %s", exc)
    return dict(DEFAULT_LLM_CONFIG)


async def set_llm_config(config: Dict[str, Any]) -> None:
    """Persist LLM provider config to DB."""
    value = json.dumps(config, ensure_ascii=False)
    async with async_session() as db:
        row = await _get_setting(db, LLM_CONFIG_KEY)
        if row is None:
            row = AppSetting(key=LLM_CONFIG_KEY, value=value)
            db.add(row)
        else:
            row.value = value
        await db.commit()
