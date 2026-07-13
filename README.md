# LLM Job Parser

AI-powered job search tool that analyzes hh.ru vacancies based on your natural language description.

## Features

- **Natural language search**: Describe your ideal job in plain language
- **AI-powered analysis**: Uses LLM to understand your requirements and match vacancies
- **hh.ru scraping**: Automatically collects vacancies from hh.ru
- **Smart matching**: Analyzes job descriptions for implicit requirements

## Tech Stack

- **Backend**: Python, FastAPI, SQLite, BeautifulSoup
- **Frontend**: React, Vite, TailwindCSS, shadcn/ui
- **AI**: GigaChat API (Sber)

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

Create `.env` file in `backend` folder:
```
GIGACHAT_AUTH_KEY=your_gigachat_authorization_key_here
```

Run backend:
```bash
cd backend
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Start backend on http://localhost:8000
2. Start frontend on http://localhost:5173
3. Enter your job description (e.g., "ненапряжная работа чтобы заниматься личными делами")
4. Wait for AI to analyze vacancies
5. Review matched jobs

## How it works

1. You enter a natural language description of your ideal job
2. LLM generates search queries for hh.ru
3. Scraper collects ~50 vacancies from hh.ru
4. LLM analyzes each vacancy against your requirements
5. Results are displayed with match explanations
