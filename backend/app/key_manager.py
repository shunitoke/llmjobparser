import os
from typing import Any, Dict, Optional

from app.config import get_settings

_INVISIBLE_CHARS = set(" \xa0\u200b\ufeff\r\n\t")
_KEY_ERROR_RU = (
    "Ключ содержит кириллицу или лишние символы. "
    "Скопируйте заново только сам ключ из личного кабинета."
)


def sanitize_key(key: str) -> str:
    """Strip whitespace, invisible chars and surrounding quotes from an API key."""
    if not key:
        return ""
    cleaned = "".join(ch for ch in key.strip() if ch not in _INVISIBLE_CHARS)
    cleaned = cleaned.strip(" \t\"'«»„""''")
    if not cleaned:
        return ""
    half = len(cleaned) // 2
    if half >= 20 and cleaned[:half] == cleaned[half:]:
        cleaned = cleaned[:half]
    return cleaned


class KeyManager:
    def __init__(self, default_key: str = ""):
        self._default_key = default_key
        self._runtime_key: str | None = None
        self._provider: str = "gigachat"
        self._model: str = ""

    def get_key(self) -> str:
        raw = os.environ.get("GIGACHAT_AUTH_KEY") or self._runtime_key or self._default_key
        return sanitize_key(raw)

    def set_key(self, key: str) -> None:
        cleaned = sanitize_key(key)
        if not cleaned:
            raise ValueError("Authorization key cannot be empty")
        if not cleaned.isascii():
            raise ValueError(_KEY_ERROR_RU)
        self._runtime_key = cleaned

    def clear_key(self) -> None:
        self._runtime_key = None

    def get_provider(self) -> str:
        return self._provider

    def set_provider(self, provider: str) -> None:
        self._provider = provider

    def get_model(self) -> str:
        return self._model

    def set_model(self, model: str) -> None:
        self._model = model


_default_key = get_settings().gigachat_auth_key
key_manager = KeyManager(default_key=_default_key)
