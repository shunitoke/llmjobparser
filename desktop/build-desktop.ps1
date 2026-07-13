#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Push-Location $root

try {
    Write-Host "Building frontend..." -ForegroundColor Cyan
    $frontendDir = Join-Path $root "frontend"
    npm --prefix $frontendDir run build

    Write-Host "Building desktop executable..." -ForegroundColor Cyan
    $backendVenv = Join-Path $root "backend\.venv\Scripts\python.exe"
    & $backendVenv -m pip install -r (Join-Path $root "desktop\requirements.txt")
    & $backendVenv (Join-Path $root "desktop\build.py")

    Write-Host "Build complete: desktop/dist/JobRadar.exe" -ForegroundColor Green
} finally {
    Pop-Location
}
