import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

import feedparser

from app.scrapers.base import BaseScraper, is_blocked_for_global

logger = logging.getLogger(__name__)


class WeWorkRemotelyScraper(BaseScraper):
    name = "weworkremotely"
    base_url = "https://weworkremotely.com"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        try:
            resp = await self._get("https://weworkremotely.com/remote-jobs.rss")
            if not resp:
                return vacancies
            feed = feedparser.parse(resp.text)
            query_tokens = [t.lower() for t in query.split() if t]
            for entry in feed.entries:
                if len(vacancies) >= max_results:
                    break
                title = entry.get("title", "")
                if query_tokens and not any(t in title.lower() for t in query_tokens):
                    continue
                v = self._parse_entry(entry)
                if v:
                    full_text = " ".join(
                        [v.get("title", ""), v.get("description", ""), v.get("location", "")]
                    )
                    if is_blocked_for_global(full_text):
                        continue
                    vacancies.append(v)
        except Exception as exc:
            logger.warning("[weworkremotely] search error: %s", exc)
        return vacancies

    def _parse_entry(self, entry) -> Optional[Dict]:
        try:
            title = entry.get("title", "")
            url = entry.get("link", "")
            source_id = self._extract_id(url)
            company = ""
            if " - " in title:
                company, title = title.split(" - ", 1)
            summary = entry.get("summary", "")
            published_at = ""
            if entry.get("published_parsed"):
                published_at = datetime(*entry.published_parsed[:6]).isoformat()
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary="",
                location="",
                published_at=published_at,
                description=summary,
            )
        except Exception as exc:
            logger.warning("[weworkremotely] parse entry error: %s", exc)
            return None

    def _extract_id(self, url: str) -> str:
        match = re.search(r"/remote-jobs/(.+)$", url)
        return match.group(1) if match else re.sub(r"\W", "", url)[:30]

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = soup.select_one(".listing-container") or soup.select_one(".job-description")
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[weworkremotely] details error %s: %s", url, exc)
            return None
