# Smart Livestock AI – tích hợp hiện tại (22/10/2026)

## Luồng chat và dữ liệu

Tính năng dùng nguyên component `AI` trong `frontend/src/main.jsx` và endpoint `POST /api/ai/analyze`; không có chatbot riêng. Frontend gửi câu hỏi, ngữ cảnh trang và tối đa 10 tin user/assistant đã thành công. Tin lỗi/pending không được đưa vào câu hỏi tiếp nối. Hội thoại không lưu vào localStorage hoặc database; chuyển trang trong phiên vẫn giữ hội thoại. Server chỉ lưu metadata sử dụng AI của chính tài khoản.

Luồng có hai đường được ghi nhãn riêng:

1. **Báo cáo hệ thống:** “hãy cho tôi xem báo cáo”, “hay cho toi xem bao cao”, “báo cáo tổng hợp”, “mở báo cáo nhé” chạy bộ xử lý xác định `ai/reports.py`. Bộ xử lý dùng chính `registry/read_data` đã kiểm tra quyền, lấy thống kê toàn bộ kết quả, dựng văn bản dễ đọc và trả nguồn `#reports`. Không gọi OpenAI, hoạt động cả khi không có khóa; mode trả về là `system_report`, không giả thành AI thật.
2. **Hỏi đáp bằng mô hình:** backend gọi OpenAI Responses API để tạo kế hoạch JSON Schema strict, xác thực lại kế hoạch bằng Pydantic, chạy bộ truy vấn chỉ đọc rồi gửi kết quả cho mô hình diễn đạt. Lịch sử dùng hiểu câu tiếp nối; số liệu luôn tra lại từ database. `OPENAI_MODEL` chỉ lấy từ cấu hình backend, không cho client chỉ định. Yêu cầu gửi provider có `store=False`, timeout, giới hạn output và không tự retry. Không tự đổi model hay trả câu trả lời giả khi provider lỗi.

Báo cáo hệ thống gồm đàn đang nuôi, sức khỏe, cân nặng trung bình, số chuồng/sức chứa, số loại thức ăn tồn thấp, chăm sóc, vaccine chưa tiêm, số lần đo, phiếu/số con xuất bán và doanh thu. Xuất bán cộng `quantity`, không đếm phiếu thành số con. Số liệu chăm sóc/xuất bán tính toàn bộ lịch sử; đàn/vaccine/tăng trưởng lấy phạm vi đang nuôi. Không có bản ghi thì trung bình/tổng chưa có dữ liệu được nêu rõ; count=0 là không có bản ghi. Thức ăn tồn thấp tính dưới 50 theo đơn vị của từng loại, không cộng trộn đơn vị. Hạn chế: router báo cáo không có model chỉ nhận các yêu cầu tổng hợp nêu trên; báo cáo có điều kiện thời gian/chuồng cần mô hình. Không âm thầm bỏ bộ lọc để trả tổng toàn trại.

## Nguồn dữ liệu và quyền

FastAPI/SQLAlchemy ở `backend/app/main.py`; SQLite mặc định, PostgreSQL qua Docker Compose. Bộ truy vấn không chạy SQL, eval hay mã do mô hình tạo. Chỉ cho list/count/sum/avg/min/max, trường và JOIN cố định, bộ lọc eq/contains/gte/lte/gt/lt. Kế hoạch mô hình tối đa 6 truy vấn, 8 điều kiện/truy vấn, 30 dòng/nhóm; báo cáo hệ thống dùng các truy vấn thống kê cố định của backend. Có cờ danh sách/nhóm bị cắt và tổng bản ghi. Truy vấn tên hỗ trợ tiếng Việt có/không dấu, giới hạn 1.000 giá trị phân biệt. Thời gian lưu UTC, câu hỏi thời gian Việt Nam phải chuyển khoảng UTC.

| Trang | API/nguồn |
|---|---|
| Tổng quan | `/api/dashboard`; thống kê bảng gốc |
| Đàn vật nuôi | `/api/animals`; animals nối barns |
| Chuồng trại | `/api/barns`; barns và thống kê animals |
| Chăm sóc | `/api/care`; care_logs nối animals/barns |
| Thức ăn | `/api/feed-types`, `/barn-feeds`, `/feed-transfers`, `/feed-norms`; loại, tồn, chuyển, định mức |
| Vaccine | `/api/vaccinations`; vaccinations nối animals/barns |
| Tăng trưởng | `/api/growth`; growth_measurements nối animals/barns |
| Xuất bán | `/api/exports`; export_bills nối animals/barns |
| Báo cáo | `/api/reports/health`, `/growth`, `/sales`; các thống kê từ bảng gốc |
| Trợ lý | `/api/ai/analyze`, `/summary`, `/capabilities`, `/history`; metadata lịch sử của chính tài khoản |
| Tài khoản | `/api/users`; chỉ Admin, không có password_hash/token |

Giữ ranh giới quyền backend hiện có: bốn vai trò đọc dữ liệu nghiệp vụ chung của trại; chỉ Admin đọc danh sách tài khoản. Lịch sử chỉ của chính tài khoản, kể cả Admin. JWT, vai trò và trạng thái tài khoản được kiểm tra từ database mỗi request. Menu ẩn trước đây không phải ranh giới quyền backend; dự án chưa có tenant/ownership theo người dùng cho dữ liệu nghiệp vụ. Các JOIN có mã con, tên chuồng, trạng thái vật nuôi; chuyển thức ăn có tên chuồng nguồn/đích. Thông tin xác thực không có trong danh mục và các chuỗi giống token/key được che trước khi đưa dữ liệu ra ngoài.

Trợ lý chỉ đọc và hướng dẫn; không có công cụ thêm/sửa/xóa. Yêu cầu ghi dẫn về biểu mẫu hiện có, API nghiệp vụ tiếp tục kiểm tra quyền. Định mức có dữ liệu/API nhưng chưa có màn hình sửa riêng; hướng dẫn nêu rõ giới hạn này.

## Cấu hình backend và Docker

**Tệp cần tự điền:** `/Users/havanthang/Downloads/FarmAI_BT3_HoanChinh_DaSua/.env` (cùng cấp `docker-compose.yml`). Tìm hai dòng `OPENAI_API_KEY=` và `OPENAI_MODEL=`:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
AI_TIMEOUT_SECONDS=25
AI_MAX_OUTPUT_TOKENS=4096
AI_COOLDOWN_SECONDS=2
SEED_DEMO_DATA=false
```

Điền khóa trực tiếp sau dấu `=` trong `.env` bằng IDE. Không dán khóa vào chat, frontend, terminal command có lịch sử, Git hoặc log. Model có thể đổi theo quyền truy cập của tài khoản; cấu hình tên model không chứng minh model hoạt động. `AI_MAX_OUTPUT_TOKENS` có default 4096 nếu `.env` hiện tại chưa có dòng này.

`.env` được `.gitignore` loại trừ; backend/frontend `.dockerignore` loại `.env` khỏi build context. Frontend không nhận `OPENAI_API_KEY` hoặc `OPENAI_MODEL`. Backend đọc biến lúc khởi động. `.env.example` có mẫu trống và chú thích đúng với khả năng báo cáo không cần khóa.

Compose đọc `.env` để nội suy rồi truyền `OPENAI_API_KEY`, `OPENAI_MODEL`, timeout và output limit qua `services.backend.environment`. Shell đã export biến có thể ghi đè `.env`, kể cả giá trị rỗng; dùng `unset OPENAI_API_KEY` khi cần để Compose lấy từ tệp. Không chạy/in `docker compose config`, `config --environment`, `env` hoặc log debug để chia sẻ vì có thể làm lộ bí mật. Dùng:

```sh
python3 scripts/check_ai_config.py
```

Script chỉ in cờ boolean; không gọi OpenAI, không khởi động service hay ghi dữ liệu. Nó kiểm tra Compose, model/key/output limit ở cấu hình backend, frontend không nhận khóa, driver PostgreSQL, daemon, và nếu service đã chạy thì kiểm tra key hiện diện trong container/pg_isready. `configured=true` không có nghĩa khóa được xác thực thành công.

Giữ `SEED_DEMO_DATA=false` để backend không thêm dữ liệu demo/tài khoản hoặc làm mới trạng thái chuồng khi khởi động. Dùng database và tài khoản đang có; không tạo dữ liệu nghiệp vụ/volume mới chỉ để làm bài thử, không chạy `down -v`.

Sau khi tự điền khóa, với Docker đang có database:

```sh
docker compose --env-file .env up -d --no-deps --build --force-recreate backend
docker compose up -d --no-deps --build frontend
python3 scripts/check_ai_config.py
```

`docker compose restart` không nạp lại môi trường container. Dùng `force-recreate` như trên để nhận cấu hình mới. Docker daemon/PostgreSQL phải đang sẵn sàng trước khi cập nhật backend không kèm dependencies.

Chạy local, từ thư mục gốc, mỗi lệnh ở một terminal:

```sh
cd backend
../.venv/bin/python -m uvicorn app.main:app --env-file ../.env --host 127.0.0.1 --port 8000
```

```sh
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

Nếu terminal Node chưa nhận npm, kích hoạt phiên bản Node qua nvm rồi chạy lại. Mở `http://127.0.0.1:3000/`. `uvicorn --env-file ../.env` nạp biến trước khi import app; chạy uvicorn không có `--env-file` không tự đọc `.env`. Chạy backend từ `backend` để SQLite mặc định trỏ `backend/livestock.db`, không vô tình dùng database khác.

Frontend lấy `VITE_API_URL` nếu đã đặt, nếu không dùng cùng hostname/protocol đang mở web và cổng backend 8000 (`127.0.0.1:3000` → `127.0.0.1:8000/api`). Với Docker frontend port 3000 cũng dùng backend port 8000 trên cùng host. `CORS_ORIGINS` trong mẫu có localhost/127.0.0.1 ở cổng 3000 và 5173. Nếu triển khai khác máy hoặc HTTPS, đặt `VITE_API_URL` và CORS đúng địa chỉ, build frontend lại; không đưa cấu hình OpenAI vào `VITE_*`.

## Lỗi hiển thị

Backend trả `detail: {code, message, retryable}` cho lỗi provider; frontend giữ nguyên thông báo cụ thể ở alert và tin lỗi, không thay bằng câu chung. Phân biệt với 401/403 của phiên đăng nhập ứng dụng.

| Code | Ý nghĩa / cách xử lý |
|---|---|
| `ai_not_configured` (503) | Chưa có key; báo cáo hệ thống vẫn hoạt động |
| `openai_authentication` (502) | OpenAI từ chối key, cần kiểm tra khóa |
| `openai_permission` (502) | Key/project không có quyền tài nguyên/model |
| `openai_model` (502 hoặc 503 nếu chưa đặt) | Model không tồn tại, không được cấp quyền hoặc cấu hình trống |
| `openai_quota` (429) | Hết tín dụng/hạn mức ngân sách; không giả thành lỗi mạng |
| `openai_rate_limit` (429) | Giới hạn tần suất, chờ rồi thử lại |
| `openai_connection` (502) | Backend không kết nối OpenAI; kiểm tra mạng/proxy/TLS |
| `openai_timeout` (504) | Vượt thời gian chờ |
| `openai_invalid_request` (502) | Tham số tích hợp bị provider từ chối |
| `openai_unavailable` / `openai_failed` (502) | Dịch vụ hoặc yêu cầu provider không hoàn thành |
| `openai_incomplete` / `openai_empty_response` (502) | Kết quả bị cắt/không có nội dung, không coi là trả lời thành công |
| `ai_invalid_plan` (502) | Kế hoạch từ model không hợp lệ; không thực thi và không thay bằng số liệu khác |
| `ai_processing_error` (502) | Lỗi xử lý backend khác, không gán nhầm thành lỗi khóa/mạng |

Không trả exception gốc, response body, headers, khóa hoặc request data của SDK vào API/log. Lỗi local cooldown 429 có thông báo chờ riêng. Lỗi mạng giữa trình duyệt/backend, timeout, JSON sai và validation 422 có thông báo tiếng Việt; input nhạy cảm trong validation error không hiển thị. Có nút kiểm tra cấu hình lại, giữ câu hỏi để thử gửi lại. Có khóa chỉ là trạng thái cấu hình, không hiển thị như đã gọi AI thành công.

## Kiểm tra

```sh
PYTHONPYCACHEPREFIX=/private/tmp/farmai-pycache .venv/bin/python -m pytest tests -q
npm --prefix frontend test
npm --prefix frontend run build
python3 scripts/check_ai_config.py
```

Pytest tự cô lập database tạm và đặt key trống, không dùng database nghiệp vụ hoặc có cuộc gọi tính phí. Fixture dữ liệu giả chỉ ở database test. Test provider dùng SDK OpenAI thật với HTTPX MockTransport để kiểm tra request Responses (`model`, `instructions`, `store=False`, output budget và JSON Schema strict) cùng từng loại lỗi. Đây là **kiểm tra mô phỏng HTTP**, không phải gọi OpenAI thật.

Báo cáo không khóa được kiểm tra qua HTTP TestClient với database SQLite cô lập: số con bán cộng quantity, doanh thu, đàn đang nuôi, kết quả trống, liên kết reports và bốn vai trò; xác nhận không gọi provider và không thay dữ liệu nghiệp vụ. Các test có sẵn tiếp tục kiểm tra JWT, đổi vai trò, khóa tài khoản, lịch sử riêng, câu hỏi tiếp nối, query allowlist, bộ lọc, dữ liệu trống, timeout và lỗi frontend.

Kết quả lượt tích hợp: **56 tests backend đạt**, **10 tests frontend logic đạt**, **Vite production build thành công**. Lần kiểm tra cấu hình cuối: Compose có giá trị key/model/output limit, frontend không nhận key, seeding tắt; Docker daemon không truy cập được nên chưa kiểm tra container/PostgreSQL thực tế.

**Đã thử API thật một lần:** gửi yêu cầu kết nối tối thiểu chỉ yêu cầu trả OK, không gửi dữ liệu trang trại. OpenAI từ chối xác thực; wrapper trả mã `openai_authentication` (HTTP lỗi của ứng dụng là 502; upstream SDK là AuthenticationError). Chưa có cuộc gọi AI thành công và chưa đối chiếu hội thoại AI thật với dữ liệu nghiệp vụ. Khóa hiện có giá trị nhưng không được provider chấp nhận; người dùng cần tự kiểm tra/thay khóa trong `.env`, không gửi khóa qua chat. Chưa thể xác minh quyền model/quota vì thất bại ngay ở xác thực. Không lặp lại yêu cầu sau lỗi xác thực.

**HTTP localhost đã xác nhận sau khi cập nhật backend:** frontend `http://127.0.0.1:3000/` và health backend `http://127.0.0.1:8000/api/health` đều 200; CORS chấp nhận origin frontend; module client đang phục vụ có code báo cáo không cần khóa và resolve đúng hostname; POST chat không có token trả 401. Không dùng thành công health/CORS hoặc test giả lập để khẳng định provider hoạt động. Kiểm tra UI trực quan vẫn chưa thực hiện vì không có browser khả dụng.

Kiểm tra khi đã có khóa và backend đang chạy: với tài khoản đang có, hỏi một câu ngoài router báo cáo như “có bao nhiêu vật nuôi đang nuôi?”, kiểm tra mode `openai`, rồi hỏi tiếp “chỉ trong chuồng đó?” sau câu có tên chuồng rõ ràng. Đối chiếu số liệu với các API tương ứng. Hỏi “hãy cho tôi xem báo cáo” phải là mode `system_report`, có nhãn hệ thống và nút mở Báo cáo; câu này không kiểm tra kết nối OpenAI.

| Nhóm | Câu hỏi | Nguồn đối chiếu |
|---|---|---|
| Vật nuôi | Có bao nhiêu con đang nuôi? | dashboard.total_animals, animals với đầy đủ phân trang |
| Chuồng | Có bao nhiêu chuồng? | barns |
| Chăm sóc | Có bao nhiêu nhật ký chăm sóc? | care |
| Thức ăn | Tồn kho từng loại là bao nhiêu? | feed-types, không cộng trộn đơn vị |
| Vaccine | Có bao nhiêu lịch chưa tiêm? | vaccinations, status=chua_tiem; lọc animal_status nếu hỏi đàn đang nuôi |
| Tăng trưởng | Có bao nhiêu lần đo? | growth; không nhầm số con/mức tăng cân |
| Xuất bán | Đã bán bao nhiêu con, doanh thu bao nhiêu? | exports: SUM quantity và SUM total |
| Báo cáo | Thống kê sức khỏe đàn đang nuôi | reports/health |

Nếu dữ liệu rỗng phải nói rõ; không thêm/sửa dữ liệu để thử. Hỏi thêm “còn tháng trước?” và câu tương đương không dấu; kiểm tra bộ lọc ngày Việt Nam/khoảng UTC. Bấm liên kết nhanh đến đúng trang, chuyển trang giữ hội thoại, đăng xuất không lộ state/lịch sử phiên trước. Non-Admin không xem users, mọi vai trò chỉ xem lịch sử metadata của mình. Không đổi quyền/khóa tài khoản thật để thử; các tình huống này dùng fixture test.

Desktop/mobile cần kiểm tra render bằng trình duyệt: 1440×900, 390×844, 360×800; không cuộn ngang, tin dài xuống dòng, nút/gợi ý không vượt khung, trạng thái chờ/lỗi dễ thấy. Enter gửi, Shift+Enter xuống dòng; IME tiếng Việt không gửi khi còn ghép ký tự. Môi trường hiện không có browser khả dụng nên chưa xác nhận render trực quan. Các cổng local trước đây bị sandbox chặn; có thể chạy service bằng quyền localhost đã cấp, không suy ra rằng Docker/PostgreSQL cũng sẵn sàng.

Để xác minh backend → PostgreSQL thực sự, chỉ dùng database đang chạy, kiểm tra `pg_isready` qua script cấu hình rồi chạy SELECT 1 không import app và không in DSN/exception:

```sh
docker compose exec -T backend python - <<'PYCODE'
import os
from sqlalchemy import create_engine, text
try:
    engine = create_engine(os.environ['DATABASE_URL'])
    with engine.connect() as conn:
        ok = conn.execute(text('SELECT 1')).scalar() == 1
    print('backend_postgres_connection_ok:', ok)
except Exception:
    print('backend_postgres_connection_ok:', False)
PYCODE
```

Chỉ ghi nhận PostgreSQL đạt khi SELECT 1 thành công. Parse Compose không chứng minh đã chạy container hoặc nối database.

## Tệp triển khai

- `backend/app/ai/llm.py`: Responses API, structured output, lỗi có mã an toàn.
- `backend/app/ai/reports.py`: báo cáo hệ thống không phụ thuộc khóa.
- `backend/app/ai/workspace.py`, `backend/app/main.py`: kế hoạch, endpoint hiện có, capabilities, quyền và phân luồng.
- `frontend/src/ai-client.js`, `frontend/src/main.jsx`: API URL, thông báo lỗi, gợi ý, báo cáo không khóa trong chat hiện có.
- `.env.example`, `docker-compose.yml`, `scripts/check_ai_config.py`: cấu hình và kiểm tra không lộ bí mật.
- `tests/conftest.py`, `tests/test_ai_chat.py`, `tests/test_openai_provider.py`, `frontend/tests/ai-client.test.mjs`: kiểm thử cô lập và hồi quy.

Tích hợp đối chiếu [OpenAI Responses API](https://developers.openai.com/api/reference/python/resources/responses/methods/create) và [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes). Việc xác thực khóa/model thực tế cần một cuộc gọi provider thành công, không suy ra từ tài liệu.
