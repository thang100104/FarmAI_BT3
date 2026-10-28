# Triển khai Smart Livestock lên Render

## 1. PostgreSQL
- Name: `smart-livestock-db`
- Region: Singapore
- Tạo database và giữ lại **Internal Database URL**.

## 2. Backend Web Service
- Repository: repo GitHub của dự án
- Branch: `main`
- Root Directory: `backend`
- Runtime: Docker hoặc Python
- Nếu dùng Python:
  - Build: `pip install -r requirements.txt`
  - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment:
  - `DATABASE_URL`: Internal Database URL của Render PostgreSQL
  - `JWT_SECRET_KEY`: chuỗi bí mật dài, tự tạo
  - `ACCESS_TOKEN_EXPIRE_MINUTES=480`
  - `OPENAI_API_KEY`: để trống nếu chỉ demo fallback
  - `OPENAI_MODEL=gpt-5`
  - `AI_TIMEOUT_SECONDS=25`
  - `AI_COOLDOWN_SECONDS=2`
  - `CORS_ORIGINS=https://<frontend-cua-ban>.onrender.com`

Sau khi backend deploy xong, kiểm tra:
- `https://<backend>.onrender.com/api/health`
- `https://<backend>.onrender.com/docs`

## 3. Frontend Static Site
- Root Directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment:
  - `VITE_API_URL=https://<backend>.onrender.com/api`

Sau khi thay đổi biến môi trường, redeploy frontend.

## 4. Tài khoản demo
- Admin: `admin / admin123`
- Nhân viên trại: `nhanvientrai1 / staff123`
- Kỹ thuật viên: `kythuatvien1 / tech123`
- Nhân viên xuất bán: `xuatban1 / sale123`

## 5. Bảo mật trước khi nộp
- Không commit `.env`.
- Không đưa API key thật vào báo cáo hoặc frontend.
- Đổi `JWT_SECRET_KEY` trên cloud.
- Sau khi demo nên đổi mật khẩu các tài khoản mẫu nếu tiếp tục dùng hệ thống.
