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
- Đã triển khai revision `quanlyrtg-00013-4vt`, nhận 100% lưu lượng ngày 27/09/2026. Trên https://quanlyrtg.ai.studio/ đã kiểm chứng đăng nhập Admin Google, URL sạch sau callback PKCE, dashboard tải dữ liệu và giao diện quản lý tài khoản trong hồ sơ Admin. Health trả `ok`. Không đặt lại mật khẩu hoặc cấp tài khoản thật để thử.
- Backend có phép kiểm tra khóa quản trị bằng Auth Admin `getUserById` chỉ đọc khi mở khung tài khoản; lỗi được trả về dạng thông báo chung, không ghi khóa. Bổ sung kiểm thử khóa hợp lệ/không hợp lệ (tổng 29 kiểm thử backend). Sau bản sửa PKCE/thu hồi phiên: 4 kiểm thử account/API, typecheck và build đạt; 16 kiểm thử Chrome của tính năng tài khoản đã đạt trước đó.
- Cấu hình production đã hoàn tất sau khi chủ tài khoản lưu lại SUPABASE_SECRET_KEY bằng tay và Republish. Revision `quanlyrtg-00014-2rg` nhận 100% lưu lượng, revision 00013 còn 0%. Trên địa chỉ chính thức: đăng nhập Admin Google thành công, URL callback đã được dọn sạch, mở hồ sơ RTG-ADMIN xác minh Auth Admin getUserById thành công, cảnh báo thiếu cấu hình đã hết và ô mật khẩu mới được bật. Health trả `ok`; JavaScript entry công khai không chứa khóa sb_secret. Không cấp tài khoản hoặc đổi mật khẩu thật để thử. Ảnh: artifacts/screenshots/account-live-key-verified-20260927.png. Thay đổi lần này là cấu hình server, không thay mã nghiệp vụ hoặc migration.
- Trong lần kiểm tra trước khi chuyển sang PKCE, công cụ ghi lại URL callback có token phiên. Đã chặn phiên cũ bằng credentials_changed_at và đăng xuất; xác minh auth.sessions của Admin còn 0 trước lần đăng nhập PKCE mới. Backend từ revision 00013 cũng bắt buộc session_id còn tồn tại. Token Google đi kèm là riêng biệt, chưa xác nhận thu hồi; đã đề nghị chủ tài khoản cho phép gỡ quyền RTG System rồi kết nối lại, vì thao tác đó ảnh hưởng đồng bộ Drive/Sheets. Không lưu token vào repository/tài liệu này.

## Đồng bộ tự động, Realtime và cấp tài khoản ban đầu — 27/09/2026

- Supabase Cron gọi worker Node mỗi phút khi còn việc; token dùng một lần, chỉ lưu SHA-256 trong bảng private, hết hạn 5 phút. Worker xử lý trong HTTP request để phù hợp Cloud Run CPU theo request. Không thay Secrets.
- Google Sync lọc success ở DB trước phân trang; UI cập nhật mỗi 10 giây. Giữ lịch sử, Retry và Preview/Confirm. Lỗi Google thử lại tối đa 3 lần, không xóa dữ liệu nghiệp vụ/file tạm trước khi xác nhận Drive.
- Tất cả vai trò dùng Realtime; tải bù sau reconnect/online/focus và polling dự phòng. Thay đổi quyền hồ sơ làm cập nhật menu và tải lại dữ liệu theo phạm vi mới. Dashboard được mở khi cấp visibleTabs, không bắt buộc thêm VIEW_ANALYTICS; quyền API không được nới rộng.
- Ẩn điều khiển đồng bộ Google khỏi tài khoản không phải Admin. Không xóa chức năng nhập/xuất báo cáo nghiệp vụ đã cấp quyền.
- Hàng đợi cấp tài khoản chỉ nhận nhân sự ACTIVE chưa liên kết Auth. Khóa theo nhân sự, job_id chống trùng, initialOnly kiểm tra lại trong giao dịch; không reset tài khoản đã có. Mật khẩu ban đầu 123456 theo yêu cầu, buộc đổi trước khi truy cập nghiệp vụ. Không lưu mật khẩu vào queue/HR/Sheets/audit.
- TypeScript, build, 32 kiểm thử backend và 20 tình huống Chrome đạt (17 trong lượt toàn bộ, 3 Realtime chạy lại sau khi sửa fixture đúng định dạng). Các kích thước 390/768/1366/1920px đạt. PGlite migrations đạt, 19 bảng ứng dụng bật RLS; migrations production và ledger đã áp dụng.
- Security Advisor: bảng private không có policy là chủ ý deny browser. pg_net có metadata extension thuộc public và thuộc quyền quản lý supabase_admin; lệnh REVOKE từ postgres không thay đổi ACL của extension. Giữ nguyên extension, không DROP. Worker được bảo vệ độc lập bằng token dùng một lần; bảng worker private và hàm dispatch không cho browser đọc/gọi. Xem https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public . Cảnh báo bảo vệ mật khẩu rò rỉ có sẵn vẫn được giữ nguyên, không tắt thêm bảo vệ nào.
- Lịch đang chờ bật sau khi xác minh bản triển khai mới; kết quả thực tế được bổ sung sau publish.

- Bổ sung giới hạn API 120 request/phút theo UID Auth đã xác minh, bên cạnh giới hạn ingress chung 3000/phút/IP để nhiều nhân viên dùng chung mạng cảng không chặn lẫn nhau. Limiter đăng nhập vẫn giữ nguyên. Kiểm thử hai tài khoản cùng IP: tài khoản thứ nhất bị giới hạn không ảnh hưởng tài khoản thứ hai.

## Kiểm thử 80 phiên và sửa nhập XLS — 27/09/2026

- Mỗi phiên dùng một kênh Realtime chung thay cho 12 kênh; 80 phiên cần 80 lượt join thay vì khoảng 960. Collection reads tối đa 3 yêu cầu đang chạy trên mỗi trình duyệt, có timeout, debounce và giãn polling. Sau reconnect vẫn tải bù; unsubscribe cuối cùng gỡ kênh.
- Xác minh token dùng chung lời gọi đang chạy cho cùng token, không cache kết quả hoặc quyền. Mỗi request vẫn kiểm tra tài khoản và auth.sessions trong DB. Auth tạm quá tải trả 503 thay vì ép đăng xuất với 401.
- Migration coalesce_realtime_transactions đã áp dụng trên Supabase và ledger: một thông báo thay đổi/module/giao dịch khi import nhiều dòng; RLS và dữ liệu nghiệp vụ giữ nguyên.
- Thử tải local: Express thật + PGlite + Auth giả lập độ trễ 75 ms. 80 tài khoản giả, 1.282 HTTP request, 0 lỗi ngoài dự kiến; kiểm tra dữ liệu từng tài khoản, trạng thái khóa và thu hồi phiên. Lượt riêng: login p95 1.337 ms, đọc khởi tạo p95 2.611 ms. Lượt chạy cùng toàn bộ suite: login p95 3.660 ms, đọc khởi tạo p95 3.451 ms. Đây không phải số đo SLA production, không mô phỏng hạn mức hoặc sự cố mạng của nhà cung cấp.
- 36 kiểm thử backend đạt trước sửa import; thêm 3 kiểm thử import/parser/multipart đạt. Ba kiểm thử Chrome Realtime cho ADMIN/MANAGER_L1/USER đạt; typecheck/build và migration local đạt (19 bảng có RLS).
- Hạ tầng được đọc trực tiếp: Cloud Run Starter, min 0/max 1 instance, concurrency 1000, timeout 300 giây; PostgreSQL max_connections 60, pool app 10. Supabase organization Free. Free Realtime chỉ 200 kết nối, 100 message/giây và 100 join/giây: 80 kết nối nằm trong giới hạn nhưng nhiều thay đổi đồng thời có thể vượt lưu lượng sự kiện. Cần đo tải staging với cấu hình tương đương, gồm nộp bài/import đồng loạt, trước khi cam kết vận hành 80 người. Không tự nâng gói trả phí. https://supabase.com/docs/guides/realtime/limits
- Tệp báo cáo người dùng gửi có đuôi XLS nhưng nội dung là OOXML/XLSX. Parser nhận diện bằng nội dung, chấp nhận trường hợp xuất XLS này, hỗ trợ XLS BIFF và CSV UTF-8/UTF-16. MIME rỗng/octet-stream được chuẩn hóa sau xác minh chữ ký; tệp giả, MIME sai, dung lượng >20 MB, >2.000 dòng hoặc >100 cột vẫn bị chặn. Kiểm tra đọc tệp thực thành công: 1.375 dòng (gồm tiêu đề), 39 cột; không sửa bản gốc và không đưa dữ liệu báo cáo lên GitHub.
- Preview multipart lưu đúng MIME thực vào queue, giữ nguyên bytes và chưa đánh dấu business_saved_at trước khi nghiệp vụ được lưu. Google Drive vẫn phải trả file ID trước khi xóa tệp tạm.
- Bản code đã chuẩn bị để cập nhật AI Studio; trạng thái publish và cấp tài khoản thực sẽ được ghi sau khi kiểm chứng endpoint mới. Tại lần đọc gần nhất, revision 00014 vẫn nhận 100% lưu lượng; worker chưa bật và 74 tài khoản còn trong hàng đợi.
- Cập nhật: revision `quanlyrtg-00015-n9m` lúc 16:24:29 ngày 27/09/2026 đã nhận 100% lưu lượng. Endpoint worker trả 401 riêng của worker khi thiếu nonce, bundle công khai có kênh `rtg-records:`. Đã bật worker_config và xác nhận 12 tài khoản đầu tiên được cấp qua lịch HTTP, queue Google bắt đầu chạy. Tiến độ cuối sẽ được cập nhật khi hoàn tất.
- Auth Rate Limits được đọc trực tiếp: token refresh 150 request/5 phút/IP; sign-up/sign-in 30/5 phút/IP; IP Address Forwarding tắt. Tài liệu Supabase mô tả token endpoint (gồm password grant) có burst 30. Thử tải local chưa mô phỏng quota này. Cần kiểm thử staging và điều chỉnh lưu lượng/cấu hình Auth trước khi cam kết 80 đăng nhập cùng một thời điểm; không tăng hạn mức bảo mật hoặc thay gói trả phí tự động. https://supabase.com/docs/guides/auth/rate-limits

## Thống kê bãi chỉ xem — 27/09/2026

- Theo yêu cầu mới, thống kê bãi chỉ đọc bảng tính trong bộ nhớ và hiển thị bảng trong lần xem hiện tại. Không lưu file nguồn, kết quả, metadata, temporary_files hoặc tác vụ Drive/Sheets. Đóng phân hệ hoặc tải lại trang sẽ mất kết quả; không tự xóa dữ liệu lịch sử đã tồn tại.
- Backend vẫn kiểm tra quyền, MIME/nội dung, dung lượng và giới hạn bảng tính; phản hồi xem trước dùng Cache-Control: no-store. Nhập nhân sự/vi phạm vẫn giữ quy trình lưu trữ nguồn cũ.
- Typecheck/build và 3 kiểm thử parser/HTTP đạt. Kiểm thử HTTP chứng minh preview thống kê không tạo records, temporary_files hoặc sync_queue, còn nhập nhân sự vẫn giữ nguồn đúng MIME.
- Cấp tài khoản tự động đã hoàn tất 74/74 tác vụ; cả 74 tài khoản mới đều buộc đổi mật khẩu lần đầu. Hai tài khoản có sẵn không được đưa vào hàng đợi cấp mới.

## Vi phạm: đối soát, xác nhận và quyền xem — 27/09/2026

- Tách bản đối soát khỏi vụ việc đã đồng bộ. Trích xuất mới chỉ tạo bản nháp trên màn hình; không upsert cả danh sách vào DB khi thêm/xóa. Các bản nháp legacy đã lưu được xóa thật qua API có quyền và giao dịch; audit tombstone chặn client cũ khôi phục cùng ID.
- API incidents/confirm xác nhận cả lô và cập nhật hồ sơ nhân sự trong một giao dịch. Dùng khóa giao dịch, định danh vụ việc theo nhân viên/mã/thời gian và unique key records để retry/import lại không trừ điểm hai lần. Chỉ cập nhật trường hồ sơ do server tính; MANAGE_VIOLATIONS không cấp quyền sửa các trường HR khác. Bản đối soát chỉ loại dòng sau khi API thành công; lỗi giữ nguyên để thử lại.
- Tài khoản ACTIVE được mở tab Vi phạm đọc được vụ việc RTG đã đồng bộ, không đọc bản nháp. Bổ sung danh bạ đối soát tối thiểu cho người có MANAGE_VIOLATIONS, không trả thông tin riêng tư của hồ sơ. Không nới RLS.
- Có hai mục Bảng đối soát / Đã đồng bộ. Khi đồng bộ toàn bộ thành công, bảng đối soát về 0; các vụ việc nằm ở Đã đồng bộ và tự cập nhật qua Realtime cho người xem. Loại nút tải Google thủ công khỏi giao diện người xem.
- Typecheck/build, 40/40 kiểm thử backend và migrations local đạt; 19 bảng ứng dụng vẫn bật RLS. 3/3 Chrome chuyên biệt đạt: thống kê chỉ xem, xóa không hồi sinh/confirm thất bại-thành công và người xem nhận vụ việc qua Realtime. Sau bảo vệ tombstone, kiểm thử incident/API chạy lại; không sửa hồ sơ thật để kiểm thử.
- Đã thử tệp XLS được người dùng cho phép trên bản thống kê chỉ xem: LINE A 849, LINE B 518, tổng 1.367 container, bỏ 4 Flag Y và 3 Block trống. Trước/sau lượt xem số records shipProductivity giữ 2 và sync_queue giữ 4; không tạo file hoặc kết quả mới. Các bản lịch sử trước thay đổi không tự xóa. Ảnh: artifacts/screenshots/yard-view-only-live.png.
- Đã triển khai revision `quanlyrtg-00018-g2s` lúc 19:57:24 ngày 27/09/2026 (Asia/Ho_Chi_Minh), nhận 100% lưu lượng; revision 00017 về 0%. Đăng nhập Admin Google trên https://quanlyrtg.ai.studio/ thành công. Giao diện chính thức hiển thị Bảng đối soát (1) và Đã đồng bộ (2); bản nháp lịch sử chưa xác nhận được giữ nguyên. Không xác nhận/trừ điểm/xóa vụ việc thật để thử. Console không có lỗi runtime trong lần mở phân hệ. Ảnh: artifacts/screenshots/incidents-published-live.png.
- Bổ sung bộ lọc đơn vị quản lý trước nhận diện tên nhân viên, chỉ nhận RTG/cẩu khung và chuẩn hóa Phạm Ngọc Tuấn → Phạm Ngọc Tuân. Kiểm thử mới loại dòng Tổ Đầu kéo kể cả có nhắc tên nhân viên RTG. Lượt cuối typecheck/build và 2/2 kiểm thử incidents đạt; không chạy lại toàn bộ suite vì không có thay đổi ở các phân hệ khác.

## Đăng nhập đông người trên gói miễn phí — 27/09/2026

- Giữ nguyên gói Supabase Free và cấu hình Cloud Run hiện tại. Không nâng gói, tăng quota Auth, bật IP forwarding hoặc tắt giới hạn bảo mật.
- Backend điều tiết password grant bằng hàng chờ trong bộ nhớ: tối đa 4 yêu cầu Auth đang chạy, đợt đầu 20 lượt, sau đó bổ sung 1 lượt/2,5 giây. Hàng chờ tối đa 100, tổng thời gian đăng nhập tối đa 240 giây. Thiết kế theo deployment hiện tại max 1 instance; nếu tăng số instance cần chuyển bộ điều tiết sang cơ chế dùng chung trước.
- Lỗi upstream 429/5xx/mạng thử lại tối đa 4 lần trong cùng một POST, có khoảng chờ và cooldown. Sai thông tin không thử lại tự động; giới hạn 10 lần/tên đăng nhập/15 phút và 100 POST/IP/5 phút được giữ. Lỗi hạ tầng/hủy chờ hoàn lại lượt thử để tránh khóa nhầm tài khoản. Không lưu mật khẩu/token vào bảng hàng chờ, log, Drive hay Sheets.
- UI có trạng thái chờ, số giây đã chờ, chặn bấm lặp và cho hủy; giới hạn 250 giây phía client. Hủy đóng hàng chờ phía server. Xóa mật khẩu khỏi ô nhập sau khi kết thúc. Lỗi quá tải không hiển thị thành sai mật khẩu.
- Đổi mật khẩu lần đầu cũng dùng hàng chờ Auth; chờ trước khi giữ transaction/khóa nhân sự, kiểm tra credentials_changed_at sau khi lấy khóa để ngăn ghi đè thay đổi mật khẩu từ phiên khác. Giữ chính sách bắt đổi ban đầu, thu hồi phiên và RLS.
- Với 80 lượt dồn một lúc, người ở cuối có thể chờ khoảng 2,5 phút nếu dịch vụ bình thường; đây là đánh đổi để giữ gói miễn phí. Khi kèm đổi mật khẩu lần đầu/refresh/lỗi nhà cung cấp, có thể lâu hơn hoặc cần thử lại. Nên cấp và đổi mật khẩu trước buổi kiểm tra tập trung.
- Màn hình chờ/hủy/lỗi 503 trên Chrome 390px và 1366px đạt 2/2; typecheck/build đạt. Kết quả mô phỏng tải được bổ sung sau khi hoàn tất. Không tạo tài khoản thử hoặc phát tải vào production.
- Tài liệu quota được đối chiếu: https://supabase.com/docs/guides/auth/rate-limits . Realtime Free vẫn có giới hạn 200 kết nối và 100 message/giây; tối ưu đăng nhập không thay thế kiểm thử tải Realtime/nộp bài trong môi trường thực.
- Kết quả kiểm thử cuối: 9/9 backend liên quan đạt; sau bổ sung bảo vệ đổi mật khẩu đồng thời, 6/6 account/admission chạy lại đạt. Lượt 80 tài khoản qua Express thật + PGlite + Auth giả lập có burst 30, refill 150/5 phút đạt 1.282 HTTP request, 0 lỗi ngoài dự kiến, 0 lần chạm quota giả lập. Login p95 140.224 ms, chậm nhất 150.227 ms; tải dữ liệu khởi tạo p95 1.424 ms. Đây là mô phỏng giới hạn nhà cung cấp, chưa phải kết quả đo với 80 Supabase Auth thật. Báo cáo: artifacts/capacity-80.json.
- Đã triển khai điều tiết đăng nhập ở revision `quanlyrtg-00019-twr`, 100% lưu lượng lúc 20:19:18 ngày 27/09/2026. Một lượt đăng nhập với tên giả lập không tồn tại xác minh trạng thái chờ và lỗi thông tin đăng nhập; không chạm tài khoản nhân viên.

## Giữ phiên và giảm yêu cầu lặp của một người dùng — 27/09/2026

- Phản hồi thực tế sau bản 00019 cho thấy một người dùng vẫn gặp giới hạn API. Tối ưu password grant chưa xử lý luồng tải dữ liệu: focus tải lại toàn bộ phân hệ, SIGNED_IN lặp tải hồ sơ/ghi session, lỗi tải hồ sơ tạm thời bị xử lý như mất quyền. Không coi thử tải đăng nhập là chứng minh ổn định toàn phiên.
- Gộp sự kiện Auth của cùng phiên, giãn tải hồ sơ/focus tối thiểu 30 giây, gộp Realtime theo module tối thiểu 3 giây; giữ polling dự phòng khi đang hiển thị và hủy yêu cầu khi rời phân hệ. Google Sync đọc trạng thái mỗi 15 giây khi đang hiển thị. Không tăng giới hạn 120 API/phút/tài khoản.
- GET gặp 429 tôn trọng Retry-After dùng chung trong trình duyệt, chỉ tự thử lại một lần và giữ dữ liệu đang hiển thị. Không tự gửi lại POST/PUT/DELETE. Lỗi mạng/429/503 khi tải lại hồ sơ không xóa phiên; 401/403 vẫn chặn như cũ.
- Thay đổi quyền thay thế listener nhưng tái sử dụng một kênh Realtime; gỡ kênh khi không còn listener và bỏ qua sự kiện của kênh đã gỡ. Ngăn đua leave/join khi cập nhật quyền.
- 6/6 tình huống Chrome đạt: ba vai trò cập nhật quyền/Realtime, 100 sự kiện focus không phát sinh đọc collection hoặc ghi session thêm, profile 503 giữ phiên, collection 429 tự phục hồi, Google queue tự ẩn success. 5/5 API/backoff/security checks và 3/3 kiểm thử hub/queue đạt; typecheck/build đạt. Build còn cảnh báo bundle lớn có sẵn. Không thay schema hoặc RLS.
- App bật persistSession và autoRefreshToken, không đặt đồng hồ giới hạn số giờ sử dụng. Phiên mặc định Supabase không có thời hạn tối đa cố định; refresh token duy trì đăng nhập khi phiên còn hợp lệ. Điều này không phải cam kết không có sự cố trong ca làm việc. https://supabase.com/docs/guides/auth/sessions

- Bản sửa đã triển khai revision quanlyrtg-00020-ml7 lúc 20:38:07 ngày 27/09/2026 (Asia/Ho_Chi_Minh), nhận 100% lưu lượng. Phiên Admin Google tải lại trang, mở Vi phạm, chuyển Kiểm tra và về Tổng quan vẫn đăng nhập; không hiện lỗi 429 và console không ghi lỗi runtime trong lượt kiểm tra. Không chỉnh dữ liệu nghiệp vụ để thử. Đây là smoke test ngắn, chưa phải đo phiên thực 8–12 giờ hoặc 80 người đồng thời. Ảnh: artifacts/screenshots/session-refresh-live.png.

## Ngân hàng câu hỏi: xóa thư mục và nhập cả lô — 27/09/2026

- Nguyên nhân: callback cập nhật thư mục chỉ upsert danh sách còn lại, không DELETE mục đã bỏ. Callback câu hỏi upsert từng câu của toàn bộ ngân hàng sau mỗi chỉnh sửa; cửa sổ nhập đóng trước khi promise hoàn tất. Nhập lớn có thể chạm giới hạn API và chỉ lưu một phần. Bộ đọc cũ chỉ xét sheet đầu, tự mặc định đáp án A khi thiếu, còn luồng AI giới hạn số câu và cắt văn bản ở 30.000 ký tự.
- Xóa thư mục qua giao dịch DELETE thật, bỏ phân loại nhưng giữ câu hỏi và đề thi đã lưu. Dùng khóa chung cho ghi/xóa ngân hàng, audit tombstone chặn client cũ tái tạo ID đã xóa. Không nới quyền MANAGE_QUIZ hoặc RLS.
- Endpoint import nhận 1–2.000 câu đã xem trước trong một giao dịch, ghi hàng loạt, kiểm tra thư mục/đáp án và chống trùng theo nội dung/lựa chọn/đáp án trong cùng thư mục. Biên nhận dùng job_id, checksum, trạng thái success và unique dedupe_key của audit_log; lỗi rollback cả câu hỏi và biên nhận. Retry cùng job trả lại kết quả cũ, payload thay đổi trả 409.
- UI chờ lưu xong mới báo thành công, giữ Preview khi lỗi và không gửi lại từng câu. Các câu bỏ chọn được giữ trong Preview để rà soát. Chỉnh sửa thủ công lưu riêng từng câu bằng nút Lưu câu hỏi. Preview phân trang 20 câu, hiển thị tổng số, vị trí cần rà soát và nút chọn các câu có đáp án hợp lệ.
- Nhập trực tiếp toàn bộ các sheet Excel hoặc văn bản Word/TXT theo mẫu; tách rõ chế độ nhập câu có sẵn và biên soạn mới bằng AI. Không tự đoán đáp án; văn bản quá giới hạn biên soạn AI báo lỗi rõ thay vì cắt im lặng. PDF vẫn được hỗ trợ làm tài liệu biên soạn AI.
- 50/50 backend tests đạt, gồm migrations/RLS và thử tải cục bộ 80 phiên; 3/3 Chrome đạt (386 câu giả lập, đúng tệp người dùng với 383 dòng/10 đáp án cần rà soát, hồi quy giao đề). Sau chỉnh bộ đọc đáp án, 3/3 kiểm thử chuyên biệt chạy lại đạt. Typecheck/build đạt trước triển khai; build còn cảnh báo bundle lớn có sẵn. Không có thay đổi schema.
- Tệp thực kiểm tra có 383 dòng câu hỏi trong A2:F384: 373 đáp án đơn hợp lệ, 7 đáp án nhiều lựa chọn, 2 trống, 1 E ngoài A–D; 6 dòng trùng nội dung/lựa chọn/đáp án. Người dùng chọn nhập các câu hợp lệ trước và giữ 10 câu để rà soát. Không đưa nội dung câu hỏi, đáp án hoặc tệp người dùng lên GitHub.
- Đã triển khai bản sửa ở revision `quanlyrtg-00023-cfx`, 100% lưu lượng lúc 21:31:25 ngày 27/09/2026. Nhập thực tế lúc 21:47:25: submitted 373, added 346, skipped 27 (21 đã tồn tại + 6 dòng lặp). Supabase xác nhận thư mục đích có 367 câu, toàn ngân hàng 527 câu; receipt success. 10 câu chưa hợp lệ giữ trong Preview và tài liệu rà soát cục bộ. Console không ghi lỗi runtime trong lượt nhập. Ảnh: artifacts/screenshots/question-bank-live-import.png.
- Sửa tiếp lỗi Chrome để fieldset không trực tiếp giữ vùng cuộn flex: dùng div cuộn bên ngoài, giữ fieldset khóa thao tác khi lưu. Kiểm thử cuộn danh sách dài tại 390/768/1366/1920px xác nhận hộp thoại/nút xác nhận luôn trong viewport, nội dung cuộn bên trong; kiểm thử toàn luồng 386 câu đạt lại.
