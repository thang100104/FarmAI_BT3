# Review code bằng AI – Bài kiểm tra thường xuyên 3

## Các vấn đề phát hiện trong phiên bản trước
1. Prompt được viết trực tiếp trong endpoint → khó thử nghiệm và bảo trì.
2. Context AI còn ít dữ liệu → phân tích chưa phản ánh đủ hệ thống.
3. Lịch sử AI trả về dữ liệu của mọi người dùng → chưa tốt về phân quyền dữ liệu.
4. Chưa giới hạn thời gian gọi provider và chưa có cooldown chống gửi liên tục.
5. Chưa kiểm soát prompt chứa chuỗi giống API key/token/mật khẩu.

## Cải thiện
- Tách `app/ai/prompts.py`, `guardrails.py`, `context.py`, `llm.py`.
- Context lấy từ CSDL: đàn, sức khỏe, khối lượng, chuồng, vaccine, thức ăn, tăng trưởng, doanh thu.
- Người dùng thường chỉ xem lịch sử AI của chính mình; Admin có thể xem toàn bộ.
- OpenAI client có timeout và retry giới hạn; lỗi provider chuyển sang fallback.
- Thêm HTTP 429 khi người dùng gửi yêu cầu AI quá nhanh.
- Prompt/output/context đều có giới hạn kích thước.
