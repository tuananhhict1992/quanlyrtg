# Hướng dẫn đưa hệ thống RTG vào hoạt động

Ngày cập nhật: 26/09/2026. Project đã chọn: **quanlyrtghict — utcpdfiyaqnimdasttak**.

Mã nguồn đã có các luồng Supabase/Google và hai bản sửa bình xét, thông báo giao bài. Cập nhật 26/09/2026: migration đã được áp dụng lên project `quanlyrtghict` (`utcpdfiyaqnimdasttak`), 11 bảng đều bật RLS và Realtime đã cấu hình. Admin đầu tiên đã được tạo trong Supabase Auth và liên kết hồ sơ `RTG-ADMIN` (ADMIN, ACTIVE). Bản Google AI Studio Preview đã đăng nhập thành công, tải màn hình quản trị từ database thật và ghi audit `login`. Máy local hiện chưa có `.env`; Google Drive/Sheets chưa kết nối và website chưa Publish chính thức.

Đối với bản AI Studio hiện tại, URL, publishable key, `DATABASE_URL` và `TRUST_PROXY_HOPS=1` đã được cấu hình trong Secrets. Kết nối database sử dụng Session pooler, kiểm tra TLS đầy đủ và chứng chỉ CA tại `supabase/certs/prod-ca-2021.txt`. Không nhập lại mật khẩu hoặc bootstrap admin khi không cần. Migration đã có ledger nên không cần dán lại SQL tạo bảng; bước 3 dùng để áp dụng migration mới khi có thay đổi. Bản nhập vào AI Studio không tự đồng bộ với GitHub.

1. **Chuẩn bị nơi chạy ứng dụng**

   Dùng Node.js 22 trở lên. Mở PowerShell trong thư mục project:

   ```powershell
   Set-Location 'C:\Users\ADMIN\OneDrive\Documents\ChatGPT\RTG 2'
   node --version
   npm.cmd ci
   if (-not (Test-Path -LiteralPath '.env')) {
     Copy-Item -LiteralPath '.env.example' -Destination '.env'
   }
   notepad.exe .env
   ```

   Lệnh trên giữ nguyên `.env` nếu đã có. Không đưa `.env`, khóa Google hay mật khẩu vào chat, Git hoặc file chia sẻ. Do thư mục hiện nằm trong OneDrive, nên đặt bản triển khai và secret ngoài thư mục đồng bộ dùng chung; giới hạn người có quyền đọc file cấu hình.

2. **Lấy cấu hình Supabase**

   Mở [project quanlyrtghict](https://supabase.com/dashboard/project/utcpdfiyaqnimdasttak). Kiểm tra đúng project ref trước khi nhập thông tin.

   Vào phần API Keys của project để lấy **publishable key**. Điền trong `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://utcpdfiyaqnimdasttak.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=DIEN_PUBLISHABLE_KEY
   SUPABASE_URL=https://utcpdfiyaqnimdasttak.supabase.co
   SUPABASE_PUBLISHABLE_KEY=DIEN_CUNG_PUBLISHABLE_KEY
   RUN_SYNC_WORKER=false
   PORT=3000
   ```

   Hai dòng URL trùng nhau, hai dòng publishable key trùng nhau. Chỉ publishable key được đưa vào `VITE_*`; không dùng secret/service-role key ở đây.

   Bấm **Connect** trên dashboard, chọn **Direct connection** nếu máy hỗ trợ IPv6, hoặc **Session pooler** khi máy chỉ dùng IPv4. Sao chép chuỗi kết nối vào `DATABASE_URL`, thay mật khẩu database và thêm `sslmode=verify-full` đúng cú pháp URL. Dùng thông tin host/user do dashboard cung cấp; không đoán hostname. Mật khẩu trong URL phải được percent-encode nếu có ký tự đặc biệt. Đây là mật khẩu database, khác với mật khẩu đăng nhập ứng dụng.

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD_DA_ENCODE@HOST:5432/postgres?sslmode=verify-full&sslrootcert=supabase%2Fcerts%2Fprod-ca-2021.txt
   ```

   Giữ file CA công khai `supabase/certs/prod-ca-2021.txt` trong bản triển khai và chạy Node từ thư mục gốc project. File này lấy từ mục SSL của Supabase Database Settings; kiểm tra thời hạn và thay bằng chứng chỉ chính thức khi Supabase đổi CA. Mật khẩu thật không có dấu ngoặc vuông giữ chỗ từ mẫu URI, trừ khi dấu đó thực sự thuộc mật khẩu.

   Worker sử dụng khóa theo session nên **không dùng Transaction pooler**. Nếu gặp lỗi chứng chỉ, cấu hình CA từ Supabase cho máy chủ; không tắt kiểm tra TLS. [Hướng dẫn SSL chính thức của Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).

3. **Khởi tạo cấu trúc database**

   Với database đã có dữ liệu, tạo backup trước. Sau khi lưu `.env`, chạy:

   ```powershell
   npm.cmd run db:migrate
   ```

   Thành công sẽ có dòng `Applied ...sql` ở lần đầu. Chạy lại không áp dụng trùng các migration đã ghi nhận. Không dùng reset database. Nếu lệnh báo lỗi, dừng bước này và xử lý lỗi kết nối/quyền trước khi tạo admin.

   Có thể kiểm tra bằng SQL Editor:

   ```sql
   select name, applied_at from private.schema_migrations;
   select schemaname, tablename, rowsecurity
   from pg_tables
   where schemaname = 'private'
      or (schemaname = 'public' and tablename = 'record_changes');
   ```

   `rowsecurity` phải là `true` trên các bảng ứng dụng. Dữ liệu nghiệp vụ nằm trong schema `private`; không thêm schema này vào **Exposed schemas** của Data API. Migration cấu hình Realtime cho tín hiệu `public.record_changes`.

4. **Tạo admin đầu tiên**

   Bước này đã hoàn tất trên project `quanlyrtghict`: admin đầu tiên đã liên kết với `RTG-ADMIN`. Không chạy bootstrap lần nữa trên project này. Các hướng dẫn dưới đây chỉ dùng khi cài một database mới.

   Trong Supabase, mở **Authentication → Users → Add user → Create new user**, nhập email và mật khẩu mạnh do bạn tự đặt. Nếu quản trị viên trực tiếp tạo tài khoản nội bộ, xác nhận email theo lựa chọn của dashboard; nếu dùng email mời thì hoàn tất lời mời trước khi đăng nhập. Sao chép **User UID** của tài khoản vừa tạo.

   Chạy lệnh dưới đây, thay `UUID_TU_SUPABASE_AUTH` bằng UID thật:

   ```powershell
   npm.cmd run account:link -- --auth-user-id UUID_TU_SUPABASE_AUTH --employee-id RTG-ADMIN --bootstrap-admin --name "Quản trị RTG"
   ```

   Kết quả đúng: `Linked account successfully.` Lệnh tạo hồ sơ ACTIVE, gán ADMIN và liên kết với Supabase Auth. Chỉ dùng `--bootstrap-admin` cho admin đầu tiên; nếu đã tồn tại admin thì quản lý quyền qua ứng dụng. Không tạo một dòng nhân viên có email rồi cho rằng đã tạo tài khoản đăng nhập: Auth và hồ sơ phải được liên kết.

   Trong cấu hình Auth, bật Email/password. Nếu chỉ cấp tài khoản nội bộ, tắt đăng ký công khai. Ở **URL Configuration**, thêm địa chỉ local phù hợp như `http://localhost:3000` và sau này thay Site URL bằng tên miền HTTPS thật. Đăng nhập Google là cấu hình provider riêng, không bắt buộc để đăng nhập bằng email/mật khẩu. [Tài liệu Supabase về redirect URL](https://supabase.com/docs/guides/auth/redirect-urls).

5. **Chạy và đăng nhập local**

   Nếu app đang chạy trong cửa sổ terminal khác, dừng tiến trình đó bằng Ctrl+C trước khi khởi động lại để tránh trùng cổng 3000.

   ```powershell
   npm.cmd run typecheck
   npm.cmd run build
   $env:NODE_ENV='production'
   npm.cmd start
   ```

   Giữ terminal mở, vào [ứng dụng local](http://localhost:3000), đăng nhập bằng email/mật khẩu ở bước 4. Kiểm tra nhìn thấy menu nhân sự và phân quyền. Khi thay `VITE_SUPABASE_*`, phải build lại vì các giá trị này được đóng gói vào frontend. Khi thay cấu hình server/Google, phải khởi động lại tiến trình server và worker.

   Để phát triển mã nguồn, dùng terminal mới không có `NODE_ENV=production`, hoặc `Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue`, rồi chạy `npm.cmd run dev`.

6. **Tạo hồ sơ và cấp tài khoản nhân viên**

   Trong Nhân sự, nhập/tạo hồ sơ RTG; đối chiếu mã nhân viên, email, ca/bộ phận và trạng thái ACTIVE trước khi xác nhận. Chọn 2–3 nhân viên để thử trước khi nhập toàn bộ.

   Với mỗi người: tạo tài khoản trong Supabase Auth, lấy UID; email Auth phải khớp email trong hồ sơ. Sau đó liên kết bằng **id hồ sơ** thực tế (không nhầm với employeeCode nếu hai giá trị khác nhau):

   ```powershell
   npm.cmd run account:link -- --auth-user-id UUID_NHAN_VIEN --employee-id ID_HO_SO
   ```

   Admin vào Phân quyền để cấp các nghiệp vụ cần thiết. Thử bằng một tài khoản nhân viên thường để xác nhận quyền xem/sửa. Quyền người dùng được kiểm tra lại ở Node, không chỉ dựa vào việc ẩn menu. Không lưu mật khẩu nhân viên trong Excel, Sheets hoặc hồ sơ.

7. **Chuẩn bị Google Drive và Google Sheets**

   Bản tích hợp hiện dùng **service account**. Trong [Google Cloud Console](https://console.cloud.google.com/), chọn/tạo project; vào APIs & Services, bật **Google Drive API** và **Google Sheets API**. Tạo service account ở IAM & Admin → Service Accounts; tạo khóa JSON nếu chính sách tổ chức cho phép. Giữ khóa này riêng trên server, không đặt trong thư mục public.

   Trong Google Workspace, tạo thư mục tên chính xác **RTG_SYSTEM** bên trong **Shared Drive**. Thêm email service account làm thành viên có quyền tạo/ghi tệp và thư mục, ví dụ Contributor nếu chính sách tổ chức cho phép. Service account không có dung lượng để sở hữu tệp trong My Drive; nếu bạn chỉ có Gmail cá nhân, cần Shared Drive từ tổ chức hoặc bổ sung luồng OAuth người dùng vào mã nguồn trước khi dùng kho cá nhân. [Giải thích chính thức của Google](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

   Tạo một Google Spreadsheet dành riêng cho báo cáo RTG, cấp quyền chỉnh sửa cho email service account. Lấy hai ID:

   | Cấu hình | Lấy từ đâu |
   |---|---|
   | `GOOGLE_DRIVE_ROOT_ID` | Phần sau `/folders/` trong URL thư mục RTG_SYSTEM; không lấy ID gốc của cả Shared Drive |
   | `GOOGLE_SPREADSHEET_ID` | Phần giữa `/spreadsheets/d/` và `/edit` trong URL spreadsheet; không dùng `gid` của một tab |
   | `GOOGLE_CLIENT_EMAIL` | Trường `client_email` trong khóa JSON |
   | `GOOGLE_PRIVATE_KEY` | Trường `private_key` trong khóa JSON |

   Điền vào `.env`:

   ```dotenv
   GOOGLE_CLIENT_EMAIL=TEN_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nNOI_DUNG_KHOA\n-----END PRIVATE KEY-----\n"
   GOOGLE_DRIVE_ROOT_ID=ID_THU_MUC_RTG_SYSTEM
   GOOGLE_SPREADSHEET_ID=ID_SPREADSHEET
   ```

   Giữ đúng nội dung khóa và ký hiệu xuống dòng `\n`. Khởi động lại server. Admin vào **Phân quyền → Google Sync → Chuẩn bị Google**. Thành công phải có 10 thư mục con và 11 tab:

   ```text
   RTG_SYSTEM/
     01_NHAN_SU       02_VI_PHAM       03_BINH_XET
     04_NGHI_PHEP     05_SAN_LUONG     06_KIEM_TRA
     07_GOP_Y         08_THONG_BAO     09_TAI_LIEU
     10_BACKUP

   EMPLOYEES, VIOLATIONS, RANKINGS, LEAVE, SHIP_PRODUCTIVITY,
   EXAMS, EXAM_RESULTS, FEEDBACK, NOTIFICATIONS,
   COMPETENCY_EVENTS, SYNC_LOG
   ```

   Không bật chia sẻ công khai thư mục/tệp. PostgreSQL tiếp tục là nơi đọc/ghi nghiệp vụ; Sheets dùng lưu trữ và báo cáo. Sửa Sheets không tự đổi dữ liệu ứng dụng.

8. **Bật xử lý hàng đợi**

   Cho lần chạy đầu trên một máy, đổi `RUN_SYNC_WORKER=true` trong `.env`, khởi động lại server bằng `npm.cmd start` trong terminal có `NODE_ENV=production`. Worker sẽ chạy cùng server.

   Nếu vận hành worker riêng, giữ `RUN_SYNC_WORKER=false` cho web và mở terminal thứ hai trong thư mục project:

   ```powershell
   npm.cmd run worker
   ```

   Chọn một cách vận hành, theo dõi log tiến trình. Không tắt máy/cửa sổ chứa tiến trình khi đang cần đồng bộ. Tại Google Sync, xếp hàng báo cáo thử, theo dõi `pending → processing → success`. Nếu `failed`, xem nguyên nhân, sửa cấu hình/quyền rồi bấm **Retry Sync**. Không nhập lại nghiệp vụ chỉ vì Google báo lỗi.

   Thử một tệp nhỏ, kiểm tra có file ID và metadata sau khi upload. File tạm chỉ được xóa khi xử lý, lưu database và xác nhận Drive đều hoàn tất. Không dọn bảng `private.temporary_files` thủ công để giải quyết lỗi queue.

9. **Kiểm thử nghiệp vụ trước khi nhập dữ liệu thật hàng loạt**

   - Bình xét: tạo kỳ thử với người loại A và người mặc định a; chốt; kiểm tra hồ sơ vẫn có a nhưng Word, bản in và xem A4 không liệt kê người mặc định a. Bản Word đã tải trước khi sửa cần xuất lại.
   - Giao bài: dùng đề thử, chọn một người rồi một nhóm; tài khoản người nhận chỉ thấy một thông báo cho đề đó. Gửi lại cùng đề/người không tạo thêm. Người có quyền quản trị thông báo vẫn có thể xem danh sách gửi toàn hệ thống. Luồng này gửi **thông báo trong ứng dụng**, không xác nhận đã gửi Zalo OA ra điện thoại.
   - Các thông báo trùng đã tồn tại từ trước không bị xóa tự động. Khi kết nối được DB thật, cần đối chiếu theo đề/người trước khi xử lý lịch sử để tránh xóa thông báo hợp lệ.
   - Kiểm tra bài thi: nhân viên không nhận đáp án đúng trước khi nộp; thử nộp lại và hết giờ; kiểm tra điểm lưu vào hồ sơ.
   - Google: sửa một hồ sơ, chạy báo cáo, đối chiếu tab; thử mất quyền Google rồi Retry và xác nhận dữ liệu DB vẫn còn.
   - Import Sheets: luôn **Preview → kiểm tra dữ liệu → Confirm Import**. Mẫu báo cáo mới dùng snapshot của ứng dụng; Sheets cũ theo cột nên xuất XLSX và dùng luồng nhập Excel hiện có.
   - Duyệt/từ chối nghỉ, nhập vi phạm RTG, phân quyền, mở tài liệu và ảnh; thử trên điện thoại 390px và các màn hình 768/1366/1920px. Kiểm tra ngày/giờ Việt Nam.

   Kiểm thử tự động local dùng API fixture và PostgreSQL PGlite, không thay cho các bước xác nhận Supabase/Google thật. `npm.cmd run db:check` chỉ kiểm tra migration local; `npm.cmd run db:migrate` mới áp dụng lên DB đã cấu hình.

10. **Đưa lên máy chủ để nhân viên sử dụng**

    `localhost` chỉ truy cập trên chính máy đang chạy. Cần một máy chủ chạy Node liên tục, tên miền và HTTPS. Không chỉ upload thư mục `dist` lên hosting tĩnh vì các API, xác thực nghiệp vụ, Word và worker cần Node.

    Trên máy chủ: chép mã nguồn đã kiểm thử cùng file CA, cài dependencies, lưu secret trong môi trường server, chạy migration còn thiếu, build với biến `VITE_*` đúng, đặt `NODE_ENV=production`, chạy `npm start` và worker theo bước 8. Dùng trình quản lý dịch vụ của nền tảng để tự khởi động lại sau lỗi/reboot. Thiết lập reverse proxy HTTPS cho cùng origin web/API; cấu hình giới hạn truy cập ở proxy phù hợp, đặc biệt khi chạy nhiều web instance.

    `TRUST_PROXY_HOPS=0` khi chạy trực tiếp, không có proxy. Bản AI Studio hiện dùng `TRUST_PROXY_HOPS=1` để lấy IP qua ingress cho rate limit. Với nền tảng khác, xác nhận số proxy tin cậy thực tế và ngăn truy cập trực tiếp vào Node trước khi đặt giá trị; không đặt trust proxy thành `true` cho mọi nguồn.

    Cập nhật Site URL/Redirect URLs trong Supabase Auth sang tên miền thật. Nếu dùng đăng nhập Google, cấu hình provider và callback riêng. Cấu hình SMTP nếu dùng email mời/khôi phục mật khẩu; kiểm tra email thực nhận được trước khi cấp tài khoản hàng loạt.

    Trước khi mở cho toàn tổ: đăng nhập admin và nhân viên thường qua tên miền HTTPS, thử lưu DB/Drive/Sheets, theo dõi queue và log, xác nhận backup/khôi phục. Cấu hình backup database theo gói Supabase và lưu cấu hình triển khai ở nơi an toàn. Nút **Backup** trong Google Sync tạo snapshot nghiệp vụ vào `10_BACKUP`, không thay thế backup Supabase Auth/database.

11. **Theo dõi và xử lý lỗi thường gặp**

    | Hiện tượng | Cần kiểm tra |
    |---|---|
    | Chưa cấu hình Supabase | `.env`, hai biến `VITE_*`; build lại và restart |
    | Invalid login credentials | Email/mật khẩu Auth, đúng project, tình trạng xác nhận email |
    | Tài khoản chưa được cấp quyền / 403 | `account:link`, đúng id hồ sơ, trạng thái ACTIVE và quyền nghiệp vụ |
    | Lỗi password authentication / timeout DB | DATABASE_URL, mật khẩu DB, encode ký tự, project đang hoạt động, Direct/Session pooler và mạng |
    | SELF_SIGNED_CERT_IN_CHAIN | File CA có trong bản triển khai, đường dẫn sslrootcert đúng, dùng sslmode=verify-full; không tắt xác minh chứng chỉ |
    | Unsupported provider: provider is not enabled | Dùng email/mật khẩu; nút Google Workspace cần cấu hình Google OAuth riêng |
    | Google 403/404 | API đã bật, service account có quyền Shared Drive/Spreadsheet, đúng folder ID và spreadsheet ID |
    | Queue luôn pending | Worker có chạy và có kết nối DB không; kiểm tra log |
    | Queue failed | Xem lỗi từng job, sửa nguyên nhân, Retry; không xóa dữ liệu nghiệp vụ/file tạm |
    | EADDRINUSE:3000 | Một tiến trình đang dùng cổng 3000; dừng đúng tiến trình app cũ rồi chạy lại |
    | Mở được health nhưng không đăng nhập/lưu được | `/api/health` chỉ xác nhận Node còn chạy, không xác nhận DB/Google |

    Khi báo lỗi, gửi thao tác, thời điểm, thông báo lỗi và job ID nếu có; che token, mật khẩu, khóa và thông tin cá nhân không cần thiết.

Chi tiết phạm vi kiểm chứng và giới hạn hiện tại: [PRODUCTION_CHECK.md](PRODUCTION_CHECK.md).
