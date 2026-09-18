"""Input/output safety and size limits for the AI layer."""
import re
from typing import Optional

MAX_PROMPT_CHARS = 4000
MAX_CONTEXT_CHARS = 10000
MAX_OUTPUT_CHARS = 8000

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"(?i)(api[_-]?key|password|token)\s*[:=]\s*[^\s,;]+"),
]

def sanitize_prompt(prompt: str) -> str:
    text = (prompt or "").strip()
    if not text:
        raise ValueError("Nội dung yêu cầu AI không được để trống")
    if len(text) > MAX_PROMPT_CHARS:
        raise ValueError(f"Yêu cầu AI vượt quá {MAX_PROMPT_CHARS} ký tự")
    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            raise ValueError("Không gửi API key, token hoặc mật khẩu vào ô yêu cầu AI")
    return text

def limit_context(context: str) -> str:
    return (context or "")[:MAX_CONTEXT_CHARS]

def sanitize_output(text: Optional[str]) -> str:
    value = (text or "").strip()
    if not value:
        raise ValueError("AI không trả về nội dung")
    return value[:MAX_OUTPUT_CHARS]
