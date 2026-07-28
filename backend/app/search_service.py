import asyncio
import json
import logging
import re as _re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm_service import LLMService, sanitize_description
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


_RU_MONTHS = {
    "янв": 1, "января": 1, "фев": 2, "февраля": 2, "мар": 3, "марта": 3,
    "апр": 4, "апреля": 4, "май": 5, "мая": 5,
    "июн": 6, "июня": 6, "июл": 7, "июля": 7,
    "авг": 8, "августа": 8, "сен": 9, "сентября": 9,
    "окт": 10, "октября": 10, "ноя": 11, "ноября": 11,
    "дек": 12, "декабря": 12,
}


def _parse_published_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text)
        except Exception:
            pass
        for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(text, fmt)
            except Exception:
                pass
        logger.debug("[parse_date] failed to parse: %r", text)
        now = datetime.now()
        # Dot-separated dates: "28.07.2025", "28.07.25", "Обновлено 28.07.2025"
        m = _re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", text)
        if m:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day)
            except ValueError:
                pass
        # Dot-separated without year: "28.07"
        m = _re.search(r"(\d{1,2})\.(\d{1,2})(?!\.\d)", text)
        if m:
            day, month = int(m.group(1)), int(m.group(2))
            try:
                return datetime(now.year, month, day)
            except ValueError:
                pass
        lower = text.lower()
        # "Только что", "только что"
        if lower in ("только что", "just now"):
            return now
        # "Сегодня", "Сегодня, 28 июля", "сегодня 14:30"
        if lower.startswith("сегодня") or lower.startswith("today"):
            rest = lower.split(",", 1)[-1].strip() if "," in lower else ""
            if rest:
                parsed = _parse_ru_absolute_date(rest, now)
                if parsed:
                    return parsed
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        # "Вчера", "Вчера, 27 июля"
        if lower.startswith("вчера") or lower.startswith("yesterday"):
            rest = lower.split(",", 1)[-1].strip() if "," in lower else ""
            yesterday = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
            if rest:
                parsed = _parse_ru_absolute_date(rest, now)
                if parsed:
                    return parsed
            return yesterday
        # "позавчера"
        if lower in ("позавчера",):
            return now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=2)
        # "неделю назад", "полчаса назад" — word-based relatives
        word_relatives = {
            "неделю": timedelta(weeks=1), "недели": timedelta(weeks=1), "недель": timedelta(weeks=1),
            "полчаса": timedelta(minutes=30), "полчасов": timedelta(minutes=30),
            "час": timedelta(hours=1), "часа": timedelta(hours=2), "часов": timedelta(hours=3),
        }
        for word, delta in word_relatives.items():
            if word in lower and "назад" in lower:
                return now - delta
        # "N минут/часов/дней/недель/месяцев/лет назад"
        m = _re.match(
            r"(\d+)\s*(минут[уы]?|час[аов]*|дн[ьяе]*|день|дней|недел[ьюя]*|месяц[аев]*|год[ау]*|лет)",
            lower,
        )
        if m and "назад" in lower:
            n = int(m.group(1))
            unit = m.group(2)
            if "минут" in unit:
                delta = timedelta(minutes=n)
            elif "час" in unit:
                delta = timedelta(hours=n)
            elif any(u in unit for u in ("дн", "день", "дня", "дней")):
                delta = timedelta(days=n)
            elif any(u in unit for u in ("недел", "неделю")):
                delta = timedelta(weeks=n)
            elif any(u in unit for u in ("месяц", "мес")):
                delta = timedelta(days=n * 30)
            elif any(u in unit for u in ("год", "года", "лет")):
                delta = timedelta(days=n * 365)
            else:
                delta = timedelta(days=n)
            return now - delta
        # Russian absolute dates: "28 июля", "15 авг 2025"
        parsed = _parse_ru_absolute_date(lower, now)
        if parsed:
            return parsed
    return None


def _parse_ru_absolute_date(text: str, now: datetime) -> Optional[datetime]:
    m = _re.search(r"(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?", text)
    if m:
        day = int(m.group(1))
        month_name = m.group(2)
        year = int(m.group(3)) if m.group(3) else now.year
        month = _RU_MONTHS.get(month_name)
        if month and 1 <= day <= 31:
            try:
                return datetime(year, month, day)
            except ValueError:
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
    """Wrapper: guarantee the session never gets stuck in a non-terminal state."""
    try:
        await _run_search_inner(session_id, city, categories, search_mode, cancel_event)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("[search:%s] unhandled error in run_search", session_id)
        try:
            from app.database import async_session

            async with async_session() as db:
                session = await _refresh_session(db, session_id)
                if session and session.status not in ("completed", "cancelled"):
                    session.status = "failed"
                    session.error_message = sanitize_description(
                        f"Внутренняя ошибка: {type(exc).__name__}: {str(exc)[:300]}"
                    )
                    session.current_query = None
                    session.current_source = None
                    await _commit_with_refresh(db, session)
        except Exception:
            logger.exception("[search:%s] failed to mark session as failed", session_id)


async def _run_search_inner(
    session_id: int,
    city: str,
    categories: Optional[List[str]],
    search_mode: str,
    cancel_event: Optional[asyncio.Event],
) -> None:
    from app.database import async_session

    settings = get_settings()
    llm = LLMService()
    llm.reset_gigachat_model()  # also sets current_model for status UI
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

        # Run constraint extraction + query generation in parallel with a hard timeout,
        # so a slow/unreachable LLM can never hang the pipeline forever.
        async def _extract() -> Dict[str, Any]:
            try:
                return await llm.extract_search_constraints(
                    session.user_prompt, lang=lang, city=city
                )
            except Exception as exc:
                logger.warning("[search:%s] constraint extraction failed: %s", session_id, exc)
                return {}

        async def _queries() -> List[str]:
            return await llm.generate_search_queries(
                session.user_prompt, categories or [], lang=lang, city=city
            )

        constraints: Dict[str, Any] = {}
        queries: List[str] = []
        try:
            constraints, queries = await asyncio.wait_for(
                asyncio.gather(_extract(), _queries()), timeout=150.0
            )
            logger.info("[search:%s] extracted constraints: %s", session_id, constraints)
        except asyncio.TimeoutError:
            logger.error("[search:%s] LLM stage timed out after 150s", session_id)
            session.status = "failed"
            session.error_message = sanitize_description(
                "Нейросеть не отвечает дольше 150 сек. Проверьте API-ключ, модель и интернет."
            )
            await _commit_with_refresh(db, session)
            return
        except Exception as exc:
            logger.exception("[search:%s] query generation failed: %s", session_id, exc)
            session.status = "failed"
            session.error_message = sanitize_description(f"Ошибка нейросети: {str(exc)[:300]}")
            await _commit_with_refresh(db, session)
            return

        if not queries:
            logger.error("[search:%s] LLM returned no queries", session_id)
            session.status = "failed"
            session.error_message = sanitize_description(
                "Нейросеть не вернула поисковые запросы. Попробуйте другую модель или переформулируйте запрос."
            )
            await _commit_with_refresh(db, session)
            return

        # If LLM extracted a different city, prefer it
        effective_city = city
        if not effective_city and constraints.get("city"):
            effective_city = str(constraints["city"])

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

        async def _search_one(scraper, query: str) -> List[Dict]:
            try:
                return await scraper.search_vacancies(
                    query, max_results=30, city=effective_city,
                    constraints=constraints,
                )
            except Exception as exc:
                logger.warning(
                    "[search:%s] %s search failed for '%s': %s",
                    session_id, scraper.name, query, exc,
                )
                return []

        try:
            for query in queries:
                if cancel_event and cancel_event.is_set():
                    break
                session.current_query = query
                await _commit_with_refresh(db, session)

                results = await asyncio.gather(
                    *[_search_one(s, query) for s in scrapers],
                    return_exceptions=True,
                )
                for found in results:
                    if isinstance(found, Exception) or not isinstance(found, list):
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
                    if len(candidates) >= candidates_cap:
                        break
                await _commit_with_refresh(db, session)
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
                    published_at=_parse_published_at(v.get("published_at")),
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
                session.user_prompt, candidates, target=selected_cap, lang=lang, city=effective_city
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

        # Persist jobs (both selected and rejected candidates)
        try:
            for v in candidates:
                vid = v.get("hh_id")
                is_selected = vid in selected_set
                detail = details.get(vid, {})
                published_at = v.get("published_at")
                published_dt = _parse_published_at(published_at)
                job_reason = None
                if not is_selected:
                    job_reason = "Не прошли предварительный отбор (не попали в шортлист)"
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
                    selected=is_selected,
                    rejection_reason=job_reason,
                )
                db.add(job)
            session.selected_count = len(selected_set)
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

        BATCH_SIZE = 5

        try:
            result = await db.execute(select(Job).where(Job.session_id == session_id))
            jobs = result.scalars().all()
            for i in range(0, len(jobs), BATCH_SIZE):
                if cancel_event and cancel_event.is_set():
                    break
                batch = jobs[i:i + BATCH_SIZE]
                vacancies = [
                    {
                        "title": j.title,
                        "company": j.company,
                        "salary": j.salary,
                        "location": j.location,
                        "experience": j.experience,
                        "employment_type": j.employment_type,
                        "description": j.description,
                    }
                    for j in batch
                ]
                try:
                    results = await llm.analyze_vacancies_batch(
                        session.user_prompt, vacancies, city=effective_city, lang=lang,
                    )
                    for job, (is_match, reason) in zip(batch, results):
                        job.is_match = is_match
                        job.match_reason = reason
                        job.analyzed_at = datetime.utcnow()
                    await db.commit()
                except Exception as exc:
                    logger.warning("[search:%s] batch analyze failed: %s", session_id, exc)
        except Exception as exc:
            logger.exception("[search:%s] analyze stage failed: %s", session_id, exc)

        session.status = "completed" if not (cancel_event and cancel_event.is_set()) else "cancelled"
        await _commit_with_refresh(db, session)
