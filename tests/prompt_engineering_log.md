# Prompt Engineering Log – Bài kiểm tra thường xuyên 3

## Vòng 1 – Prompt ngắn
**Prompt:** "Hãy phân tích tình trạng đàn."

**Kết quả:** Dễ trả lời nhưng thiếu cấu trúc, có nguy cơ khuyến nghị chung chung và không nhắc dữ liệu thiếu.

**Cải thiện:** Tách system prompt và user prompt; yêu cầu chỉ dùng dữ liệu hệ thống.

## Vòng 2 – Prompt có vai trò + dữ liệu
**Thay đổi:** Bổ sung vai trò trợ lý chăn nuôi, truyền context từ CSDL và quy tắc không bịa số liệu.

**Kết quả:** Câu trả lời bám dữ liệu tốt hơn, nhưng định dạng giữa các lần trả lời chưa đồng nhất.

**Cải thiện:** Quy định cấu trúc `Tóm tắt → Điểm đáng chú ý → Khuyến nghị → Dữ liệu cần kiểm tra thêm`.

## Vòng 3 – Prompt có cấu trúc + guardrails
**Thay đổi:** Tách template khỏi code, giới hạn độ dài context/prompt/output, chặn secret-like input và bổ sung câu nhắc AI không thay thế bác sĩ thú y.

**Kết quả:** Câu trả lời ổn định hơn, giảm dữ liệu thừa và có cơ chế xử lý dữ liệu thiếu.

**Kết luận:** Vòng 3 được chọn cho bản triển khai.
