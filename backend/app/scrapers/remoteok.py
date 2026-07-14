import logging
from datetime import datetime
from typing import Dict, List, Optional

from app.scrapers.base import BaseScraper, is_blocked_for_global

logger = logging.getLogger(__name__)


class RemoteOKScraper(BaseScraper):
    name = "remoteok"
    base_url = "https://remoteok.com"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        query_tokens = [t.lower() for t in query.split() if t]
        try:
            api_url = "https://remoteok.com/api"
            params = {"tag": query.replace(" ", "-")}
            resp = await self._get(api_url, params=params)
            if not resp:
                return vacancies
            data = resp.json()
            if not isinstance(data, list):
                return vacancies
            for item in data:
                if not isinstance(item, dict):
                    continue
                if item.get("slug") in (None, ""):
                    continue
                if len(vacancies) >= max_results:
                    break
                v = self._parse_item(item)
                if not v:
                    continue
                full_text = " ".join(
                    [v.get("title", ""), v.get("description", ""), v.get("location", "")]
                )
                if is_blocked_for_global(full_text):
                    continue
                if query_tokens and not any(t in full_text.lower() for t in query_tokens):
                    continue
                vacancies.append(v)
        except Exception as exc:
            logger.warning("[remoteok] search error: %s", exc)
        return vacancies

    def _parse_item(self, item: Dict) -> Optional[Dict]:
        try:
            slug = item.get("slug", "")
            source_id = str(item.get("id", slug))
            title = item.get("position", "") or item.get("title", "")
            url = f"https://remoteok.com/remote-jobs/{slug}" if slug else ""
            company = item.get("company", "")
            salary = item.get("salary", "") or ""
            location = item.get("location", "") or ""
            description = item.get("description", "") or ""
            published_at = ""
            if item.get("date"):
                try:
                    published_at = datetime.fromtimestamp(int(item["date"])).isoformat()
                except Exception:
                    published_at = str(item["date"])
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary=salary,
                location=location,
                published_at=published_at,
                description=description,
            )
        except Exception as exc:
            logger.warning("[remoteok] parse item error: %s", exc)
            return None

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = soup.select_one(".description") or soup.select_one(".job_description")
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[remoteok] details error %s: %s", url, exc)
            return None
