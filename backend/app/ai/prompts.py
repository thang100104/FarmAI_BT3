"""Prompt templates are kept separate from business/API code for easier testing and revision."""

SYSTEM_PROMPT = """Bạn là trợ lý AI cho hệ thống quản lý chăn nuôi Smart Livestock.
Nhiệm vụ: phân tích dữ liệu đã được hệ thống cung cấp và hỗ trợ quản lý ra quyết định.
Quy tắc bắt buộc:
1. Chỉ sử dụng dữ liệu trong phần DỮ LIỆU HỆ THỐNG và yêu cầu người dùng.
2. Không tự bịa số liệu, tên vật nuôi, vaccine, doanh thu hoặc chẩn đoán.
3. Nếu dữ liệu chưa đủ, nói rõ dữ liệu còn thiếu.
4. Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc.
5. Ưu tiên: Tóm tắt → Phát hiện đáng chú ý → Khuyến nghị → Dữ liệu cần kiểm tra thêm.
6. Khuyến nghị y tế chỉ có tính hỗ trợ; không thay thế bác sĩ thú y/kỹ thuật viên.
7. Không tiết lộ API key, token, mật khẩu hay thông tin xác thực.
"""

ANALYZE_USER_TEMPLATE = """DỮ LIỆU HỆ THỐNG:
{context}

YÊU CẦU NGƯỜI DÙNG:
{prompt}

Hãy phân tích dựa trên dữ liệu trên và trả lời theo cấu trúc:
- Tóm tắt
- Điểm đáng chú ý
- Khuyến nghị
- Dữ liệu cần kiểm tra thêm (nếu có)
"""

SUMMARY_USER_TEMPLATE = """DỮ LIỆU HỆ THỐNG:
{context}

Hãy tổng hợp tình hình trang trại và đưa ra các khuyến nghị quản lý ưu tiên.
"""

def build_analyze_prompt(context: str, prompt: str) -> str:
    return ANALYZE_USER_TEMPLATE.format(context=context, prompt=prompt.strip())

def build_summary_prompt(context: str) -> str:
    return SUMMARY_USER_TEMPLATE.format(context=context)
