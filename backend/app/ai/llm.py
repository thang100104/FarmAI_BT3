"""Provider client wrapper with timeout and graceful fallback."""
import os
from typing import Tuple
from openai import OpenAI

from .guardrails import sanitize_output

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "25"))


def call_openai(system_prompt: str, user_prompt: str) -> Tuple[str, str]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY chưa được cấu hình")
    client = OpenAI(api_key=OPENAI_API_KEY, timeout=AI_TIMEOUT_SECONDS, max_retries=1)
    response = client.responses.create(
        model=OPENAI_MODEL,
        instructions=system_prompt,
        input=user_prompt,
    )
    return sanitize_output(response.output_text), "openai"
