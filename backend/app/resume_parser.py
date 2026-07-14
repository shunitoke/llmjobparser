import logging
from typing import Any, Dict

from app.llm_service import LLMService
from app.key_manager import key_manager

logger = logging.getLogger(__name__)

_ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
}

_TEXT_ONLY_TYPES = {"text/plain"}

_MAX_SIZE = 5 * 1024 * 1024  # 5 MB


class ResumeParser:
    def __init__(self):
        self._llm = LLMService()

    async def close(self) -> None:
        await self._llm.aclose()

    async def parse(self, filename: str, content: bytes, content_type: str) -> Dict[str, Any]:
        if content_type not in _ALLOWED_TYPES:
            raise ValueError(f"Unsupported file type: {content_type}")
        if len(content) > _MAX_SIZE:
            raise ValueError("File is too large (max 5 MB)")

        provider = key_manager.get_provider()

        if content_type in _TEXT_ONLY_TYPES:
            text = content.decode("utf-8", errors="replace")
            result = await self._llm.parse_resume(text, from_text=True)
        elif provider == "gigachat":
            file_id = await self._llm.upload_file(filename, content, content_type)
            logger.info("Resume uploaded to GigaChat as file %s", file_id)
            try:
                result = await self._llm.parse_resume(file_id)
            except Exception:
                logger.exception("GigaChat resume parsing failed for file %s", file_id)
                raise
        else:
            raise ValueError(
                "PDF/DOCX upload is only supported with GigaChat provider. "
                "Switch to GigaChat or upload a .txt file."
            )

        return {
            "position": result.get("position", "") if isinstance(result, dict) else "",
            "skills": result.get("skills", []) if isinstance(result, dict) else [],
            "experience_summary": result.get("experience_summary", "") if isinstance(result, dict) else "",
            "search_prompt": result.get("search_prompt", "") if isinstance(result, dict) else "",
            "raw": result.get("raw", "") if isinstance(result, dict) else str(result),
        }
