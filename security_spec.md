# Phạm vi bảo mật hiện tại

Tài liệu này mô tả mã nguồn đã triển khai; kết quả kiểm chứng và giới hạn môi trường nằm trong [PRODUCTION_CHECK.md](PRODUCTION_CHECK.md).

## Xác thực và phân quyền

- Mọi API nghiệp vụ xác minh access token với Supabase Auth và đọc hồ sơ ACTIVE từ PostgreSQL. UID Auth phải được liên kết với employee ID trong `private.accounts`.
- Quyền lấy từ hồ sơ hiện tại trong database, không lấy từ dữ liệu trình duyệt, email đặc biệt hoặc user metadata.
- Bảng nghiệp vụ trong schema `private` bật RLS và thu hồi quyền của `anon`/`authenticated`. Node dùng kết nối server, áp dụng permission và ownership trước đọc/ghi; vì vậy kiểm tra ở Node là một phần bắt buộc của ranh giới bảo mật.
- Realtime chỉ phát tín hiệu tên module cho tài khoản đã được cấp quyền; dữ liệu được tải lại qua API có kiểm tra quyền.
- Mật khẩu chỉ do Supabase Auth quản lý. Không lưu mật khẩu trong hồ sơ, Excel, Sheets, audit hoặc log.

## Các ràng buộc quan trọng

- Nhân viên chỉ sửa các trường hồ sơ cá nhân cho phép. Thay role, permission, visible tabs hoặc trạng thái tài khoản cần quyền quản lý phân quyền.
- Nhân viên chỉ tự tạo/sửa yêu cầu nghỉ và góp ý đang chờ xử lý; không tự duyệt hoặc thay người sở hữu.
- Người làm bài không đọc ngân hàng đáp án hoặc tự ghi kết quả. Node tạo snapshot lượt thi, kiểm tra thời hạn và chấm điểm; nộp lại cùng lượt trả kết quả đã lưu.
- Audit append-only. Ghi nghiệp vụ, audit và enqueue nằm trong cùng transaction.
- Import Google phải xác nhận preview do chính người dùng tạo, còn hạn và đúng checksum; server không tin các dòng được sửa trong request Confirm.
- Upload kiểm tra kích thước, phần mở rộng, MIME và chữ ký tệp. Tệp tạm chỉ được xóa sau khi xử lý, lưu nghiệp vụ và lưu metadata xác nhận Drive ID.
- API Google chỉ thao tác trong thư mục RTG được cấu hình; credential nằm trên server. Không chia sẻ công khai tự động.
- Middleware áp dụng rate limit, security headers và giới hạn request. Production cần HTTPS; triển khai nhiều instance cần limiter chung ở reverse proxy.

## Kiểm thử

`npm test` chạy kiểm thử Node/API/PostgreSQL local, bao gồm quyền, ownership, redaction đáp án, MIME, RLS, audit, chống trùng, preview/confirm và khôi phục upload khi mất phản hồi.

`npm run db:check` thực thi migration trên PGlite. `npm run test:browser` kiểm tra giao diện bằng API fixture. Các kiểm thử này không thay thế kiểm chứng quyền và cấu hình trên Supabase/Google thật.
