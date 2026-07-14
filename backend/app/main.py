import asyncio
import json
import logging
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Depends, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import httpx

from app.database import init_db, get_db
from app.models import AppSetting, CandidateJob, SearchSession, Job
from app.schemas import (
    CandidateListResponse,
    JobResponse,
    SearchRequest,
    SearchSessionResponse,
    SearchStatusResponse,
)
from app.resume_parser import ResumeParser
from app.search_service import run_search
from app.settings_store import get_telegram_channels, set_telegram_channels, get_llm_config, set_llm_config
from app.key_manager import key_manager as _key_manager

app = FastAPI(title="vibejob")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cancel_events: Dict[int, asyncio.Event] = {}
_sources_health_cache: Dict[str, Any] = {}
_sources_health_cached_at: float = 0.0

logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/api/health")
async def health():
    return {"status": "ok"}


class GigaChatKeyPayload(BaseModel):
    key: str


@app.post("/api/settings/gigachat-key")
async def set_gigachat_key(payload: GigaChatKeyPayload):
    try:
        _key_manager.set_key(payload.key)
        return {"status": "ok"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})


@app.delete("/api/settings/gigachat-key")
async def delete_gigachat_key():
    _key_manager.clear_key()
    return {"status": "ok"}


class LlmConfigPayload(BaseModel):
    provider: str = "gigachat"
    api_key: str = ""
    model: str = ""


@app.get("/api/settings/llm-config")
async def get_llm_config_api():
    config = await get_llm_config()
    return {
        "provider": config.get("provider", "gigachat"),
        "model": config.get("model", ""),
        "has_key": bool(_key_manager.get_key()),
    }


@app.post("/api/settings/llm-config")
async def set_llm_config_api(payload: LlmConfigPayload):
    _key_manager.set_provider(payload.provider)
    _key_manager.set_model(payload.model)
    if payload.api_key:
        try:
            _key_manager.set_key(payload.api_key)
        except ValueError as e:
            return JSONResponse(status_code=400, content={"detail": str(e)})
    await set_llm_config({"provider": payload.provider, "model": payload.model})
    return {"status": "ok"}


FALLBACK_MODELS = {
    "gigachat": ["GigaChat"],
    "anthropic": ["claude-3-haiku", "claude-3-5-haiku", "claude-sonnet-4"],
    "deepseek": ["deepseek-v4-flash", "deepseek-v4-pro"],
    "gemini": ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"],
}


class LlmModelsPayload(BaseModel):
    provider: str = "gigachat"
    api_key: str = ""


@app.post("/api/settings/llm-models")
async def get_llm_models(payload: LlmModelsPayload):
    """Query provider for available models and return cheapest capable ones."""
    provider = payload.provider
    key = payload.api_key or _key_manager.get_key()
    suggested: list[str] = []

    if provider == "gigachat":
        suggested = ["GigaChat"]

    elif provider == "openai" and key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                r.raise_for_status()
                data = r.json()
                all_ids = [m["id"] for m in data.get("data", [])]
                gpt_ids = [m for m in all_ids
                           if m.startswith("gpt-") and "realtime" not in m and "audio" not in m
                           and "instruct" not in m]
                gpt_ids.sort(key=lambda x: (0 if "mini" in x else 1, x))
                suggested = gpt_ids[:5]
        except Exception:
            pass

    elif provider == "openrouter" and key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                r.raise_for_status()
                models = r.json().get("data", [])
                priced = []
                for m in models:
                    p = m.get("pricing", {})
                    try:
                        cost = float(p.get("prompt", "1") or "1")
                    except (ValueError, TypeError):
                        cost = 1.0
                    priced.append((cost, m["id"]))
                priced.sort(key=lambda x: x[0])
                suggested = [m_id for _, m_id in priced[:8]]
        except Exception:
            pass

    elif provider == "deepseek" and key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.deepseek.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                r.raise_for_status()
                data = r.json()
                all_ids = [m["id"] for m in data.get("data", [])]
                preferred = ["deepseek-v4-flash", "deepseek-v4-pro"]
                found = [m for m in preferred if m in all_ids] or all_ids[:3]
                suggested = found
        except Exception:
            pass

    elif provider == "gemini" and key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    params={"key": key},
                )
                r.raise_for_status()
                data = r.json()
                all_ids = [m["name"].split("/")[-1] for m in data.get("models", [])
                           if "generateContent" in m.get("supportedGenerationMethods", [])]
                flash = [m for m in all_ids if "flash" in m]
                flash.sort()
                suggested = (flash + all_ids)[:5]
        except Exception:
            pass

    elif provider == "anthropic" and key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-3-5-haiku-20241022",
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "ping"}],
                    },
                )
                if r.status_code == 200:
                    suggested = ["claude-3-5-haiku-20241022", "claude-sonnet-4-20250514"]
                elif r.status_code == 404:
                    suggested = ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"]
                else:
                    suggested = list(FALLBACK_MODELS.get("anthropic", []))
        except Exception:
            suggested = list(FALLBACK_MODELS.get("anthropic", []))
    if not suggested:
        suggested = list(FALLBACK_MODELS.get(provider, []))

    return {"provider": provider, "models": suggested, "default": suggested[0] if suggested else ""}


@app.get("/api/settings/telegram-channels")
async def list_telegram_channels():
    return await get_telegram_channels()


class TelegramChannelsPayload(BaseModel):
    channels: list[dict[str, str]]


@app.post("/api/settings/telegram-channels")
async def update_telegram_channels(payload: TelegramChannelsPayload):
    cleaned = []
    seen = set()
    for c in payload.channels:
        name = str(c.get("name", "")).strip().lstrip("@")
        category = str(c.get("category", "vacancy")).strip() or "vacancy"
        if not name or name in seen:
            continue
        seen.add(name)
        cleaned.append({"name": name, "category": category})
    await set_telegram_channels(cleaned)
    return {"status": "ok", "channels": cleaned}


class ResumeTextPayload(BaseModel):
    text: str


@app.post("/api/resume/parse-text")
async def parse_resume_text(payload: ResumeTextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    parser = ResumeParser()
    try:
        result = await parser.parse_text(payload.text)
        return result
    except Exception as e:
        logger.exception("Resume text parsing failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}")
    finally:
        await parser.close()


@app.post("/api/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Cannot determine file type")
    parser = ResumeParser()
    try:
        content = await file.read()
        result = await parser.parse(file.filename, content, file.content_type)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.exception("Resume parsing failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}")
    finally:
        await parser.close()


async def process_search(
    session_id: int, city: str = "", categories: list = None, search_mode: str = "ru"
):
    """Background task to scrape and analyze vacancies."""
    event = asyncio.Event()
    _cancel_events[session_id] = event
    try:
        await run_search(session_id, city, categories or [], search_mode, event)
    finally:
        _cancel_events.pop(session_id, None)


@app.post("/api/search")
async def create_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a new job search."""
    session = SearchSession(user_prompt=request.prompt)
    db.add(session)
    await db.commit()
    await db.refresh(session)

    asyncio.create_task(
        process_search(
            session.id,
            request.city,
            request.categories,
            request.search_mode,
        )
    )

    return {
        "id": session.id,
        "user_prompt": session.user_prompt,
        "generated_queries": None,
        "status": session.status,
        "created_at": session.created_at.isoformat(),
        "jobs": [],
    }


@app.get("/api/search/{session_id}", response_model=SearchSessionResponse)
async def get_search(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get search session with jobs."""
    result = await db.execute(
        select(SearchSession)
        .options(selectinload(SearchSession.jobs))
        .where(SearchSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


@app.get("/api/search/{session_id}/status", response_model=SearchStatusResponse)
async def get_search_status(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get search status."""
    result = await db.execute(
        select(SearchSession)
        .options(selectinload(SearchSession.jobs))
        .where(SearchSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    total = len(session.jobs)
    analyzed = sum(1 for j in session.jobs if j.analyzed_at is not None)
    matched = sum(1 for j in session.jobs if j.is_match is True)

    return SearchStatusResponse(
        id=session.id,
        status=session.status,
        total_jobs=total,
        analyzed_jobs=analyzed,
        matched_jobs=matched,
        current_query=session.current_query or "",
        current_source=session.current_source or "",
        candidates_count=session.candidates_count or 0,
        selected_count=session.selected_count or 0,
        scraped_count=session.scraped_count or 0,
        generated_queries=session.generated_queries,
    )


@app.post("/api/search/{session_id}/cancel")
async def cancel_search(session_id: int, db: AsyncSession = Depends(get_db)):
    """Request cancellation of a running search."""
    result = await db.execute(
        select(SearchSession).where(SearchSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    event = _cancel_events.get(session_id)
    if event:
        event.set()
    if session.status not in ("completed", "cancelled", "failed"):
        session.status = "cancelled"
        await db.commit()
        await db.refresh(session)
    return {"status": "ok", "session_status": session.status}


@app.get("/api/search/{session_id}/candidates", response_model=CandidateListResponse)
async def get_candidates(
    session_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    selected: Optional[bool] = Query(None),
    ready: Optional[bool] = Query(None),
    sort: str = Query("created_at", pattern="^(created_at|title|source)$"),
    db: AsyncSession = Depends(get_db),
):
    """List candidate jobs collected during search."""
    result = await db.execute(
        select(SearchSession).where(SearchSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    stmt = select(CandidateJob).where(CandidateJob.session_id == session_id)
    if selected is not None:
        stmt = stmt.where(CandidateJob.selected == selected)
    if ready is not None:
        # "ready" means the candidate has a non-empty URL and title.
        if ready:
            stmt = stmt.where(CandidateJob.url != "", CandidateJob.title != "")
        else:
            stmt = stmt.where((CandidateJob.url == "") | (CandidateJob.title == ""))

    order_column = {
        "title": CandidateJob.title,
        "source": CandidateJob.source,
    }.get(sort, CandidateJob.created_at)
    stmt = stmt.order_by(desc(order_column))

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar() or 0

    stmt = stmt.offset(offset).limit(limit)
    rows_result = await db.execute(stmt)
    items = rows_result.scalars().all()

    return CandidateListResponse(
        total=total,
        offset=offset,
        limit=limit,
        items=items,
    )


@app.get("/api/sessions", response_model=list[SearchSessionResponse])
async def get_sessions(db: AsyncSession = Depends(get_db)):
    """Get all search sessions."""
    result = await db.execute(
        select(SearchSession).order_by(SearchSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return sessions


@app.get("/api/sources/health")
async def sources_health():
    """Probe each source and return availability status. Cached for 60 seconds."""
    global _sources_health_cache, _sources_health_cached_at

    now = time.time()
    if _sources_health_cache and now - _sources_health_cached_at < 60:
        return _sources_health_cache

    import httpx

    probes = {
        "hh": "https://hh.ru/search/vacancy?text=python",
        "rabota": "https://www.rabota.ru/vacancy/?query=python",
        "superjob": "https://www.superjob.ru/vacancy/search/?keywords=python",
        "remoteok": "https://remoteok.com/api",
        "weworkremotely": "https://weworkremotely.com/remote-jobs.rss",
        "4dayweek": "https://4dayweek.io/remote-jobs",
        "djinni": "https://djinni.co/jobs/?primary_keyword=python&employment=remote",
        "telegram": "https://t.me/s/githubjobs",
    }

    statuses: Dict[str, str] = {}
    timeout = httpx.Timeout(6.0, connect=2.0)

    async def probe_one(name: str, url: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url)
            if response.status_code in (200, 304):
                statuses[name] = "ok"
            elif response.status_code in (403, 429):
                statuses[name] = "blocked"
            else:
                statuses[name] = "unknown"
        except httpx.TimeoutException:
            statuses[name] = "slow"
        except Exception:
            statuses[name] = "unknown"

    await asyncio.gather(
        *[probe_one(name, url) for name, url in probes.items()],
        return_exceptions=True,
    )

    _sources_health_cache = statuses
    _sources_health_cached_at = now
    return statuses


def _debug_static_log(message: str) -> None:
    """Append a debug line to a file so bundled runtime issues can be inspected."""
    try:
        log_dir = Path(os.environ.get("APP_DATA_DIR", tempfile.gettempdir()))
        log_dir.mkdir(parents=True, exist_ok=True)
        with (log_dir / "static-debug.log").open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")
    except Exception:
        pass


def resolve_static_dir() -> Path:
    """Return the directory containing the built frontend.

    In development the dist folder lives next to the backend under
    ``frontend/dist``. When bundled with PyInstaller, the files are extracted
    to ``sys._MEIPASS``; PyInstaller 6+ places user data inside an
    ``_internal`` subdirectory, older versions place them at the MEIPASS root.
    """
    candidates: list[Path] = []
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        meipass = Path(sys._MEIPASS)
        candidates = [
            meipass / "_internal" / "frontend" / "dist",
            meipass / "frontend" / "dist",
        ]
    else:
        project_root = Path(__file__).resolve().parent.parent.parent
        candidates = [
            project_root / "frontend" / "dist",
            Path(__file__).resolve().parent / "static",
        ]

    _debug_static_log(
        f"resolve_static_dir: frozen={getattr(sys, 'frozen', False)} "
        f"meipass={getattr(sys, '_MEIPASS', None)} candidates={[str(c) for c in candidates]}"
    )
    for candidate in candidates:
        _debug_static_log(
            f"  checking {candidate}: exists={candidate.exists()} is_dir={candidate.is_dir() if candidate.exists() else False}"
        )
        if candidate.exists():
            return candidate
    return candidates[0]


# Serve the built frontend at the root.
static_dir = resolve_static_dir()
_debug_static_log(f"static_dir resolved to {static_dir}")
if static_dir.exists():
    try:
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
        _debug_static_log(f"mounted StaticFiles at {static_dir}")
    except Exception as exc:
        _debug_static_log(f"failed to mount StaticFiles: {exc}")
else:
    _debug_static_log("static_dir does not exist; frontend will not be served")
