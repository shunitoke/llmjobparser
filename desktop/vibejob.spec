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
        "app.main",
        "app.config",
        "app.database",
        "app.llm_service",
        "app.key_manager",
        "app.models",
        "app.schemas",
        "app.search_service",
        "app.scrapers.base",
        "app.scrapers.hh",
        "app.scrapers.rabota",
        "app.scrapers.superjob",
        "app.scrapers.remoteok",
        "app.scrapers.weworkremotely",
        "app.scrapers.fourdayweek",
        "app.scrapers.djinni",
        "app.scrapers.telegram",
        "feedparser",
        "uvicorn",
        "fastapi",
        "fastapi.middleware.cors",
        "fastapi.staticfiles",
        "pydantic",
        "pydantic_settings",
        "sqlalchemy",
        "sqlalchemy.ext.asyncio",
        "sqlalchemy.dialects.sqlite",
        "aiosqlite",
        "httpx",
        "bs4",
        "lxml",
        "lxml.etree",
        "webview",
        "desktop.api_bridge",
        "desktop.key_store",
        "app.settings_store",
        "app.resume_parser",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "unittest",
        "distutils",
        "setuptools",
        "test",
        "email",
        "pydoc",
    ],
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
    name="vibejob",
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
    icon=str(desktop_dir / "vibejob.ico") if (desktop_dir / "vibejob.ico").exists() else None,
)
