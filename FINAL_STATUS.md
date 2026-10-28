# Trạng thái bản web hoàn thiện

## Đã hoàn thiện
- Đăng nhập JWT, RBAC và menu theo vai trò.
- Admin quản lý tài khoản: tạo, sửa vai trò/trạng thái, đặt lại mật khẩu.
- Quản lý vật nuôi: thêm/sửa/xóa, tìm kiếm, lọc, phân trang, xuất bán theo quyền.
- Chuồng trại: CRUD, phân chia Khu A/B/C/Khu cách ly, hiển thị sức chứa và vật nuôi.
- Chăm sóc, vaccine, tăng trưởng.
- Thức ăn: danh mục kho tổng, cấp theo chuồng, chuyển giữa chuồng, lịch sử chuyển.
- Dashboard KPI, cảnh báo sức khỏe/vaccine/tồn kho.
- Tìm kiếm nhanh toàn hệ thống.
- Báo cáo xem/in PDF bằng trình duyệt.
- AI Assistant: context CSDL, prompt tách lớp, guardrails, timeout/rate-limit, fallback và lịch sử AI.
- Cấu hình deploy Render bằng `VITE_API_URL`, `DATABASE_URL`, `CORS_ORIGINS`.

## Kiểm tra kỹ thuật đã thực hiện trong môi trường tạo file
- Python backend: `py_compile` thành công.
- JSX frontend: TypeScript parser xác nhận cú pháp JSX hợp lệ.
- docker-compose.yml: YAML parse hợp lệ.
- Không chạy được full `npm build`/`pytest` tại môi trường tạo file do môi trường này không có Internet để tải dependency. Dự án đã giữ đầy đủ `package.json` và `requirements.txt` để Docker/Render cài dependency khi build.
