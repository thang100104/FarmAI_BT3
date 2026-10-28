"""Input/output safety and size limits for the AI layer."""
import re
from typing import Optional

MAX_PROMPT_CHARS = 4000
MAX_CONTEXT_CHARS = 10000
MAX_OUTPUT_CHARS = 8000

SECRET_PATTERNS = [
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/-]+"),
    re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
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
    for pattern in SECRET_PATTERNS:
        value = pattern.sub("[đã ẩn thông tin xác thực]", value)
    return value[:MAX_OUTPUT_CHARS]


OUT_OF_SCOPE_ANSWER = "Mình không biết về nội dung này. Mình chỉ hỗ trợ các câu hỏi về FarmAI và quản lý chăn nuôi: vật nuôi, chuồng trại, thức ăn, vaccine, chăm sóc, tăng trưởng, xuất bán và báo cáo."


def normalize_question(prompt: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFD", prompt.lower().replace("đ", "d"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text


def is_farm_question(prompt: str) -> bool:
    """Conservative offline gate; ambiguous requests are refused without a provider."""
    text = normalize_question(prompt)
    unrelated = ("bong da", "chinh tri", "chung khoan", "bitcoin", "thoi tiet", "lam tho", "viet tho", "ke chuyen", "lap trinh", "ignore", "bo qua", "doi vai", "thu do", "phim", "am nhac", "du lich")
    if any(word in text for word in unrelated):
        return False
    topics = ("farmai", "farm ai", "chan nuoi", "vat nuoi", "dan lon", "dan bo", "dan ga", "tinh hinh dan", "tong dan", "con bao nhieu con", "con may con", "suc khoe", "can nang", "khoi luong", "bi benh", "so con", "bao nhieu con", "may con", "bao nhieu vat nuoi", "tien ban", "chuong", "thuc an", "vaccine", "vac xin", "tiem phong", "thu y", "tang truong", "xuat ban", "ban di bao nhieu con", "da ban", "ban duoc", "con da ban", "trang trai", "cham soc", "ton kho", "bao cao", "doanh thu", "dinh muc")
    return any(re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", text) for word in topics)
