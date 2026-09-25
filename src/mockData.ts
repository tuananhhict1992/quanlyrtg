import {
  Employee,
  InternalDocument,
  Quiz,
  QuizQuestion,
  QuestionFolder,
  QuizSubmission,
  FeedbackProposal,
  ZaloMessage,
  UserRole,
  RoleConfig,
  PermissionKey,
  TabType,
  LeaveRequest,
  CompetencyScoringRules,
} from './types';

export const DEFAULT_COMPETENCY_RULES: CompetencyScoringRules = {
  goodTaskScore: 5,
  excellentTaskScore: 10,
  ratingAScore: 50,
  ratingSmallAScore: 40,
  ratingBScore: 30,
  ratingSmallBScore: 20,
  ratingCScore: 0,
  restrictionScore: 5,
  violationScore: 20,

  // 1. Thang điểm đánh giá Hàng tháng
  monthlyProductivityA: 50,
  monthlyProductivitySmallA: 40,
  monthlyProductivityB: 30,
  monthlyProductivitySmallB: 20,
  monthlyProductivityC: 0,

  monthlyQuiz90_100: 30,
  monthlyQuiz70_89: 20,
  monthlyQuiz50_69: 10,
  monthlyQuizUnder50: 0,

  monthlyComplianceBase: 20,
  monthlyComplianceAdminDeduct: 5,
  monthlyComplianceDispatchDeduct: 10,
  monthlyComplianceMinorIncidentDeduct: 20,

  monthlyBonusValidSuggestion: 5,
  monthlyBonusEffectiveSuggestion: 10,

  // 2. Thiết lập đánh giá Hàng năm
  annualMonthlyAvgWeight: 0.70,
  annualExamWeight: 0.20,
  annualRewardDisciplineWeight: 0.10,
};

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  ADMIN: {
    name: 'Admin',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    defaultPermissions: [
      'MANAGE_HR',
      'MANAGE_DEPARTMENT_USERS',
      'MANAGE_LEAVE',
      'MANAGE_BXXL',
      'EXPORT_BXXL_REPORTS',
      'MANAGE_CONTAINER_TOOL',
      'MANAGE_LIBRARY',
      'MANAGE_QUIZ',
      'CREATE_QUIZ',
      'MANAGE_FEEDBACK',
      'APPROVE_FEEDBACK',
      'MANAGE_ZALO',
      'SEND_BROADCAST_NOTIFICATION',
      'VIEW_ANALYTICS',
      'VIEW_DEPARTMENT_STATS',
      'MANAGE_DRIVE',
      'MANAGE_PERMISSIONS',
    ],
    description: 'Admin: Toàn quyền cấu hình, phân quyền các bộ phận và quản lý toàn diện hệ thống.',
  },
  MANAGER_L1: {
    name: 'Quản lý cấp 1',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    defaultPermissions: [
      'MANAGE_HR',
      'MANAGE_DEPARTMENT_USERS',
      'MANAGE_LEAVE',
      'MANAGE_BXXL',
      'EXPORT_BXXL_REPORTS',
      'MANAGE_CONTAINER_TOOL',
      'MANAGE_LIBRARY',
      'MANAGE_QUIZ',
      'CREATE_QUIZ',
      'MANAGE_FEEDBACK',
      'APPROVE_FEEDBACK',
      'MANAGE_ZALO',
      'SEND_BROADCAST_NOTIFICATION',
      'VIEW_ANALYTICS',
      'VIEW_DEPARTMENT_STATS',
      'MANAGE_DRIVE',
      'MANAGE_PERMISSIONS',
    ],
    description: 'Quản lý cấp 1: Quản lý tổng thể, duyệt bình xét xếp loại (BXXL), duyệt đề xuất và theo dõi điều hành.',
  },
  MANAGER_L2: {
    name: 'Quản lý cấp 2',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    defaultPermissions: [
      'MANAGE_DEPARTMENT_USERS',
      'MANAGE_LEAVE',
      'MANAGE_BXXL',
      'MANAGE_CONTAINER_TOOL',
      'MANAGE_LIBRARY',
      'MANAGE_QUIZ',
      'MANAGE_FEEDBACK',
      'MANAGE_ZALO',
      'VIEW_DEPARTMENT_STATS',
    ],
    description: 'Quản lý cấp 2: Quản lý trực tiếp các bộ phận được chỉ định, thực hiện BXXL, gửi thông báo và tra cứu bãi container.',
  },
  USER: {
    name: 'Người dùng',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    defaultPermissions: [
      'MANAGE_CONTAINER_TOOL',
    ],
    description: 'Người dùng: Tra cứu quy định, làm bài thi trắc nghiệm, gửi đề xuất sáng kiến và tra cứu số liệu bãi container.',
  },
  // Tương thích ngược
  MANAGER: {
    name: 'Quản lý cấp 1',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    defaultPermissions: [
      'MANAGE_HR',
      'MANAGE_DEPARTMENT_USERS',
      'MANAGE_BXXL',
      'EXPORT_BXXL_REPORTS',
      'MANAGE_CONTAINER_TOOL',
      'MANAGE_LIBRARY',
      'MANAGE_QUIZ',
      'CREATE_QUIZ',
      'MANAGE_FEEDBACK',
      'APPROVE_FEEDBACK',
      'MANAGE_ZALO',
      'SEND_BROADCAST_NOTIFICATION',
      'VIEW_ANALYTICS',
      'VIEW_DEPARTMENT_STATS',
      'MANAGE_DRIVE',
      'MANAGE_PERMISSIONS',
    ],
    description: 'Quản lý cấp 1: Quản lý tổng thể, duyệt bình xét xếp loại và xem báo cáo điều hành.',
  },
  VIEWER: {
    name: 'Người dùng',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    defaultPermissions: ['MANAGE_CONTAINER_TOOL'],
    description: 'Người dùng: Tra cứu tài liệu và làm bài thi.',
  },
};

// Personal records are loaded from the authenticated database, never seeded from source.
export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_DOCUMENTS: InternalDocument[] = [
  {
    id: 'doc-1',
    code: 'NQ-01/2026/QĐ-DN',
    category: 'NOI_QUY',
    categoryName: 'Nội quy - Quy định',
    title: 'Nội quy Lao động & Giờ giấc làm việc 2026',
    summary: 'Quy định chi tiết về thời gian biểu làm việc, điểm danh, trang phục công sở và văn hóa ứng xử nơi văn phòng.',
    departmentInCharge: 'RTG ca 2',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-02-15',
    viewCount: 420,
    tags: ['Nội quy', 'Giờ làm việc', 'Chấm công', 'Trang phục'],
    content: `
CĂN CỨ BỘ LUẬT LAO ĐỘNG VÀ QUY CHẾ HOẠT ĐỘNG DOANH NGHIỆP:

Điều 1: Thời gian làm việc và nghỉ ngơi
- Giờ làm việc tiêu chuẩn: Từ 08h00 đến 17h30 hàng ngày từ Thứ Hai đến Thứ Sáu.
- Thời gian nghỉ trưa: Từ 12h00 đến 13h30 (90 phút).
- Làm việc ngoài giờ (OT): Phải được Trưởng bộ phận phê duyệt bằng văn bản/email trước 16h00 cùng ngày và được tính hệ số theo quy định luật lao động (150% ngày thường, 200% ngày nghỉ tuần).

Điều 2: Phương thức Chấm công & Điểm danh
- Nhân viên bắt buộc điểm danh bằng khuôn mặt/vân tay tại cổng văn phòng hoặc check-in GPS trên ứng dụng nội bộ trước 08h00 và sau 17h30.
- Đi muộn từ 01 - 15 phút: Tính đi muộn mức 1.
- Đi muộn trên 15 phút mà không có lý do báo trước được Trưởng bộ phận duyệt: Tính nửa buổi công tác hoặc nghỉ không lương.
- Quên chấm công: Tối đa 02 lần/tháng được làm phiếu giải trình có xác nhận của Quản lý trực tiếp. Quá 02 lần sẽ không tính công buổi đó.

Điều 3: Tiêu chuẩn Trang phục & Tác phong văn phòng
- Thứ Hai đến Thứ Năm: Trang phục công sở lịch sự (Nam: Áo sơ mi/polo có cổ, quần âu/kaki; Nữ: Váy công sở qua gối, áo sơ mi/blouse).
- Thứ Sáu (Casual Friday): Được mặc áo phông đồng phục công ty kết hợp quần jean tối màu lịch sự.
- Luôn đeo thẻ nhân viên trong suốt thời gian có mặt tại trụ sở và các chi nhánh làm việc.
    `,
  },
  {
    id: 'doc-2',
    code: 'NQ-02/2026/QĐ-IT',
    category: 'NOI_QUY',
    categoryName: 'Nội quy - Quy định',
    title: 'Quy chế Bảo mật Thông tin & An toàn Dữ liệu Khách hàng',
    summary: 'Nguyên tắc bảo vệ dữ liệu nội bộ, bảo mật mật khẩu, cấm sao chép dữ liệu khách hàng và quy định dùng thiết bị.',
    departmentInCharge: 'RTG ca 1',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-01-20',
    viewCount: 312,
    tags: ['Bảo mật', 'Dữ liệu', 'Công nghệ', 'Mật khẩu', 'NDA'],
    content: `
Điều 1: Quản lý Tài khoản & Mật khẩu
- Mật khẩu truy cập hệ thống phải dài tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
- Bắt buộc đổi mật khẩu định kỳ mỗi 90 ngày. Bật xác thực hai yếu tố (2FA) trên email và tài khoản nội bộ.
- Tuyệt đối không chia sẻ tài khoản làm việc, mật khẩu cho đồng nghiệp hoặc người ngoài.

Điều 2: Bảo vệ Dữ liệu & Bí mật Kinh doanh
- Nghiêm cấm tải, trích xuất danh sách khách hàng, báo cáo tài chính, mã nguồn (source code) ra thiết bị cá nhân hoặc USB không được cấp phép.
- Không sử dụng email cá nhân để trao đổi tài liệu mật hoặc công việc của công ty.
- Khi rời khỏi bàn làm việc, nhân viên có nghĩa vụ khóa màn hình máy tính (Windows: Phím Windows + L; macOS: Cmd + Ctrl + Q).
    `,
  },
  {
    id: 'doc-3',
    code: 'HD-01/2026/SOP-HR',
    category: 'HUONG_DAN',
    categoryName: 'Hướng dẫn - Quy trình (SOP)',
    title: 'Quy trình Đăng ký Nghỉ phép & Phép năm (SOP-HR01)',
    summary: 'Hướng dẫn thủ tục nộp đơn xin nghỉ phép năm, nghỉ ốm, nghỉ chế độ và thời hạn báo trước cho quản lý.',
    departmentInCharge: 'RTG ca 2',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-02-10',
    viewCount: 540,
    tags: ['Nghỉ phép', 'SOP', 'Phép năm', 'Nghỉ ốm', 'Quy trình'],
    content: `
Điều 1: Tiêu chuẩn Phép năm
- Mỗi nhân viên chính thức được hưởng 12 ngày phép năm có hưởng lương/năm. Cứ đủ 05 năm làm việc liên tục được cộng thêm 01 ngày phép.
- Nhân viên đang trong thời gian thử việc chưa được dùng phép năm, trường hợp cần nghỉ sẽ tính là nghỉ không lương.

Điều 2: Thời hạn báo trước khi xin nghỉ phép
- Nghỉ từ 01 đến 02 ngày: Phải gửi đơn phê duyệt trên hệ thống trước ít nhất 48 giờ (02 ngày làm việc).
- Nghỉ từ 03 đến 05 ngày: Phải gửi đơn trước ít nhất 07 ngày làm việc để Trưởng phòng sắp xếp bàn giao nhân sự.
- Nghỉ từ 06 ngày trở lên: Phải gửi đơn trước ít nhất 15 ngày và cần sự phê duyệt của Ca trưởng hoặc Tổng Giám đốc.
- Nghỉ ốm đột xuất: Phải thông báo qua điện thoại/Zalo cho Quản lý trực tiếp trước 08h00 sáng ngày nghỉ và bổ sung Giấy xác nhận nghỉ việc hưởng BHXH (C65-HD) của cơ sở y tế trong vòng 48h khi đi làm lại.
    `,
  },
  {
    id: 'doc-4',
    code: 'HD-02/2026/SOP-KT',
    category: 'HUONG_DAN',
    categoryName: 'Hướng dẫn - Quy trình (SOP)',
    title: 'Hướng dẫn Tạm ứng & Thanh toán Công tác phí (SOP-KT03)',
    summary: 'Định mức ăn ở, vé máy bay, hồ sơ chứng từ hợp lệ và thời hạn thanh quyết toán công tác phí.',
    departmentInCharge: 'RTG ca 2',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-01-15',
    viewCount: 285,
    tags: ['Công tác phí', 'Tạm ứng', 'Hóa đơn VAT', 'Quyết toán'],
    content: `
Điều 1: Định mức Lưu trú & Công tác phí
- Định mức khách sạn tại Hà Nội, TP.HCM, Đà Nẵng: Tối đa 900.000 VNĐ/phòng đơn/đêm đối với nhân viên; 1.500.000 VNĐ/đêm đối với Trưởng bộ phận.
- Phụ cấp lưu trú (tiền ăn): 300.000 VNĐ/người/ngày (không cần xuất hóa đơn tài chính).
- Phương tiện di chuyển: Đi máy bay hạng phổ thông (Economy) đối với chặng bay trên 400km; đi tàu hỏa/xe giường nằm đối với cự ly ngắn hơn.

Điều 2: Hồ sơ & Thời hạn Thanh quyết toán
- Tất cả chi phí lưu trú, tiếp khách, di chuyển taxi công cộng bắt buộc phải có Hóa đơn điện tử VAT (hóa đơn đỏ) phát hành đúng mã số thuế công ty.
- Trong vòng 05 ngày làm việc kể từ ngày kết thúc chuyến công tác, nhân sự phải hoàn thiện Bảng kê thanh toán kèm đầy đủ hóa đơn chứng từ nộp về Phòng Kế toán.
    `,
  },
  {
    id: 'doc-5',
    code: 'VP-01/2026/QĐ-KL',
    category: 'VI_PHAM',
    categoryName: 'Các vi phạm & Chế tài',
    title: 'Khung Chế tài Xử lý Vi phạm Kỷ luật Lao động (QĐ-VP2026)',
    summary: 'Bảng quy định mức độ vi phạm, hình thức khiển trách, phạt vi phạm và các trường hợp bị sa thải chấm dứt HĐLĐ.',
    departmentInCharge: 'RTG ca 2',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-02-28',
    viewCount: 689,
    tags: ['Chế tài', 'Kỷ luật', 'Vi phạm', 'Sa thải', 'Đi muộn'],
    content: `
Căn cứ Điều 124, 125 Bộ luật Lao động và Quy chế xử lý nội bộ:

MỨC 1: NHẮC NHỞ & TRỪ ĐIỂM THI ĐUA NỘI BỘ
- Đi muộn hoặc về sớm từ 03 đến 05 lần trong 01 tháng không có lý do chính đáng: Lập biên bản nhắc nhở, trừ 10 điểm KPI tháng.
- Không mặc đúng trang phục công sở hoặc không đeo thẻ nhân viên quá 03 lần/tháng.
- Để khu vực làm việc bừa bãi, không tắt thiết bị điện (máy tính, điều hòa) khi ra về cuối ngày.

MỨC 2: KHIỂN TRÁCH BẰNG VĂN BẢN
- Đi muộn trên 05 lần trong 01 tháng.
- Không hoàn thành nhiệm vụ được giao gây ảnh hưởng trực tiếp đến tiến độ dự án dưới 3 ngày.
- Bỏ vị trí làm việc trong giờ hành chính từ 02 tiếng trở lên không thông báo.
- Vi phạm an toàn PCCC mức độ sơ đẳng (hút thuốc lá tại khu vực cấm hút thuốc): Phạt 500.000 VNĐ nộp quỹ công đoàn và lập biên bản khiển trách.

MỨC 3: KÉO DÀI THỜI HẠN NÂNG LƯƠNG HOẶC CÁCH CHỨC
- Tiết lộ thông tin nội bộ chưa được công bố ra ngoài gây thiệt hại uy tín công ty.
- Có hành vi xúc phạm danh dự, nhân phẩm, gây rối trật tự, ẩu đả tại nơi làm việc.
- Gian dối trong việc chấm công hoặc làm giả chứng từ thanh toán công tác phí.

MỨC 4: SA THẢI CHẤM DỨT HỢP ĐỒNG LAO ĐỘNG
- Tự ý bỏ việc 05 ngày làm việc cộng dồn trong thời hạn 30 ngày hoặc 20 ngày trong thời hạn 365 ngày mà không có lý do chính đáng.
- Có hành vi trộm cắp, tham ô, đánh bạc, sử dụng ma túy tại nơi làm việc.
- Tiết lộ bí mật kinh doanh, bí mật công nghệ hoặc sao chép cơ sở dữ liệu khách hàng cho bên thứ ba cạnh tranh.
    `,
  },
  {
    id: 'doc-6',
    code: 'VP-02/2026/QĐ-AT',
    category: 'VI_PHAM',
    categoryName: 'Các vi phạm & Chế tài',
    title: 'Quy định An toàn Lao động & Phòng ngừa Sự cố Kho bãi',
    summary: 'Chế tài nghiêm cấm vi phạm bảo hộ lao động, quy trình xếp dỡ hàng hóa và quy định phòng cháy chữa cháy.',
    departmentInCharge: 'RTG ca 1',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-02-01',
    viewCount: 190,
    tags: ['An toàn', 'Kho vận', 'PCCC', 'Bảo hộ', 'Chế tài'],
    content: `
Điều 1: Bắt buộc trang bị Đồ Bảo hộ Lao động (PPE)
- Nhân viên làm việc tại kho, khu vực sản xuất hoặc kiểm kê hàng hóa nặng bắt buộc phải mang giày mũi thép, mũ bảo hộ và áo phản quang.
- Vi phạm lần 1: Đình chỉ ca làm việc và nhắc nhở. Vi phạm lần 2: Phạt 300.000 VNĐ và lập biên bản vi phạm kỷ luật.

Điều 2: Phòng cháy Chữa cháy & Lối thoát hiểm
- Nghiêm cấm để hàng hóa hoặc chướng ngại vật chắn cửa thoát hiểm, bình cứu hỏa hoặc hộp chữa cháy vách tường trong phạm vi 1.5 mét.
- Tuyệt đối nghiêm cấm mang nguồn lửa, diêm, bật lửa hoặc hút thuốc lá trong kho hàng và khu vực văn phòng.
    `,
  },
];

export const INITIAL_QUESTION_FOLDERS: QuestionFolder[] = [
  {
    id: 'folder-noiquy',
    name: 'Nội quy Lao động & Kỷ luật',
    description: 'Quy định giờ giấc làm việc, chấm công, nghỉ phép và tác phong kỷ luật',
    color: 'indigo',
    createdAt: '2026-01-01',
  },
  {
    id: 'folder-vanhoa',
    name: 'Văn hóa & Đãi ngộ',
    description: 'Chính sách phúc lợi, thưởng, tác phong ứng xử chuẩn mực',
    color: 'emerald',
    createdAt: '2026-01-05',
  },
  {
    id: 'folder-antoan',
    name: 'An toàn & PCCC Kho bãi',
    description: 'Trang bị bảo hộ PPE, quy chuẩn phòng cháy chữa cháy và thoát hiểm',
    color: 'amber',
    createdAt: '2026-01-10',
  },
  {
    id: 'folder-baomat',
    name: 'Bảo mật Thông tin & CNTT',
    description: 'Quy chế dữ liệu, an toàn thiết bị, bảo vệ tài khoản và email nội bộ',
    color: 'rose',
    createdAt: '2026-01-15',
  },
];

export const INITIAL_QUESTION_BANK: QuizQuestion[] = [
  {
    id: 'q-1',
    folderId: 'folder-noiquy',
    question: 'Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào?',
    options: [
      { id: 'opt-a', text: '08h00 - 17h00 (Nghỉ trưa 60 phút)' },
      { id: 'opt-b', text: '08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)' },
      { id: 'opt-c', text: '08h30 - 18h00 (Nghỉ trưa 90 phút)' },
      { id: 'opt-d', text: 'Tùy nhân viên tự chọn khung giờ linh hoạt' },
    ],
    correctOptionId: 'opt-b',
    explanation: 'Giờ làm việc tiêu chuẩn là từ 08h00 đến 17h30 từ Thứ Hai đến Thứ Sáu, nghỉ trưa 90 phút (12h00 - 13h30).',
    citation: 'Căn cứ Điều 1, Nội quy Lao động & Giờ giấc làm việc 2026 (NQ-01)',
  },
  {
    id: 'q-2',
    folderId: 'folder-noiquy',
    question: 'Nhân viên cần nộp đơn xin nghỉ phép trước bao lâu nếu dự định nghỉ từ 01 đến 02 ngày làm việc?',
    options: [
      { id: 'opt-a', text: 'Trước 12 giờ' },
      { id: 'opt-b', text: 'Trước 24 giờ' },
      { id: 'opt-c', text: 'Trước ít nhất 48 giờ (02 ngày làm việc)' },
      { id: 'opt-d', text: 'Chỉ cần báo Quản lý vào buổi sáng ngày nghỉ' },
    ],
    correctOptionId: 'opt-c',
    explanation: 'Quy trình SOP-HR01 quy định nghỉ từ 1 - 2 ngày phải gửi đơn trước ít nhất 48 giờ.',
    citation: 'Căn cứ Điều 2, Quy trình Đăng ký Nghỉ phép (HD-01/2026/SOP-HR)',
  },
  {
    id: 'q-3',
    folderId: 'folder-noiquy',
    question: 'Hình thức xử lý đối với nhân viên đi làm muộn từ 03 đến 05 lần trong 01 tháng mà không có lý do chính đáng là gì?',
    options: [
      { id: 'opt-a', text: 'Khiển trách bằng văn bản và trừ lương tháng' },
      { id: 'opt-b', text: 'Nhắc nhở bằng biên bản và trừ 10 điểm thi đua KPI tháng' },
      { id: 'opt-c', text: 'Sa thải ngay lập tức' },
      { id: 'opt-d', text: 'Không bị xử lý nếu bù giờ vào buổi tối' },
    ],
    correctOptionId: 'opt-b',
    explanation: 'Đi muộn từ 3-5 lần/tháng thuộc Mức 1: Nhắc nhở bằng văn bản và trừ 10 điểm KPI tháng.',
    citation: 'Căn cứ Mức 1, Khung Chế tài Xử lý Vi phạm Kỷ luật Lao động (VP-01)',
  },
  {
    id: 'q-4',
    folderId: 'folder-baomat',
    question: 'Theo quy chế an toàn dữ liệu, nhân viên cần làm gì khi rời khỏi bàn làm việc?',
    options: [
      { id: 'opt-a', text: 'Để màn hình chờ chạy tự do' },
      { id: 'opt-b', text: 'Bắt buộc khóa màn hình máy tính (Win + L hoặc Cmd + Ctrl + Q)' },
      { id: 'opt-c', text: 'Tắt nguồn máy tính hoàn toàn' },
      { id: 'opt-d', text: 'Nhờ đồng nghiệp ngồi cạnh trông hộ máy' },
    ],
    correctOptionId: 'opt-b',
    explanation: 'Khi rời khỏi vị trí làm việc, nhân viên có nghĩa vụ khóa màn hình máy tính để bảo vệ dữ liệu bí mật.',
    citation: 'Căn cứ Điều 2, Quy chế Bảo mật Thông tin (NQ-02/2026/QĐ-IT)',
  },
  {
    id: 'q-5',
    folderId: 'folder-vanhoa',
    question: 'Thời hạn tối đa để nộp hồ sơ quyết toán công tác phí về Phòng Kế toán là bao nhiêu ngày kể từ khi kết thúc chuyến công tác?',
    options: [
      { id: 'opt-a', text: '03 ngày làm việc' },
      { id: 'opt-b', text: '07 ngày làm việc' },
      { id: 'opt-c', text: '15 ngày làm việc' },
      { id: 'opt-d', text: 'Vào kỳ quyết toán tài chính cuối năm' },
    ],
    correctOptionId: 'opt-b',
    explanation: 'Hồ sơ quyết toán công tác phí phải nộp trong vòng 07 ngày làm việc kèm đầy đủ hóa đơn GTGT hợp lệ.',
    citation: 'Căn cứ Điều 3, Quy chế Công tác phí & Chế độ phụ cấp (HD-02/2026/TC-KT)',
  },
  {
    id: 'q-6',
    folderId: 'folder-antoan',
    question: 'Khoảng cách tối thiểu bắt buộc phải giữ thông thoáng quanh bình cứu hỏa và hộp chữa cháy vách tường là bao nhiêu?',
    options: [
      { id: 'opt-a', text: '0.5 mét' },
      { id: 'opt-b', text: '1.0 mét' },
      { id: 'opt-c', text: '1.5 mét' },
      { id: 'opt-d', text: '2.0 mét' },
    ],
    correctOptionId: 'opt-c',
    explanation: 'Nghiêm cấm để hàng hóa hoặc chướng ngại vật chắn cửa thoát hiểm, bình cứu hỏa hoặc hộp chữa cháy trong phạm vi 1.5 mét.',
    citation: 'Căn cứ Điều 2, Quy định An toàn Lao động & PCCC Kho bãi (VP-02)',
  },
];

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'quiz-1',
    title: 'Kiểm tra Đánh giá Năng lực: Nội quy Lao động & Văn hóa Doanh nghiệp 2026',
    code: 'TEST-NQ2026',
    category: 'Nội quy & Văn hóa',
    description: 'Bài kiểm tra định kỳ nhằm đánh giá mức độ hiểu biết và tuân thủ các quy định giờ giấc, chấm công, trang phục và bảo mật dữ liệu.',
    durationMinutes: 15,
    passScore: 75,
    targetDepartments: ['ALL'],
    createdAt: '2026-01-10',
    questions: [
      {
        id: 'q-1',
        question: 'Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào?',
        options: [
          { id: 'opt-a', text: '08h00 - 17h00 (Nghỉ trưa 60 phút)' },
          { id: 'opt-b', text: '08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)' },
          { id: 'opt-c', text: '08h30 - 18h00 (Nghỉ trưa 90 phút)' },
          { id: 'opt-d', text: 'Tùy nhân viên tự chọn khung giờ linh hoạt' },
        ],
        correctOptionId: 'opt-b',
        explanation: 'Giờ làm việc tiêu chuẩn là từ 08h00 đến 17h30 từ Thứ Hai đến Thứ Sáu, nghỉ trưa 90 phút (12h00 - 13h30).',
        citation: 'Căn cứ Điều 1, Nội quy Lao động & Giờ giấc làm việc 2026 (NQ-01)',
      },
      {
        id: 'q-2',
        question: 'Nhân viên cần nộp đơn xin nghỉ phép trước bao lâu nếu dự định nghỉ từ 01 đến 02 ngày làm việc?',
        options: [
          { id: 'opt-a', text: 'Trước 12 giờ' },
          { id: 'opt-b', text: 'Trước 24 giờ' },
          { id: 'opt-c', text: 'Trước ít nhất 48 giờ (02 ngày làm việc)' },
          { id: 'opt-d', text: 'Chỉ cần báo Quản lý vào buổi sáng ngày nghỉ' },
        ],
        correctOptionId: 'opt-c',
        explanation: 'Quy trình SOP-HR01 quy định nghỉ từ 1 - 2 ngày phải gửi đơn trước ít nhất 48 giờ.',
        citation: 'Căn cứ Điều 2, Quy trình Đăng ký Nghỉ phép (HD-01/2026/SOP-HR)',
      },
      {
        id: 'q-3',
        question: 'Hình thức xử lý đối với nhân viên đi làm muộn từ 03 đến 05 lần trong 01 tháng mà không có lý do chính đáng là gì?',
        options: [
          { id: 'opt-a', text: 'Khiển trách bằng văn bản và trừ lương tháng' },
          { id: 'opt-b', text: 'Nhắc nhở bằng biên bản và trừ 10 điểm thi đua KPI tháng' },
          { id: 'opt-c', text: 'Sa thải ngay lập tức' },
          { id: 'opt-d', text: 'Không bị xử lý nếu bù giờ vào buổi tối' },
        ],
        correctOptionId: 'opt-b',
        explanation: 'Đi muộn từ 3-5 lần/tháng thuộc Mức 1: Nhắc nhở bằng văn bản và trừ 10 điểm KPI tháng.',
        citation: 'Căn cứ Mức 1, Khung Chế tài Xử lý Vi phạm Kỷ luật Lao động (VP-01)',
      },
      {
        id: 'q-4',
        question: 'Theo quy chế an toàn dữ liệu, nhân viên cần làm gì khi rời khỏi bàn làm việc?',
        options: [
          { id: 'opt-a', text: 'Để màn hình chờ chạy tự do' },
          { id: 'opt-b', text: 'Bắt buộc khóa màn hình máy tính (Win + L hoặc Cmd + Ctrl + Q)' },
          { id: 'opt-c', text: 'Tắt nguồn máy tính hoàn toàn' },
          { id: 'opt-d', text: 'Nhờ đồng nghiệp ngồi cạnh trông hộ máy' },
        ],
        correctOptionId: 'opt-b',
        explanation: 'Khi rời khỏi vị trí làm việc, nhân viên có nghĩa vụ khóa màn hình máy tính để bảo vệ dữ liệu bí mật.',
        citation: 'Căn cứ Điều 2, Quy chế Bảo mật Thông tin (NQ-02/2026/QĐ-IT)',
      },
      {
        id: 'q-5',
        question: 'Thời hạn tối đa để nộp hồ sơ quyết toán công tác phí về Phòng Kế toán là bao nhiêu ngày kể từ khi kết thúc chuyến công tác?',
        options: [
          { id: 'opt-a', text: '03 ngày làm việc' },
          { id: 'opt-b', text: '05 ngày làm việc' },
          { id: 'opt-c', text: '15 ngày làm việc' },
          { id: 'opt-d', text: 'Cuối tháng kế tiếp' },
        ],
        correctOptionId: 'opt-b',
        explanation: 'Trong vòng 05 ngày làm việc kể từ ngày kết thúc chuyến đi, nhân sự phải hoàn thiện bảng kê thanh toán kèm hóa đơn VAT nộp kế toán.',
        citation: 'Căn cứ Điều 2, Hướng dẫn Tạm ứng & Thanh toán Công tác phí (HD-02)',
      },
    ],
  },
  {
    id: 'quiz-2',
    title: 'Kiểm tra Chuyên đề: An toàn Lao động & Phòng cháy Chữa cháy (PCCC 2026)',
    code: 'TEST-PCCC2026',
    category: 'An toàn & PCCC',
    description: 'Đánh giá kiến thức phòng chống cháy nổ, sử dụng trang thiết bị bảo hộ và phản ứng khi có sự cố khẩn cấp.',
    durationMinutes: 10,
    passScore: 80,
    targetDepartments: ['RTG ca 1', 'RTG ca 1'],
    createdAt: '2026-02-01',
    questions: [
      {
        id: 'q-p1',
        question: 'Khu vực quanh bình chữa cháy và cửa thoát hiểm phải giữ khoảng cách thông thoáng tối thiểu là bao nhiêu mét?',
        options: [
          { id: 'opt-a', text: '0.5 mét' },
          { id: 'opt-b', text: '1.0 mét' },
          { id: 'opt-c', text: '1.5 mét' },
          { id: 'opt-d', text: 'Không quy định cụ thể' },
        ],
        correctOptionId: 'opt-c',
        explanation: 'Nghiêm cấm để hàng hóa hoặc chướng ngại vật chắn cửa thoát hiểm, bình cứu hỏa trong phạm vi tối thiểu 1.5 mét.',
        citation: 'Căn cứ Điều 2, Quy định An toàn Lao động & Phòng ngừa Sự cố Kho bãi (VP-02)',
      },
      {
        id: 'q-p2',
        question: 'Hành vi hút thuốc lá tại khu vực cấm (như văn phòng, kho hàng) sẽ bị chế tài xử lý như thế nào?',
        options: [
          { id: 'opt-a', text: 'Chỉ nhắc nhở miệng' },
          { id: 'opt-b', text: 'Phạt 500.000 VNĐ nộp quỹ công đoàn và lập biên bản khiển trách' },
          { id: 'opt-c', text: 'Trừ 01 ngày phép năm' },
          { id: 'opt-d', text: 'Đình chỉ công tác 01 tháng' },
        ],
        correctOptionId: 'opt-b',
        explanation: 'Vi phạm an toàn PCCC mức độ hút thuốc tại nơi cấm sẽ bị phạt 500.000 VNĐ nộp quỹ công đoàn và lập biên bản khiển trách bằng văn bản.',
        citation: 'Căn cứ Mức 2, Khung Chế tài Kỷ luật Lao động (VP-01)',
      },
      {
        id: 'q-p3',
        question: 'Đồ bảo hộ lao động bắt buộc khi làm việc tại kho hoặc kiểm kê hàng nặng gồm những gì?',
        options: [
          { id: 'opt-a', text: 'Giày mũi thép, mũ bảo hộ và áo phản quang' },
          { id: 'opt-b', text: 'Chỉ cần găng tay vải thông thường' },
          { id: 'opt-c', text: 'Dép sandal quai hậu và khẩu trang y tế' },
          { id: 'opt-d', text: 'Tùy theo sự thoải mái của người lao động' },
        ],
        correctOptionId: 'opt-a',
        explanation: 'Nhân viên bắt buộc phải mang giày mũi thép, mũ bảo hộ và áo phản quang đạt chuẩn.',
        citation: 'Căn cứ Điều 1, Quy định An toàn Lao động (VP-02)',
      },
    ],
  },
];

export const INITIAL_SUBMISSIONS: QuizSubmission[] = [];
export const INITIAL_FEEDBACKS: FeedbackProposal[] = [];
export const INITIAL_ZALO_MESSAGES: ZaloMessage[] = [];

export const DEFAULT_EMPLOYEES = INITIAL_EMPLOYEES;

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string; category?: string }[] = [
  // Nhóm Nhân sự & Tổ chức
  {
    key: 'MANAGE_HR',
    label: 'Quản lý Hồ sơ Nhân sự Toàn diện',
    description: 'Thêm, sửa, xóa hồ sơ nhân viên toàn công ty, cập nhật số Zalo và hợp đồng.',
    category: 'Nhân sự & Bộ phận',
  },
  {
    key: 'MANAGE_DEPARTMENT_USERS',
    label: 'Quản lý Nhân sự Trong Bộ phận / Ca',
    description: 'Cập nhật phân công, số điện thoại Zalo và theo dõi nhân sự thuộc bộ phận/ca của mình.',
    category: 'Nhân sự & Bộ phận',
  },
  {
    key: 'MANAGE_LEAVE',
    label: 'Quản lý & Phê duyệt Đăng ký Nghỉ phép',
    description: 'Thẩm quyền phê duyệt hoặc từ chối các đơn đăng ký nghỉ phép, ca ngày / ca đêm của nhân viên.',
    category: 'Nhân sự & Bộ phận',
  },

  // Nhóm Bình xét Xếp loại (BXXL)
  {
    key: 'MANAGE_BXXL',
    label: 'Bình xét Xếp loại (BXXL)',
    description: 'Đánh giá, đề xuất xếp loại tháng A, B, b, C, GPT và tổng hợp biên bản họp.',
    category: 'Bình xét Xếp loại (BXXL)',
  },
  {
    key: 'EXPORT_BXXL_REPORTS',
    label: 'Xuất Văn bản Đề xuất Word / PDF',
    description: 'Quyền xuất tài liệu đề xuất BXXL định dạng Word (.docx) theo thể thức hành chính chuẩn.',
    category: 'Bình xét Xếp loại (BXXL)',
  },

  // Nhóm Bãi Container
  {
    key: 'MANAGE_CONTAINER_TOOL',
    label: 'Công cụ Xử lý Dữ liệu Bãi Container',
    description: 'Tra cứu, lọc ngầm file Excel tồn bãi theo Cột S và AD, xuất bảng 4 cột LINE A / B.',
    category: 'Bãi Container',
  },

  // Nhóm Đào tạo & Kiểm tra
  {
    key: 'MANAGE_QUIZ',
    label: 'Giám sát Đề thi & Kết quả Năng lực',
    description: 'Xem bảng điểm, tỷ lệ hoàn thành bài thi và hồ sơ kiểm tra định kỳ của nhân viên.',
    category: 'Đào tạo & Thi cử',
  },
  {
    key: 'CREATE_QUIZ',
    label: 'Biên soạn Đề thi & Ngân hàng Câu hỏi',
    description: 'Thêm mới đề thi, hẹn giờ mở/đóng thi, bốc câu hỏi ngẫu nhiên và quản lý thư mục.',
    category: 'Đào tạo & Thi cử',
  },

  // Nhóm Sáng kiến & Góp ý
  {
    key: 'MANAGE_FEEDBACK',
    label: 'Tiếp nhận Hòm thư Góp ý',
    description: 'Theo dõi các ý kiến, phản ánh hiện trường và đề xuất cải tiến của người lao động.',
    category: 'Sáng kiến & Góp ý',
  },
  {
    key: 'APPROVE_FEEDBACK',
    label: 'Thẩm định & Phê duyệt Sáng kiến',
    description: 'Đánh giá tính khả thi, phân loại khen thưởng và chuyển tiếp duyệt cấp cao.',
    category: 'Sáng kiến & Góp ý',
  },

  // Nhóm Quy chế & Tài liệu
  {
    key: 'MANAGE_LIBRARY',
    label: 'Quản lý Thư viện Quy chế & Văn bản',
    description: 'Ban hành, chỉnh sửa nội quy lao động, quy trình SOP và tài liệu hướng dẫn nghiệp vụ.',
    category: 'Quy chế & Tài liệu',
  },
  {
    key: 'MANAGE_DRIVE',
    label: 'Quản trị Google Drive Đám mây',
    description: 'Tải lên tài liệu, đồng bộ hóa tệp Drive và liên kết tệp vào câu hỏi trắc nghiệm.',
    category: 'Quy chế & Tài liệu',
  },

  // Nhóm Truyền thông & Báo cáo
  {
    key: 'MANAGE_ZALO',
    label: 'Gửi Tin nhắn & Thông báo Nội bộ',
    description: 'Gửi thông báo cá nhân, theo ca trực và thiết lập tin nhắn nhắc lịch.',
    category: 'Truyền thông & Báo cáo',
  },
  {
    key: 'SEND_BROADCAST_NOTIFICATION',
    label: 'Phát Thông báo Toàn Công ty',
    description: 'Quyền gửi thông báo khẩn cấp hoặc tin thông tri diện rộng đến toàn bộ cán bộ công nhân viên.',
    category: 'Truyền thông & Báo cáo',
  },
  {
    key: 'VIEW_ANALYTICS',
    label: 'Xem Báo cáo Tổng thể & Thống kê Admin',
    description: 'Truy cập trung tâm phân tích dữ liệu, dashboard KPI và tiến độ toàn đơn vị.',
    category: 'Truyền thông & Báo cáo',
  },
  {
    key: 'VIEW_DEPARTMENT_STATS',
    label: 'Xem Thống kê Báo cáo Theo Bộ phận',
    description: 'Theo dõi tỷ lệ hoàn thành nhiệm vụ, điểm thi và vi phạm trong phạm vi bộ phận mình.',
    category: 'Truyền thông & Báo cáo',
  },

  // Nhóm Hệ thống
  {
    key: 'MANAGE_PERMISSIONS',
    label: 'Phân quyền & Cấp quyền Truy cập',
    description: 'Ủy quyền quản trị viên, thiết lập vai trò theo bộ phận và cấu hình hiển thị module.',
    category: 'Hệ thống & Cấp quyền',
  },
];

export interface ModuleTabConfig {
  id: TabType;
  label: string;
  sublabel: string;
  category: 'CORE' | 'MANAGEMENT' | 'SYSTEM';
  description: string;
  requiresPermission?: PermissionKey;
}

export const ALL_MODULE_TABS: ModuleTabConfig[] = [
  {
    id: 'dashboard',
    label: 'Tổng quan & Thống kê',
    sublabel: 'Báo cáo số liệu quản trị',
    category: 'MANAGEMENT',
    description: 'Bảng điều khiển KPI, điểm năng lực nhân sự và tiến độ toàn công ty.',
    requiresPermission: 'VIEW_ANALYTICS',
  },
  {
    id: 'hr',
    label: 'Quản lý Nhân sự',
    sublabel: 'Hồ sơ, phòng ban & Zalo',
    category: 'MANAGEMENT',
    description: 'Quản lý hồ sơ cán bộ nhân viên, chức vụ, camera OCR và trạng thái Zalo.',
    requiresPermission: 'MANAGE_HR',
  },
  {
    id: 'violations',
    label: 'Vi phạm & Sự cố',
    sublabel: 'Phân tích sự cố & vi phạm',
    category: 'MANAGEMENT',
    description: 'Trích xuất tự động từ file Excel (Phụ lục 1 & 2), đối soát tên nhân sự hệ thống, chuẩn hóa tên và đồng bộ hồ sơ nhân sự.',
    requiresPermission: 'MANAGE_VIOLATIONS',
  },
  {
    id: 'bxxl',
    label: 'Bình xét Xếp loại (BXXL)',
    sublabel: 'Đánh giá tháng & Xuất Word',
    category: 'MANAGEMENT',
    description: 'Quy trình 7 bước bình xét xếp loại nhân sự A, B, b, C, GPT và xuất văn bản Word chuẩn mẫu hành chính.',
    requiresPermission: 'MANAGE_BXXL',
  },
  {
    id: 'leave',
    label: 'Đăng ký Nghỉ phép',
    sublabel: 'Nghỉ 1 ngày, dài ngày & duyệt nghỉ',
    category: 'CORE',
    description: 'Đăng ký nghỉ phép 1 ngày hoặc dài ngày, lịch trực quan thống kê lượt đăng ký và quản lý phê duyệt.',
  },
  {
    id: 'container_tool',
    label: 'Xử lý Dữ liệu Bãi',
    sublabel: 'Tự động hóa Excel Block A/B',
    category: 'CORE',
    description: 'Công cụ xử lý ngầm dữ liệu tồn bãi container Excel theo Cột S (Block) và Cột AD (NOTIN_LOADLIST_FLG), xuất bảng 4 cột LINE A / LINE B và tổng lưu bãi.',
    requiresPermission: 'MANAGE_CONTAINER_TOOL',
  },
  {
    id: 'drive',
    label: 'Google Drive Đám mây',
    sublabel: 'Quản lý tệp đám mây',
    category: 'CORE',
    description: 'Duyệt, tải lên, lưu trữ và liên kết tệp Google Drive vào câu hỏi trắc nghiệm.',
    requiresPermission: 'MANAGE_DRIVE',
  },
  {
    id: 'quiz',
    label: 'Kiểm tra Trắc nghiệm',
    sublabel: 'Đánh giá năng lực tự động',
    category: 'CORE',
    description: 'Làm bài thi trắc nghiệm, tự luyện và ngân hàng câu hỏi theo chủ đề.',
  },
  {
    id: 'feedback',
    label: 'Góp ý & Đề xuất',
    sublabel: 'Ý kiến, văn bản & hình ảnh',
    category: 'CORE',
    description: 'Gửi đề xuất cải tiến, đính kèm ảnh chụp từ điện thoại và theo dõi duyệt.',
  },
  {
    id: 'zalo',
    label: 'Tin nhắn nội bộ',
    sublabel: 'Cá nhân, Ca trực, Toàn thể',
    category: 'MANAGEMENT',
    description: 'Trung tâm thông báo nội bộ trong app: cá nhân, ca trực, toàn thể & hẹn giờ phát thông báo.',
    requiresPermission: 'MANAGE_ZALO',
  },
  {
    id: 'permissions',
    label: 'Cấp quyền & Hiển thị',
    sublabel: 'Phân quyền từng tài khoản & bộ phận',
    category: 'SYSTEM',
    description: 'Cấp quyền quản trị và cấu hình hiển thị menu cho từng tài khoản và phân quyền theo bộ phận.',
    requiresPermission: 'MANAGE_PERMISSIONS',
  },
  {
    id: 'settings',
    label: 'Cài đặt Tài khoản',
    sublabel: 'Cập nhật thông tin',
    category: 'SYSTEM',
    description: 'Thông tin cá nhân, cập nhật mật khẩu và đồng bộ tài khoản Zalo.',
  },
];

export const DEFAULT_VISIBLE_TABS_BY_ROLE: Record<UserRole, TabType[]> = {
  ADMIN: [
    'dashboard',
    'hr',
    'violations',
    'bxxl',
    'leave',
    'container_tool',
    'drive',
    'quiz',
    'feedback',
    'zalo',
    'permissions',
    'settings',
  ],
  MANAGER_L1: [
    'dashboard',
    'hr',
    'violations',
    'bxxl',
    'leave',
    'container_tool',
    'drive',
    'quiz',
    'feedback',
    'zalo',
    'permissions',
    'settings',
  ],
  MANAGER_L2: [
    'dashboard',
    'hr',
    'violations',
    'bxxl',
    'leave',
    'container_tool',
    'quiz',
    'feedback',
    'zalo',
    'settings',
  ],
  USER: [
    'violations',
    'leave',
    'container_tool',
    'quiz',
    'feedback',
    'settings',
  ],
  // Tương thích ngược
  MANAGER: [
    'dashboard',
    'hr',
    'violations',
    'bxxl',
    'leave',
    'container_tool',
    'drive',
    'quiz',
    'feedback',
    'zalo',
    'settings',
  ],
  VIEWER: [
    'violations',
    'leave',
    'container_tool',
    'settings',
  ],
};

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
