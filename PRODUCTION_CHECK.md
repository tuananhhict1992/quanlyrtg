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
- 24 unit/API/database tests đã pass, bao gồm cấp quyền trái phép, sở hữu bản ghi, đáp án, MIME/size, timezone, RLS cho anon/authenticated, audit bất biến, unique queue, chặn xóa tệp và quyền đọc tệp lưu trữ. Hai test triển khai xác nhận proxy không tin IP giả ở đầu chuỗi và kết nối PostgreSQL dùng đúng CA, không tắt xác minh TLS/hostname. Bốn test OAuth mới kiểm tra mã hóa chống sửa token, phân tách mục đích, quyền admin/origin, state/hết hạn/PKCE, callback và API chưa xác thực, RLS bảng kết nối.
- Kiểm thử Backup tái hiện và sửa lỗi PostgreSQL `42P08`: cùng job ID dùng ép kiểu UUID và text rõ ràng. Xác nhận API admin trả 202, giữ file tạm khi chưa archive, loại dữ liệu mật khẩu khỏi snapshot, ghi audit và chặn USER.
- Mức mặc định a vẫn ghi vào hồ sơ khi chốt, nhưng bị loại khỏi Word, bản in và xem trước, kể cả bản ghi cũ bật includeDefaultSmallAInDoc. Các loại A/B/b/C và GPT được giữ.
- Giao bài qua transaction riêng: kiểm tra quyền, gửi riêng theo recipientIds, khóa chính ổn định theo đề/người chống trùng. Kiểm thử 76 người mỗi người thấy đúng một thông báo; người ngoài không thấy; retry giữ trạng thái đã đọc; lỗi ghi queue rollback cả lần gửi.
- Chốt bình xét và cập nhật hồ sơ nhân viên trong cùng transaction. Kiểm thử lỗi ghi hồ sơ xác nhận rollback toàn bộ; gửi lại nội dung không tạo biên bản, audit hay đánh giá tháng trùng.
- Kiểm thử worker mô phỏng upload Drive thành công nhưng mất phản hồi: dữ liệu/tệp tạm giữ nguyên khi failed; Retry dùng cùng file ID rồi mới xóa tệp tạm.
- Migrations thực thi trên PGlite/PostgreSQL local; RLS bật ở tất cả 11 bảng ứng dụng, gồm bảng kết nối Google (bảng schema_migrations khi triển khai cũng bật RLS).
- 10 kiểm thử Chrome đã pass với bản build production: đăng nhập và màn hình dữ liệu/admin ở 390, 768, 1366, 1920px; mở từng menu; Preview/Confirm từ Nhân sự và Vi phạm trên mobile; tải ảnh Drive qua API xác thực; giao bài chờ lưu thành công, báo lỗi/retry/khóa nút trong lúc gửi; xem A4 biên bản cũ loại bỏ a. API fixture, không dữ liệu người dùng thật.
- Các nút Google cũ dùng hàng đợi backend, hiển thị trạng thái đã xếp hàng. Nhập lịch sử lấy phiên bản cuối và không khôi phục bản ghi đã được đánh dấu xóa.
- npm audit sau cập nhật dependency: 0 lỗ hổng tại thời điểm kiểm tra.

## Supabase thực — 26/09/2026

- Project `quanlyrtghict` (`utcpdfiyaqnimdasttak`) đang `ACTIVE_HEALTHY`.
- Đã áp dụng migration `rtg_secure_google`, phiên bản Supabase `20260926001050`. Ledger nội bộ ghi `20260925080536_rtg_secure_google.sql`, SHA-256 `6da9c4249339367cba2732488133f1c5991ec48ab3660cae5b0254b1640ebd99` để lệnh `db:migrate` không chạy trùng.
- Đã xác nhận RLS trên 12 bảng, gồm ledger và bảng kết nối Google mới. `anon` và `authenticated` không có quyền SELECT các bảng private. `record_changes` chỉ cho tài khoản ACTIVE đã liên kết đọc qua policy; đã tham gia publication `supabase_realtime`.
- Đã áp dụng migration `google_oauth_connection`; ledger nội bộ ghi `20260926035813_google_oauth_connection.sql`, SHA-256 `0b7be8f516f5875102890318880b62694efe3851eb63a4e54c4fe429c7bd0d99`. Bảng riêng lưu refresh token đã mã hóa, không expose qua Data API.
- Kiểm thử trực tiếp PostgreSQL đã pass: chống job sync trùng, chặn xóa file tạm trước xác nhận archive, chặn sửa audit, tài khoản chưa cấp quyền không được coi là ACTIVE. Dữ liệu kiểm thử được rollback.
- Security Advisor có INFO [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) cho 11 bảng private. Đây là thiết kế deny-by-default cho client; Node truy cập qua kết nối server và kiểm tra quyền. Không thêm policy mở để bỏ thông báo này. Lần kiểm tra mới cũng có WARN `auth_leaked_password_protection` đang tắt; chưa thay đổi cấu hình/gói dịch vụ này.
- Performance Advisor chỉ có INFO [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) ở database mới chưa có dữ liệu vận hành; giữ index phục vụ truy vấn của ứng dụng.
- Chuẩn hóa file migration về LF bằng `.gitattributes` để checksum ổn định giữa Windows và Linux.
- AI Studio Preview đã kết nối Session pooler qua TLS, đăng nhập email/mật khẩu thành công, tải màn hình ADMIN từ dữ liệu thật và ghi audit `login`. Không thay mật khẩu Auth và không tắt RLS.
- Bổ sung CA công khai từ Supabase Database Settings vào `supabase/certs/prod-ca-2021.txt`; dùng `sslmode=verify-full` và `sslrootcert`. TLS handshake thực xác nhận chứng chỉ hợp lệ. CA hết hạn 26/04/2031; cần theo dõi thay đổi CA từ Supabase.
- Cấu hình `TRUST_PROXY_HOPS=1` cho ingress AI Studio, mặc định local là 0. Log lỗi backend chỉ ghi mã lỗi đã lọc, không ghi chuỗi kết nối hay secret. Navbar/Sidebar không truyền chuỗi rỗng vào ảnh đại diện.

## Triển khai và kiểm chứng Google thực — 26/09/2026

Web chính thức: https://quanlyrtg-290449474780.asia-southeast1.run.app/. Cloud Run project `distributed-aura-kf6jr`, service `quanlyrtg`, revision `quanlyrtg-00004-d75` được triển khai lúc 16:34:32 (UTC+7), khỏe mạnh và nhận 100% lưu lượng. Revision này có sửa Backup và trang `/privacy`; đã mở trực tiếp trang quyền riêng tư trên production. Các lần kiểm tra trước xác nhận HTTPS, `/api/health` 200, `/api/me` chưa xác thực 401, CSP và HSTS. AI Studio đôi lúc hiển thị trạng thái publish chậm; đối chiếu Revision History và web thực tế.

Đã bật Supabase Google provider và đăng nhập Google thành công bằng admin. Auth giữ cùng UID hiện có, liên kết hai identity email/google, không nhân đôi hồ sơ. OAuth client có callback Supabase và callback web chính `run.app`; Google từ chối alias `quanlyrtg-hict.ai.studio`, vì vậy nút kết nối kho trên alias/preview sẽ mở website chính. Origin được kiểm tra allowlist; state có thời hạn, cookie HttpOnly/Secure và PKCE. Client Secret chỉ nằm ở Supabase provider và AI Studio Secrets, không có trong mã nguồn.

Google OAuth Audience đã chuyển sang **In production** theo xác nhận của chủ tài khoản; Branding có trang chủ và chính sách quyền riêng tư công khai. Phạm vi kho dùng `openid email drive.file`, refresh token được mã hóa trong schema private. Đã kết nối lại kho ở chế độ Production lúc 16:57 ngày 26/09/2026, callback trở về app và bảng kết nối được cập nhật; root/spreadsheet ID giữ nguyên. Không thay đổi RLS hay biến Sheets thành database.

Đã cấp quyền kho cho `tuananh.hict1992@gmail.com`, tạo `RTG_SYSTEM` gồm đủ 10 thư mục và `RTG_ARCHIVE` gồm đủ 11 tab yêu cầu. Google Drive UI đọc được kho bằng admin. Đến 16:56 ngày 26/09/2026 đã có 82 tác vụ thành công: 78 snapshot nhân sự, 1 snapshot vi phạm và 3 file Drive (Excel nhân sự, Excel vi phạm, Backup JSON). Không có tác vụ failed. Một file nhân sự mới Preview chưa Confirm vẫn pending, `business_saved_at` chưa có; hệ thống giữ nguyên file tạm và không tự xác nhận nhập. Hai phiên bản ban đầu RTG-ADMIN đã đối chiếu trực tiếp trong EMPLOYEES.

Backup thực có job `59d8db0c-49d1-4ffd-a770-843abe55a262`, Drive file ID `1x0P7dIrRBSegX46JntAPXVj8mynau8Qg`, dung lượng 50.455 byte, thành công ở lần thử đầu. Cả ba file thành công đều có metadata/Drive ID và không còn file tạm; file chưa Confirm vẫn còn. API production sau revision mới tiếp tục trả health 200, privacy 200, me chưa đăng nhập 401 và có CSP/HSTS; console trang quản trị không ghi nhận lỗi JavaScript.

Máy local chưa có `.env` hoặc credentials triển khai. RUN_SYNC_WORKER vẫn tắt trong AI Studio: admin bấm **Xử lý hàng đợi**, giữ trang mở, mỗi đợt tối đa 25 job. Chưa cấu hình lịch worker tự động 24/7 trên Cloud Run hoặc SMTP. Các thông báo trùng từ trước chưa được xóa trên DB thật. App cũ đã ngừng xuất bản theo xác nhận trước đó để giải phóng hạn mức; không thay đổi thanh toán.

Trước khi đưa vào vận hành: chạy migration với backup sẵn có, liên kết tài khoản, thử quyền từng vai trò và bộ phận với dữ liệu thật, thử upload → ngắt mạng → Retry, import Preview/Confirm, thi hết giờ/nộp lại, duyệt nghỉ và chốt bình xét, đối chiếu kết quả/biên bản hiện có. Không thể xác nhận các cấu hình bên ngoài chỉ từ source ZIP.

Các dashboard/biểu mẫu cũ vẫn cần một tập dữ liệu đầy đủ cho tính toán nghiệp vụ; API đọc theo trang nhưng lớp tương thích còn ghép các trang cho những module đó. Queue/audit có pagination thực sự ở UI. Với dữ liệu lớn cần chuyển từng dashboard sang aggregation/query theo bộ lọc, và benchmark trên khối lượng thật trước khi cam kết hiệu năng. Một số bảng cũ dùng cuộn ngang trên mobile; queue đã dùng card.

Build còn cảnh báo chunk JavaScript trên 500 kB (entry và module thi). Module đã lazy load; cần đo tải trên thiết bị thực trước khi tối ưu sâu hơn.

Mẫu import Google mới sử dụng snapshot báo cáo của RTG. Tệp Sheets cũ theo cột vẫn có thể xuất XLSX rồi dùng parser Excel cũ; cần đối chiếu bản xem trước trước khi nhập. Không dùng Sheets làm nguồn dữ liệu đọc thường xuyên cho ứng dụng.
# Khôi phục thông báo nội bộ — 27/09/2026

- Khôi phục hộp thư, chat nhanh, lịch sử, trạng thái đã đọc và soạn cá nhân/Ca/tập thể. Vi phạm và phép mở bản nháp nội bộ để Preview/Confirm. Giao bài vẫn gửi một thông báo cho mỗi đề/người.
- Server xác định người nhận ACTIVE, kiểm tra quyền và phạm vi Ca. Transaction + khóa theo job ID chống ghi trùng; lỗi giữ bản nháp, không báo thành công trước khi database lưu. Tin hẹn giờ chưa hiển thị cho người nhận trước thời điểm phát.
- API Zalo trả 410 sau xác thực; worker và provider không thể gửi ra Zalo, kể cả khi còn secret cũ. Hàng đợi Zalo thực tế trống khi bắt đầu chuyển đổi, không có tin chờ cần hủy. Không gửi thông báo thật để kiểm thử.
- Không cần migration mới. Giữ migration 20260927021032_zalo_notifications.sql đã áp dụng và ba bảng private đang bật RLS để bảo toàn dữ liệu. Mã legacy zaloMessages được giữ cho lịch sử nội bộ.
- Hẹn giờ được xử lý khi đọc hộp thư và kiểm tra lại mỗi 30 giây; nếu app đóng và worker không chạy, phát khi người dùng mở lại.

Kiểm tra local đạt: typecheck, production build, migrations (14 bảng ứng dụng bật RLS), 26/26 unit/API/database tests và 11/11 kiểm thử Chrome. Các màn hình đăng nhập, quản trị, thông báo chạy ở 390/768/1366/1920px; retry thông báo giữ bản nháp và job ID, giao bài 76 người giữ chống trùng. Build còn cảnh báo kích thước chunk lớn như trước. Đã triển khai Cloud Run revision quanlyrtg-00006-jhp lúc 10:16:48 (UTC+7) ngày 27/09/2026, nhận 100% lưu lượng. Đã mở website chính thức, kiểm tra trung tâm Tin nhắn nội bộ, hộp thư trống và chat nhanh; không có lỗi console trong kiểm tra này, không gửi tin thử cho nhân viên. AI Studio hiển thị thời điểm xuất bản cũ, nên đối chiếu bằng revision Cloud Run và giao diện thực tế.

# UI/UX HICT — 27/09/2026

- Đồng bộ palette, chữ, bán kính, bóng, biểu mẫu, bảng, focus/disabled; dùng logo HICT người dùng cung cấp ở đăng nhập, header và favicon.
- Cải tiến bố cục dashboard và thông báo nội bộ, menu mobile, avatar lỗi, toast giới hạn chiều rộng. Giữ các callback nghiệp vụ và phân quyền.
- Typecheck, build và 11/11 kiểm thử Chrome đạt trên bốn kích thước 390/768/1366/1920px. Không có migration mới hoặc thay đổi backend. Xem UI_GUIDE.md.
- Bổ sung kiểm thử thứ 12 cho đóng gói logo: giả lập PNG public bị 404, xác nhận ảnh nhúng giải mã đủ 4000×3000 và SHA-256 khớp ảnh nguồn. Typecheck/build và kiểm thử này đạt sau sửa. Logo được tải qua module lazy để trình nhập ZIP của AI Studio không bỏ mất ảnh; byte gốc giữ nguyên.
- Đã triển khai revision `quanlyrtg-00008-kl4` lúc 11:21:06 (UTC+7), ngày 27/09/2026, nhận 100% lưu lượng. Trên website chính đã xác nhận logo gốc hiện đúng, dashboard tại 390px và 1366px không tràn ngang, mở/đóng menu mobile hoạt động; không ghi nhận lỗi console trong lượt kiểm tra. Bằng chứng nằm ở artifacts/screenshots/hict-live-mobile-20260927.png và hict-live-desktop-20260927.png. Không gửi thông báo hoặc sửa dữ liệu thật để kiểm thử.

## Điều chỉnh ưu tiên dashboard — 27/09/2026

- Đưa Thông báo và Truy cập nhanh lên đầu trang, trước tiêu đề Tổng quan vận hành và các số liệu. Thay đổi thứ tự DOM để trình đọc màn hình và bàn phím đi theo đúng thứ tự hiển thị.
- Sáu nút nhanh dùng các nền màu riêng và biểu tượng màu đậm; Thông tin của tôi dùng xanh HICT. Tương phản chữ chính/nền ở trạng thái mặc định từ 4,86:1 đến 5,88:1. Giữ nguyên callback, liên kết cấu hình và quyền truy cập.
- Typecheck, production build và 4/4 kiểm thử Chrome responsive đạt ở 390/768/1366/1920px. Đã xem ảnh desktop/mobile; không thay backend, dữ liệu hay schema. Cảnh báo kích thước chunk vẫn như bản trước.
- Đã xuất bản revision `quanlyrtg-00009-h8g` lúc 13:15:01 (UTC+7), nhận 100% lưu lượng. Xác nhận trực quan trên website chính: hai khung ở đầu, sáu nút màu và nút hồ sơ hiện đúng, logo HICT giữ nguyên; không có lỗi console trong lượt kiểm tra. Ảnh: artifacts/screenshots/quick-access-live-20260927.png.

## Đối chiếu cấu hình Google — 27/09/2026

- Kết nối OAuth primary vẫn thuộc admin đã liên kết, có refresh token mã hóa; truy vấn kiểm tra chỉ lấy email/ID kho và trạng thái có token, không lấy token.
- Đã lưu trong AI Studio Secrets: GOOGLE_OAUTH_ALLOWED_ORIGINS dùng chính origin run.app hiện tại; GOOGLE_DRIVE_ROOT_ID và GOOGLE_SPREADSHEET_ID khớp kho trong private.google_connections. Giữ RUN_SYNC_WORKER=false và PUBLIC_APP_URL hiện có. GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY không áp dụng cho OAuth, không tạo thêm Service Account.
- Cloud Run revision quanlyrtg-00010-jmf lúc 13:28:26 (UTC+7) đã nhận 100% lưu lượng. Trên web chính, đăng nhập phân hệ Drive thành công và đọc được RTG_ARCHIVE cùng 10 thư mục con. Không tạo/xóa file hoặc thay dữ liệu nghiệp vụ để kiểm thử. Ảnh kiểm chứng: artifacts/screenshots/google-config-verified-20260927.png.

## Địa chỉ truy cập ngắn — 27/09/2026

- Đổi alias AI Studio thành https://quanlyrtg.ai.studio/ theo yêu cầu rút gọn. Alias quanlyrtg-hict.ai.studio đã được thay thế; không quảng bá hoặc dùng alias cũ làm redirect. Không thay DNS của hict.com/hict.net.vn.
- Revision `quanlyrtg-00011-5wl` lúc 13:36:18 (UTC+7) nhận 100% lưu lượng. Đã mở HTTPS alias mới, đăng nhập Google bằng tài khoản admin có sẵn và quay về đúng origin mới; dashboard tải được dữ liệu, không có lỗi console trong lượt kiểm tra.
- Supabase Site URL là https://quanlyrtg.ai.studio. Redirect allowlist có đúng origin mới và origin run.app hiện tại, mỗi origin có dạng không dấu / và có dấu / cuối; không thêm wildcard. PUBLIC_APP_URL của kết nối kho vẫn giữ run.app đã đăng ký với Google, giữ Client ID/Secret và kho hiện có.
- Ảnh: artifacts/screenshots/short-url-live-20260927.png. Các thay đổi local lần này chỉ là tài liệu và chú thích .env.example; không cần migration hoặc build lại mã nghiệp vụ.

## Đăng nhập username và quản lý mật khẩu — 27/09/2026

- Thêm đăng nhập username qua Node → Supabase Auth; không có API công khai tra email từ username. Lỗi sai/khóa/chưa cấp tài khoản dùng cùng thông báo; giới hạn IP và bộ đếm theo username băm trong PostgreSQL, dùng chung các Cloud Run instance.
- Admin cấp tài khoản trong sửa hồ sơ, mật khẩu ban đầu 123456 theo yêu cầu, bắt buộc đổi trước khi dùng API nghiệp vụ. Google chỉ dành cho Admin; người có MANAGE_HR/MANAGE_PERMISSIONS không được đặt mật khẩu hoặc tự cấp vai trò Admin.
- Admin đặt mật khẩu mới bằng Auth Admin API phía server, không đọc mật khẩu cũ. Tên đăng nhập duy nhất, job UUID chống lặp, audit ghi ý định/kết quả không ghi mật khẩu. Khi Auth thành công nhưng DB chưa liên kết được, retry chỉ nhận tài khoản kỹ thuật có app_metadata khớp nhân sự; không liên kết tùy tiện theo email liên hệ.
- API kiểm tra thời điểm tạo auth.sessions so với lần đổi mật khẩu, chặn phiên cũ kể cả JWT mới được refresh. Tự đổi mật khẩu xác minh mật khẩu hiện tại; không dùng email liên hệ giả của hồ sơ.
- Migration và ledger đã áp dụng; RLS bật trên 16 bảng ứng dụng. Local typecheck/build/db:check, 28 kiểm thử backend và 16 Chrome đạt (390/768/1366/1920px). Không sửa mật khẩu thật để thử.
- Advisor: private tables không có policy là chủ ý chặn browser; index mới chưa dùng là bình thường trước triển khai. Cảnh báo Supabase Leaked Password Protection Disabled có sẵn vẫn còn: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Không tắt bảo vệ nào để chấp nhận 123456; mật khẩu ban đầu phải đổi ngay.
- Trạng thái triển khai: đang chuẩn bị; cần cấu hình server SUPABASE_SECRET_KEY. Chưa cấp hàng loạt tài khoản hoặc đặt lại mật khẩu Admin đang dùng Google.
