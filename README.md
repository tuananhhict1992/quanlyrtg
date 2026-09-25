# RTG — React, Supabase và Google Workspace

Tiếp tục từ mã nguồn project được cung cấp. Supabase PostgreSQL giữ dữ liệu vận hành; Google Drive giữ tệp; Google Sheets giữ các snapshot lịch sử và báo cáo. Không tự đưa dữ liệu mẫu vào database.

Hướng dẫn từng bước cho project đã chọn, tạo admin và vận hành: [HUONG_DAN_VAN_HANH.md](HUONG_DAN_VAN_HANH.md).

Bản mã nguồn công khai không chứa danh sách hồ sơ cá nhân hay thông tin liên hệ mẫu. Hồ sơ được tải từ database sau xác thực; các biểu mẫu minh họa dùng tên “Nhân viên mẫu” và để trống số điện thoại. Quy tắc chuẩn hóa tên theo yêu cầu nghiệp vụ vẫn được giữ.

## Chạy local

Yêu cầu Node.js 22 trở lên.

```powershell
npm ci
Copy-Item .env.example .env
# Điền cấu hình trong .env, không commit secret.
npm run db:migrate
npm run dev
```

Không cấu hình dịch vụ vẫn có thể build và xem trang đăng nhập. Không có chế độ bỏ qua xác thực. Chạy `npm run worker` ở một tiến trình riêng hoặc đặt `RUN_SYNC_WORKER=true` khi chạy server. Bật worker mới thực hiện đồng bộ và lịch thông báo.

## Supabase

1. Tạo/chọn project; điền URL, publishable key và DATABASE_URL có TLS. Không thêm secret key vào biến `VITE_*`.
2. Chạy migration. Chỉ expose schema `public` qua Data API; không thêm schema `private` vào cấu hình exposed schemas. Các bảng nghiệp vụ đều bật RLS, không cấp quyền cho browser đọc trực tiếp. Node kiểm tra Supabase Auth và quyền hồ sơ hiện tại trước mọi API nghiệp vụ. Realtime chỉ phát module thay đổi, không phát dữ liệu nhân sự hoặc đáp án.
3. Tạo tài khoản đầu tiên trong Supabase Auth. Cấu hình email/password và Google provider nếu sử dụng đăng nhập Google. Đăng ký URL ứng dụng trong redirect allowlist. Tắt public signup nếu chỉ cấp tài khoản nội bộ; cấu hình JWT expiry và session lifetime phù hợp gói Supabase.
4. Liên kết tài khoản đầu tiên:

```powershell
npm run account:link -- --auth-user-id UUID_FROM_AUTH --employee-id RTG-ADMIN --bootstrap-admin --name "Quản trị RTG"
```

Với người dùng tiếp theo: tạo hồ sơ nhân viên trong ứng dụng, tạo tài khoản Supabase Auth với cùng email, rồi chạy `npm run account:link -- --auth-user-id UUID --employee-id EMPLOYEE_ID`. Không lưu hoặc nhập mật khẩu qua Excel/Sheets. Cột mật khẩu cũ bị bỏ qua.

DATABASE_URL chỉ nằm trên server; tuyệt đối không đưa credential này vào trình duyệt. Server hiện dùng kết nối có quyền quản lý schema `private`; nên triển khai trong mạng tin cậy, giới hạn truy cập database ở tầng mạng. Không chạy migration bằng client browser.

## Google Drive / Sheets

1. Bật Google Drive API và Google Sheets API trong Google Cloud.
2. Tạo service account, giữ private key ở secret manager hoặc biến môi trường server.
3. Tạo thư mục **RTG_SYSTEM trong Shared Drive**, cấp quyền đủ cho service account. Service account không dùng kho My Drive cá nhân làm nơi sở hữu tệp.
4. Tạo spreadsheet riêng cho RTG; cấp service account quyền chỉnh sửa; điền `GOOGLE_DRIVE_ROOT_ID`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
5. Admin mở **Phân quyền → Google Sync → Chuẩn bị Google** để tạo 10 thư mục và 11 tab yêu cầu. Không bật chia sẻ công khai tệp.

Thư mục: `01_NHAN_SU`, `02_VI_PHAM`, `03_BINH_XET`, `04_NGHI_PHEP`, `05_SAN_LUONG`, `06_KIEM_TRA`, `07_GOP_Y`, `08_THONG_BAO`, `09_TAI_LIEU`, `10_BACKUP`.

Tab: `EMPLOYEES`, `VIOLATIONS`, `RANKINGS`, `LEAVE`, `SHIP_PRODUCTIVITY`, `EXAMS`, `EXAM_RESULTS`, `FEEDBACK`, `NOTIFICATIONS`, `COMPETENCY_EVENTS`, `SYNC_LOG`.

Sheets lưu lịch sử theo `job_id`, `record_id`, `checksum`, `snapshot_json`, người yêu cầu, thời điểm. Giá trị ghi bằng RAW để tránh công thức từ dữ liệu nhập. Đáp án thi và credential không xuất vào snapshot báo cáo. Import báo cáo qua **Preview → Confirm Import**, bản xem trước có checksum, người tạo và thời hạn 30 phút. Luồng nhập Excel cũ vẫn được giữ; parser XLSX chạy trên Node, tối đa 20 MB, 20 sheet, mỗi sheet 2.000 dòng × 100 cột.

## Tính bền vững

- Ghi nghiệp vụ, audit và enqueue cùng transaction. Google lỗi không rollback dữ liệu nghiệp vụ đã commit.
- Chốt bình xét cập nhật biên bản và đánh giá tháng trong cùng transaction; checksum, trạng thái, job ID và unique kỳ bình xét chống gửi trùng.
- Queue: `pending → processing → success/failed`. Admin dùng **Retry Sync**. Worker chết giữa chừng được chuyển sang failed khi worker khác giành được khóa.
- Sheets retry ghi lại cùng số dòng đã cấp. Drive retry dùng file ID đã giữ trước upload để phục hồi khi mất phản hồi.
- File tạm nằm trong PostgreSQL (`private.temporary_files`), ngoài webroot. Database trigger cấm xóa trước khi xử lý xong, lưu nghiệp vụ, ghi metadata với Drive ID và xác nhận archive. File chưa confirm import tiếp tục được giữ.
- Ảnh góp ý chỉ đổi sang Drive URL sau khi lưu trữ được xác nhận. Không xóa ảnh theo timeout.
- Ảnh và tài liệu lưu trên Drive được đọc qua API xác thực theo quyền xem bản ghi hiện tại, không cần chia sẻ công khai tệp.
- Backup JSON là snapshot dữ liệu vận hành; không thay thế backup/PITR của Supabase, Auth và cấu hình hạ tầng.
- Migration có checksum và transaction. Không dùng lệnh reset database khi triển khai dữ liệu thật.

## Build / kiểm thử

```powershell
npm run typecheck
npm test
npm run db:check
npm run build
npm run test:browser
npm audit
```

`db:check` chạy migration trong PostgreSQL local qua PGlite, không kết nối project thật. Kiểm thử trình duyệt dùng Chrome headless và API fixture, kiểm tra 390 / 768 / 1366 / 1920px. Ảnh và kết quả nằm trong `artifacts/`. Không nhầm kết quả fixture với kiểm chứng tài khoản Google/Supabase thật.

Production: build với đúng biến `VITE_SUPABASE_*`, đặt `NODE_ENV=production`, chạy `npm start`, phục vụ qua HTTPS và reverse proxy. Rate limiter mặc định thuộc một process; nếu chạy nhiều web instance, cấu hình limiter chung tại reverse proxy. Chạy worker với kết nối Postgres session/direct; advisory session lock không dùng transaction pooler. Cấu hình giám sát worker, quota Google, database backup/PITR và cảnh báo queue failed.

Chi tiết phạm vi đã kiểm chứng và phần cần UAT dữ liệu thật: [PRODUCTION_CHECK.md](PRODUCTION_CHECK.md).
