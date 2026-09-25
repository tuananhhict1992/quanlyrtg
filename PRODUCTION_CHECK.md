# Kiểm tra production — 25/09/2026

## Đã thực hiện

- Gỡ SDK, cấu hình và lớp xác thực/database cũ; React sử dụng Supabase Auth; nghiệp vụ qua Node và PostgreSQL.
- Chặn đăng nhập mặc định, đăng nhập từ employee cache và đổi user bằng state trên trình duyệt. Tài khoản phải được liên kết UID Supabase với hồ sơ ACTIVE.
- Bảo vệ API, kiểm tra quyền/ownership, RLS trên toàn bộ bảng ứng dụng, schema private không expose, audit append-only, API rate limit, MIME/file signature/size validation, headers bảo mật.
- Đáp án chỉ dành cho quản lý; bài làm chấm ở server, mỗi lượt có snapshot đề, thời hạn và kết quả idempotent. Giữ chức năng làm lại bằng lượt thi mới.
- Queue và audit gắn với transaction, unique constraints cho công việc/nhân viên/kỳ bình xét/nguồn vi phạm; retry không nhân đôi dòng Sheets hoặc file Drive.
- File metadata gồm đầy đủ drive_file_id, drive_url, file_name, mime_type, size, module, record_id, uploaded_at, uploaded_by.
- Google Sync admin có loading, empty, error, success, xác nhận, Preview/Confirm, phân trang và Retry Sync.
- Lazy load các module, API cursor pagination, index truy vấn, cleanup realtime, error boundary, timezone Việt Nam. UI cũ và xử lý nghiệp vụ chuyên biệt tiếp tục được giữ.

## Bằng chứng local

- TypeScript và production build.
- 17 unit/API/database tests đã pass, bao gồm cấp quyền trái phép, sở hữu bản ghi, đáp án, MIME/size, timezone, RLS cho anon/authenticated, audit bất biến, unique queue, chặn xóa tệp và quyền đọc tệp lưu trữ.
- Mức mặc định a vẫn ghi vào hồ sơ khi chốt, nhưng bị loại khỏi Word, bản in và xem trước, kể cả bản ghi cũ bật includeDefaultSmallAInDoc. Các loại A/B/b/C và GPT được giữ.
- Giao bài qua transaction riêng: kiểm tra quyền, gửi riêng theo recipientIds, khóa chính ổn định theo đề/người chống trùng. Kiểm thử 76 người mỗi người thấy đúng một thông báo; người ngoài không thấy; retry giữ trạng thái đã đọc; lỗi ghi queue rollback cả lần gửi.
- Chốt bình xét và cập nhật hồ sơ nhân viên trong cùng transaction. Kiểm thử lỗi ghi hồ sơ xác nhận rollback toàn bộ; gửi lại nội dung không tạo biên bản, audit hay đánh giá tháng trùng.
- Kiểm thử worker mô phỏng upload Drive thành công nhưng mất phản hồi: dữ liệu/tệp tạm giữ nguyên khi failed; Retry dùng cùng file ID rồi mới xóa tệp tạm.
- Migrations thực thi trên PGlite/PostgreSQL local; RLS bật ở tất cả 10 bảng ứng dụng (bảng schema_migrations khi triển khai cũng bật RLS).
- 10 kiểm thử Chrome đã pass với bản build production: đăng nhập và màn hình dữ liệu/admin ở 390, 768, 1366, 1920px; mở từng menu; Preview/Confirm từ Nhân sự và Vi phạm trên mobile; tải ảnh Drive qua API xác thực; giao bài chờ lưu thành công, báo lỗi/retry/khóa nút trong lúc gửi; xem A4 biên bản cũ loại bỏ a. API fixture, không dữ liệu người dùng thật.
- Các nút Google cũ dùng hàng đợi backend, hiển thị trạng thái đã xếp hàng. Nhập lịch sử lấy phiên bản cuối và không khôi phục bản ghi đã được đánh dấu xóa.
- npm audit sau cập nhật dependency: 0 lỗ hổng tại thời điểm kiểm tra.

## Cần hoàn tất trên môi trường thực

Đã chọn project quanlyrtghict (utcpdfiyaqnimdasttak), nhưng chưa có DATABASE_URL, Google credentials, folder ID hay spreadsheet ID trong môi trường local. Email admin chưa được cung cấp. Vì vậy chưa áp dụng migration vào Supabase thật, chưa tạo admin, chưa thực hiện upload/sync với Google thật, chưa kiểm tra đầy đủ Supabase advisors/Auth providers/quota/SMTP, và chưa deploy. Các thông báo trùng đã lưu trước đây chưa được xử lý trên DB thật.

Trước khi đưa vào vận hành: chạy migration với backup sẵn có, liên kết tài khoản, thử quyền từng vai trò và bộ phận với dữ liệu thật, thử upload → ngắt mạng → Retry, import Preview/Confirm, thi hết giờ/nộp lại, duyệt nghỉ và chốt bình xét, đối chiếu kết quả/biên bản hiện có. Không thể xác nhận các cấu hình bên ngoài chỉ từ source ZIP.

Các dashboard/biểu mẫu cũ vẫn cần một tập dữ liệu đầy đủ cho tính toán nghiệp vụ; API đọc theo trang nhưng lớp tương thích còn ghép các trang cho những module đó. Queue/audit có pagination thực sự ở UI. Với dữ liệu lớn cần chuyển từng dashboard sang aggregation/query theo bộ lọc, và benchmark trên khối lượng thật trước khi cam kết hiệu năng. Một số bảng cũ dùng cuộn ngang trên mobile; queue đã dùng card.

Build còn cảnh báo chunk JavaScript trên 500 kB (entry và module thi). Module đã lazy load; cần đo tải trên thiết bị thực trước khi tối ưu sâu hơn.

Mẫu import Google mới sử dụng snapshot báo cáo của RTG. Tệp Sheets cũ theo cột vẫn có thể xuất XLSX rồi dùng parser Excel cũ; cần đối chiếu bản xem trước trước khi nhập. Không dùng Sheets làm nguồn dữ liệu đọc thường xuyên cho ứng dụng.
