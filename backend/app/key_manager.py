import os
from typing import Any, Dict, Optional

from app.config import get_settings


class KeyManager:
    def __init__(self, default_key: str = ""):
        self._default_key = default_key
        self._runtime_key: str | None = None
        self._provider: str = "gigachat"
        self._model: str = ""

    def get_key(self) -> str:
        return os.environ.get("GIGACHAT_AUTH_KEY") or self._runtime_key or self._default_key

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Authorization key cannot be empty")
        self._runtime_key = key.strip()

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
