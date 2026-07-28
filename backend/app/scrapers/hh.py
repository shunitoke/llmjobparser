import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_SALARY_RE = re.compile(
    r"(?:от\s+)?(\d[\d\s]*(?:\s*[–—-]\s*\d[\d\s]*)?)\s*"
    r"(?:₽|руб(?:le[sv])?|RUB|USD|EUR|₸|сом(?:они)?|сум(?:ок)?)"
    r"(?:\s*,?\s*(?:за\s+\w+|в\s+\w+|gross|net|до\s+вычета\s+налогов))?",
    re.IGNORECASE,
)

CURRENCY_MAP = {
    "₽": "₽", "руб": "₽", "rub": "₽", "rur": "₽",
    "$": "$", "usd": "$",
    "€": "€", "eur": "€",
    "₸": "₸", "kzt": "₸",
}


class HHScraper(BaseScraper):
    name = "hh"
    base_url = "https://hh.ru"
    _resolved_base: Optional[str] = None

    CITY_IDS = {
        "москва": 1, "питер": 2, "спб": 2, "санкт-петербург": 2,
        "новосибирск": 4, "екатеринбург": 3, "казань": 88,
        "нижний новгород": 66, "челябинск": 104, "самара": 78,
        "омск": 68, "ростов-на-дону": 76, "уфа": 99,
        "красноярск": 54, "воронеж": 26, "пермь": 72, "волгоград": 24,
    }

    async def _get_base_url(self) -> str:
        if self._resolved_base:
            return self._resolved_base
        try:
            resp = await self.client.get(
                f"{self.base_url}/search/vacancy",
                params={"text": "test", "per_page": 1},
                follow_redirects=False,
            )
            if resp.is_redirect:
                location = resp.headers.get("location", "")
                if location.startswith("http"):
                    from urllib.parse import urlparse
                    parsed = urlparse(location)
                    self._resolved_base = f"{parsed.scheme}://{parsed.netloc}"
                else:
                    self._resolved_base = self.base_url
            else:
                self._resolved_base = self.base_url
        except Exception:
            self._resolved_base = self.base_url
        logger.info("[hh] resolved base URL: %s", self._resolved_base)
        return self._resolved_base

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = "",
        constraints: Optional[Dict] = None,
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        page = 0
        c = constraints or {}
        base = await self._get_base_url()

        while len(vacancies) < max_results:
            params: Dict = {
                "text": query,
                "page": page,
                "items_on_page": 20,
                "order_by": "publication_time",
            }
            if city:
                city_lower = city.lower().strip()
                if city_lower in self.CITY_IDS:
                    params["area"] = self.CITY_IDS[city_lower]
                else:
                    params["text"] = f"{query} {city}"

            salary_from = c.get("salary_from")
            if salary_from and isinstance(salary_from, (int, float)) and salary_from > 0:
                params["salary"] = int(salary_from)
                params["only_with_salary"] = "true"
                params["currency_code"] = c.get("currency", "RUB")

            schedule = c.get("schedule")
            remote = c.get("remote")
            if schedule:
                params["schedule"] = schedule
            elif remote:
                params["schedule"] = "remote"

            employment = c.get("employment")
            if employment:
                params["employment"] = employment

            experience = c.get("experience")
            if experience:
                params["experience"] = experience

            try:
                resp = await self._get(f"{base}/search/vacancy", params=params)
                if not resp:
                    break
                soup = self._safe_soup(resp.text)
                cards = soup.select("[data-qa='vacancy-serp__vacancy']")
                if not cards:
                    break

                for card in cards:
                    if len(vacancies) >= max_results:
                        break
                    v = self._parse_card(card)
                    if v:
                        vacancies.append(v)

                page += 1
                await asyncio.sleep(0.5)
            except Exception as exc:
                logger.warning("[hh] search page %s error: %s", page, exc)
                break

        return vacancies

    def _parse_card(self, card) -> Optional[Dict]:
        try:
            title_elem = (
                card.select_one("[data-qa='serp-item__title']")
                or card.select_one("a[class*='title']")
                or card.select_one("a[href*='/vacancy/']")
            )
            if not title_elem:
                return None

            title = title_elem.get_text(strip=True)
            url = title_elem.get("href", "")
            if url and not url.startswith("http"):
                url = (self._resolved_base or self.base_url) + url
            source_id = self._extract_id(url)

            company_elem = (
                card.select_one("[data-qa='vacancy-serp__vacancy-employer']")
                or card.select_one("[class*='company-name']")
            )
            company = company_elem.get_text(strip=True) if company_elem else ""

            salary = self._extract_salary(card)

            location_elem = (
                card.select_one("[data-qa='vacancy-serp__vacancy-address']")
                or card.select_one("[class*='address']")
                or card.select_one("[class*='metro']")
            )
            location = location_elem.get_text(strip=True) if location_elem else ""
            if not location:
                for el in card.select("[class*='metro'], [class*='address'], [class*='location']"):
                    txt = el.get_text(strip=True)
                    if txt and len(txt) < 150:
                        location = txt
                        break

            date_elem = (
                card.select_one("[data-qa='vacancy-serp__vacancy-date']")
                or card.select_one("time")
                or card.select_one("[class*='date']")
            )
            published_at = ""
            if date_elem:
                dt = date_elem.get("datetime") or date_elem.get_text(strip=True)
                if dt:
                    published_at = dt
            if not published_at:
                published_at = datetime.utcnow().isoformat()

            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary=salary,
                location=location,
                published_at=published_at,
            )
        except Exception as exc:
            logger.warning("[hh] parse card error: %s", exc)
            return None

    def _extract_salary(self, card) -> str:
        text = card.get_text(" ", strip=True)
        m = _SALARY_RE.search(text)
        if m:
            return m.group(0).strip()
        return ""

    def _extract_id(self, url: str) -> str:
        match = re.search(r"/vacancy/(\d+)", url)
        return match.group(1) if match else re.sub(r"\D", "", url)[:20]

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = (
                soup.select_one("[data-qa='vacancy-description']")
                or soup.select_one(".vacancy-description")
            )
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            experience_elem = soup.select_one("[data-qa='vacancy-experience']")
            experience = experience_elem.get_text(strip=True) if experience_elem else ""
            employment_elem = soup.select_one("[data-qa='vacancy-view-employment-mode']")
            employment_type = employment_elem.get_text(strip=True) if employment_elem else ""
            return {
                "description": description,
                "experience": experience,
                "employment_type": employment_type,
            }
        except Exception as exc:
            logger.warning("[hh] details error %s: %s", url, exc)
            return None
