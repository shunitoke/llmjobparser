import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import datetime
import asyncio
import re


class HHScraper:
    BASE_URL = "https://hh.ru"
    SEARCH_URL = "https://hh.ru/search/vacancy"
    
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    
    def __init__(self):
        self.client = httpx.AsyncClient(headers=self.HEADERS, timeout=30.0, follow_redirects=True)
    
    async def close(self):
        await self.client.aclose()
    
    CITY_IDS = {
        "москва": 1,
        "санкт-петербург": 2,
        "новосибирск": 4,
        "екатеринбург": 3,
        "казань": 88,
        "нижний новгород": 66,
        "челябинск": 104,
        "самара": 78,
        "омск": 68,
        "ростов-на-дону": 76,
        "уфа": 99,
        "красноярск": 54,
        "воронеж": 26,
        "пермь": 72,
        "волгоград": 24,
    }
    
    async def search_vacancies(self, query: str, max_results: int = 50, city: str = "") -> List[Dict]:
        """Search for vacancies and return list of vacancy data"""
        vacancies = []
        page = 0
        
        while len(vacancies) < max_results:
            params = {
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
            
            try:
                response = await self.client.get(self.SEARCH_URL, params=params)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, "lxml")
                vacancy_cards = soup.select("[data-qa='vacancy-serp__vacancy']")
                
                if not vacancy_cards:
                    vacancy_cards = soup.select(".vacancy-card--z_UXteNo7bRGzxWVcL7y")
                
                if not vacancy_cards:
                    vacancy_cards = soup.select("[class*='vacancy-card']")
                
                if not vacancy_cards:
                    break
                
                for card in vacancy_cards:
                    if len(vacancies) >= max_results:
                        break
                    
                    vacancy = self._parse_vacancy_card(card)
                    if vacancy:
                        vacancies.append(vacancy)
                
                page += 1
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"Error scraping page {page}: {e}")
                break
        
        return vacancies
    
    def _parse_vacancy_card(self, card) -> Optional[Dict]:
        """Parse a vacancy card from search results"""
        try:
            title_elem = card.select_one("[data-qa='serp-item__title']") or card.select_one("a[class*='title']")
            if not title_elem:
                title_elem = card.select_one("a[href*='/vacancy/']")
            
            if not title_elem:
                return None
            
            title = title_elem.get_text(strip=True)
            url = title_elem.get("href", "")
            if url and not url.startswith("http"):
                url = self.BASE_URL + url
            
            hh_id = self._extract_vacancy_id(url)
            
            company_elem = card.select_one("[data-qa='vacancy-serp__vacancy-employer']") or card.select_one("[class*='company-name']")
            company = company_elem.get_text(strip=True) if company_elem else ""
            
            salary_elem = card.select_one("[data-qa='vacancy-serp__vacancy-compensation']") or card.select_one("[class*='compensation']")
            salary = salary_elem.get_text(strip=True) if salary_elem else ""
            
            location_elem = card.select_one("[data-qa='vacancy-serp__vacancy-address']") or card.select_one("[class*='address']")
            location = location_elem.get_text(strip=True) if location_elem else ""
            
            return {
                "hh_id": hh_id,
                "title": title,
                "company": company,
                "salary": salary,
                "location": location,
                "url": url,
            }
        except Exception as e:
            print(f"Error parsing vacancy card: {e}")
            return None
    
    def _extract_vacancy_id(self, url: str) -> str:
        """Extract vacancy ID from URL"""
        match = re.search(r"/vacancy/(\d+)", url)
        return match.group(1) if match else ""
    
    async def get_vacancy_details(self, url: str) -> Optional[Dict]:
        """Get full vacancy details from vacancy page"""
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "lxml")
            
            description_elem = soup.select_one("[data-qa='vacancy-description']") or soup.select_one(".vacancy-description")
            description = description_elem.get_text(separator="\n", strip=True) if description_elem else ""
            
            experience_elem = soup.select_one("[data-qa='vacancy-experience']")
            experience = experience_elem.get_text(strip=True) if experience_elem else ""
            
            employment_elem = soup.select_one("[data-qa='vacancy-view-employment-mode']")
            employment_type = employment_elem.get_text(strip=True) if employment_elem else ""
            
            return {
                "description": description,
                "experience": experience,
                "employment_type": employment_type,
            }
        except Exception as e:
            print(f"Error getting vacancy details: {e}")
            return None
    
    async def scrape_vacancies_with_details(self, query: str, max_results: int = 50, city: str = "") -> List[Dict]:
        """Search and get full details for each vacancy"""
        vacancies = await self.search_vacancies(query, max_results, city)
        
        for i, vacancy in enumerate(vacancies):
            if vacancy.get("url"):
                details = await self.get_vacancy_details(vacancy["url"])
                if details:
                    vacancy.update(details)
                await asyncio.sleep(0.3)
        
        return vacancies
