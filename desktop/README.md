# vibejob Desktop

Desktop builds for vibejob (pywebview + PyInstaller).

## Build (Windows)

```powershell
.\desktop\build-desktop.ps1
```

Output: `desktop/dist/vibejob.exe`

## Build (Linux)

Build **on Linux** (native machine, WSL2, or GitHub Actions). Cross-compile from Windows is not supported.

```bash
# deps (Ubuntu/Debian)
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
  libgirepository1.0-dev gir1.2-gtk-3.0 gir1.2-webkit2-4.1 pkg-config

bash desktop/build-desktop.sh
```

Output: `desktop/dist/vibejob`

CI: workflow `Build desktop (Linux)` uploads artifact `vibejob-linux-x64`.

### How to verify on Linux

```bash
chmod +x desktop/dist/vibejob
file desktop/dist/vibejob          # should say ELF
./desktop/dist/vibejob             # opens window (needs display)
```

Headless smoke (backend only path is harder in one-file GUI build); prefer a real desktop session or VM with GUI.

## Development

```powershell
$env:PYTHONPATH = "backend;desktop"
backend\.venv\Scripts\python.exe desktop\main.py
```

```bash
export PYTHONPATH="backend:desktop"
backend/.venv/bin/python desktop/main.py
```

## Distribution

- Windows: send `vibejob.exe`. SmartScreen may warn (unsigned).
- Linux: send `vibejob`. User needs GTK/WebKit runtime libs on the target distro.
