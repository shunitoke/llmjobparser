import asyncio
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.scrapers.base import BaseScraper, is_blocked_for_global

logger = logging.getLogger(__name__)


class FourDayWeekScraper(BaseScraper):
    name = "4dayweek"
    base_url = "https://4dayweek.io"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        page = 1
        while len(vacancies) < max_results:
            try:
                resp = await self._get(
                    "https://4dayweek.io/api/jobs",
                    params={"q": query, "page": page},
                )
                if not resp:
                    break
                body = resp.json()
                items = body.get("jobs", [])
                if not items:
                    break
                query_tokens = [t.lower() for t in query.split() if t]
                for item in items:
                    if len(vacancies) >= max_results:
                        break
                    v = self._parse_item(item)
                    if v:
                        full_text = " ".join(
                            [v.get("title", ""), v.get("description", ""), v.get("location", "")]
                        )
                        if is_blocked_for_global(full_text):
                            continue
                        if query_tokens and not any(t in full_text.lower() for t in query_tokens):
                            continue
                        vacancies.append(v)
                if not body.get("has_more"):
                    break
                page += 1
                await asyncio.sleep(0.5)
            except Exception as exc:
                logger.warning("[4dayweek] search page %s error: %s", page, exc)
                break
        return vacancies

    def _parse_item(self, item: Dict[str, Any]) -> Optional[Dict]:
        try:
            title = item.get("title", "")
            if not title:
                return None
            slug = item.get("slug", "")
            url = f"https://4dayweek.io/job/{slug}" if slug else ""
            source_id = slug or str(item.get("id", ""))
            company = item.get("company_name", "") or ""
            description = item.get("description") or ""
            locs = item.get("locations") or []
            loc_parts = []
            for l in locs:
                part = l.get("city") or l.get("country") or l.get("continent") or ""
                if part:
                    loc_parts.append(part)
            location = ", ".join(loc_parts)
            published_at = None
            ts = item.get("posted")
            if ts:
                try:
                    published_at = datetime.fromtimestamp(int(ts))
                except Exception:
                    published_at = None
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary="",
                location=location,
                published_at=published_at,
                description=description,
            )
        except Exception as exc:
            logger.warning("[4dayweek] parse item error: %s", exc)
            return None

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = (
                soup.select_one(".job-description")
                or soup.select_one(".description")
                or soup.select_one("[data-qa='job-description']")
            )
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[4dayweek] details error %s: %s", url, exc)
            return None
