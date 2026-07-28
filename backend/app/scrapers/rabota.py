import asyncio
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class RabotaScraper(BaseScraper):
    name = "rabota"
    base_url = "https://www.rabota.ru"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = "",
        constraints: Optional[Dict] = None,
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        page = 1
        c = constraints or {}
        salary_from = c.get("salary_from")
        schedule = c.get("schedule")
        employment = c.get("employment")
        remote = c.get("remote")
        while len(vacancies) < max_results and page <= 10:
            params: Dict = {"query": query, "page": page}
            if city:
                params["city"] = city
            if salary_from and isinstance(salary_from, (int, float)) and salary_from > 0:
                params["salary_from"] = int(salary_from)
            if schedule == "remote" or remote:
                params["remote"] = "1"
            if employment:
                params["employment"] = employment
            try:
                resp = await self._get(
                    "https://www.rabota.ru/vacancy/", params=params
                )
                if not resp:
                    break
                soup = self._safe_soup(resp.text)
                cards = (
                    soup.select(".vacancy-preview-card")
                    or soup.select(".r-serp__item_vacancy")
                    or soup.select(".vacancy-card")
                )
                if not cards:
                    cards = soup.select("[data-qa='vacancy']")
                if not cards:
                    cards = soup.select(".vacancy-serp__vacancy, .vacancy-list-item")
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
                logger.warning("[rabota] search page %s error: %s", page, exc)
                break
        return vacancies

    def _parse_card(self, card) -> Optional[Dict]:
        try:
            title_elem = (
                card.select_one(".vacancy-preview-card__title_border")
                or card.select_one("a[href*='/vacancy/']")
                or card.select_one("h3 a")
            )
            if not title_elem:
                return None
            title = title_elem.get_text(strip=True)
            href = title_elem.get("href", "")
            url = urljoin(self.base_url, href)
            source_id = self._extract_id(url)
            company_elem = (
                card.select_one(".vacancy-preview-card__company-name")
                or card.select_one(".vacancy-card__company")
                or card.select_one("[data-qa='vacancy-employer']")
            )
            company = company_elem.get_text(strip=True) if company_elem else ""
            company = re.split(r"Проверено|проверен|аккаунт", company, maxsplit=1)[0].strip()
            salary_elem = (
                card.select_one(".vacancy-preview-card__salary")
                or card.select_one(".vacancy-card__salary")
                or card.select_one("[data-qa='vacancy-salary']")
            )
            salary = salary_elem.get_text(strip=True) if salary_elem else ""
            location_elem = (
                card.select_one(".vacancy-preview-location__address-text")
                or card.select_one(".vacancy-preview-card__location")
                or card.select_one(".vacancy-card__location")
                or card.select_one("[data-qa='vacancy-address']")
            )
            location = location_elem.get_text(strip=True) if location_elem else ""
            date_elem = (
                card.select_one(".vacancy-preview-card__date")
                or card.select_one("[data-qa='vacancy-date']")
                or card.select_one("time")
                or card.select_one("[class*='date']")
            )
            published_at = ""
            if date_elem:
                dt = date_elem.get("datetime") or date_elem.get_text(strip=True)
                if dt:
                    published_at = dt
            if not published_at:
                from datetime import datetime
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
            logger.warning("[rabota] parse card error: %s", exc)
            return None

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
                soup.select_one(".vacancy-description")
                or soup.select_one("[data-qa='vacancy-description']")
                or soup.select_one(".vacancy-card__description")
            )
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[rabota] details error %s: %s", url, exc)
            return None
