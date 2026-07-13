#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Push-Location $root

try {
    Write-Host "Building desktop executable (includes frontend build)..." -ForegroundColor Cyan
    $backendVenv = Join-Path $root "backend\.venv\Scripts\python.exe"
    & $backendVenv -m pip install -r (Join-Path $root "desktop\requirements.txt")
    & $backendVenv (Join-Path $root "desktop\build.py")

    Write-Host "Build complete: desktop/dist/JobRadar.exe" -ForegroundColor Green
} finally {
    Pop-Location
}
