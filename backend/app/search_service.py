import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm_service import LLMService
from app.models import CandidateJob, Job, SearchSession
from app.scrapers.base import BaseScraper, close_scrapers
from app.scrapers import (
    HHScraper,
    RabotaScraper,
    SuperJobScraper,
    RemoteOKScraper,
    WeWorkRemotelyScraper,
    FourDayWeekScraper,
    DjinniScraper,
    TelegramScraper,
)

logger = logging.getLogger(__name__)


def _parse_published_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text)
        except Exception:
            pass
        # Common RSS / HTTP date fallbacks
        for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(text, fmt)
            except Exception:
                pass
    return None


def _get_scrapers(mode: str) -> List[BaseScraper]:
    if mode == "ru":
        return [HHScraper(), RabotaScraper(), SuperJobScraper()]
    if mode == "global":
        return [
            RemoteOKScraper(),
            WeWorkRemotelyScraper(),
            FourDayWeekScraper(),
            DjinniScraper(),
        ]
    if mode == "telegram":
        return [TelegramScraper()]
    return [HHScraper()]


async def _refresh_session(db: AsyncSession, session_id: int) -> Optional[SearchSession]:
    result = await db.execute(select(SearchSession).where(SearchSession.id == session_id))
    return result.scalar_one_or_none()


async def _commit_with_refresh(db: AsyncSession, session: SearchSession) -> None:
    await db.commit()
    await db.refresh(session)


async def run_search(
    session_id: int,
    city: str,
    categories: Optional[List[str]],
    search_mode: str,
    cancel_event: Optional[asyncio.Event],
) -> None:
    from app.database import async_session

    settings = get_settings()
    llm = LLMService()
    scrapers = _get_scrapers(search_mode)

    async with async_session() as db:
        session = await _refresh_session(db, session_id)
        if not session:
            logger.warning("Search session %s not found", session_id)
            return

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # ── Stage: generating_queries ──
        session.status = "generating_queries"
        await _commit_with_refresh(db, session)

        lang = "ru" if search_mode == "ru" else ("en" if search_mode == "global" else "ru")
        try:
            queries = await llm.generate_search_queries(
                session.user_prompt, categories or [], lang=lang
            )
        except Exception as exc:
            logger.exception("[search:%s] query generation failed: %s", session_id, exc)
            session.status = "failed"
            await _commit_with_refresh(db, session)
            return

        session.generated_queries = json.dumps(queries, ensure_ascii=False)
        await _commit_with_refresh(db, session)

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # ── Stage: collecting_candidates ──
        session.status = "collecting_candidates"
        await _commit_with_refresh(db, session)

        candidates: List[Dict[str, Any]] = []
        seen_ids: Set[str] = set()
        candidates_cap = settings.candidates_cap

        try:
            for query in queries:
                if cancel_event and cancel_event.is_set():
                    break
                session.current_query = query
                await _commit_with_refresh(db, session)

                for scraper in scrapers:
                    if cancel_event and cancel_event.is_set():
                        break
                    session.current_source = scraper.name
                    await _commit_with_refresh(db, session)

                    try:
                        found = await scraper.search_vacancies(query, max_results=20, city=city)
                    except Exception as exc:
                        logger.warning(
                            "[search:%s] %s search failed for '%s': %s",
                            session_id,
                            scraper.name,
                            query,
                            exc,
                        )
                        continue

                    for v in found:
                        vid = v.get("hh_id")
                        if not vid or vid in seen_ids:
                            continue
                        seen_ids.add(vid)
                        candidates.append(v)
                        if len(candidates) >= candidates_cap:
                            break
                    session.candidates_count = len(candidates)
                    await _commit_with_refresh(db, session)

                    if len(candidates) >= candidates_cap:
                        break
                if len(candidates) >= candidates_cap:
                    break
        finally:
            await close_scrapers(scrapers)

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # Persist candidates
        try:
            for v in candidates:
                candidate = CandidateJob(
                    session_id=session_id,
                    hh_id=v.get("hh_id", ""),
                    title=v.get("title", ""),
                    company=v.get("company", ""),
                    salary=v.get("salary", ""),
                    location=v.get("location", ""),
                    url=v.get("url", ""),
                    source=v.get("source", ""),
                    category=v.get("category", "vacancy"),
                    selected=False,
                )
                db.add(candidate)
            session.candidates_count = len(candidates)
            await _commit_with_refresh(db, session)
        except Exception as exc:
            logger.exception("[search:%s] failed to save candidates: %s", session_id, exc)
            session.status = "failed"
            await _commit_with_refresh(db, session)
            return

        # ── Stage: selecting ──
        session.status = "selecting"
        await _commit_with_refresh(db, session)

        selected_cap = settings.selected_cap
        try:
            selected_ids = await llm.select_candidate_ids(
                session.user_prompt, candidates, target=selected_cap, lang=lang
            )
        except Exception as exc:
            logger.exception("[search:%s] selection failed: %s", session_id, exc)
            selected_ids = []

        selected_set = set(selected_ids)
        if len(selected_set) < min(20, selected_cap):
            # Fallback: keep first N candidates if LLM selection is too small.
            for v in candidates:
                vid = v.get("hh_id")
                if vid:
                    selected_set.add(vid)
                if len(selected_set) >= selected_cap:
                    break

        try:
            result = await db.execute(
                select(CandidateJob).where(
                    CandidateJob.session_id == session_id,
                    CandidateJob.hh_id.in_(selected_set),
                )
            )
            for row in result.scalars().all():
                row.selected = True
            session.selected_count = len(selected_set)
            await _commit_with_refresh(db, session)
        except Exception as exc:
            logger.warning("[search:%s] failed to mark selected candidates: %s", session_id, exc)

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # ── Stage: scraping_details ──
        session.status = "scraping_details"
        await _commit_with_refresh(db, session)

        selected_candidates = [v for v in candidates if v.get("hh_id") in selected_set]
        details: Dict[str, Dict[str, Any]] = {}
        semaphore = asyncio.Semaphore(8)

        scraper_map = {
            "hh": HHScraper(),
            "rabota": RabotaScraper(),
            "superjob": SuperJobScraper(),
            "remoteok": RemoteOKScraper(),
            "weworkremotely": WeWorkRemotelyScraper(),
            "4dayweek": FourDayWeekScraper(),
            "djinni": DjinniScraper(),
            "telegram": TelegramScraper(),
        }
        detail_scrapers: Dict[str, BaseScraper] = {}

        async def fetch_details(v: Dict) -> None:
            vid = v.get("hh_id")
            url = v.get("url")
            if not vid or not url:
                return
            source = v.get("source", "")
            scraper = detail_scrapers.get(source)
            if scraper is None:
                scraper = scraper_map.get(source)
                if scraper is None:
                    return
                detail_scrapers[source] = scraper
            async with semaphore:
                try:
                    details[vid] = await scraper.get_vacancy_details(url) or {}
                except Exception as exc:
                    logger.warning("[search:%s] details %s failed: %s", session_id, vid, exc)
                    details[vid] = {}

        try:
            await asyncio.gather(*[fetch_details(v) for v in selected_candidates], return_exceptions=True)
        finally:
            await close_scrapers(list(detail_scrapers.values()))

        session.scraped_count = len(details)
        await _commit_with_refresh(db, session)

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # Persist jobs
        try:
            for v in selected_candidates:
                vid = v.get("hh_id")
                detail = details.get(vid, {})
                published_at = v.get("published_at")
                published_dt = _parse_published_at(published_at)
                job = Job(
                    session_id=session_id,
                    hh_id=vid or "",
                    title=v.get("title", ""),
                    company=v.get("company", ""),
                    salary=v.get("salary", ""),
                    location=v.get("location", ""),
                    experience=detail.get("experience", ""),
                    employment_type=detail.get("employment_type", ""),
                    description=detail.get("description", v.get("description", "")),
                    url=v.get("url", ""),
                    published_at=published_dt,
                )
                db.add(job)
            await _commit_with_refresh(db, session)
        except Exception as exc:
            logger.exception("[search:%s] failed to save jobs: %s", session_id, exc)
            session.status = "failed"
            await _commit_with_refresh(db, session)
            return

        if cancel_event and cancel_event.is_set():
            session.status = "cancelled"
            await _commit_with_refresh(db, session)
            return

        # ── Stage: analyzing ──
        session.status = "analyzing"
        await _commit_with_refresh(db, session)

        analyze_semaphore = asyncio.Semaphore(3)

        async def analyze_job(job: Job) -> None:
            async with analyze_semaphore:
                try:
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
                        },
                        lang=lang,
                    )
                    job.is_match = is_match
                    job.match_reason = reason
                    job.analyzed_at = datetime.utcnow()
                    await db.commit()
                except Exception as exc:
                    logger.warning("[search:%s] analyze job %s failed: %s", session_id, job.id, exc)

        try:
            result = await db.execute(select(Job).where(Job.session_id == session_id))
            jobs = result.scalars().all()
            await asyncio.gather(*[analyze_job(job) for job in jobs], return_exceptions=True)
        except Exception as exc:
            logger.exception("[search:%s] analyze stage failed: %s", session_id, exc)

        session.status = "completed" if not (cancel_event and cancel_event.is_set()) else "cancelled"
        await _commit_with_refresh(db, session)
