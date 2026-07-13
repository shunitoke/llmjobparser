import os
from pathlib import Path
from typing import Optional

try:
    import keyring
    _HAS_KEYRING = True
except Exception:
    _HAS_KEYRING = False

try:
    from cryptography.fernet import Fernet
    import base64
    import hashlib
    _HAS_CRYPTO = True
except Exception:
    _HAS_CRYPTO = False


class KeyStore:
    _SERVICE = "JobRadar"
    _USERNAME = "gigachat_auth_key"

    def __init__(self, app_name: str = "JobRadar", fallback_dir: Optional[Path] = None):
        self._app_name = app_name
        if fallback_dir:
            self._fallback_dir = Path(fallback_dir)
        else:
            self._fallback_dir = Path(os.environ.get("LOCALAPPDATA", Path.home())) / app_name
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._fallback_file = self._fallback_dir / "key.enc"

    def get_key(self) -> Optional[str]:
        if _HAS_KEYRING:
            try:
                value = keyring.get_password(self._SERVICE, self._USERNAME)
                if value:
                    return value
            except Exception:
                pass
        return self._read_fallback()

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Key cannot be empty")
        value = key.strip()
        stored = False
        if _HAS_KEYRING:
            try:
                keyring.set_password(self._SERVICE, self._USERNAME, value)
                stored = True
            except Exception:
                pass
        if not stored:
            self._write_fallback(value)

    def _read_fallback(self) -> Optional[str]:
        if not self._fallback_file.exists():
            return None
        if not _HAS_CRYPTO:
            return self._fallback_file.read_text(encoding="utf-8").strip() or None
        f = self._get_fernet()
        try:
            ciphertext = self._fallback_file.read_bytes()
            return f.decrypt(ciphertext).decode("utf-8")
        except Exception:
            return None

    def _write_fallback(self, value: str) -> None:
        if not _HAS_CRYPTO:
            self._fallback_file.write_text(value, encoding="utf-8")
            return
        f = self._get_fernet()
        self._fallback_file.write_bytes(f.encrypt(value.encode("utf-8")))

    def _get_fernet(self):
        # DPAPI-like derivation: use a key derived from the app name.
        # This is not high-security but better than plaintext for a fallback.
        digest = hashlib.sha256(self._app_name.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))
