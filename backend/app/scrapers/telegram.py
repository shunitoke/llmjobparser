import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

from app.scrapers.base import BaseScraper
from app.settings_store import get_telegram_channels

logger = logging.getLogger(__name__)


class TelegramScraper(BaseScraper):
    name = "telegram"
    base_url = "https://t.me/s"

    async def search_vacancies(
        self, query: str, max_results: int = 20, city: str = ""
    ) -> List[Dict]:
        vacancies: List[Dict] = []
        query_tokens = [t.lower() for t in query.split() if t]
        channels = await get_telegram_channels()
        for channel in channels:
            if len(vacancies) >= max_results:
                break
            try:
                resp = await self._get(f"https://t.me/s/{channel['name']}")
                if not resp:
                    continue
                soup = self._safe_soup(resp.text)
                messages = soup.select("div.tgme_widget_message")
                for msg in messages:
                    if len(vacancies) >= max_results:
                        break
                    v = self._parse_message(msg, channel)
                    if not v:
                        continue
                    text = " ".join([v.get("title", ""), v.get("description", "")])
                    if query_tokens and not any(t in text.lower() for t in query_tokens):
                        continue
                    vacancies.append(v)
                await asyncio.sleep(0.5)
            except Exception as exc:
                logger.warning("[telegram] channel %s error: %s", channel.get("name"), exc)
        return vacancies

    def _parse_message(self, msg, channel: Dict) -> Optional[Dict]:
        try:
            text_elem = msg.select_one("div.tgme_widget_message_text")
            if not text_elem:
                return None
            text = text_elem.get_text(separator="\n", strip=True)
            if not text or len(text) < 30:
                return None
            ad_markers = [
                "реклама",
                "подпишись",
                "партнерский пост",
                "заказной пост",
                "#реклама",
                "спонсор",
            ]
            lower = text.lower()
            if any(marker in lower for marker in ad_markers):
                return None
            channel_name = channel.get("name", "")
            message_id = msg.get("data-post-id") or msg.get("id", "")
            source_id = f"{channel_name}:{message_id}"
            url = f"https://t.me/s/{channel_name}/{message_id}"
            title = text.split("\n")[0][:120]
            time_elem = msg.select_one("time")
            published_at = ""
            if time_elem:
                dt = time_elem.get("datetime", "")
                if dt:
                    try:
                        published_at = datetime.fromisoformat(dt.replace("Z", "+00:00")).isoformat()
                    except Exception:
                        published_at = dt
            return self._vacancy_stub(
                source_id=source_id,
                title=title,
                url=url,
                company="",
                salary="",
                location="",
                published_at=published_at,
                description=text,
                category=channel.get("category", "vacancy"),
            )
        except Exception as exc:
            logger.warning("[telegram] parse message error: %s", exc)
            return None

    def _extract_id(self, url: str) -> str:
        match = re.search(r"/([^/]+)/(\d+)$", url)
        if match:
            return f"{match.group(1)}:{match.group(2)}"
        return re.sub(r"\W", "", url)[:40]

    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._get(url)
            if not resp:
                return None
            soup = self._safe_soup(resp.text)
            msg = soup.select_one("div.tgme_widget_message")
            if msg:
                text_elem = msg.select_one("div.tgme_widget_message_text")
                description = text_elem.get_text(separator="\n", strip=True) if text_elem else ""
            else:
                description = ""
            return {"description": description}
        except Exception as exc:
            logger.warning("[telegram] details error %s: %s", url, exc)
            return None
