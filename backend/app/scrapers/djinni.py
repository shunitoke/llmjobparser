import asyncio
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from app.scrapers.base import BaseScraper, is_blocked_for_global

logger = logging.getLogger(__name__)


class DjinniScraper(BaseScraper):
    name = "djinni"
    base_url = "https://djinni.co"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        page = 1
        while len(vacancies) < max_results and page <= 10:
            try:
                params: Dict = {
                    "primary_keyword": query,
                    "employment": "remote",
                    "page": page,
                }
                if city:
                    params["location"] = city
                resp = await self._get(
                    "https://djinni.co/jobs/", params=params
                )
                if not resp:
                    break
                soup = self._safe_soup(resp.text)
                cards = soup.select(".job-item") or soup.select(".list-jobs__item") or soup.select(".job-listing__item")
                if not cards:
                    break
                for card in cards:
                    if len(vacancies) >= max_results:
                        break
                    v = self._parse_card(card)
                    if v:
                        full_text = " ".join(
                            [v.get("title", ""), v.get("description", ""), v.get("location", "")]
                        )
                        if is_blocked_for_global(full_text):
                            continue
                        vacancies.append(v)
                page += 1
                await asyncio.sleep(0.5)
            except Exception as exc:
                logger.warning("[djinni] search page %s error: %s", page, exc)
                break
        return vacancies

    def _parse_card(self, card) -> Optional[Dict]:
        try:
            title_elem = (
                card.select_one(".job-item__position")
                or card.select_one("a.job_item__header-link")
                or card.select_one("a[href*='/jobs/']")
                or card.select_one("h3 a")
                or card.find("a")
            )
            if not title_elem:
                return None
            title = title_elem.get_text(strip=True)
            href = title_elem.get("href", "")
            if not href:
                link_elem = card.select_one("a.job_item__header-link") or card.select_one("a[href*='/jobs/']")
                href = link_elem.get("href", "") if link_elem else ""
            url = urljoin(self.base_url, href)
            source_id = self._extract_id(url)
            company_elem = (
                card.select_one("span.small.text-gray-800.opacity-75.font-weight-500")
                or card.select_one(".job-listing__company")
                or card.select_one(".company-name")
            )
            company = company_elem.get_text(strip=True) if company_elem else ""
            salary_elem = (
                card.select_one(".public-salary-item")
                or card.select_one(".salary")
            )
            salary = salary_elem.get_text(strip=True) if salary_elem else ""
            # Location tags are .text-nowrap chips; filter out experience/English/stat chips.
            location_tokens = []
            for token in card.select(".text-nowrap"):
                txt = token.get_text(strip=True)
                if not txt or any(marker in txt.lower() for marker in (
                    "years of experience", "year of experience", "english -", "views", "applications", "more"
                )):
                    continue
                location_tokens.append(txt)
            location = ", ".join(location_tokens[:3])
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company=company,
                salary=salary,
                location=location,
            )
        except Exception as exc:
            logger.warning("[djinni] parse card error: %s", exc)
            return None

    def _extract_id(self, url: str) -> str:
        match = re.search(r"/jobs/(\d+)-", url)
        return match.group(1) if match else re.sub(r"\D", "", url)[:20]

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            description_elem = (
                soup.select_one(".job-post__description")
                or soup.select_one(".job-description")
                or soup.select_one(".vacancy-description")
            )
            description = (
                description_elem.get_text(separator="\n", strip=True)
                if description_elem
                else ""
            )
            return {"description": description}
        except Exception as exc:
            logger.warning("[djinni] details error %s: %s", url, exc)
            return None
