<p align="center">
  <img src="frontend/public/logo.webp" alt="vibejob" width="48" />
</p>

<h1 align="center">vibejob</h1>

<p align="center">
  AI-powered job search — describe your dream job in plain language, get matched from 8 sources.<br/>
  <a href="https://github.com/shunitoke/llmjobparser/releases/latest">Download for Windows</a>
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/card.mp4" autoplay loop muted playsinline width="720" />
</p>

---

## Features

- **Natural language search** — describe your ideal job however you want
- **8 job sources** — hh.ru, Rabota.ru, SuperJob, RemoteOK, WeWorkRemotely, 4dayweek.io, Djinni, Telegram channels
- **AI-driven matching** — LLM generates queries, selects best vacancies, and analyzes each one
- **Multi-provider AI** — GigaChat, OpenAI, OpenRouter, Anthropic Claude, DeepSeek, Google Gemini
- **Model auto-detection** — picks the cheapest capable model from your provider
- **Resume parsing** — upload PDF/DOC/DOCX/TXT or paste text for deeper matching
- **Desktop app** — single-file Windows EXE, no install required
- **Telegram channels** — configure custom channels to scan for jobs
- **Dark/light theme** — follows OS or manual toggle

## Download

**Windows** — download the latest release:

[**vibejob.exe** (27 MB)](https://github.com/shunitoke/llmjobparser/releases/latest)

No installation needed. Run it and enter your API key on first launch.

## Quick Start

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

Open http://localhost:5173, enter your API key, and you're set.

### Build desktop app

```bash
cd frontend && npm run build
cd ../desktop && pyinstaller vibejob.spec --noconfirm --clean
```

Output: `desktop/dist/vibejob.exe`

## How it works

1. You describe the job you want in natural language
2. LLM generates targeted search queries
3. Scrapers collect vacancies from all enabled sources
4. LLM selects the most promising candidates
5. Selected vacancies are scraped for full details
6. LLM analyzes each vacancy against your requirements
7. You see matched jobs with explanations

## Sources

| Source | Status | Method |
|--------|--------|--------|
| hh.ru | Working | HTML fallback |
| Djinni.co | Working | CSS selectors |
| Rabota.ru | Working | CSS selectors |
| 4dayweek.io | Working | Public API |
| RemoteOK | Working | Public API |
| WeWorkRemotely | Working | RSS feed |
| Telegram | Working | Channel parsing |
| SuperJob | Blocked by captcha | — |

## Tech Stack

**Backend** — Python, FastAPI, SQLAlchemy, SQLite, lxml, httpx

**Frontend** — React 18, Vite, TailwindCSS, shadcn/ui, TypeScript

**Desktop** — PyInstaller (single-file EXE), PyWebview, pywin32 (DPAPI)

## License

MIT
