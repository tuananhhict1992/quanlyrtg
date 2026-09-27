# Giao diện HICT – Điều hành RTG

Cập nhật 27/09/2026. Các quy tắc dùng chung nằm ở src/index.css; logo và ảnh đại diện ở src/components/Brand.tsx.

- Màu chính: #006EAE; hover #075B91; nền nhạt #EEF8FD; nền ứng dụng #F4F7FA; chữ #16324A.
- Xanh lá dành cho thành công, vàng cho cảnh báo, đỏ cho lỗi hoặc thao tác xóa.
- Font Plus Jakarta Sans hỗ trợ tiếng Việt; hệ thống fallback khi font web chưa tải.
- Nút chính xanh, nút phụ nền trắng có viền; trạng thái hover/focus/disabled rõ ràng. Các trường nhập có vòng focus và chữ 16px trên điện thoại.
- Logo tại public/brand/hict-logo.png là bản sao nguyên vẹn NĂM.png do người dùng cung cấp, SHA-256 79ddc19566aa5111bc74bfbe596c2c24f4304580fd7210ece2c66e71135891d5. Component hiển thị vùng có hình bằng SVG viewBox, không thay màu hay kéo méo artwork.
- UserAvatar dùng chữ viết tắt khi không có ảnh hoặc ảnh tải lỗi, không tạo ảnh chân dung giả.
- Thanh menu thu gọn trên mobile; Escape đóng menu và menu tài khoản. Nút điều hướng có aria-current. Hiệu ứng tôn trọng prefers-reduced-motion.
- Dashboard ưu tiên hai khung Thông báo và Truy cập nhanh ở đầu; tiêu đề Tổng quan vận hành và các số liệu nằm bên dưới, tiếp đến các báo cáo. Nút truy cập nhanh dùng nền màu nhạt, biểu tượng màu đậm theo từng nhóm: xanh dương/tra cứu, xanh ngọc/thư viện, vàng/phương tiện, cam/sự cố thiết bị, hồng/vi phạm và tím/kiểm tra. Nút Thông tin của tôi dùng xanh HICT. Chức năng, quyền truy cập và luồng nghiệp vụ tiếp tục dùng cơ chế hiện có.
- Không thay schema, RLS, xác thực hoặc dữ liệu nhân sự trong lần cập nhật này.

Logo được đóng gói dưới dạng module lazy tại src/assets/hict để AI Studio vẫn xuất bản đúng ảnh khi trình nhập ZIP bỏ qua file nhị phân public. Chạy node scripts/embed-brand-logo.mjs sau khi thay ảnh nguồn. Các phần base64 chứa nguyên byte PNG, được tải một lần và dùng chung cho logo/favicon; không nằm trong bundle chính.

Kiểm tra local: TypeScript, production build và 12 kiểm thử Chrome đạt qua hai lượt chạy; gồm 390/768/1366/1920px, điều hướng các phân hệ, Google Preview/Confirm, ảnh tệp, giao bài chống trùng và thông báo nội bộ. Test logo giả lập đường dẫn PNG 404, xác nhận ảnh nhúng giải mã được ở 4000×3000 và trùng SHA-256 gốc. Build còn cảnh báo chunk lớn; riêng ảnh gốc 2,69 MB được tải qua chunk lazy, không tối ưu mất dữ liệu.
