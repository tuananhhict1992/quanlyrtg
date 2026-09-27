# Thông báo Zalo cho RTG

Supabase PostgreSQL lưu nghiệp vụ, nội dung đã xác nhận, người nhận, hàng đợi và kết quả. Google Sheets chỉ nhận bản báo cáo kết quả; lỗi Google hoặc Zalo không xóa nghiệp vụ.

## Người thực hiện

- Vi phạm: mở **Chi tiết vụ việc → Thông báo Zalo**. Chỉ người có `MANAGE_VIOLATIONS` hoặc Admin; chỉ vụ việc Tổ RTG đã lưu.
- Kiểm tra: **Giao bài & soạn Zalo** lưu danh sách giao bài trước, rồi mở bản nháp. Quyền `MANAGE_QUIZ` hoặc `CREATE_QUIZ` với bài do mình tạo.
- Phép: sau đăng ký bởi quản lý, duyệt hoặc từ chối thành công, mở bản nháp; có thể bấm **Thông báo Zalo** tại phiếu. Quyền `MANAGE_LEAVE` hoặc Admin.
- Thông báo chung: **Thông báo Zalo → Soạn thông báo Zalo**, cần `MANAGE_ZALO` hoặc Admin.

Chọn **Cá nhân**, **Ca RTG** hoặc **Tập thể RTG**, sửa nội dung, bấm **Xem trước**, kiểm tra người nhận rồi **Xác nhận gửi Zalo**. Gửi tập thể cần `SEND_BROADCAST_NOTIFICATION` hoặc Admin. Người không có quyền này chỉ gửi trong các Ca được phân công (`managedDepartments`, mặc định Ca của mình). Để sử dụng trung tâm nhật ký, cấp hiển thị tab `zalo` cùng quyền nghiệp vụ phù hợp.

Phạm vi Ca/Tập thể hỗ trợ hai cách: gửi riêng một tin cho mỗi người hoặc một tin vào nhóm **GMF do OA quản lý**. Đây không phải API gửi vào nhóm Zalo cá nhân thông thường. Khi gửi vào nhóm, tất cả thành viên thực tế của nhóm có thể đọc nội dung; Admin phải đối chiếu thành viên nhóm đúng phạm vi đã liên kết.

## Cấu hình thật trước khi sử dụng

### Nếu chưa có OA

1. Mở [Zalo OA](https://oa.zalo.me/) và chọn tạo Official Account.
2. Tự đăng nhập bằng Zalo quản trị của bạn; có thể quét QR bằng điện thoại.
3. Chọn loại **Doanh nghiệp**, điền tên, danh mục hoạt động, mô tả và ảnh đại diện đúng đơn vị.
4. Nộp hồ sơ xác thực theo hướng dẫn trên màn hình; dùng giấy tờ và tên được đơn vị cho phép. Tổ RTG là bộ phận nội bộ nên cần phối hợp người quản trị/đại diện doanh nghiệp về hồ sơ, không tự khai Tổ RTG là pháp nhân độc lập.
5. Sau khi OA được duyệt, ghi lại OA ID và tạo ứng dụng tích hợp trên Zalo Developers. Chọn quyền OA cần dùng, liên kết ứng dụng với OA trước khi cấu hình server bên dưới.

Tham khảo [hướng dẫn tạo OA chính thức của Zalo](https://ads.zalo.me/business/huong-dan-tao-zalo-official-account-2/). Không gửi mật khẩu, OTP hoặc access token trong chat. Nếu gói OA yêu cầu phí, xem điều kiện và hạn mức trên màn hình trước khi quyết định đăng ký.

### Nối OA với RTG

1. Dùng Zalo Official Account và ứng dụng Zalo Developers của đơn vị. Cấp quyền gửi tin OA; nếu dùng nhóm, cần quyền GMF tương ứng. Xem [tài liệu OA chính thức](https://docs.zaloplatforms.com/docs/OA/tin-nhan/tin-tu-van/gui-tin-tu-van-dang-van-ban) và [API nhóm GMF](https://docs.zaloplatforms.com/docs/OA/nhom-chat-gmf/tin-nhan/text_message).
2. Lưu `ZALO_OA_ID` và `ZALO_OA_ACCESS_TOKEN` trong Secrets / biến môi trường **server** của AI Studio / Cloud Run. Không đặt tiền tố `VITE_`, không lưu vào AppSettings, Git hoặc trình duyệt. Triển khai lại server sau khi cập nhật secret.
3. Trong **Thông báo Zalo → Liên kết Zalo OA và người nhận**, Admin liên kết mã nhân viên với **UID thuộc chính OA này**. Số điện thoại không thay thế UID. Đối chiếu danh tính trước khi lưu. UID trùng giữa hai nhân viên bị từ chối.
4. Nếu gửi nhóm, liên kết Ca hoặc `ALL` với Group ID GMF do OA quản lý. Việc đổi OA yêu cầu liên kết lại đúng UID/nhóm của OA mới.
5. Áp dụng migration `supabase/migrations/20260927021032_zalo_notifications.sql` trước khi dùng bản code này. Migration chỉ thêm ba bảng private, bật RLS, không cấp quyền trực tiếp cho `anon` / `authenticated`.
6. Xem trước một tin và xác nhận gửi cho một người đã thống nhất để kiểm tra cấu hình. Không dùng danh sách toàn bộ nhân sự làm dữ liệu thử.

Tin văn bản cá nhân dùng `POST /v3.0/oa/message/cs` (tin tư vấn). Zalo áp dụng điều kiện tương tác và hạn mức; có UID không bảo đảm được gửi tùy ý mọi lúc. Trường hợp thông báo chủ động ngoài điều kiện tin tư vấn cần **ZBS Template Message với mẫu được Zalo duyệt**; phiên bản này chưa triển khai ZBS. Không dùng endpoint tin giao dịch/quảng bá UID cũ đã ngừng hỗ trợ từ 01/03/2026.

Access token có hạn sử dụng. Phiên bản này nhận token OA từ server Secrets, **chưa tự chạy OAuth/refresh token Zalo**. Cần quy trình làm mới token từ phía quản trị Zalo và cập nhật server trước khi token hết hạn; không thể coi chỉ cấu hình token một lần là kết nối lâu dài đã hoàn tất.

## Hàng đợi và xử lý lỗi

- Giữ màn hình mở trong khi gửi ngay; server xử lý từng người, client tiếp tục tối đa 500 người, có giãn cách để phù hợp giới hạn API của RTG. Đóng trang hoặc mất mạng vẫn giữ hàng đợi trong DB; vào nhật ký bấm **Tiếp tục gửi**.
- Để tiếp tục gửi khi đóng trang và hẹn giờ, chạy worker `npm run worker` trên dịch vụ luôn hoạt động; hoặc bật `RUN_SYNC_WORKER=true` với CPU luôn được cấp cho dịch vụ. Cloud Run giới hạn CPU theo request hoặc scale-to-zero không bảo đảm lịch gửi. Không bật worker trong nhiều nơi mà không kiểm soát cấu hình; khóa PostgreSQL ngăn cùng lúc gửi trùng.
- Hẹn giờ dùng **Asia/Ho_Chi_Minh (UTC+7)**, giao diện `HH:mm DD/MM/YYYY`.
- `success`: Zalo trả `error=0` và `message_id`. Đây là xác nhận tiếp nhận, không xác nhận người đọc.
- `failed`: Zalo từ chối hoặc kiểm tra quyền/cấu hình thất bại. Sửa nguyên nhân rồi **Thử lại tin lỗi**; chỉ những tin failed được đưa lại hàng đợi.
- `unknown`: timeout, phản hồi không rõ hoặc worker dừng sau khi bắt đầu gửi. Có thể Zalo đã nhận tin. Đối chiếu tại OA trước; hệ thống không tự gửi lại.
- `pending` / `processing`: chờ / đang gửi. Hủy chỉ hủy phần chưa gửi; không thu hồi được tin đang gửi hoặc đã tiếp nhận.
- Job UUID, checksum nội dung/người nhận, unique constraints và khóa PostgreSQL bảo vệ double-click, retry HTTP, mở lại bản nháp y hệt. Muốn gửi một lời nhắc mới có chủ đích, sửa nội dung rõ thời điểm/lý do mới rồi xác nhận.
- Trước mỗi lần gửi, kiểm tra lại quyền người thực hiện, trạng thái hoạt động của nhân viên, Ca, OA và UID đã liên kết. Nếu người nhận/UID đổi, tạo lại bản nháp để xem trước. Retry không tự thay danh sách hoặc UID đã xác nhận.

Lịch sử thông báo trong ứng dụng được giữ để đọc/tra cứu. Nó được ghi rõ là lịch sử nội bộ, không phải bằng chứng gửi Zalo. Giao bài vẫn có một bản ghi trong ứng dụng cho từng người để giữ quy trình làm bài cũ.

## Kiểm tra phát hành

`npm run typecheck`, `npm test`, `npm run db:check`, `npm run build`, `npm run test:browser`.
Các bài test Zalo dùng phản hồi giả lập, không phát tin thật. Kiểm tra giao diện tại 390, 768, 1366 và 1920px.
