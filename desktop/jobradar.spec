# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.building.build_main import Analysis, PYZ, EXE
import sys
from pathlib import Path

project_root = Path(SPECPATH).resolve().parent
backend_dir = project_root / "backend"
frontend_dist = project_root / "frontend" / "dist"
desktop_dir = project_root / "desktop"

a = Analysis(
    [str(desktop_dir / "main.py")],
    pathex=[str(backend_dir), str(desktop_dir)],
    binaries=[],
    datas=[
        (str(backend_dir / "app"), "backend/app"),
        (str(frontend_dist), "frontend/dist"),
    ],
    hiddenimports=[
        # Backend application modules
        "app.main",
        "app.config",
        "app.database",
        "app.llm_service",
        "app.key_manager",
        "app.models",
        "app.schemas",
        "app.scraper",
        # Web framework and server
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "fastapi",
        "fastapi.middleware.cors",
        "fastapi.staticfiles",
        "starlette",
        "starlette.middleware",
        # Data validation and settings
        "pydantic",
        "pydantic.v1",
        "pydantic_core",
        "pydantic_settings",
        # Database
        "sqlalchemy",
        "sqlalchemy.ext.asyncio",
        "sqlalchemy.dialects.sqlite",
        "aiosqlite",
        # HTTP client
        "httpx",
        "httpcore",
        "certifi",
        # HTML parsing
        "bs4",
        "lxml",
        "lxml.etree",
        "lxml._elementpath",
        "html.parser",
        # Environment and security
        "dotenv",
        "keyring",
        "keyring.backends.Windows",
        "cryptography",
        "cryptography.hazmat.backends.openssl",
        # Desktop launcher
        "webview",
        "desktop.api_bridge",
        "desktop.key_store",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="JobRadar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(desktop_dir / "icon.ico") if (desktop_dir / "icon.ico").exists() else None,
)
