import webbrowser
from pathlib import Path
from typing import Any

from desktop.key_store import KeyStore


class ApiBridge:
    def __init__(self, app_data_dir: Path, app_name: str = "vibejob"):
        self._store = KeyStore(app_name=app_name, fallback_dir=app_data_dir)

    def getKeyStatus(self) -> dict[str, Any]:
        key = self._store.get_key()
        return {"configured": bool(key)}

    def setKey(self, key: str) -> dict[str, Any]:
        try:
            self._store.set_key(key)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def deleteKey(self) -> dict[str, Any]:
        try:
            self._store.delete_key()
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def openExternalLink(self, url: str) -> None:
        if url and url.startswith(("http://", "https://")):
            webbrowser.open(url)

    def getStoredKey(self) -> str | None:
        return self._store.get_key()