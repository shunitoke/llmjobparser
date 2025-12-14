import httpx
import json
from typing import List, Dict, Tuple
from app.config import get_settings


class LLMService:
    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
    
    def __init__(self):
        self.settings = get_settings()
    
    async def _call_llm(self, messages: List[Dict], temperature: float = 0.7) -> str:
        """Make a call to OpenRouter API"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.openrouter_model,
                    "messages": messages,
                    "temperature": temperature,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def generate_search_queries(self, user_prompt: str, categories: List[str] = None) -> List[str]:
        """Generate search queries for hh.ru based on user prompt"""
        
        categories_hint = ""
        if categories:
            categories_hint = f"\n\nПользователь выбрал категории: {', '.join(categories)}. Учти их при генерации запросов."
        
        messages = [
            {
                "role": "system",
                "content": """Ты КРЕАТИВНЫЙ помощник для поиска работы. На основе описания пользователя сгенерируй 5-10 поисковых запросов для hh.ru.

ВАЖНО - ДУМАЙ КРЕАТИВНО И НЕСТАНДАРТНО:
- Если человек хочет "ненапряжную работу" - предложи: сторож, вахтёр, киномеханик, смотритель музея, библиотекарь, гардеробщик, консьерж, администратор парковки
- Если "работа с животными" - не только ветеринар, но и: догситтер, грумер, работник приюта, кинолог
- Если "творческая работа" - не только дизайнер, но и: флорист, декоратор, бариста, кондитер

Правила:
- Запросы на русском
- Включай как очевидные, так и НЕОЧЕВИДНЫЕ профессии
- Думай о реальных условиях работы, а не только о названии
- Возвращай ТОЛЬКО JSON массив строк, без пояснений

Пример для "хочу спокойную работу без стресса":
["сторож", "вахтёр", "библиотекарь", "архивариус", "смотритель", "гардеробщик", "ночной администратор", "оператор видеонаблюдения"]"""
            },
            {
                "role": "user",
                "content": f"Описание желаемой работы: {user_prompt}{categories_hint}"
            }
        ]
        
        result = await self._call_llm(messages, temperature=0.9)
        
        try:
            result = result.strip()
            if result.startswith("```"):
                result = result.split("\n", 1)[1]
                result = result.rsplit("```", 1)[0]
            queries = json.loads(result)
            return queries if isinstance(queries, list) else []
        except json.JSONDecodeError:
            return [user_prompt]
    
    async def analyze_vacancy(self, user_prompt: str, vacancy: Dict) -> Tuple[bool, str]:
        """Analyze if a vacancy matches user's requirements"""
        vacancy_text = f"""
Название: {vacancy.get('title', '')}
Компания: {vacancy.get('company', '')}
Зарплата: {vacancy.get('salary', 'не указана')}
Локация: {vacancy.get('location', '')}
Опыт: {vacancy.get('experience', '')}
Тип занятости: {vacancy.get('employment_type', '')}

Описание:
{vacancy.get('description', '')[:3000]}
"""
        
        messages = [
            {
                "role": "system",
                "content": """Ты эксперт по анализу вакансий. Оцени, подходит ли вакансия под запрос пользователя.

ВАЖНО: Анализируй не только явные требования, но и неявные. Например:
- "ненапряжная работа" = мало требований, простые задачи, гибкий график, удаленка
- "для личных дел" = частичная занятость, гибкий график, мало совещаний

Ответь СТРОГО в JSON формате:
{"match": true/false, "reason": "краткое объяснение на русском (1-2 предложения)"}"""
            },
            {
                "role": "user",
                "content": f"Запрос пользователя: {user_prompt}\n\nВакансия:\n{vacancy_text}"
            }
        ]
        
        result = await self._call_llm(messages, temperature=0.3)
        
        try:
            result = result.strip()
            if result.startswith("```"):
                result = result.split("\n", 1)[1]
                result = result.rsplit("```", 1)[0]
            data = json.loads(result)
            return data.get("match", False), data.get("reason", "")
        except json.JSONDecodeError:
            return False, "Ошибка анализа"
