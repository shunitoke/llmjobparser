import abc
import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

RUSSIA_CIS_LOCATIONS = {
    "russia",
    "россия",
    "moscow",
    "москва",
    "saint petersburg",
    "санкт-петербург",
    "spb",
    "питер",
    "yekaterinburg",
    "екатеринбург",
    "novosibirsk",
    "новосибирск",
    "kazan",
    "казань",
    "nizhny novgorod",
    "нижний новгород",
    "chelyabinsk",
    "челябинск",
    "samara",
    "самара",
    "omsk",
    "омск",
    "rostov-on-don",
    "ростов-на-дону",
    "ufa",
    "уфа",
    "krasnoyarsk",
    "красноярск",
    "voronezh",
    "воронеж",
    "perm",
    "пермь",
    "volgograd",
    "волгоград",
    "minsk",
    "минск",
    "kyiv",
    "киев",
    "almaty",
    "астана",
    "tashkent",
    "ташкент",
    "baku",
    "баку",
    "yerevan",
    "ереван",
}

_CITIZENSHIP_BLOCK_PATTERNS = [
    re.compile(r"\b(us|uk|eu|canadian|australian)\s+citizen", re.IGNORECASE),
    re.compile(r"\bcitizen\s+of\s+(the\s+)?(us|usa|uk|eu|canada|australia)", re.IGNORECASE),
    re.compile(r"\b(us|uk|eu|canada|australia)\s+(only|citizens?\b)", re.IGNORECASE),
    re.compile(r"\bno\s+visa\s+sponsor", re.IGNORECASE),
    re.compile(r"\bvisa\s+sponsorship\s+(is\s+)?not\s+(available|provided)", re.IGNORECASE),
    re.compile(r"\bunauthorized\s+to\s+work\s+in\s+(the\s+)?(us|usa|uk|eu|canada|australia)", re.IGNORECASE),
    re.compile(r"\blegal\s+(right|authorization)\s+to\s+work\s+in\s+(the\s+)?(us|usa|uk|eu|canada|australia)", re.IGNORECASE),
]

_RU_BLOCK_PATTERNS = [
    re.compile(r"работа\s+в\s+(сша|аmerica|европе|канаде|австралии)", re.IGNORECASE),
    re.compile(r"гражданство\s+(сша|англии|европы|канады|австралии)", re.IGNORECASE),
    re.compile(r"виза\s+не\s+спонсируется", re.IGNORECASE),
]


def is_blocked_for_global(text: str) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in _CITIZENSHIP_BLOCK_PATTERNS) or any(
        p.search(text) for p in _RU_BLOCK_PATTERNS
    )


def is_russia_cis(location: str) -> bool:
    loc = (location or "").lower()
    return any(marker in loc for marker in RUSSIA_CIS_LOCATIONS)


class BaseScraper(abc.ABC):
    name: str = "base"
    base_url: str = ""

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers=self.HEADERS, timeout=30, follow_redirects=True
        )

    async def close(self) -> None:
        await self.client.aclose()

    @abc.abstractmethod
    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        """Return list of vacancy dicts from a single search query."""
        raise NotImplementedError

    @abc.abstractmethod
    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        """Return detail dict (description etc.) for a given vacancy URL."""
        raise NotImplementedError

    def _make_id(self, source_id: str) -> str:
        return f"{self.name}:{source_id}"

    def _vacancy_stub(
        self,
        source_id: str,
        title: str = "",
        url: str = "",
        company: str = "",
        salary: str = "",
        location: str = "",
        published_at: Optional[datetime] = None,
        description: str = "",
        category: Optional[str] = None,
    ) -> Dict:
        return {
            "hh_id": self._make_id(source_id),
            "title": title,
            "url": url,
            "company": company,
            "salary": salary,
            "location": location,
            "published_at": published_at.isoformat() if isinstance(published_at, datetime) else (published_at or ""),
            "description": description,
            "source": self.name,
            "category": category or "vacancy",
        }

    def _is_global_block(self, text: str) -> bool:
        return is_blocked_for_global(text)

    def _safe_soup(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "lxml")

    async def _get(self, url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None) -> Optional[httpx.Response]:
        try:
            resp = await self.client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            logger.warning("[%s] GET failed %s: %s", self.name, url, exc)
            return None


async def close_scrapers(scrapers: List[BaseScraper]) -> None:
    await asyncio.gather(*[s.close() for s in scrapers], return_exceptions=True)
