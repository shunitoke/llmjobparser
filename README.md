# vibejob

AI-powered job search tool that analyzes vacancies from multiple sources based on your natural language description.

## Features

- **Natural language search**: Describe your ideal job in plain language
- **Multi-provider AI**: GigaChat, OpenAI, or OpenRouter — choose your LLM
- **7 job sources**: hh.ru, Djinni, Rabota, 4dayweek, RemoteOK, WeWorkRemotely, Telegram channels
- **Desktop app**: Windows native app built with PyInstaller + PyWebview
- **Resume parsing**: Upload your CV for AI-driven job matching
- **Telegram channel support**: Configure custom channels to scan for jobs
- **DPAPI key storage**: API keys stored securely via Windows DPAPI

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, lxml
- **Frontend**: React, Vite, TailwindCSS, shadcn/ui, TypeScript
- **AI**: GigaChat (OAuth), OpenAI / OpenRouter (REST)
- **Desktop**: PyInstaller, PyWebview, pywin32 (DPAPI)

## Sources

| Source | Status | Method |
|--------|--------|--------|
| hh.ru | HTML fallback | requests + lxml |
| Djinni.co | Working | CSS selectors |
| Rabota.ru | Working | CSS selectors |
| 4dayweek.io | Working | Public API |
| RemoteOK | Working | Public API |
| WeWorkRemotely | Working | RSS feed |
| Telegram | Working | Channel parsing |
| SuperJob | Offline | Blocked by captcha |

## Quick Start

### Desktop app (Windows)

```bash
pip install -r backend/requirements.txt
cd backend && python desktop/build.py
desktop/dist/vibejob.exe
```

### Dev mode

```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, enter your API key on the first-run screen, and you're set.

## Usage

1. Enter a job description ("напряжная работа чтобы заниматься личными делами")
2. LLM generates search queries and analyzes results
3. Review matched jobs with AI-powered reasoning
4. Optionally upload your resume for deeper matching

## How it works

1. LLM generates search queries from your description
2. Scrapers collect vacancies from all enabled sources
3. LLM analyzes each vacancy against your requirements
4. Results displayed with match score and explanation
