# Hoàn thiện web theo báo cáo kết thúc học phần

- API frontend đổi sang biến môi trường `VITE_API_URL`, sẵn sàng deploy cloud.
- Bổ sung phân quyền menu theo vai trò.
- Bổ sung quản lý tài khoản dành cho Admin: tạo tài khoản, sửa vai trò/trạng thái, đặt lại mật khẩu.
- Tắt luồng tự reset mật khẩu không an toàn; người dùng liên hệ Admin.
- Bổ sung tìm kiếm nhanh toàn hệ thống ở thanh trên.
- Bổ sung cảnh báo sức khỏe, vaccine sắp đến hạn/quá hạn và tồn kho thức ăn thấp.
- Bổ sung tìm kiếm, lọc trạng thái và phân trang ở quản lý vật nuôi.
- Bổ sung chọn chuồng theo tên/khu vực thay vì nhập ID thủ công.
- Bổ sung phân chia chuồng theo Khu A/B/C/Khu cách ly và thanh mức sử dụng sức chứa.
- Bổ sung quản lý danh mục thức ăn và tồn kho tổng.
- Bổ sung lịch sử sử dụng AI ở giao diện AI.
- Cải thiện CORS, PostgreSQL URL và cấu hình Render.
- Thêm tài liệu `DEPLOY_RENDER.md` và `frontend/.env.example`.
