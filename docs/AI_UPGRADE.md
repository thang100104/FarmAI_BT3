# FarmAI — nâng cấp phân tích dữ liệu

## Chạy ứng dụng

```sh
docker compose up --build
```

Giao diện http://localhost:3000, Swagger http://localhost:8000/docs.
Compose sử dụng PostgreSQL và volume hiện có. Không chạy `docker compose down -v` nếu cần giữ dữ liệu.
Không thay đổi các tài khoản demo. Database mới cần `SEED_DEMO_DATA=true` để tạo tài khoản demo; database đang có dữ liệu có thể giữ `false`.

Chạy cục bộ với database SQLite hiện có:

```sh
SEED_DEMO_DATA=false .venv/bin/python -m uvicorn app.main:app --app-dir backend --env-file .env --host 127.0.0.1 --port 8000
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

`DATABASE_URL` quyết định database. Không tự chuyển dữ liệu SQLite sang PostgreSQL. Các truy vấn dùng SQLAlchemy, tương thích hai hệ quản trị.

## AI và fallback

`OPENAI_API_KEY` không bắt buộc. Thiếu key hoặc gặp lỗi provider, quota, timeout, model: backend trả HTTP 200 với `mode=fallback`, số liệu thực và nhãn Phân tích nội bộ.
`OPENAI_MODEL` đọc từ biến môi trường; không có khóa trong frontend. Gọi mô hình thành công trả `mode=ai`.
Fallback hỗ trợ tổng đàn, vaccine quá hạn/trong 7 ngày tới, sức khỏe, chuồng, tồn thức ăn, tăng trưởng theo mã và doanh thu tháng này. Bộ lọc thời gian chưa hỗ trợ được thông báo rõ, không thay bằng tổng toàn kỳ.
Tổng đàn không gồm đã xóa; đàn hiện tại chỉ gồm `dang_nuoi`. Vaccine cảnh báo chỉ tính đàn đang nuôi. Doanh thu tháng này theo Asia/Ho_Chi_Minh, database lưu UTC.

Context JSON giới hạn 10.000 ký tự, giữ tổng số chính xác và cờ `truncated` cùng `counts` nếu cắt danh sách. Không đưa bảng tài khoản hoặc bí mật cấu hình vào context.

Ngưỡng tồn kho: dưới 50 đơn vị của từng loại. Chuồng gần đầy: từ 90% sức chứa khai báo. Đây là quy tắc cảnh báo vận hành.
Tăng trưởng tính từ lần đo đầu/cuối, không dùng AI làm số học. Ít hơn hai lần đo khác thời điểm: `insufficient_data`; giảm cân: `decreasing`; không tăng cân: `slow_growth`; tăng cân: `stable_growth`. Nhãn stable_growth chỉ mô tả tăng cân đã ghi nhận, không khẳng định đạt chuẩn sinh học. Cần định mức theo loài/tuổi để đánh giá tăng trưởng chậm so với chuẩn.

## API

- `GET /api/ai/alerts`: cảnh báo, high trước medium trước low.
- `GET /api/ai/growth/{animal_id}`: lịch sử đo và các chỉ số tính sẵn; 404 nếu không có vật nuôi.
- `POST /api/ai/analyze`: prompt, page, messages, conversation_id tùy chọn.
- `POST /api/ai/summary`: tối đa 5 cảnh báo và 5 khuyến nghị.
- `GET /api/ai/history`: tối đa 100 lượt gần nhất của tài khoản hiện tại, gồm prompt, response, model, mode, status, query_type, conversation_id và created_at.
- `DELETE /api/ai/conversations/{conversation_id}`: chỉ xóa lịch sử của chính tài khoản; không sửa dữ liệu nghiệp vụ.

Mọi endpoint yêu cầu đăng nhập. Admin cũng chỉ xem hội thoại của mình. Nội dung mới được lưu để tiếp tục hội thoại; lịch sử cũ giữ nguyên và ẩn nội dung. Migration chỉ thêm cột model/query_type/conversation_id, không xóa seed hoặc bảng.
Prompt tối đa 4.000 ký tự; từ chối thông tin xác thực; cooldown theo user. SQL do backend xây từ danh mục cho phép, mô hình không được thực thi SQL, shell hoặc sửa dữ liệu.

## Kiểm tra

```sh
.venv/bin/python -m pytest -q tests
cd frontend
npm test
npm run build
cd ..
docker compose build
```

Test sử dụng database tạm và mock provider, không tiêu tốn tín dụng OpenAI. Không thể xác minh chất lượng câu trả lời của provider thật khi khóa hết quota.

## File thay đổi

- `backend/app/main.py`: API, fallback, audit hội thoại, migration thêm cột.
- `backend/app/ai/analytics.py`: phân tích số liệu, cảnh báo, tăng trưởng, context có giới hạn.
- `backend/app/ai/context.py`: context chi tiết từ database.
- `backend/app/ai/prompts.py`: prompt dựa trên dữ liệu, không chẩn đoán.
- `backend/app/ai/workspace.py`: giữ truy vấn có kiểm soát, áp dụng prompt mới.
- `frontend/src/main.jsx`: chatbot, hội thoại, lịch sử, tìm kiếm, copy, badge nguồn.
- `frontend/src/style.css`: bố cục chatbot và responsive.
- `frontend/Dockerfile`: npm ci theo lockfile, cache và giới hạn kết nối registry.
- `tests/test_ai_chat.py`: cập nhật hợp đồng fallback và lịch sử mới.
- `tests/test_ai_analytics.py`: test API, dữ liệu thực, cảnh báo, tăng trưởng, phân quyền, doanh thu và bảo mật.
- `README.md`: hướng dẫn chạy và liên kết tài liệu mới.
- `docs/AI_UPGRADE.md`: tài liệu nâng cấp.

## Kết quả kiểm chứng ngày 28/10/2026

- Backend: 67 test đạt.
- Frontend: 10 test đạt; Vite production build thành công.
- `docker compose build`: backend và frontend đều Built, exit 0.
- PostgreSQL 15 tạm: đăng nhập, API đọc có phân quyền, cảnh báo, tăng trưởng, lịch sử, bốn câu hỏi fallback, summary và schema AI đều đạt; đã dọn container tạm.
- Migration trên database cũ: thêm ba cột metadata AI, giữ nguyên lịch sử cũ.
- Backend đang chạy: health, alerts, growth, history đều HTTP 200 với tài khoản admin.
- Sau khi người dùng cho phép gửi dữ liệu thực tới OpenAI: `/api/ai/analyze` trả HTTP 200, `mode=fallback`, có câu trả lời từ dữ liệu thật.
- Chưa kiểm tra trực quan bằng trình duyệt vì công cụ trình duyệt không khả dụng và điều khiển Chrome bị timeout. Đã kiểm tra biên dịch frontend.
