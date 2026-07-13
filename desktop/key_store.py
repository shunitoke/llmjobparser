"""
Secure local store for the GigaChat Authorization key.

Primary storage: Windows Credential Manager via ``keyring``.
Fallback storage: Windows DPAPI (``win32crypt``) so the secret is bound to the
current Windows user and recoverable only by that user.

The plaintext fallback that shipped originally is intentionally disabled: if
neither ``keyring`` nor ``pywin32`` is available, ``set_key`` raises so we never
persist a secret in cleartext.
"""
import os
from pathlib import Path
from typing import Optional

try:
    import keyring
    _HAS_KEYRING = True
except Exception:
    _HAS_KEYRING = False

try:
    import win32crypt
    _HAS_WIN32 = True
except Exception:
    _HAS_WIN32 = False


class KeyStore:
    _USERNAME = "gigachat_auth_key"
    _FILE_NAME = "key.dpapi"

    def __init__(self, app_name: str = "JobRadar", fallback_dir: Optional[Path] = None):
        self._app_name = app_name
        # Use app_name as the keyring service so distinct test harnesses (with
        # different app names) cannot see each other's stored credentials.
        self._service = app_name
        if fallback_dir:
            self._fallback_dir = Path(fallback_dir)
        else:
            self._fallback_dir = Path(os.environ.get("LOCALAPPDATA", Path.home())) / app_name
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._fallback_file = self._fallback_dir / self._FILE_NAME

    def get_key(self) -> Optional[str]:
        if _HAS_KEYRING:
            try:
                value = keyring.get_password(self._service, self._USERNAME)
                if value:
                    return value
            except Exception:
                pass
        return self._read_dpapi()

    def set_key(self, key: str) -> None:
        if not key or not key.strip():
            raise ValueError("Key cannot be empty")
        value = key.strip()
        stored = False
        if _HAS_KEYRING:
            try:
                keyring.set_password(self._service, self._USERNAME, value)
                stored = True
            except Exception:
                pass
        if not stored:
            self._write_dpapi(value)

    def _read_dpapi(self) -> Optional[str]:
        if not self._fallback_file.exists():
            return None
        if not _HAS_WIN32:
            raise RuntimeError(
                "Cannot read Job Radar key: Windows Credential Manager unavailable "
                "and DPAPI fallback requires pywin32."
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
                "Cannot save Job Radar key: Windows Credential Manager unavailable "
                "and DPAPI fallback requires pywin32."
            )
        blob = win32crypt.CryptProtectData(value.encode("utf-8"), "JobRadar.gigachat_key", None, None, None, 0)
        self._fallback_file.write_bytes(blob)