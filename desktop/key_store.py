"""
Simple file-based key storage.

The key file is stored in the application's data directory (next to the
executable for frozen builds, or in the backend directory for development).
File-level permissions (NTFS) already restrict access to the current user.
"""
import os
from pathlib import Path
from typing import Optional


class KeyStore:
    _FILE_NAME = "vibejob.key"

    def __init__(self, app_name: str = "vibejob", fallback_dir: Optional[Path] = None):
        if fallback_dir:
            self._fallback_dir = Path(fallback_dir)
        else:
            self._fallback_dir = Path(os.environ.get("LOCALAPPDATA", Path.home())) / app_name
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._fallback_file = self._fallback_dir / self._FILE_NAME
        self._migrate_dpapi()

    def _migrate_dpapi(self):
        old_file = self._fallback_dir / "key.dpapi"
        if not old_file.exists() or self._fallback_file.exists():
            return
        try:
            import win32crypt
            blob = old_file.read_bytes()
            if blob:
                _desc, plaintext = win32crypt.CryptUnprotectData(blob, None, None, None, 0)
                key = plaintext.decode("utf-8").strip()
                self._fallback_file.write_text(key, encoding="utf-8")
            old_file.unlink()
        except Exception:
            try:
                old_file.unlink()
            except Exception:
                pass

    def get_key(self) -> Optional[str]:
        if not self._fallback_file.exists():
            return None
        try:
            return self._fallback_file.read_text("utf-8").strip() or None
        except Exception:
            return None

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Key cannot be empty")
        self._fallback_file.write_text(key.strip(), encoding="utf-8")

    def delete_key(self) -> None:
        if self._fallback_file.exists():
            try:
                self._fallback_file.unlink()
            except Exception:
                pass
