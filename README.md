# vibejob

AI-powered job search tool that analyzes vacancies from multiple sources based on your natural language description.

## Features

- **Natural language search**: Describe your ideal job in plain language
- **Multi-provider AI**: GigaChat, OpenAI, OpenRouter, Anthropic Claude, DeepSeek, Google Gemini
- **Model auto-detection**: Fetches available models and picks the cheapest capable one
- **8 job sources**: hh.ru, Djinni, Rabota.ru, SuperJob, 4dayweek.io, RemoteOK, WeWorkRemotely, Telegram channels
- **Desktop app**: Windows native app — loads instantly with spinner, backend starts in background
- **Resume parsing**: Upload a file (PDF/DOC/DOCX/TXT) or paste text directly
- **AI-driven matching**: LLM generates search queries, selects best vacancies, and analyzes each one
- **Telegram channel support**: Configure custom channels to scan for jobs
- **DPAPI key storage**: API keys stored securely via Windows DPAPI
- **Theme**: Dynamic dark/light — follows OS or manual toggle, persisted in localStorage

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, lxml, httpx
- **Frontend**: React 18, Vite, TailwindCSS, shadcn/ui, TypeScript
- **AI**: GigaChat (OAuth), OpenAI, Anthropic Claude, DeepSeek, Google Gemini, OpenRouter
- **Desktop**: PyInstaller (single-file EXE), PyWebview, pywin32 (DPAPI)

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
| SuperJob | Blocked by captcha | — |

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

1. Enter a job description ("удалённая работа с гибким графиком")
2. LLM generates search queries and analyzes results from all sources
3. Review matched jobs with AI-powered reasoning
4. Optionally upload your resume or paste its text for deeper matching
5. View parsed resume data (position, skills, experience) at any time

## How it works

1. LLM generates search queries from your description
2. Scrapers collect vacancies from all enabled sources
3. LLM selects the most promising candidates from the raw list
4. Selected vacancies are scraped for full details (description, experience, etc.)
5. LLM analyzes each vacancy against your requirements
6. Results displayed with match status and explanation
