export type UserRole =
  | 'ADMIN'         // Admin
  | 'MANAGER_L1'    // Quản lý cấp 1
  | 'MANAGER_L2'    // Quản lý cấp 2
  | 'USER'          // Người dùng
  | 'MANAGER'       // Tương thích ngược: map sang Quản lý cấp 1
  | 'VIEWER';       // Tương thích ngược: map sang Người dùng

export type TabType =
  | 'dashboard'
  | 'hr'
  | 'violations'
  | 'bxxl'
  | 'leave'
  | 'competency_rules'
  | 'container_tool'
  | 'library'
  | 'drive'
  | 'quiz'
  | 'feedback'
  | 'zalo'
  | 'permissions'
  | 'settings';

export type LeaveShift = 'DAY' | 'NIGHT' | 'FULL_DAY';
export type LeaveType = 'POLICY' | 'REASONABLE' | 'ANNUAL' | 'PERSONAL' | 'COMPENSATORY' | 'SICK' | 'MATERNITY' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shift?: string;
  isMultiDay: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  targetShift?: LeaveShift; // Tùy chọn (đã đơn giản hóa theo yêu cầu không cần chia ca ngày/đêm)
  leaveType: LeaveType;
  reason: string;
  substituteName?: string;
  status: LeaveStatus;
  rejectReason?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  daysCount: number;
}

export interface EmployeeLeaveRecord {
  requestId: string;
  startDate: string;
  endDate: string;
  shift?: LeaveShift;
  leaveType: LeaveType;
  reason: string;
  approvedBy: string;
  approvedAt: string;
}

export interface CustomScoreAdjustment {
  id: string;
  points: number;
  reason: string;
  category?: string;
  date: string;
  adjustedBy: string;
  adjustedByName?: string;
}

export interface CompetencyScoringRules {
  // Hệ số cơ bản / tương thích
  goodTaskScore: number;       // Hoàn thành tốt (+5)
  excellentTaskScore: number;  // Hoàn thành xuất sắc (+10)
  ratingAScore: number;        // Bình xét A (+50)
  ratingSmallAScore: number;   // Bình xét a (+40)
  ratingBScore: number;        // Bình xét B (+30)
  ratingSmallBScore: number;   // Bình xét b (+20)
  ratingCScore: number;        // Bình xét C (0)
  restrictionScore: number;    // Hạn chế (-5)
  violationScore: number;      // Vi phạm (-20)

  // 1. BẢNG THIẾT LẬP TIÊU CHÍ & THANG ĐIỂM ĐÁNH GIÁ HÀNG THÁNG (Tối đa 100đ + Điểm thưởng)
  // Nhóm 1: Kết quả bình xét năng suất (Tối đa 50đ)
  monthlyProductivityA: number;       // +50 (Loại A - KPI/khối lượng hoàn thành xuất sắc)
  monthlyProductivitySmallA: number;  // +40 (Loại a)
  monthlyProductivityB: number;       // +30 (Loại B)
  monthlyProductivitySmallB: number;  // +20 (Loại b)
  monthlyProductivityC: number;       // 0 (Loại C)

  // Nhóm 2: Kết quả bài kiểm tra (Tối đa 30đ)
  monthlyQuiz90_100: number;          // +30 (Điểm bài thi 90 - 100 hoặc % đúng)
  monthlyQuiz70_89: number;           // +20 (Điểm bài thi 70 - 89)
  monthlyQuiz50_69: number;           // +10 (Điểm bài thi 50 - 69)
  monthlyQuizUnder50: number;         // 0 (Dưới 50: Gắn cờ yêu cầu đào tạo lại)

  // Nhóm 3: Tuân thủ & Vi phạm sự cố (Khởi điểm 20đ đầu tháng, trừ dần tối đa về 0đ)
  monthlyComplianceBase: number;                // 20 (Nhân sự tự động có 20đ đầu tháng)
  monthlyComplianceAdminDeduct: number;         // 5 (Lỗi hành chính, tác phong: đi muộn, quên thẻ - Trừ 5đ/lần)
  monthlyComplianceDispatchDeduct: number;      // 10 (Không tuân thủ yêu cầu điều hành, phân ca - Trừ 10đ/lần)
  monthlyComplianceMinorIncidentDeduct: number; // 20 (Sự cố vận hành/an toàn mức độ nhẹ - Mất toàn bộ 20đ nhóm tuân thủ)
  // Sự cố nghiêm trọng ảnh hưởng dây chuyền: Tự động 0đ toàn tháng! Hủy toàn bộ điểm, xếp loại Kém (C)

  // Nhóm 4: Góp ý & Đề xuất (Điểm thưởng - cộng thẳng vào tổng điểm, có thể > 100đ)
  monthlyBonusValidSuggestion: number;          // +5 (Đề xuất hợp lệ, được CBQL ghi nhận)
  monthlyBonusEffectiveSuggestion: number;      // +10 (Đề xuất được áp dụng mang lại hiệu quả thực tế)

  // 2. BẢNG THIẾT LẬP ĐÁNH GIÁ HÀNG NĂM (Trọng số 70% - 20% - 10%)
  annualMonthlyAvgWeight: number;               // 0.70 (70% - Trung bình điểm 12 tháng)
  annualExamWeight: number;                     // 0.20 (20% - Bài kiểm tra tổng hợp cuối năm)
  annualRewardDisciplineWeight: number;         // 0.10 (10% - Tổng kết Khen thưởng/Kỷ luật năm)
}

export interface MonthlyScoreDetail {
  month: string; // "03/2026"
  // Nhóm 1: Năng suất (Tối đa 50đ)
  productivityRating?: 'A' | 'a' | 'B' | 'b' | 'C';
  productivityScore: number;
  productivityNote?: string;
  // Nhóm 2: Bài kiểm tra (Tối đa 30đ)
  rawQuizScore: number;
  quizScore: number;
  quizTitle?: string;
  needsRetraining: boolean; // Cờ đào tạo lại (bài thi < 50)
  // Nhóm 3: Tuân thủ & Vi phạm (Khởi điểm 20đ)
  complianceBaseScore: number;
  adminViolationsCount: number;
  dispatchViolationsCount: number;
  minorIncidentsCount: number;
  hasSevereIncident: boolean; // Sự cố nghiêm trọng ảnh hưởng dây chuyền
  complianceDeductions: number;
  complianceScore: number;
  // Nhóm 4: Góp ý & Đề xuất (Điểm thưởng)
  validSuggestionsCount: number;
  effectiveSuggestionsCount: number;
  bonusScore: number;
  // Tổng kết tháng
  totalScore: number;
  tier: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AVERAGE' | 'POOR';
  tierLabel: string;
  statusNote?: string;
}

export interface AnnualScoreDetail {
  year: string; // "2026"
  // 1. Trung bình 12 tháng (70%)
  monthlyScores: { month: string; score: number }[];
  monthlyAverage: number;
  weightedMonthlyScore: number;
  // 2. Bài kiểm tra cuối năm (20%)
  yearEndExamRawScore: number;
  weightedExamScore: number;
  // 3. Khen thưởng / Kỷ luật (10%)
  rewardDisciplineRawScore: number;
  weightedRewardScore: number;
  hasDisciplineRecord: boolean;
  hasCompanyAward: boolean;
  // Tổng kết năm
  totalAnnualScore: number;
  annualRank: 'EXCELLENT' | 'GOOD' | 'PASS' | 'FAIL';
  annualRankLabel: string;
  recommendation: string;
}

export interface AppSettings {
  id: string;
  nqQdDriveLink: string;
  traCuuLink?: string;
  vehicleStatusLink?: string;      // Link "Tình trạng Phương tiện"
  engineRoofIncidentLink?: string; // Link "Nổ máy/ Thủng nóc"
  violationReportLink?: string;    // Link "Vi phạm"
  libraryLink?: string;            // Link "Thư Viện"
  quizLink?: string;               // Link "Kiểm tra" (tùy chọn)
  feedbackGoogleSheetId?: string;
  feedbackGoogleSheetUrl?: string;
  feedbackGoogleSheetWebhookUrl?: string;
  // Liên kết file Data_RTG (sheet ThongTinNhanSu & TheoDoiViPham)
  dataRtgSpreadsheetId?: string;
  dataRtgSpreadsheetUrl?: string;
  dataRtgSheetTabName?: string;
  dataRtgViolationTabName?: string;
  // Google Sheet Webhook Sync (Cách 1)
  googleSheetWebhookUrl?: string;
  googleSheetSpreadsheetUrl?: string;
  googleSheetReportUrl?: string;
  googleDriveLink?: string;
  googleSheetsWebhookUrl?: string;
  autoSyncQuiz?: boolean;
  autoSyncFeedback?: boolean;
  autoSyncBxxl?: boolean;
  autoSyncHr?: boolean;
  autoSyncViolations?: boolean;
  googleSheetLastSyncAt?: string;
  announcementTitle?: string;
  announcementContent?: string;
  announcementUpdatedAt?: string;
  announcementUpdatedBy?: string;
  competencyRules?: CompetencyScoringRules;
  customRoleTemplates?: Partial<Record<UserRole, RoleTemplateConfig>>;
}

export interface RoleTemplateConfig {
  permissions: PermissionKey[];
  visibleTabs: TabType[];
  defaultScope?: 'ALL' | 'DIRECT' | 'NONE';
  description?: string;
}

export type PermissionKey =
  // Quản lý Nhân sự & Bộ phận
  | 'MANAGE_HR'
  | 'MANAGE_DEPARTMENT_USERS'
  // Đăng ký & Duyệt Nghỉ phép
  | 'MANAGE_LEAVE'
  // Bình xét Xếp loại (BXXL)
  | 'MANAGE_BXXL'
  | 'EXPORT_BXXL_REPORTS'
  // Công cụ Bãi Container
  | 'MANAGE_CONTAINER_TOOL'
  // Đào tạo & Thi cử
  | 'MANAGE_QUIZ'
  | 'CREATE_QUIZ'
  // Sáng kiến & Góp ý
  | 'MANAGE_FEEDBACK'
  | 'APPROVE_FEEDBACK'
  // Thư viện & Văn bản
  | 'MANAGE_LIBRARY'
  | 'MANAGE_DRIVE'
  // Tin nhắn & Truyền thông
  | 'MANAGE_ZALO'
  | 'SEND_BROADCAST_NOTIFICATION'
  // Báo cáo & Thống kê
  | 'VIEW_ANALYTICS'
  | 'VIEW_DEPARTMENT_STATS'
  // Quản lý Vi phạm & Sự cố (Tổ RTG)
  | 'MANAGE_VIOLATIONS'
  // Hệ thống & Cấp quyền
  | 'MANAGE_PERMISSIONS';

export interface EmployeeViolationRecord {
  id: string;
  incidentCode: string;
  time: string;
  location: string;
  what: string;
  why: string;
  how: string;
  equipment?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  pointsDeducted?: number;
  recordedAt: string;
}

export interface IncidentViolation {
  id: string;
  code: string; // Mã vụ việc (vd: SC-01, VP-02)
  time: string; // Thời gian (When)
  location: string; // Địa điểm (Where)
  timeAndLocation?: string; // Thời gian, Địa điểm kết hợp (Cột 1)
  incidentProgression?: string; // Diễn biến vụ việc (Cột 2)
  consequence?: string; // Hậu quả (Cột 3)
  cause?: string; // Nguyên nhân (Cột 4)
  responsibility?: string; // Trách nhiệm (Cột 5)
  managingUnit?: string; // Đơn vị quản lý (Cột 6)
  correctiveAction?: string; // Biện pháp xử lý khắc phục (Cột 7)
  classification?: string; // Phân loại: Sự cố / Vi phạm nội quy / TNLĐ (Cột 8)
  violatorName: string; // Nhân viên vi phạm (Who)
  normalizedName?: string; // Tên đối soát với hệ thống (vd: Phạm Ngọc Tuân)
  originalName?: string; // Tên gốc trong file
  matchedEmployeeId?: string; // ID nhân viên khớp trong hệ thống
  matchedEmployeeCode?: string; // Mã nhân viên (vd: NV-008, hoangld...)
  matchedEmployeeName?: string; // Tên chính thức trong hệ thống
  matchedDepartment?: string; // Ca trực / Bộ phận trong hệ thống (vd: RTG ca 1, RTG ca 2)
  matchedPosition?: string; // Chức danh trong hệ thống (vd: Lái cẩu RTG)
  matchedAvatar?: string; // Avatar nhân viên
  isMatchedWithSystem: boolean; // Đã đối soát khớp với nhân viên hệ thống
  department: string; // Đơn vị / Chức danh (vd: Tổ RTG / Lái cẩu RTG 02)
  equipment?: string; // Thiết bị cẩu (vd: RTG 02, RTG 05)
  what: string; // Mô tả Vi phạm / Hậu quả (What)
  why: string; // Nguyên nhân cốt lõi (Why)
  how: string; // Biện pháp xử lý / Trách nhiệm (How)
  sourceAppendix: 'PHU_LUC_1' | 'PHU_LUC_2' | 'OTHER'; // Phụ lục 1 (Sự cố) / Phụ lục 2 (Vi phạm)
  isRtgRelated: boolean; // Liên quan trực tiếp Tổ RTG
  severity: 'THAP' | 'TRUNG_BINH' | 'NGHIEM_TRONG';
  pointsDeducted?: number;
  isSyncedToProfile?: boolean;
}

export interface IncidentAnalysisReport {
  id: string;
  title: string;
  fileName?: string;
  month?: string;
  createdAt: string;
  createdByName?: string;
  totalIncidents: number;
  rtgIncidentsCount: number;
  matchedCount: number; // Số vụ việc khớp nhân sự hệ thống được trích xuất
  unmatchedOrNonRtgCount: number; // Số vụ việc không thuộc RTG hoặc không khớp bị loại trừ
  nonRtgIgnoredCount: number;
  totalFileRows: number;
  repeatViolators: {
    name: string;
    normalizedName: string;
    employeeCode?: string;
    department?: string;
    count: number;
    equipment?: string;
    severities: string[];
    recommendations: string;
  }[];
  recommendations: string;
  items: IncidentViolation[];
}

export interface RoleConfig {
  name: string;
  badgeColor: string;
  defaultPermissions: PermissionKey[];
  description: string;
}

export interface Employee {
  id: string;
  username?: string;

  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  zaloPhone: string;
  zaloSynced: boolean;
  avatar: string;
  department: string;
  position: string;
  joinDate: string;
  dateOfBirth?: string;
  onboardingCompleted?: boolean;
  status: 'ACTIVE' | 'PROBATION' | 'LEAVE' | 'TERMINATED';
  role: UserRole;
  assignedPermissions: PermissionKey[];
  visibleTabs?: TabType[];
  competencyScore: number;
  quizzesCompleted: number;
  violationCount: number;
  proposalsCount: number;
  shift?: string;
  managedDepartments?: string[];
  monthlyEvaluations?: EmployeeMonthlyEvaluation[];
  approvedLeaves?: EmployeeLeaveRecord[];
  customScoreAdjustments?: CustomScoreAdjustment[];
  violationRecords?: EmployeeViolationRecord[];
}

export interface EmployeeMonthlyEvaluation {
  month: string; // ví dụ "03/2026"
  rating: 'A' | 'a' | 'B' | 'b' | 'C';
  reason?: string;
  isGpt?: boolean;
  date: string;
  recordId?: string;
  updatedAt: string;
}

export interface BxxlEmployeeItem {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  shift?: string;
  position?: string;
  reason?: string; // Bắt buộc đối với B, b, C nếu muốn hiển thị trong biên bản
}

export interface BxxlRecord {
  id: string;
  // Bước 1: Thông tin lập biên bản
  companyName: string; // "CÔNG TY TNHH CẢNG CONTAINER QUỐC TẾ TÂN CẢNG HẢI PHÒNG"
  departmentName: string; // "ĐỘI CƠ GIỚI"
  groupName: string; // "(Tổ RTG)"
  evaluationMonth: string; // "03/2026"
  createdCity: string; // "Hải Phòng"
  createdDate: string; // "15"
  createdMonth: string; // "04"
  createdYear: string; // "2026"
  selectedCategories: ('A' | 'B' | 'b' | 'C')[]; // Các mục bình xét để hiển thị
  includeGpt: boolean; // Có mục GPT hay không
  includeDefaultSmallAInDoc?: boolean; // Legacy field; exports always exclude the default rating "a".
  generalNote?: string; // "- Các nội dung bình xét khác Tổ RTG xin nhất trí theo đánh giá của BCH Đội Cơ Giới"
  
  // Bước 2 - 5: Danh sách xếp loại
  listA: BxxlEmployeeItem[];
  listSmallA?: BxxlEmployeeItem[]; // "a" - Mặc định cho nhân viên không được đánh A, B, b, C
  listB: BxxlEmployeeItem[];
  listSmallB: BxxlEmployeeItem[]; // "b"
  listC: BxxlEmployeeItem[];

  // Bước 6: Danh sách GPT (Giải phóng tàu)
  listGpt: BxxlEmployeeItem[];

  // Metadata
  totalEvaluated: number;
  createdAt: string;
  createdBy: string;
  creatorName?: string;
}

export type DocCategory = 'NOI_QUY' | 'HUONG_DAN' | 'VI_PHAM';

export interface InternalDocument {
  id: string;
  code: string;
  category: DocCategory;
  categoryName: string;
  title: string;
  summary: string;
  content: string;
  effectiveDate: string;
  updatedAt: string;
  departmentInCharge: string;
  viewCount: number;
  tags: string[];
  fileName?: string;
  fileUrl?: string;
}

export interface QuestionFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  citation: string; // E.g. "Căn cứ Điều 4, Khoản 2 - Nội quy Lao động 2026"
  folderId?: string; // Topic / Folder ID
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  isFolder?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  code: string;
  category: string;
  description: string;
  durationMinutes: number;
  passScore: number; // e.g. 75
  targetDepartments: string[]; // ['ALL'] or specific
  questions: QuizQuestion[];
  createdAt: string;
  scheduledStartTime?: string; // e.g. "2026-09-20T08:00" - Hẹn giờ phát đề (bắt đầu thi)
  scheduledEndTime?: string; // e.g. "2026-09-20T17:00" - Hẹn giờ kết thúc kiểm tra
  isRandomQuestions?: boolean; // Tự động chọn câu hỏi ngẫu nhiên khi thí sinh vào thi
  randomQuestionCount?: number; // Số lượng câu hỏi tự động bốc ngẫu nhiên
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  quizTitle: string;
  employeeId: string;
  employeeName: string;
  department: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  submittedAt: string;
  answers: Record<string, string>;
  competencyLevel: 'Xuất sắc' | 'Đạt' | 'Cần đào tạo lại';
}

export type FeedbackCategory =
  | 'DONG_GOP'
  | 'DE_XUAT'
  | 'CANH_BAO_NGUY_HIEM'
  | 'KHAC';

export interface FeedbackProposal {
  id: string;
  title: string;
  category: FeedbackCategory;
  categoryName: string;
  content: string;
  images: string[];
  isAnonymous: boolean;
  authorId: string;
  authorName: string;
  authorDepartment: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  // Cảnh báo nguy hiểm & Trừ điểm hồ sơ năng lực
  dangerCauserName?: string; // Tên nhân viên gây nguy hiểm / vi phạm
  dangerCauserId?: string; // ID nhân sự trong hệ thống nếu khớp
  dangerCauserCode?: string; // Mã nhân viên
  dangerCauserDepartment?: string; // Phòng ban / Ca trực của nhân viên gây nguy hiểm
  penaltyPoints?: number; // Mức trừ điểm (mặc định 5 hoặc 10, người dùng hoặc quản lý có thể điều chỉnh)
  pointsDeductedApplied?: boolean; // Đã lưu vào hồ sơ năng lực & trừ điểm hay chưa
  pointsDeductedAt?: string; // Thời điểm trừ điểm
  imagesArchived?: boolean; // Ảnh minh chứng đã được tải lên Drive/Doc/Sheet và giải phóng dung lượng ảnh base64
  imagesArchivedNote?: string; // Ghi chú dọn dẹp ảnh
  adminResponse?: {
    by: string;
    date: string;
    comment: string;
    actionPlan?: string;
  };
}

export interface ZaloMessage {
  id: string;
  type: 'AUTOMATIC' | 'INDIVIDUAL' | 'BROADCAST';
  recipientType: 'ALL' | 'DEPARTMENT' | 'INDIVIDUAL';
  recipientIds?: string[];
  recipientNames: string[];
  recipientPhones?: string[];
  department?: string;
  title: string;
  content: string;
  templateId?: string;
  status: 'SENT' | 'DELIVERED' | 'SCHEDULED' | 'FAILED' | 'CANCELLED';
  sentAt: string;
  scheduledAt?: string; // e.g. 2026-09-18 15:30
  isScheduled?: boolean;
  priority?: 'NORMAL' | 'URGENT';
  readByIds?: string[];
  sentBy: string;
  senderId?: string;
  znsMessageId?: string;
}

export type InternalMessage = ZaloMessage;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  citations?: string[];
  isGrounded?: boolean;
}

export interface CameraOcrResult {
  title: string;
  documentType: string;
  summary: string;
  extractedData: {
    reportDate?: string;
    involvedPerson?: string;
    department?: string;
    amountOrCost?: string;
    actionSuggested?: string;
    violationClause?: string;
  };
  rawText: string;
  confidenceScore: number;
}

export interface CameraAiScanResult {
  documentType: string;
  documentTitle: string;
  date: string;
  creatorOrSubject: string;
  department: string;
  summary: string;
  autoFillData: {
    title: string;
    category: string;
    employeeName?: string;
    content: string;
    suggestedAction?: string;
  };
}
