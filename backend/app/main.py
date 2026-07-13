from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import json
import asyncio
from datetime import datetime
from pathlib import Path

from app.database import init_db, get_db
from app.models import SearchSession, Job
from app.schemas import SearchRequest, SearchSessionResponse, SearchStatusResponse, JobResponse
from app.scraper import HHScraper
from app.llm_service import LLMService

app = FastAPI(title="LLM Job Parser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/api/health")
async def health():
    return {"status": "ok"}


async def process_search(session_id: int, city: str = "", categories: list = None):
    """Background task to scrape and analyze vacancies"""
    from app.database import async_session
    
    async with async_session() as db:
        result = await db.execute(
            select(SearchSession).where(SearchSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return
        
        session.status = "generating_queries"
        await db.commit()
        
        llm = LLMService()
        queries = await llm.generate_search_queries(session.user_prompt, categories or [])
        session.generated_queries = json.dumps(queries, ensure_ascii=False)
        session.status = "scraping"
        await db.commit()
        
        scraper = HHScraper()
        all_vacancies = []
        seen_ids = set()
        
        try:
            for query in queries:
                session.current_query = query
                await db.commit()
                
                vacancies = await scraper.scrape_vacancies_with_details(query, max_results=20, city=city)
                for v in vacancies:
                    if v.get("hh_id") and v["hh_id"] not in seen_ids:
                        seen_ids.add(v["hh_id"])
                        all_vacancies.append(v)
                        session.scraped_count = len(all_vacancies)
                        await db.commit()
                        if len(all_vacancies) >= 50:
                            break
                if len(all_vacancies) >= 50:
                    break
        finally:
            await scraper.close()
        
        for v in all_vacancies:
            job = Job(
                session_id=session_id,
                hh_id=v.get("hh_id", ""),
                title=v.get("title", ""),
                company=v.get("company", ""),
                salary=v.get("salary", ""),
                location=v.get("location", ""),
                experience=v.get("experience", ""),
                employment_type=v.get("employment_type", ""),
                description=v.get("description", ""),
                url=v.get("url", ""),
            )
            db.add(job)
        await db.commit()
        
        session.status = "analyzing"
        await db.commit()
        
        result = await db.execute(
            select(Job).where(Job.session_id == session_id)
        )
        jobs = result.scalars().all()
        
        for job in jobs:
            is_match, reason = await llm.analyze_vacancy(
                session.user_prompt,
                {
                    "title": job.title,
                    "company": job.company,
                    "salary": job.salary,
                    "location": job.location,
                    "experience": job.experience,
                    "employment_type": job.employment_type,
                    "description": job.description,
                }
            )
            job.is_match = is_match
            job.match_reason = reason
            job.analyzed_at = datetime.utcnow()
            await db.commit()
        
        session.status = "completed"
        await db.commit()


@app.post("/api/search")
async def create_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Start a new job search"""
    session = SearchSession(user_prompt=request.prompt)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    session_id = session.id
    user_prompt = session.user_prompt
    status = session.status
    created_at = session.created_at
    
    asyncio.create_task(process_search(session_id, request.city, request.categories))
    
    return {
        "id": session_id,
        "user_prompt": user_prompt,
        "generated_queries": None,
        "status": status,
        "created_at": created_at.isoformat(),
        "jobs": []
    }


@app.get("/api/search/{session_id}", response_model=SearchSessionResponse)
async def get_search(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get search session with jobs"""
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
    """Get search status"""
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
        scraped_count=session.scraped_count or 0,
        generated_queries=session.generated_queries,
    )


@app.get("/api/sessions", response_model=list[SearchSessionResponse])
async def get_sessions(db: AsyncSession = Depends(get_db)):
    """Get all search sessions"""
    result = await db.execute(
        select(SearchSession).order_by(SearchSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return sessions


static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
