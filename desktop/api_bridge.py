import webbrowser
from pathlib import Path
from typing import Any

from desktop.key_store import KeyStore


class ApiBridge:
    def __init__(self, app_data_dir: Path):
        self._store = KeyStore(app_name="JobRadar", fallback_dir=app_data_dir)

    def get_key_status(self) -> dict[str, Any]:
        key = self._store.get_key()
        return {"configured": bool(key)}

    def set_key(self, key: str) -> dict[str, Any]:
        try:
            self._store.set_key(key)
            return {"status": "ok"}
        except ValueError as e:
            return {"status": "error", "message": str(e)}

    def open_external_link(self, url: str) -> None:
        if url and url.startswith(("http://", "https://")):
            webbrowser.open(url)
