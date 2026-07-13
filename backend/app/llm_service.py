import httpx
import json
import uuid
import time
from typing import List, Dict, Tuple
from app.config import get_settings
from app.key_manager import key_manager as _global_key_manager
import asyncio


class LLMService:
    GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

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
        # GigaChat uses Russian Ministry of Digital certs not in standard trust stores
        self._client = httpx.AsyncClient(timeout=timeout, limits=limits, verify=False)

    async def aclose(self) -> None:
        await self._client.aclose()

    # ── GigaChat OAuth: exchange auth key → access token (valid 30 min) ──

    _access_token: str | None = None
    _token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        # Refresh if token is missing or expires within 2 minutes
        if self._access_token and time.time() < self._token_expires_at - 120:
            return self._access_token

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Bearer {self._key_manager.get_key()}",
        }
        data = {"scope": self.settings.gigachat_scope}
        resp = await self._client.post(self.GIGACHAT_OAUTH_URL, headers=headers, data=data)
        resp.raise_for_status()
        body = resp.json()
        self._access_token = body["access_token"]
        # expires_at is ISO 8601; parse to epoch, fallback to 30 min from now
        try:
            from datetime import datetime
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
    
    async def _call_llm(self, messages: List[Dict], temperature: float = 0.7) -> str:
        """Make a call to GigaChat API"""
        max_retries = max(0, int(self.settings.gigachat_max_retries or 0))
        attempt = 0
        async with self._semaphore:
            while True:
                try:
                    headers = await self._headers()
                    response = await self._client.post(
                        self.GIGACHAT_CHAT_URL,
                        headers=headers,
                        json={
                            "model": self.settings.gigachat_model,
                            "messages": messages,
                            "temperature": temperature,
                        },
                    )
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        status = e.response.status_code
                        # 401 → access token expired, force refresh and retry
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
    
    async def generate_search_queries(self, user_prompt: str, categories: List[str] = None, lang: str = "ru") -> List[str]:
        """Generate search queries based on user prompt. lang='ru' for Russian job boards, lang='en' for global/remote boards."""
        
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
        """Analyze if a vacancy matches user's requirements. lang='ru' for Russian, lang='en' for English."""
        
        if lang == "en":
            vacancy_text = f"""
Title: {vacancy.get('title', '')}
Company: {vacancy.get('company', '')}
Salary: {vacancy.get('salary', 'not specified')}
Location: {vacancy.get('location', '')}
Experience: {vacancy.get('experience', '')}
Employment type: {vacancy.get('employment_type', '')}

Description:
{vacancy.get('description', '')[:3000]}
"""
            system_content = """You are a job analysis expert. Evaluate if the vacancy matches the user's requirements.

IMPORTANT: Analyze both explicit and implicit requirements. For example:
- "low-stress work" = few requirements, simple tasks, flexible schedule, remote
- "time for personal matters" = part-time, flexible schedule, few meetings

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
{vacancy.get('description', '')[:3000]}
"""
            system_content = """Ты эксперт по анализу вакансий. Оцени, подходит ли вакансия под запрос пользователя.

ВАЖНО: Анализируй не только явные требования, но и неявные. Например:
- "ненапряжная работа" = мало требований, простые задачи, гибкий график, удаленка
- "для личных дел" = частичная занятость, гибкий график, мало совещаний

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
                location = (c.get("location") or "").strip().replace("\n", " ")[:40]
                lines.append(f"{cid} | {title} | {company} | {location}")
            return "\n".join(lines)

        async def pick_from_chunk(chunk: List[Dict], k: int) -> List[str]:
            if lang == "en":
                system_content = (
                    "You are a job selection assistant. Based on the user's request, select the most suitable vacancies from the list. "
                    "Consider that the user may want 'low-stress work' and time for personal matters: "
                    "look for options with low workload, flexible schedule, part-time, remote, simple routine. "
                    "Return STRICTLY a JSON array of IDs (first field before '|'). No other text."
                )
                user_content = f"Request: {user_prompt}\n\nSelect up to {k} IDs from the list below:\n\n{compact(chunk)}"
            else:
                system_content = (
                    "Ты помощник по отбору вакансий. По запросу пользователя выбери наиболее подходящие вакансии из списка. "
                    "Учитывай, что пользователь может хотеть 'ненапряжную работу' и возможность заниматься личными делами: "
                    "ищи варианты с низкой нагрузкой, сменным графиком, подработкой, удалёнкой, простой рутиной. "
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

        # chunk -> shortlist -> final selection
        if not candidates:
            return []

        chunk_size = 80
        per_chunk = max(5, min(25, target // max(1, (len(candidates) + chunk_size - 1) // chunk_size)))

        shortlist: List[str] = []
        seen = set()
        chunks: List[List[Dict]] = []
        for i in range(0, len(candidates), chunk_size):
            chunks.append(candidates[i : i + chunk_size])

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

        # If shortlist is too small, fall back to first N
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

        # final pass to pick exactly target
        shortlist_items = [c for c in candidates if c.get("hh_id") in set(shortlist)]
        final = await pick_from_chunk(shortlist_items[: min(len(shortlist_items), 120)], target)
        if final:
            # keep only known ids
            known = set([c.get("hh_id") for c in candidates if c.get("hh_id")])
            final2 = [x for x in final if x in known]
            if final2:
                return final2[:target]
        return shortlist[:target]
