import asyncio
import unittest

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


class TestParsersSmoke(unittest.IsolatedAsyncioTestCase):
    def _assert_vacancy_structure(self, item):
        self.assertIn("hh_id", item)
        self.assertIn("title", item)
        self.assertIn("url", item)
        self.assertTrue(item["hh_id"])
        self.assertTrue(item["title"])
        self.assertTrue(item["url"])

    async def _test_scraper(self, scraper_cls, query, city="", max_results=2):
        scraper = scraper_cls()
        try:
            try:
                results = await scraper.search_vacancies(
                    query, max_results=max_results, city=city
                )
            except Exception as exc:
                self.skipTest(
                    f"Network/source unavailable for {scraper_cls.__name__}: {exc}"
                )
            self.assertIsInstance(results, list)
            if results:
                for item in results[:max_results]:
                    self._assert_vacancy_structure(item)
        finally:
            await scraper.close()

    async def test_hh_scraper(self):
        await self._test_scraper(HHScraper, "python", city="")

    async def test_rabota_scraper(self):
        await self._test_scraper(RabotaScraper, "python", city="")

    async def test_superjob_scraper(self):
        await self._test_scraper(SuperJobScraper, "python", city="")

    async def test_remoteok_scraper(self):
        await self._test_scraper(RemoteOKScraper, "python")

    async def test_weworkremotely_scraper(self):
        await self._test_scraper(WeWorkRemotelyScraper, "python")

    async def test_fourdayweek_scraper(self):
        await self._test_scraper(FourDayWeekScraper, "python")

    async def test_djinni_scraper(self):
        await self._test_scraper(DjinniScraper, "python")

    async def test_telegram_scraper(self):
        await self._test_scraper(TelegramScraper, "python")


if __name__ == "__main__":
    unittest.main()
