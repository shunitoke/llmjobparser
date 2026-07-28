# AGENTS.md — instructions for AI coding agents

## Project

vibejob — desktop app (Python PyWebview + FastAPI backend + React frontend).
Windows EXE and Linux ELF via PyInstaller.

## Build

| Platform | Command | Output |
|----------|---------|--------|
| Windows desktop | `backend\.venv\Scripts\python.exe desktop\build.py` | `desktop/dist/vibejob.exe` |
| Linux desktop | `bash desktop/build-desktop.sh` | `desktop/dist/vibejob` |
| Frontend only | `npm run build` (in `frontend/`) | `frontend/dist/` |

Note: `desktop\build.py` also builds the frontend (calls `npm run build` internally).
On Windows the build script is `desktop\build-desktop.ps1` (installs pip deps first).
Linux build requires system deps: `libgtk-3-dev libwebkit2gtk-4.1-dev libgirepository1.0-dev gir1.2-gtk-3.0 gir1.2-webkit2-4.1 pkg-config`.

## Development

```bash
# Backend
Set-Location backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend dev server
Set-Location frontend
npm run dev                 # -> http://localhost:5173

# Desktop (dev mode, no PyInstaller)
$env:PYTHONPATH = "backend;desktop"
backend\.venv\Scripts\python.exe desktop\main.py
```

Linux equivalents: use `backend/.venv/bin/python`, path separator `:`.

## Test

```bash
# Backend tests
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/ -v

# Desktop tests
$env:PYTHONPATH = "backend;desktop"
.\.venv\Scripts\python.exe -m pytest desktop/tests/ -v
```

## Lint / typecheck

```bash
# Frontend (ESLint + tsc)
Set-Location frontend
npm run lint
npm run build               # includes `tsc` typecheck

# Python — no linter configured in project
```

## CI

File: `.github/workflows/build-desktop-linux.yml`
Trigger: push (paths: desktop/, backend/, frontend/), manual dispatch
Output: artifact `vibejob-linux-x64` (42 MB)

## Key files

| Path | Purpose |
|------|---------|
| `backend/app/` | FastAPI app, scrapers, LLM service, database |
| `frontend/src/` | React + Tailwind + shadcn/ui |
| `desktop/` | PyWebview shell, key storage, build scripts |
| `desktop/vibejob.spec` | PyInstaller config |
| `Dockerfile` | Multi-stage: frontend build → Python uvicorn |

## Important notes

### Before build
- Close ALL running `vibejob.exe` processes — they lock `dist/vibejob.exe` and `vibejob-data/jobs.db`
- `backend\.venv` must exist with correct Python path; if path is wrong (user `timof` → `shuni`), delete venv, run `winget install Python.Python.3.12`, then recreate

### GigaChat
- **Model IDs**: `GigaChat-2` (Lite), `GigaChat-2-Pro`, `GigaChat-2-Max`, `GigaChat-3-Ultra`
  - Aliases for backward compat: `GigaChat`→`GigaChat-2`, `GigaChat-Pro`→`GigaChat-2-Pro`, etc.
- **Rotation**: Lite→Pro→Max→Ultra on quota/404. Starts from preferred model in settings (default Lite).
- **OAuth**: `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth` with `Authorization: Basic <key>`. Sber docs say Basic; Bearer also works historically.
- **Chat URL**: `https://api.giga.chat/v1/chat/completions` (new endpoint since 17 Jul 2026).
- **404 = invalid model ID** (not bad URL). The endpoint itself is fine.

### Key storage
- Key is stored as **plain text** in `vibejob-data/vibejob.key` (NOT DPAPI).
- `_migrate_dpapi()` exists only for migration from old DPAPI keys — do NOT re-introduce DPAPI.
- **Keys must be ASCII-only** — `sanitize_key()` strips whitespace, invisible chars (including non-breaking space `\xa0` and BOM `\ufeff`), and quotes. Non-ASCII → clear error: "Скопируйте заново только сам ключ".
- `key_store.set_key()` now sanitizes before saving to disk (was saving raw), preventing invisible chars from persisting in the key file silently.

### LLM error handling
- GigaChat returns `{"code":4,"message":"Can't decode 'Authorization' header"}` for bad keys via HTTP 400. Backend now returns "Неверный ключ GigaChat" instead of generic "Ошибка нейросети".
- GigaChat returns error text in HTTP 200/400 response body (e.g. `ERROR: Cannot read "image.png"…`). httpx includes this in `str(exc)`. **ALL `error_message` fields MUST go through `sanitize_description()`**.
- `sanitize_description()` regex `^ERROR:\s*Cannot\s+read.*$` (MULTILINE+IGNORECASE) strips these lines.
- `analyze_vacancy()` fails loudly (`status="failed"`) — never silently degrade analysis.
- `search_service.py` top-level exception guard prevents infinite spinner (always hits terminal status).

### Search constraints
- `extract_search_constraints()` uses LLM to extract filters from free text (city, salary, remote, schedule, employment, experience). Handles typos (`питер`→`Санкт-Петербург`).
- Constraints + queries run in **parallel** (asyncio.gather, 150s timeout).
- `hh.py` maps constraints to URL params (`salary`, `schedule`, `employment`, `experience`, `area`).

### Search pipeline resilience
- `generate_search_queries()` catches **all** exceptions (HTTP/auth/network/timeout) and falls back to `[user_prompt]` as the search query. If the LLM call fails, search continues with the user's raw prompt instead of failing entirely.
- `extract_search_constraints()` failures are non-fatal (returns `{}`, search proceeds without structured filters).

### Frontend details
- Footer: `sticky bottom-0` — always visible.
- Clippy: `clippy-pop` bounce animation, first show 5s after mount, context-aware tips.
- Failed search: error card with `status.error` — never blank screen.
- Model display: `formatModelLabel()` → `GigaChat 2 Lite`, etc.
- Job card: no "Почему подходит:" prefix on match_reason.

### Database
- `error_message` column: lightweight migration in `init_db()` (PRAGMA table_info → ALTER TABLE if missing).
