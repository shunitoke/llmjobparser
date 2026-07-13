import os

from app.config import get_settings


class KeyManager:
    def __init__(self, default_key: str = ""):
        self._default_key = default_key
        self._runtime_key: str | None = None

    def get_key(self) -> str:
        return os.environ.get("GIGACHAT_AUTH_KEY") or self._runtime_key or self._default_key

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Authorization key cannot be empty")
        self._runtime_key = key.strip()


_default_key = get_settings().gigachat_auth_key
key_manager = KeyManager(default_key=_default_key)
