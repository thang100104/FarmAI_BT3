import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ai.guardrails import sanitize_prompt, sanitize_output, limit_context
from app.ai.prompts import SYSTEM_PROMPT, build_analyze_prompt


def test_prompt_template_contains_context_and_user_request():
    result = build_analyze_prompt("Tổng đàn: 10", "Phân tích sức khỏe")
    assert "Tổng đàn: 10" in result
    assert "Phân tích sức khỏe" in result
    assert "Không tự bịa" in SYSTEM_PROMPT


def test_prompt_rejects_secret_like_input():
    try:
        sanitize_prompt("api_key=sk-abcdefghijklmnopqrstuvwxyz123456")
        assert False, "secret input should be rejected"
    except ValueError:
        pass


def test_prompt_size_limit():
    try:
        sanitize_prompt("x" * 4001)
        assert False
    except ValueError:
        pass


def test_output_and_context_limits():
    assert len(sanitize_output("x" * 9000)) == 8000
    assert len(limit_context("x" * 12000)) == 10000
