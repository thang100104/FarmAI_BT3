# Hướng dẫn triển khai Bài 3

## Files chính đã chỉnh
- `backend/app/main.py`: tích hợp AI layer, rate limit, fallback, RBAC history.
- `backend/app/ai/prompts.py`: prompt hệ thống/user.
- `backend/app/ai/context.py`: lấy dữ liệu từ CSDL.
- `backend/app/ai/guardrails.py`: giới hạn và kiểm soát input/output.
- `backend/app/ai/llm.py`: gọi OpenAI Responses API có timeout.
- `frontend/src/main.jsx`: hiển thị lỗi AI và lượng context đã gửi.

## Không cần đưa API key vào frontend
Chỉ đặt `OPENAI_API_KEY` trong `.env` ở thư mục có `docker-compose.yml`.
