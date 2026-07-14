import asyncio
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class SuperJobScraper(BaseScraper):
    name = "superjob"
    base_url = "https://www.superjob.ru"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        page = 1
        while len(vacancies) < max_results and page <= 10:
            params: Dict = {"keywords": query, "page": page}
            if city:
                params["town"] = city
            try:
                resp = await self._get(
                    "https://www.superjob.ru/vacancy/search/", params=params
                )
                if not resp:
                    break
                soup = self._safe_soup(resp.text)
                cards = soup.select(".f-test-vacancy-item") or soup.select("._2g1F-")
                if not cards:
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
                logger.warning("[superjob] search page %s error: %s", page, exc)
                break
        return vacancies

    def _parse_card(self, card) -> Optional[Dict]:
        try:
            title_elem = (
                card.select_one("a[href*='/vakansii/']")
                or card.select_one("[class*='f-test-link-']")
                or card.find("a")
            )
            if not title_elem:
                return None
            title = title_elem.get_text(strip=True)
            href = title_elem.get("href", "")
            url = urljoin(self.base_url, href)
            source_id = self._extract_id(url)
            company_elem = (
                card.select_one(".f-test-text-vacancy-item-company-name")
                or card.select_one("[data-qa='vacancy-serp__vacancy-employer']")
            )
            company = company_elem.get_text(strip=True) if company_elem else ""
            salary_elem = (
                card.select_one(".f-test-text-company-item-salary")
                or card.select_one("[data-qa='vacancy-serp__vacancy-compensation']")
            )
            salary = salary_elem.get_text(strip=True) if salary_elem else ""
            location_elem = (
                card.select_one(".f-test-text-company-item-location")
                or card.select_one("[data-qa='vacancy-serp__vacancy-address']")
            )
            location = location_elem.get_text(strip=True) if location_elem else ""
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary=salary,
                location=location,
            )
        except Exception as exc:
            logger.warning("[superjob] parse card error: %s", exc)
            return None

    def _extract_id(self, url: str) -> str:
        match = re.search(r"/vakansii/[^/]+-(\d+)\.html", url)
        if match:
            return match.group(1)
        match = re.search(r"/(\d+)\.html", url)
        return match.group(1) if match else re.sub(r"\D", "", url)[:20]

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = (
                soup.select_one(".vacancy-section")
                or soup.select_one("[data-qa='vacancy-description']")
                or soup.select_one("._1IjW")
            )
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[superjob] details error %s: %s", url, exc)
            return None
