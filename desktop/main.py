import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from threading import Thread

import httpx

# When packaged as a single executable, the backend is started by re-executing
# the same binary with VIBEJOB_BACKEND=1. This keeps the launcher and server
# in one file while avoiding a separate backend.exe.
if __name__ == "__main__" and os.environ.get("VIBEJOB_BACKEND") == "1":
    for _fd, _attr in ((1, "stdout"), (2, "stderr")):
        if getattr(sys, _attr, None) is None:
            try:
                setattr(sys, _attr, os.fdopen(_fd, "w", encoding="utf-8", closefd=False))
            except OSError:
                setattr(sys, _attr, open(os.devnull, "w", encoding="utf-8"))

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        log_level="info",
    )
    sys.exit(0)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import webview

from desktop.api_bridge import ApiBridge
from desktop.loading import LOADING_HTML


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def get_app_data_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(os.path.dirname(sys.executable)) / "vibejob-data"
    return Path(__file__).resolve().parent / ".." / "backend"


def get_backend_executable() -> Path:
    return Path(sys.executable)


def start_backend(port: int, app_data_dir: Path) -> subprocess.Popen:
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["APP_DATA_DIR"] = str(app_data_dir)
    env["HOST"] = "127.0.0.1"

    project_root = Path(__file__).resolve().parent.parent
    backend_dir = project_root / "backend"
    pythonpath_parts = [str(project_root), str(backend_dir)]
    existing_pythonpath = env.get("PYTHONPATH", "")
    if existing_pythonpath:
        pythonpath_parts.append(existing_pythonpath)
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_parts)

    backend_exe = get_backend_executable()
    if getattr(sys, "frozen", False):
        env["VIBEJOB_BACKEND"] = "1"
        args = [str(backend_exe)]
    else:
        backend_dir = Path(__file__).resolve().parent / ".." / "backend"
        args = [str(backend_exe), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)]

    return subprocess.Popen(
        args,
        cwd=str(backend_exe.parent),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stream_logs(process: subprocess.Popen) -> None:
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            print(line, end="")
    except Exception:
        pass


def wait_for_backend(port: int, timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = httpx.get(f"http://127.0.0.1:{port}/api/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def main() -> None:
    app_data_dir = get_app_data_dir()
    app_data_dir.mkdir(parents=True, exist_ok=True)

    debug_log = app_data_dir / "vibejob-launcher.log"
    def debug(msg: str) -> None:
        try:
            with open(debug_log, "a", encoding="utf-8") as f:
                f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
        except Exception:
            pass

    bridge = ApiBridge(app_data_dir=app_data_dir)
    port = get_free_port()
    debug(f"port={port} starting backend...")
    process = start_backend(port, app_data_dir)
    debug(f"backend pid={process.pid}")

    log_thread = Thread(target=stream_logs, args=(process,), daemon=True)
    log_thread.start()

    loading_html = LOADING_HTML.replace("__PORT__", str(port))
    window = webview.create_window(
        "vibejob",
        html=loading_html,
        width=1280,
        height=800,
        min_size=(900, 600),
    )
    window.expose(bridge.getKeyStatus, bridge.setKey, bridge.deleteKey, bridge.getStoredKey, bridge.openExternalLink)
    debug("window created, starting gui loop...")

    def on_started():
        debug("on_started: waiting for backend...")
        ok = wait_for_backend(port)
        debug(f"on_started: backend ready={ok}")
        if ok:
            url = f"http://127.0.0.1:{port}/?desktop=1"
            debug(f"on_started: navigating to {url}")
            window.load_url(url)
            debug("on_started: load_url called")
        else:
            window.evaluate_js(
                "document.getElementById('hint').textContent = 'Не удалось запустить сервер. Перезапустите приложение.'"
            )
            process.terminate()

    try:
        webview.start(func=on_started, debug=False)
    finally:
        debug("shutting down...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        debug("done")


if __name__ == "__main__":
    main()
