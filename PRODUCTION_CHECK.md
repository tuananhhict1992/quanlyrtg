# Kiểm tra production — cập nhật 26/09/2026

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
- 19 unit/API/database tests đã pass, bao gồm cấp quyền trái phép, sở hữu bản ghi, đáp án, MIME/size, timezone, RLS cho anon/authenticated, audit bất biến, unique queue, chặn xóa tệp và quyền đọc tệp lưu trữ. Hai test triển khai xác nhận proxy không tin IP giả ở đầu chuỗi và kết nối PostgreSQL dùng đúng CA, không tắt xác minh TLS/hostname.
- Mức mặc định a vẫn ghi vào hồ sơ khi chốt, nhưng bị loại khỏi Word, bản in và xem trước, kể cả bản ghi cũ bật includeDefaultSmallAInDoc. Các loại A/B/b/C và GPT được giữ.
- Giao bài qua transaction riêng: kiểm tra quyền, gửi riêng theo recipientIds, khóa chính ổn định theo đề/người chống trùng. Kiểm thử 76 người mỗi người thấy đúng một thông báo; người ngoài không thấy; retry giữ trạng thái đã đọc; lỗi ghi queue rollback cả lần gửi.
- Chốt bình xét và cập nhật hồ sơ nhân viên trong cùng transaction. Kiểm thử lỗi ghi hồ sơ xác nhận rollback toàn bộ; gửi lại nội dung không tạo biên bản, audit hay đánh giá tháng trùng.
- Kiểm thử worker mô phỏng upload Drive thành công nhưng mất phản hồi: dữ liệu/tệp tạm giữ nguyên khi failed; Retry dùng cùng file ID rồi mới xóa tệp tạm.
- Migrations thực thi trên PGlite/PostgreSQL local; RLS bật ở tất cả 10 bảng ứng dụng (bảng schema_migrations khi triển khai cũng bật RLS).
- 10 kiểm thử Chrome đã pass với bản build production: đăng nhập và màn hình dữ liệu/admin ở 390, 768, 1366, 1920px; mở từng menu; Preview/Confirm từ Nhân sự và Vi phạm trên mobile; tải ảnh Drive qua API xác thực; giao bài chờ lưu thành công, báo lỗi/retry/khóa nút trong lúc gửi; xem A4 biên bản cũ loại bỏ a. API fixture, không dữ liệu người dùng thật.
- Các nút Google cũ dùng hàng đợi backend, hiển thị trạng thái đã xếp hàng. Nhập lịch sử lấy phiên bản cuối và không khôi phục bản ghi đã được đánh dấu xóa.
- npm audit sau cập nhật dependency: 0 lỗ hổng tại thời điểm kiểm tra.

## Supabase thực — 26/09/2026

- Project `quanlyrtghict` (`utcpdfiyaqnimdasttak`) đang `ACTIVE_HEALTHY`.
- Đã áp dụng migration `rtg_secure_google`, phiên bản Supabase `20260926001050`. Ledger nội bộ ghi `20260925080536_rtg_secure_google.sql`, SHA-256 `6da9c4249339367cba2732488133f1c5991ec48ab3660cae5b0254b1640ebd99` để lệnh `db:migrate` không chạy trùng.
- Đã xác nhận RLS trên 11 bảng, gồm ledger. `anon` và `authenticated` không có quyền SELECT các bảng private. `record_changes` chỉ cho tài khoản ACTIVE đã liên kết đọc qua policy; đã tham gia publication `supabase_realtime`.
- Kiểm thử trực tiếp PostgreSQL đã pass: chống job sync trùng, chặn xóa file tạm trước xác nhận archive, chặn sửa audit, tài khoản chưa cấp quyền không được coi là ACTIVE. Dữ liệu kiểm thử được rollback.
- Security Advisor chỉ có INFO [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) cho 10 bảng private. Đây là thiết kế deny-by-default cho client; Node truy cập qua kết nối server và kiểm tra quyền. Không thêm policy mở để bỏ thông báo này.
- Performance Advisor chỉ có INFO [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) ở database mới chưa có dữ liệu vận hành; giữ index phục vụ truy vấn của ứng dụng.
- Chuẩn hóa file migration về LF bằng `.gitattributes` để checksum ổn định giữa Windows và Linux.
- AI Studio Preview đã kết nối Session pooler qua TLS, đăng nhập email/mật khẩu thành công, tải màn hình ADMIN từ dữ liệu thật và ghi audit `login`. Không thay mật khẩu Auth và không tắt RLS.
- Bổ sung CA công khai từ Supabase Database Settings vào `supabase/certs/prod-ca-2021.txt`; dùng `sslmode=verify-full` và `sslrootcert`. TLS handshake thực xác nhận chứng chỉ hợp lệ. CA hết hạn 26/04/2031; cần theo dõi thay đổi CA từ Supabase.
- Cấu hình `TRUST_PROXY_HOPS=1` cho ingress AI Studio, mặc định local là 0. Log lỗi backend chỉ ghi mã lỗi đã lọc, không ghi chuỗi kết nối hay secret. Navbar/Sidebar không truyền chuỗi rỗng vào ảnh đại diện.

## Cần hoàn tất trên môi trường thực

AI Studio đã Publish thành công ngày 26/09/2026, trạng thái Ready. URL chính thức: https://quanlyrtg-290449474780.asia-southeast1.run.app/. Đã kiểm tra HTTPS, trang đăng nhập trả 200, `/api/health` trả 200 với status ok, `/api/me` không xác thực trả 401. Production có CSP và HSTS, trang đăng nhập chưa ghi nhận lỗi JavaScript. Site URL Supabase Auth đã cập nhật theo URL chính thức. Đăng nhập admin đã kiểm chứng trên Preview; cần người dùng nhập mật khẩu trực tiếp để xác nhận phiên mới trên tên miền production.

Chưa có DATABASE_URL, Google credentials, folder ID hay spreadsheet ID trong môi trường local. AI Studio đã có DATABASE_URL trong Secrets. Upload/sync Google thật, Google OAuth/quota/SMTP vẫn cần cấu hình và kiểm tra. RUN_SYNC_WORKER hiện tắt trong AI Studio khi chưa có cấu hình Google. Các thông báo trùng đã lưu trước đây chưa được xử lý trên DB thật. Preview có thể báo lỗi websocket Vite trong lúc máy chủ khởi động lại; không coi Preview là bản production đã kiểm thử toàn bộ.

Trước khi đưa vào vận hành: chạy migration với backup sẵn có, liên kết tài khoản, thử quyền từng vai trò và bộ phận với dữ liệu thật, thử upload → ngắt mạng → Retry, import Preview/Confirm, thi hết giờ/nộp lại, duyệt nghỉ và chốt bình xét, đối chiếu kết quả/biên bản hiện có. Không thể xác nhận các cấu hình bên ngoài chỉ từ source ZIP.

Các dashboard/biểu mẫu cũ vẫn cần một tập dữ liệu đầy đủ cho tính toán nghiệp vụ; API đọc theo trang nhưng lớp tương thích còn ghép các trang cho những module đó. Queue/audit có pagination thực sự ở UI. Với dữ liệu lớn cần chuyển từng dashboard sang aggregation/query theo bộ lọc, và benchmark trên khối lượng thật trước khi cam kết hiệu năng. Một số bảng cũ dùng cuộn ngang trên mobile; queue đã dùng card.

Build còn cảnh báo chunk JavaScript trên 500 kB (entry và module thi). Module đã lazy load; cần đo tải trên thiết bị thực trước khi tối ưu sâu hơn.

Mẫu import Google mới sử dụng snapshot báo cáo của RTG. Tệp Sheets cũ theo cột vẫn có thể xuất XLSX rồi dùng parser Excel cũ; cần đối chiếu bản xem trước trước khi nhập. Không dùng Sheets làm nguồn dữ liệu đọc thường xuyên cho ứng dụng.
