# Test Case – Smart Livestock System

| ID | Chức năng | Dữ liệu kiểm thử | Kết quả mong đợi |
|---|---|---|---|
| TC01 | Login đúng | admin/admin123 | HTTP 200, nhận JWT |
| TC02 | Login sai mật khẩu | admin/123456 | HTTP 401 |
| TC03 | Lấy dashboard | Token hợp lệ | HTTP 200, có thống kê |
| TC04 | Danh sách vật nuôi | GET /api/animals | HTTP 200 |
| TC05 | Thêm vật nuôi | Mã mới, weight >= 0 | Tạo thành công |
| TC06 | Mã vật nuôi trùng | VN001 | HTTP 400 |
| TC07 | Chuồng không tồn tại | barn_id=9999 | HTTP 400 |
| TC08 | Sửa vật nuôi | Dữ liệu hợp lệ | HTTP 200 |
| TC09 | Xóa vật nuôi | ID hợp lệ | Xóa mềm |
| TC10 | Ghi chăm sóc | animal_id hợp lệ | HTTP 200 |
| TC11 | Tạo lịch vaccine | Kỹ thuật viên | HTTP 200 |
| TC12 | Vaccine sai quyền | Nhân viên trại | HTTP 403 |
| TC13 | Ghi tăng trưởng | weight >= 0 | HTTP 200 |
| TC14 | Thêm thức ăn | stock >= 0 | HTTP 200 |
| TC15 | Lập phiếu xuất | vật nuôi đang nuôi | HTTP 200 |
| TC16 | Xuất vật nuôi đã bán | ID đã bán | HTTP 400 |
| TC17 | AI summary | Token hợp lệ | Có phân tích |
| TC18 | AI analyze | Prompt hợp lệ | Có kết quả và lưu lịch sử |
| TC19 | Xem lịch sử AI | Token hợp lệ | HTTP 200 |
| TC20 | Báo cáo sức khỏe | Token hợp lệ | Có thống kê |
