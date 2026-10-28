# Smart Livestock System v2

## Chạy bằng Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Demo

- admin / admin123
- nhanvientrai1 / staff123
- kythuatvien1 / tech123
- xuatban1 / sale123

## Modules

Dashboard, tài khoản/JWT/RBAC, vật nuôi CRUD, chuồng CRUD, chăm sóc, vaccine, tăng trưởng, thức ăn, định mức, xuất bán, báo cáo, AI summary/analyze/history.

AI hiện có chế độ fallback an toàn để hệ thống chạy không cần API key. Có thể thay thế hàm build_ai_answer bằng provider AI thật khi triển khai.

## Kết nối OpenAI / ChatGPT

Giao diện Trợ lý AI đã hỗ trợ gọi OpenAI Responses API ở backend. API key không được đưa vào frontend.

1. Tạo file `.env` cạnh `docker-compose.yml`.
2. Thêm:
   `OPENAI_API_KEY=...`
   `OPENAI_MODEL=gpt-5`
3. Chạy lại:
   `docker compose up --build`

Nếu không có `OPENAI_API_KEY`, hệ thống tự động dùng chế độ `fallback` để demo và vẫn hoạt động.

Tham khảo OpenAI Responses API: https://platform.openai.com/docs/quickstart/make-your-first-api-request

## Bài kiểm tra thường xuyên 3 – phần AI nâng cấp

Bản này tiếp tục trực tiếp từ source Bài 2 và bổ sung:
- Prompt được tách riêng trong `backend/app/ai/prompts.py`.
- Guardrails tại `backend/app/ai/guardrails.py`.
- Context AI lấy dữ liệu thực tế từ CSDL tại `backend/app/ai/context.py`.
- Provider OpenAI có timeout/retry giới hạn tại `backend/app/ai/llm.py`.
- Fallback an toàn khi thiếu API key hoặc provider lỗi.
- HTTP 429 khi gửi AI quá nhanh.
- Lịch sử AI có RBAC: user thường chỉ xem lịch sử của mình.
- Nhật ký 3 vòng tối ưu prompt: `tests/prompt_engineering_log.md`.
- Review code bằng AI và các cải tiến: `docs/AI_CODE_REVIEW.md`.
- Test tự động: `tests/test_ai_unit.py`, `tests/test_api_smoke.py`.

### Chạy test

```bash
pip install -r backend/requirements.txt
pip install pytest httpx
pytest -q tests
```

### Demo AI

Không có `OPENAI_API_KEY`: hệ thống vẫn chạy bằng fallback để demo chức năng.
Có API key ở backend: endpoint `/api/ai/analyze` và `/api/ai/summary` gọi provider thật.

## Bản hoàn thiện cuối học phần

Bản này đã được đồng bộ thêm theo quyển báo cáo cuối học phần: phân quyền UI, quản lý tài khoản Admin, tìm kiếm/lọc/phân trang, phân chia khu vực chuồng, kho thức ăn, cảnh báo, lịch sử AI và cấu hình deploy Render.

Xem hướng dẫn cloud: `DEPLOY_RENDER.md`.

## AI phân tích dữ liệu và fallback

Đã bổ sung `GET /api/ai/alerts`, `GET /api/ai/growth/{animal_id}`, hội thoại riêng theo tài khoản và phân tích nội bộ khi thiếu key/hết quota/timeout. Không bắt buộc `OPENAI_API_KEY` để phân tích dữ liệu trang trại. Backend trả `mode=ai` hoặc `mode=fallback`.

Xem quy tắc tính toán, giới hạn dữ liệu, các API và cách chạy tại [docs/AI_UPGRADE.md](docs/AI_UPGRADE.md). Không xóa volume PostgreSQL khi cập nhật.
