import asyncio
import json
import logging
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import get_settings
from app.key_manager import key_manager as _global_key_manager
from app.settings_store import get_llm_config

logger = logging.getLogger(__name__)

_current_gigachat_model: str = ""


def get_current_gigachat_model() -> str:
    return _current_gigachat_model


def sanitize_description(text: str) -> str:
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'<img[^>]*>', '', text)
    text = re.sub(r'ERROR: Cannot read.*?\.(\s|$)', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


class LLMService:
    GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
    OPENAI_BASE_URL = "https://api.openai.com/v1"
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
    DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
    GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    GIGACHAT_MODELS = ["GigaChat", "GigaChat-Pro", "GigaChat-Max"]

    def __init__(self):
        self.settings = get_settings()
        self._key_manager = _global_key_manager
        self._semaphore = asyncio.Semaphore(max(1, int(self.settings.gigachat_concurrency or 1)))
        timeout = httpx.Timeout(
            connect=10.0,
            read=float(self.settings.gigachat_timeout_seconds or 60.0),
            write=10.0,
            pool=10.0,
        )
        limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
        self._client = httpx.AsyncClient(timeout=timeout, limits=limits)
        self._gigachat_client = httpx.AsyncClient(timeout=timeout, limits=limits, verify=False)
        self._gigachat_model_idx = 0

    async def aclose(self) -> None:
        await self._client.aclose()
        await self._gigachat_client.aclose()

    # ── Provider helpers ──

    def _get_provider(self) -> str:
        return self._key_manager.get_provider()

    def _get_api_key(self) -> str:
        return self._key_manager.get_key()

    def _get_model(self) -> str:
        mg = self._key_manager.get_model()
        if mg:
            return mg
        provider = self._get_provider()
        if provider == "openai":
            return self.settings.openai_model or "gpt-4o-mini"
        if provider == "openrouter":
            return self.settings.openrouter_model or "openai/gpt-4o-mini"
        if provider == "anthropic":
            return self.settings.anthropic_model or "claude-3-5-haiku-20241022"
        if provider == "deepseek":
            return self.settings.deepseek_model or "deepseek-v4-flash"
        if provider == "gemini":
            return self.settings.gemini_model or "gemini-2.0-flash"
        idx = min(self._gigachat_model_idx, len(self.GIGACHAT_MODELS) - 1)
        return self.GIGACHAT_MODELS[idx]

    def reset_gigachat_model(self) -> None:
        self._gigachat_model_idx = 0

    def _rotate_gigachat_model(self) -> bool:
        global _current_gigachat_model
        if self._gigachat_model_idx >= len(self.GIGACHAT_MODELS) - 1:
            return False
        self._gigachat_model_idx += 1
        model = self.GIGACHAT_MODELS[self._gigachat_model_idx]
        _current_gigachat_model = model
        logger.warning("Rotated GigaChat model to %s", model)
        return True

    # ── Resume file upload (GigaChat only) ──

    async def upload_file(self, filename: str, content: bytes, content_type: str) -> str:
        """Upload a file to GigaChat storage and return file id."""
        if self._get_provider() != "gigachat":
            raise RuntimeError("File upload is only supported with GigaChat provider")
        if not self._get_api_key():
            raise RuntimeError("Authorization key is not configured")
        headers = {"Authorization": f"Bearer {await self._get_access_token()}"}
        files = {"file": (filename, content, content_type), "purpose": (None, "general")}
        resp = await self._gigachat_client.post(
            "https://gigachat.devices.sberbank.ru/api/v1/files",
            headers=headers,
            files=files,
        )
        resp.raise_for_status()
        body = resp.json()
        file_id = body.get("id")
        if not file_id:
            raise RuntimeError(f"Unexpected upload response: {body}")
        return file_id

    async def parse_resume(self, file_id_or_text: str, from_text: bool = False) -> Dict[str, Any]:
        """Ask LLM to extract structured data from a resume."""
        system_prompt = (
            "Ты — рекрутер. Извлеки из резюме ключевую информацию и верни строго JSON "
            "без пояснений. JSON должен содержать поля:\n"
            "- position (желаемая должность или направление)\n"
            "- skills (список ключевых навыков)\n"
            "- experience_summary (краткое описание опыта, 2-3 предложения)\n"
            "- search_prompt (готовый запрос для поиска вакансий по этому резюме, 1-2 предложения на русском)\n"
            "Если чего-то не хватает, используй пустую строку или пустой список."
        )
        if self._get_provider() == "gigachat" and not from_text:
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": "Проанализируй приложенное резюме и извлеки данные в JSON.",
                    "attachments": [file_id_or_text],
                },
            ]
        else:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Проанализируй следующее резюме и извлеки данные в JSON.\n\n{file_id_or_text[:5000]}"},
            ]
        raw = await self._call_llm(messages, temperature=0.2)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                return {"raw": raw}
            return data
        except json.JSONDecodeError:
            return {"raw": raw}

    # ── GigaChat OAuth ──

    _access_token: str | None = None
    _token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires_at - 120:
            return self._access_token
        key = self._get_api_key()
        if not key:
            raise RuntimeError("GigaChat authorization key is not configured")
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Bearer {key}",
        }
        data = {"scope": self.settings.gigachat_scope}
        resp = await self._gigachat_client.post(self.GIGACHAT_OAUTH_URL, headers=headers, data=data)
        resp.raise_for_status()
        body = resp.json()
        self._access_token = body["access_token"]
        try:
            self._token_expires_at = datetime.fromisoformat(body["expires_at"]).timestamp()
        except Exception:
            self._token_expires_at = time.time() + 1800
        return self._access_token

    async def _headers(self) -> Dict[str, str]:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def _extract_retry_after(self, response: httpx.Response) -> float:
        ra = response.headers.get("Retry-After")
        if ra:
            try:
                return float(ra)
            except Exception:
                return 0.0
        return 0.0

    # ── Unified LLM call ──

    async def _call_llm(self, messages: List[Dict], temperature: float = 0.7) -> str:
        provider = self._get_provider()
        if provider == "gigachat":
            return await self._call_gigachat(messages, temperature)
        elif provider == "openai":
            return await self._call_openai(messages, temperature)
        elif provider == "openrouter":
            return await self._call_openai(messages, temperature, base_url=self.OPENROUTER_BASE_URL)
        elif provider == "anthropic":
            return await self._call_anthropic(messages, temperature)
        elif provider == "deepseek":
            return await self._call_openai(messages, temperature, base_url=self.DEEPSEEK_BASE_URL)
        elif provider == "gemini":
            return await self._call_gemini(messages, temperature)
        else:
            raise RuntimeError(f"Unknown LLM provider: {provider}")

    async def _call_gigachat(self, messages: List[Dict], temperature: float) -> str:
        global _current_gigachat_model
        _current_gigachat_model = self._get_model()
        max_retries = max(0, int(self.settings.gigachat_max_retries or 0))
        attempt = 0
        async with self._semaphore:
            while True:
                try:
                    headers = await self._headers()
                    response = await self._gigachat_client.post(
                        self.GIGACHAT_CHAT_URL,
                        headers=headers,
                        json={
                            "model": self._get_model(),
                            "messages": messages,
                            "temperature": temperature,
                        },
                    )
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        status = e.response.status_code
                        if status == 401 and attempt < max_retries:
                            self._access_token = None
                            self._token_expires_at = 0.0
                            attempt += 1
                            await asyncio.sleep(1.0)
                            continue
                        if status in (429, 502, 503, 504) and attempt < max_retries:
                            retry_after = self._extract_retry_after(e.response)
                            if retry_after <= 0:
                                retry_after = min(20.0, 2.0 ** attempt)
                            attempt += 1
                            await asyncio.sleep(retry_after)
                            continue
                        # rotate model on quota/token exhaustion (402 or 403 with keywords)
                        if status in (402, 403, 400, 429):
                            body_text = ""
                            try:
                                body_text = str(e.response.json())
                            except Exception:
                                body_text = e.response.text or ""
                            body_lower = body_text.lower()
                            if status == 402 or any(kw in body_lower for kw in ["token_limit", "quota", "insufficient", "лимит", "баланс", "tokens", "исчерпа"]):
                                if self._rotate_gigachat_model():
                                    attempt += 1
                                    await asyncio.sleep(1.0)
                                    continue
                                logger.error("All GigaChat models exhausted: %s", body_text[:200])
                        raise
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError):
                    if attempt < max_retries:
                        wait_s = min(20.0, 2.0 ** attempt)
                        attempt += 1
                        await asyncio.sleep(wait_s)
                        continue
                    raise

    async def _call_openai(self, messages: List[Dict], temperature: float, base_url: Optional[str] = None) -> str:
        url = (base_url or self.OPENAI_BASE_URL) + "/chat/completions"
        key = self._get_api_key()
        if not key:
            raise RuntimeError("API key is not configured")
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        max_retries = max(0, int(self.settings.gigachat_max_retries or 0))
        attempt = 0
        async with self._semaphore:
            while True:
                try:
                    response = await self._client.post(
                        url,
                        headers=headers,
                        json={
                            "model": self._get_model(),
                            "messages": messages,
                            "temperature": temperature,
                        },
                    )
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        status = e.response.status_code
                        if status in (429, 502, 503, 504) and attempt < max_retries:
                            retry_after = self._extract_retry_after(e.response)
                            if retry_after <= 0:
                                retry_after = min(20.0, 2.0 ** attempt)
                            attempt += 1
                            await asyncio.sleep(retry_after)
                            continue
                        raise
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError):
                    if attempt < max_retries:
                        wait_s = min(20.0, 2.0 ** attempt)
                        attempt += 1
                        await asyncio.sleep(wait_s)
                        continue
                    raise

    async def _call_anthropic(self, messages: List[Dict], temperature: float) -> str:
        url = self.ANTHROPIC_BASE_URL + "/messages"
        key = self._get_api_key()
        if not key:
            raise RuntimeError("API key is not configured")
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        system = None
        chat_messages = []
        for m in messages:
            if m.get("role") == "system":
                system = m["content"]
            else:
                chat_messages.append(m)

        body: Dict[str, Any] = {
            "model": self._get_model(),
            "max_tokens": 4096,
            "messages": chat_messages,
            "temperature": temperature,
        }
        if system:
            body["system"] = system

        max_retries = max(0, int(self.settings.gigachat_max_retries or 0))
        attempt = 0
        async with self._semaphore:
            while True:
                try:
                    response = await self._client.post(url, headers=headers, json=body)
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        status = e.response.status_code
                        if status in (429, 502, 503, 504) and attempt < max_retries:
                            retry_after = self._extract_retry_after(e.response)
                            if retry_after <= 0:
                                retry_after = min(20.0, 2.0 ** attempt)
                            attempt += 1
                            await asyncio.sleep(retry_after)
                            continue
                        raise
                    data = response.json()
                    return data["content"][0]["text"]
                except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError):
                    if attempt < max_retries:
                        wait_s = min(20.0, 2.0 ** attempt)
                        attempt += 1
                        await asyncio.sleep(wait_s)
                        continue
                    raise

    async def _call_gemini(self, messages: List[Dict], temperature: float) -> str:
        key = self._get_api_key()
        if not key:
            raise RuntimeError("API key is not configured")

        system = None
        contents = []
        for m in messages:
            if m.get("role") == "system":
                system = m["content"]
            else:
                contents.append({"role": m["role"], "parts": [{"text": m["content"]}]})

        body: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}

        url = f"{self.GEMINI_BASE_URL}/models/{self._get_model()}:generateContent?key={key}"
        max_retries = max(0, int(self.settings.gigachat_max_retries or 0))
        attempt = 0
        async with self._semaphore:
            while True:
                try:
                    response = await self._client.post(url, json=body)
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        status = e.response.status_code
                        if status in (429, 502, 503, 504) and attempt < max_retries:
                            retry_after = self._extract_retry_after(e.response)
                            if retry_after <= 0:
                                retry_after = min(20.0, 2.0 ** attempt)
                            attempt += 1
                            await asyncio.sleep(retry_after)
                            continue
                        raise
                    data = response.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError):
                    if attempt < max_retries:
                        wait_s = min(20.0, 2.0 ** attempt)
                        attempt += 1
                        await asyncio.sleep(wait_s)
                        continue
                    raise

    # ── Resume parsing from raw text (for non-GigaChat) ──

    async def parse_resume_text(self, file_text: str) -> Dict[str, Any]:
        """Parse resume by sending the text content directly (for OpenAI/OpenRouter)."""
        return await self.parse_resume(file_text, from_text=True)

    # ── Job analysis methods ──

    async def generate_search_queries(self, user_prompt: str, categories: List[str] = None, lang: str = "ru") -> List[str]:
        """Generate search queries based on user prompt."""
        if lang == "en":
            categories_hint = ""
            if categories:
                categories_hint = f"\n\nUser selected categories: {', '.join(categories)}. Consider them when generating queries."
            system_prompt = """You are a job search assistant. Based on the user's description, generate 8-12 search queries for remote job boards.

Your task:
1. Understand what the user REALLY wants (working conditions, lifestyle, skills, interests)
2. Translate their description into ACTUAL JOB TITLES that exist on job boards
3. Think broadly: what professions match these criteria? Include obvious and non-obvious options
4. Consider synonyms, related roles, and different industry terms for the same type of work

Rules:
- Queries in ENGLISH
- Each query should be a real job title or search term
- Diverse mix: different industries, seniority levels, work types
- Return ONLY a JSON array of strings, no explanations"""
            user_content = f"Desired job description: {user_prompt}{categories_hint}"
        else:
            categories_hint = ""
            if categories:
                categories_hint = f"\n\nПользователь выбрал категории: {', '.join(categories)}. Учти их при генерации запросов."
            system_prompt = """Ты помощник для поиска работы. На основе описания пользователя сгенерируй 8-12 поисковых запросов для hh.ru.

Твоя задача:
1. Понять, что пользователь РЕАЛЬНО хочет (условия работы, образ жизни, навыки, интересы)
2. Перевести его описание в РЕАЛЬНЫЕ НАЗВАНИЯ ВАКАНСИЙ, которые есть на job-сайтах
3. Думай широко: какие профессии подходят под эти критерии? Включай очевидные и неочевидные варианты
4. Учитывай синонимы, смежные роли и разные отраслевые термины для одного типа работы

Правила:
- Запросы на русском
- Каждый запрос — реальное название должности или поисковый термин
- Разнообразный микс: разные отрасли, уровни, типы занятости
- Возвращай ТОЛЬКО JSON массив строк, без пояснений"""
            user_content = f"Описание желаемой работы: {user_prompt}{categories_hint}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        result = await self._call_llm(messages, temperature=0.9)

        try:
            result = result.strip()
            if result.startswith("```"):
                result = result.split("\n", 1)[1]
                result = result.rsplit("```", 1)[0]
            queries = json.loads(result)
            if not isinstance(queries, list):
                return []

            cleaned: List[str] = []
            seen = set()
            for q in queries:
                if not isinstance(q, str):
                    continue
                q2 = q.strip()
                if not q2:
                    continue
                key = q2.lower()
                if key in seen:
                    continue
                seen.add(key)
                cleaned.append(q2)

            prompt_lc = (user_prompt or "").lower()
            if any(k in prompt_lc for k in ["ненапряж", "личн", "без стрес", "спокойн"]):
                security_markers = ["охран", "сторож", "вахт", "чоп", "видеонаблюд", "консьерж", "вахта"]
                security = [q for q in cleaned if any(m in q.lower() for m in security_markers)]
                non_security = [q for q in cleaned if q not in security]
                security = security[:2]
                cleaned = non_security + security
                fallback = [
                    "оператор чата поддержка",
                    "оператор call-центра входящие",
                    "оператор ввода данных",
                    "администратор ресепшен",
                    "диспетчер",
                    "модератор контента",
                    "архивариус",
                    "библиотекарь",
                    "пункт выдачи заказов",
                    "удаленная подработка",
                    "частичная занятость",
                ]
                for f in fallback:
                    if len(cleaned) >= 12:
                        break
                    if f.lower() in seen:
                        continue
                    seen.add(f.lower())
                    cleaned.append(f)
            return cleaned[:12]
        except json.JSONDecodeError:
            return [user_prompt]

    async def analyze_vacancy(self, user_prompt: str, vacancy: Dict, lang: str = "ru") -> Tuple[bool, str]:
        """Analyze if a vacancy matches user's requirements."""
        desc = sanitize_description(vacancy.get('description', ''))
        if lang == "en":
            vacancy_text = f"""
Title: {vacancy.get('title', '')}
Company: {vacancy.get('company', '')}
Salary: {vacancy.get('salary', 'not specified')}
Location: {vacancy.get('location', '')}
Experience: {vacancy.get('experience', '')}
Employment type: {vacancy.get('employment_type', '')}

Description:
{desc[:3000]}
"""
            system_content = """You are a job analysis expert. Evaluate if the vacancy matches the user's requirements.

IMPORTANT: Analyze both explicit and implicit requirements.
Respond STRICTLY in JSON format:
{"match": true/false, "reason": "brief explanation in English (1-2 sentences)"}"""
            user_content = f"User request: {user_prompt}\n\nVacancy:\n{vacancy_text}"
        else:
            vacancy_text = f"""
Название: {vacancy.get('title', '')}
Компания: {vacancy.get('company', '')}
Зарплата: {vacancy.get('salary', 'не указана')}
Локация: {vacancy.get('location', '')}
Опыт: {vacancy.get('experience', '')}
Тип занятости: {vacancy.get('employment_type', '')}

Описание:
{desc[:3000]}
"""
            system_content = """Ты эксперт по анализу вакансий. Оцени, подходит ли вакансия под запрос пользователя.

Ответь СТРОГО в JSON формате:
{"match": true/false, "reason": "краткое объяснение на русском (1-2 предложения)"}"""
            user_content = f"Запрос пользователя: {user_prompt}\n\nВакансия:\n{vacancy_text}"

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content}
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

    async def select_candidate_ids(self, user_prompt: str, candidates: List[Dict], target: int = 100, lang: str = "ru") -> List[str]:
        """Select best candidate vacancy IDs based on title-card info to reduce deep scraping."""

        def compact(items: List[Dict]) -> str:
            lines: List[str] = []
            for c in items:
                cid = (c.get("hh_id") or "").strip()
                if not cid:
                    continue
                title = (c.get("title") or "").strip().replace("\n", " ")[:80]
                company = (c.get("company") or "").strip().replace("\n", " ")[:50]
                salary = (c.get("salary") or "").strip().replace("\n", " ")[:50]
                location = (c.get("location") or "").strip().replace("\n", " ")[:40]
                source = (c.get("source") or "").strip()[:20]
                lines.append(f"{cid} | {title} | {company} | {salary} | {location} | {source}")
            return "\n".join(lines)

        async def pick_from_chunk(chunk: List[Dict], k: int) -> List[str]:
            if lang == "en":
                system_content = (
                    "You are a job selection assistant. Based on the user's request, select the most suitable vacancies from the list. "
                    "Return STRICTLY a JSON array of IDs (first field before '|'). No other text."
                )
                user_content = f"Request: {user_prompt}\n\nSelect up to {k} IDs from the list below:\n\n{compact(chunk)}"
            else:
                system_content = (
                    "Ты помощник по отбору вакансий. По запросу пользователя выбери наиболее подходящие вакансии из списка. "
                    "Верни СТРОГО JSON массив ID (первое поле до '|'). Никакого текста."
                )
                user_content = f"Запрос: {user_prompt}\n\nВыбери до {k} ID из списка ниже:\n\n{compact(chunk)}"

            messages = [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ]
            result = await self._call_llm(messages, temperature=0.2)
            try:
                txt = result.strip()
                if txt.startswith("```"):
                    txt = txt.split("\n", 1)[1]
                    txt = txt.rsplit("```", 1)[0]
                data = json.loads(txt)
                if isinstance(data, list):
                    out = []
                    for x in data:
                        if isinstance(x, str) and x.strip():
                            out.append(x.strip())
                    return out
            except Exception:
                return []
            return []

        if not candidates:
            return []

        chunk_size = 80
        per_chunk = max(5, min(25, target // max(1, (len(candidates) + chunk_size - 1) // chunk_size)))

        shortlist: List[str] = []
        seen = set()
        chunks: List[List[Dict]] = []
        for i in range(0, len(candidates), chunk_size):
            chunks.append(candidates[i: i + chunk_size])

        tasks = [asyncio.create_task(pick_from_chunk(chunk, per_chunk)) for chunk in chunks]
        try:
            results = await asyncio.gather(*tasks)
        finally:
            for t in tasks:
                if not t.done():
                    t.cancel()

        for picked in results:
            for pid in picked:
                if pid not in seen:
                    seen.add(pid)
                    shortlist.append(pid)

        if len(shortlist) < min(20, target):
            for c in candidates:
                cid = (c.get("hh_id") or "").strip()
                if cid and cid not in seen:
                    seen.add(cid)
                    shortlist.append(cid)
                if len(shortlist) >= target:
                    break

        if len(shortlist) <= target:
            return shortlist

        shortlist_items = [c for c in candidates if c.get("hh_id") in set(shortlist)]
        final = await pick_from_chunk(shortlist_items[: min(len(shortlist_items), 120)], target)
        if final:
            known = {c.get("hh_id") for c in candidates if c.get("hh_id")}
            final2 = [x for x in final if x in known]
            if final2:
                return final2[:target]
        return shortlist[:target]
