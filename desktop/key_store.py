"""
Secure local store for the GigaChat Authorization key.

Storage: Windows DPAPI (``win32crypt``) so the secret is bound to the current
Windows user and recoverable only by that user. The encrypted blob is kept in
the application data directory (``vibejob-data`` next to the executable), so
deleting that directory resets the key and shows the first-run screen again.

The keyring/Credential Manager path that shipped originally is intentionally
removed to keep everything inside the app data folder and make reset predictable.
"""
import os
from pathlib import Path
from typing import Optional

try:
    import win32crypt

    _HAS_WIN32 = True
except Exception:
    _HAS_WIN32 = False


class KeyStore:
    _FILE_NAME = "key.dpapi"

    def __init__(self, app_name: str = "vibejob", fallback_dir: Optional[Path] = None):
        self._app_name = app_name
        if fallback_dir:
            self._fallback_dir = Path(fallback_dir)
        else:
            self._fallback_dir = Path(os.environ.get("LOCALAPPDATA", Path.home())) / app_name
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._fallback_file = self._fallback_dir / self._FILE_NAME

    def get_key(self) -> Optional[str]:
        return self._read_dpapi()

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Key cannot be empty")
        self._write_dpapi(key.strip())

    def delete_key(self) -> None:
        if self._fallback_file.exists():
            try:
                self._fallback_file.unlink()
            except Exception:
                pass

    def _read_dpapi(self) -> Optional[str]:
        if not self._fallback_file.exists():
            return None
        if not _HAS_WIN32:
            raise RuntimeError(
                "Cannot read vibejob key: DPAPI requires pywin32."
            )
        blob = self._fallback_file.read_bytes()
        if not blob:
            return None
        try:
            _desc, plaintext = win32crypt.CryptUnprotectData(blob, None, None, None, 0)
            return plaintext.decode("utf-8")
        except Exception:
            return None

    def _write_dpapi(self, value: str) -> None:
        if not _HAS_WIN32:
            raise RuntimeError(
                "Cannot save vibejob key: DPAPI requires pywin32."
            )
        blob = win32crypt.CryptProtectData(
            value.encode("utf-8"), "vibejob.gigachat_key", None, None, None, 0
        )
        self._fallback_file.write_bytes(blob)
