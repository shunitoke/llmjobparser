# vibejob Desktop

Windows desktop build for vibejob.

## Build

```powershell
.\desktop\build-desktop.ps1
```

Output: `desktop/dist/vibejob.exe`

## Development

```powershell
$env:PYTHONPATH = "backend;desktop"
backend\.venv\Scripts\python.exe desktop\main.py
```

## Distribution

Send `vibejob.exe` to the user. On first run Windows may show a SmartScreen warning because the file is not code-signed.
