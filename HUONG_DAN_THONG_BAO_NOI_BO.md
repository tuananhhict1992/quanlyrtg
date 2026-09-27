# Thông báo nội bộ RTG

Cập nhật 27/09/2026. Thông báo được lưu trong Supabase PostgreSQL và đọc ngay trong ứng dụng RTG. Không cần Zalo OA hay tài khoản Zalo.

## Sử dụng

1. Đăng nhập web, mở **Thông báo nội bộ** hoặc biểu tượng tin nhắn trên thanh trên cùng. Hộp thư giữ lịch sử và trạng thái đã đọc.
2. Người có quyền quản trị thông báo chọn cá nhân, Ca hoặc toàn thể; nhập nội dung và bấm **Phát Thông Báo Nội Bộ Ngay**. Chat nhanh sử dụng cùng kênh nội bộ.
3. Trong chi tiết vi phạm hoặc phiếu phép, người có thẩm quyền bấm **Thông báo nội bộ**, chọn cá nhân/Ca RTG/tập thể, sửa nội dung, **Xem trước thông báo** rồi **Xác nhận gửi vào app**. Duyệt/từ chối phép cũng mở bản nháp để kiểm tra trước khi gửi.
4. Trong Kiểm tra, chọn người nhận rồi **Giao bài & Gửi thông báo**. Mỗi nhân viên nhận một thông báo cho đề được giao. Gửi lại cùng đề và người không tạo thêm tin.
5. Nếu lưu thất bại, lỗi hiển thị và bản nháp được giữ. Gửi lại cùng bản nháp dùng cùng mã yêu cầu để tránh trùng khi mất phản hồi.

## Hẹn giờ và quyền

- Hẹn giờ dùng múi giờ Việt Nam. Khi có người mở app, hộp thư kiểm tra lịch mỗi 30 giây và phát các tin đã đến giờ. Nếu không ai mở app và worker không chạy, tin được phát khi app được mở lại. Không phải thông báo đẩy của hệ điều hành khi app đóng.
- Quyền thông báo chung giữ mã kỹ thuật cũ MANAGE_ZALO; nhãn giao diện là thông báo nội bộ. Gửi toàn thể cần SEND_BROADCAST_NOTIFICATION hoặc Admin.
- Thông báo nghiệp vụ kiểm tra quyền vi phạm/phép/kiểm tra và phạm vi Ca được quản lý ở server. Chỉ nhân sự ACTIVE trong phạm vi được phép nhận tin.
- Hệ thống chỉ xét các vụ việc Tổ RTG. Thông báo không thay đổi hồ sơ vi phạm, kết quả thi hoặc quyết định phép.
- Google Drive và Google Sheets tiếp tục là kho file/báo cáo; PostgreSQL là database chính. Không có gửi qua Zalo.

## Bảo trì

Tên kỹ thuật zaloMessages trong database được giữ để đọc đầy đủ lịch sử cũ. API /api/zalo đã ngừng (410 sau xác thực), provider cũ trả channel_disabled và worker không gọi Zalo. Ba bảng private từng dành cho Zalo được giữ nguyên cùng RLS; không cần chạy lại hay xóa migration.
