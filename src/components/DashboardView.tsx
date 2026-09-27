import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  Lightbulb,
  MessageSquareShare,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  BellRing,
  User,
  X,
  Search,
  Edit3,
  Truck,
  Flame,
  Link2,
  ExternalLink,
  Settings2,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import {
  Employee,
  InternalDocument,
  Quiz,
  QuizSubmission,
  FeedbackProposal,
  ZaloMessage,
  AppSettings,
} from '../types';
import { TabType } from './Sidebar';

interface DashboardViewProps {
  currentUser: Employee;
  employees: Employee[];
  documents: InternalDocument[];
  quizzes: Quiz[];
  submissions: QuizSubmission[];
  feedbacks: FeedbackProposal[];
  zaloMessages: ZaloMessage[];
  appSettings?: AppSettings | null;
  onSaveAppSettings?: (newSettings: Partial<AppSettings>) => Promise<void> | void;
  setActiveTab: (tab: TabType) => void;
  onNavigateToLibraryCategory?: (category: any) => void;
  onOpenMasterSync?: () => void;
}

const DEFAULT_ANNOUNCEMENT_CONTENT =
  'Tuần tới (từ 15/09 - 22/09) sẽ diễn ra đợt kiểm tra năng lực toàn công ty đợt 3. Yêu cầu toàn bộ nhân sự ôn tập bộ quy chế mới ban hành (QĐ-04/2026) và tham gia thi đúng giờ. Mọi vi phạm về giờ giấc làm bài sẽ bị ghi nhận vào hệ thống đánh giá KPI tháng.';

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  employees = [],
  documents = [],
  quizzes = [],
  submissions = [],
  feedbacks = [],
  zaloMessages = [],
  appSettings,
  onSaveAppSettings,
  setActiveTab,
  onNavigateToLibraryCategory,
  onOpenMasterSync,
}) => {
  const [showUserInfo, setShowUserInfo] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';

  // State for announcement update modal
  const [isEditAnnouncementOpen, setIsEditAnnouncementOpen] = useState(false);
  const [announcementTitleInput, setAnnouncementTitleInput] = useState(
    appSettings?.announcementTitle || 'Thông báo'
  );
  const [announcementContentInput, setAnnouncementContentInput] = useState(
    appSettings?.announcementContent || DEFAULT_ANNOUNCEMENT_CONTENT
  );
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);

  // State for quick buttons link configuration modal (Admin)
  const [isEditLinksOpen, setIsEditLinksOpen] = useState(false);
  const [traCuuLinkInput, setTraCuuLinkInput] = useState(appSettings?.traCuuLink || '');
  const [libraryLinkInput, setLibraryLinkInput] = useState(appSettings?.libraryLink || appSettings?.nqQdDriveLink || '');
  const [vehicleStatusLinkInput, setVehicleStatusLinkInput] = useState(appSettings?.vehicleStatusLink || '');
  const [engineRoofIncidentLinkInput, setEngineRoofIncidentLinkInput] = useState(appSettings?.engineRoofIncidentLink || '');
  const [violationReportLinkInput, setViolationReportLinkInput] = useState(appSettings?.violationReportLink || '');
  const [quizLinkInput, setQuizLinkInput] = useState(appSettings?.quizLink || '');
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [saveLinksSuccess, setSaveLinksSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (appSettings?.announcementTitle) {
      setAnnouncementTitleInput(appSettings.announcementTitle);
    }
    if (appSettings?.announcementContent) {
      setAnnouncementContentInput(appSettings.announcementContent);
    }
    if (appSettings) {
      setTraCuuLinkInput(appSettings.traCuuLink || '');
      setLibraryLinkInput(appSettings.libraryLink || appSettings.nqQdDriveLink || '');
      setVehicleStatusLinkInput(appSettings.vehicleStatusLink || '');
      setEngineRoofIncidentLinkInput(appSettings.engineRoofIncidentLink || '');
      setViolationReportLinkInput(appSettings.violationReportLink || '');
      setQuizLinkInput(appSettings.quizLink || '');
    }
  }, [appSettings]);

  const handleOpenQuickLink = (url: string | undefined, label: string) => {
    if (url && url.trim()) {
      window.open(url.trim(), '_blank', 'noopener,noreferrer');
    } else {
      if (isAdmin) {
        setIsEditLinksOpen(true);
      } else {
        alert(`Đường link "${label}" chưa được cài đặt. Vui lòng liên hệ Quản trị viên để cấu hình.`);
      }
    }
  };

  const announcementTitle = appSettings?.announcementTitle || 'Thông báo';
  const announcementContent = appSettings?.announcementContent || DEFAULT_ANNOUNCEMENT_CONTENT;

  // Analytical metrics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE').length;
  const probationEmployees = employees.filter((e) => e.status === 'PROBATION').length;
  const syncedZaloCount = employees.filter((e) => e.zaloSynced).length;
  const zaloSyncRate = Math.round((syncedZaloCount / (totalEmployees || 1)) * 100);

  // Competency analytics
  const totalSubmissions = submissions.length;
  const passedSubmissions = submissions.filter((s) => s.passed).length;
  const quizPassRate = totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;
  const averageCompetency = Math.round(
    employees.reduce((acc, curr) => acc + (curr.competencyScore || 0), 0) / (totalEmployees || 1)
  );

  // Department distribution
  const deptCounts: Record<string, number> = {};
  employees.forEach((e) => {
    deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
  });

  // Feedback stats
  const pendingFeedbacks = feedbacks.filter((f) => f.status === 'PENDING').length;
  const approvedFeedbacks = feedbacks.filter((f) => f.status === 'APPROVED').length;
  const inReviewFeedbacks = feedbacks.filter((f) => f.status === 'IN_REVIEW').length;

  // Violations recorded
  const totalViolations = employees.reduce((sum, e) => sum + (e.violationCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Announcement */}
      <div 
        className="rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center"
        style={{ borderRadius: '10px' }}
      >
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-cyan-300/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-2xl space-y-6">
          {/* Announcement Box */}
          <div 
            className="backdrop-blur-md flex flex-col gap-3 text-left w-full mx-auto"
            style={{ 
              backgroundColor: '#cae4ff',
              borderColor: '#b30303',
              borderStyle: 'dashed',
              borderWidth: '1px',
              borderRadius: '7px',
              padding: '16px'
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2" style={{ color: '#fb0707' }}>
                <BellRing className="w-6 h-6 animate-pulse shrink-0" />
                <span className="text-xl font-extrabold uppercase tracking-wide">
                  {announcementTitle}
                </span>
              </div>
              {/* Nút cập nhật thông báo - Quyền chỉnh sửa chỉ dành cho Admin */}
              {isAdmin && (
                <button
                  id="dash-edit-announcement-btn"
                  type="button"
                  onClick={() => {
                    setAnnouncementTitleInput(announcementTitle);
                    setAnnouncementContentInput(announcementContent);
                    setIsEditAnnouncementOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Quyền Admin: Chỉnh sửa và cập nhật thông báo"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Cập nhật thông báo</span>
                </button>
              )}
            </div>
            <p 
              className="text-sm leading-relaxed font-medium whitespace-pre-line"
              style={{ color: '#030202' }}
            >
              {announcementContent}
            </p>
            {appSettings?.announcementUpdatedAt && (
              <div className="text-[11px] text-slate-600 font-medium pt-1.5 border-t border-blue-200/60 flex items-center justify-between flex-wrap gap-2">
                <span>
                  Cập nhật: {new Date(appSettings.announcementUpdatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}
                </span>
                {appSettings.announcementUpdatedBy && (
                  <span>Bởi: {appSettings.announcementUpdatedBy}</span>
                )}
              </div>
            )}
          </div>

          {/* Lối Tắt Tác Nghiệp & Liên Kết Nhanh */}
          <div className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-white/95 flex items-center gap-2 drop-shadow-xs">
                <ExternalLink className="w-4 h-4 text-cyan-200" />
                Lối Tắt Tác Nghiệp & Liên Kết Nhanh
              </span>
              {isAdmin && (
                <button
                  id="dash-edit-quick-links-btn"
                  type="button"
                  onClick={() => {
                    setSaveLinksSuccess(null);
                    setIsEditLinksOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/25 hover:bg-white/35 text-white text-xs font-bold border border-white/40 shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Quyền Admin: Cài đặt đường link mở trang cho các nút"
                >
                  <Settings2 className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Cài đặt liên kết (Admin)</span>
                </button>
              )}
            </div>

            {/* Bố cục cân đối, trực quan:
                - Mobile: 2 cột (3 hàng x 2 nút + 1 nút toàn chiều rộng phía dưới)
                - Desktop: 3 cột (2 hàng x 3 nút + 1 nút toàn chiều rộng phía dưới)
            */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-3.5">
              {/* 1. Tra Cứu */}
              <button
                id="dash-quick-search-btn"
                type="button"
                onClick={() => handleOpenQuickLink(appSettings?.traCuuLink, 'Tra Cứu')}
                className="relative rounded-2xl bg-blue-600/35 hover:bg-blue-600/50 text-white font-bold border border-blue-300/45 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                title={appSettings?.traCuuLink ? `Mở: ${appSettings.traCuuLink}` : "Mở đường link Tra Cứu được cài đặt"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Tra Cứu</span>
                <span className="text-xs text-blue-200/90 font-medium mt-1">Liên kết ngoài</span>
              </button>

              {/* 2. Thư Viện */}
              <button
                id="dash-quick-library-btn"
                type="button"
                onClick={() => handleOpenQuickLink(appSettings?.libraryLink || appSettings?.nqQdDriveLink, 'Thư Viện')}
                className="relative rounded-2xl bg-teal-600/35 hover:bg-teal-600/50 text-white font-bold border border-teal-300/45 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                title={appSettings?.libraryLink || appSettings?.nqQdDriveLink ? "Mở Thư Viện tài liệu / NQ-QĐ" : "Mở Thư Viện"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Thư Viện</span>
                <span className="text-xs text-teal-200/90 font-medium mt-1">NQ - QĐ & Quy trình</span>
              </button>

              {/* 3. Tình trạng Phương tiện */}
              <button
                id="dash-quick-vehicle-btn"
                type="button"
                onClick={() => handleOpenQuickLink(appSettings?.vehicleStatusLink, 'Tình trạng Phương tiện')}
                className="relative rounded-2xl bg-emerald-600/40 hover:bg-emerald-600/55 text-white font-bold border border-emerald-300/45 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                title={appSettings?.vehicleStatusLink ? `Mở: ${appSettings.vehicleStatusLink}` : "Mở đường link Tình trạng Phương tiện"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Tình trạng Phương tiện</span>
                <span className="text-xs text-emerald-200/90 font-medium mt-1">Kỹ thuật cẩu RTG</span>
              </button>

              {/* 4. Nổ máy/ Thủng nóc */}
              <button
                id="dash-quick-engine-roof-btn"
                type="button"
                onClick={() => handleOpenQuickLink(appSettings?.engineRoofIncidentLink, 'Nổ máy/ Thủng nóc')}
                className="relative rounded-2xl bg-amber-600/45 hover:bg-amber-600/60 text-white font-bold border border-amber-300/50 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                title={appSettings?.engineRoofIncidentLink ? `Mở: ${appSettings.engineRoofIncidentLink}` : "Mở đường link theo dõi Nổ máy/ Thủng nóc"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Nổ máy/ Thủng nóc</span>
                <span className="text-xs text-amber-200/90 font-medium mt-1">Sự cố thiết bị & vỏ</span>
              </button>

              {/* 5. Vi phạm */}
              <button
                id="dash-quick-violation-btn"
                type="button"
                onClick={() => handleOpenQuickLink(appSettings?.violationReportLink, 'Vi phạm')}
                className="relative rounded-2xl bg-rose-600/50 hover:bg-rose-600/65 text-white font-bold border border-rose-300/55 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                style={{ backgroundColor: '#ff4c16' }}
                title={appSettings?.violationReportLink ? `Mở: ${appSettings.violationReportLink}` : "Mở đường link theo dõi Vi phạm do Admin cài đặt"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Vi phạm</span>
                <span className="text-xs text-orange-200 font-medium mt-1">Báo cáo & Theo dõi</span>
              </button>

              {/* 6. Kiểm tra */}
              <button
                id="dash-quick-quiz-btn"
                type="button"
                onClick={() => {
                  if (appSettings?.quizLink && appSettings.quizLink.trim()) {
                    window.open(appSettings.quizLink.trim(), '_blank', 'noopener,noreferrer');
                  } else {
                    setActiveTab('quiz');
                  }
                }}
                className="relative rounded-2xl bg-purple-600/40 hover:bg-purple-600/55 text-white font-bold border border-purple-300/45 backdrop-blur-md shadow-lg transition-all duration-200 flex flex-col items-center justify-center p-4 sm:p-5 min-h-[90px] sm:min-h-[100px] cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
                title={appSettings?.quizLink ? "Mở đường link Kiểm tra trực tuyến" : "Vào làm bài kiểm tra năng lực & kiến thức nội bộ"}
              >
                <span className="text-sm sm:text-base font-extrabold text-center leading-tight">Kiểm tra</span>
                <span className="text-xs text-purple-200/90 font-medium mt-1">Đánh giá năng lực</span>
              </button>

              {/* 7. Thông tin của tôi (Full-width cả 2 cột mobile hoặc 3 cột desktop) */}
              <button
                id="dash-quick-userinfo-btn"
                type="button"
                onClick={() => setShowUserInfo(true)}
                className="col-span-2 sm:col-span-3 py-3.5 sm:py-4 px-6 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm sm:text-base border border-white/35 backdrop-blur-md shadow-lg transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.01] active:scale-[0.99]"
                title="Xem thông tin cá nhân và hồ sơ nhân sự 360°"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                <span>Thông tin của tôi</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nút Tổng Admin: Đẩy toàn bộ dữ liệu lên Google Sheet (Data_RTG) */}
      {isAdmin && onOpenMasterSync && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-emerald-500/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Nút Tổng Admin: Đẩy Toàn Bộ Dữ Liệu Lên Google Sheet (Data_RTG)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-black tracking-wider uppercase border border-white/30">
                  6 Sheets Tích Hợp
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Đồng bộ tự động Danh sách Nhân sự, Vi phạm 5W1H Tổ RTG, Kết quả thi, Sáng kiến, BXXL và Đơn nghỉ phép vào file Google Sheet chuẩn.
              </p>
            </div>
          </div>
          <button
            id="dash-admin-master-sync-btn"
            type="button"
            onClick={onOpenMasterSync}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="Mở cửa sổ Đẩy toàn bộ dữ liệu lên Google Sheet Data_RTG"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Đẩy dữ liệu ngay</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      )}

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div
          onClick={() => setActiveTab('hr')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Tổng số Nhân sự</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalEmployees}</span>
            <span className="text-xs font-semibold text-emerald-600">100% Hoạt động</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{activeEmployees} chính thức</span>
            <span>•</span>
            <span>{probationEmployees} thử việc</span>
          </div>
        </div>

        {/* Competency Score */}
        <div
          onClick={() => setActiveTab('quiz')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Điểm Năng lực TB</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{averageCompetency}/100</span>
            <span className="text-xs font-semibold text-indigo-600">Hạng Giỏi</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Tỉ lệ thi đạt: <span className="font-semibold text-slate-800">{quizPassRate}%</span> ({passedSubmissions}/{totalSubmissions} lượt)
          </div>
        </div>

        {/* Internal Messaging Card */}
        <div
          onClick={() => setActiveTab('zalo')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Tin nhắn nội bộ</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BellRing className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{zaloMessages.length}</span>
            <span className="text-xs font-semibold text-indigo-600">thông báo</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Hẹn giờ: <span className="font-semibold text-amber-600">{zaloMessages.filter((m) => m.status === 'SCHEDULED').length} tin</span> • Đã phát: <span className="font-semibold text-emerald-600">{zaloMessages.filter((m) => m.status !== 'SCHEDULED').length}</span>
          </div>
        </div>

        {/* Feedback & Proposals */}
        <div
          onClick={() => setActiveTab('feedback')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Đề xuất & Sáng kiến</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Lightbulb className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{feedbacks.length}</span>
            <span className="text-xs font-semibold text-emerald-600">{approvedFeedbacks} đã duyệt</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span className="text-amber-600 font-semibold">{pendingFeedbacks} chờ duyệt</span> • {inReviewFeedbacks} đang xử lý
          </div>
        </div>
      </div>

      {/* Analytical Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Cơ cấu Nhân sự theo Phòng Ban
              </h3>
              <span className="text-xs text-slate-400">{Object.keys(deptCounts).length} bộ phận</span>
            </div>

            <div className="space-y-3">
              {Object.entries(deptCounts).map(([dept, count]) => {
                const pct = Math.round((count / totalEmployees) * 100);
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[180px]">{dept}</span>
                      <span className="font-bold text-slate-900">
                        {count} người ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Vi phạm kỷ luật ghi nhận:</span>
            <span className={`font-bold px-2 py-0.5 rounded ${totalViolations > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {totalViolations} trường hợp
            </span>
          </div>
        </div>

        {/* Competency & Testing Highlights */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-600" />
                Đánh giá Kết quả Kiểm tra Trắc nghiệm
              </h3>
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                Tự động chấm điểm
              </span>
            </div>

            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {sub.employeeName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          sub.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sub.competencyLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {sub.quizTitle}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-base font-extrabold ${sub.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {sub.score}đ
                    </span>
                    <p className="text-[10px] text-slate-400">{sub.submittedAt.split(' ')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('quiz')}
            className="mt-4 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Xem chi tiết hồ sơ năng lực nhân sự</span>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Violations and Incidents Overview (Tổ RTG) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Vi phạm & Sự cố Tổ RTG
              </h3>
              <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                {totalViolations} sự việc
              </span>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                Đối soát dữ liệu vi phạm và sự cố an toàn cẩu khung theo danh sách nhân sự của hệ thống.
              </p>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">Nhân viên ghi nhận vi phạm</span>
                  <span className="text-[11px] text-slate-500">Cơ sở đánh giá hạ bậc BXXL tháng</span>
                </div>
                <span className="text-lg font-bold text-rose-600">
                  {employees.filter((e) => e.violationCount > 0).length} người
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('violations')}
            className="mt-4 w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Chi tiết Vi phạm & Đối soát File</span>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recent Zalo Notification Logs */}
      {/* Recent Internal Notifications */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Thông Báo Nội Bộ Gần Đây</h3>
              <p className="text-xs text-slate-500">Phát thông báo cá nhân, theo ca trực và toàn thể cơ quan</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('zalo')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Trung tâm Tin nhắn nội bộ →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {zaloMessages.slice(0, 3).map((msg) => (
            <div key={msg.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800">{msg.title}</span>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    {msg.recipientType === 'ALL' ? 'Toàn thể' : msg.recipientType === 'DEPARTMENT' ? `Ca: ${msg.department}` : 'Cá nhân'}
                  </span>
                  {msg.status === 'SCHEDULED' ? (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Hẹn giờ: {msg.scheduledAt || 'Đã lên lịch'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đã phát
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-1">{msg.content}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Gửi tới: <b className="text-slate-600">{msg.recipientNames.join(', ')}</b></span>
                  <span>•</span>
                  <span>Thời gian: {msg.status === 'SCHEDULED' ? `Hẹn: ${msg.scheduledAt}` : msg.sentAt}</span>
                  <span>•</span>
                  <span>Bởi: {msg.sentBy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showUserInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <User className="w-6 h-6 text-indigo-600" />
                Thông tin người dùng
              </h2>
              <button
                onClick={() => setShowUserInfo(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
                <img
                  src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.fullName)}&background=random`}
                  alt="Avatar"
                  className="w-24 h-24 rounded-2xl object-cover shadow-sm"
                />
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{currentUser.fullName}</h3>
                      <p className="text-sm font-medium text-slate-500">
                        {currentUser.role === 'ADMIN' ? 'Quản trị viên' : currentUser.role === 'MANAGER_L1' ? 'Quản lý Cấp 1' : currentUser.role === 'MANAGER_L2' ? 'Quản lý Cấp 2' : 'Nhân viên'}
                        {currentUser.position ? ` • ${currentUser.position}` : ''}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Điểm Năng Lực: {currentUser.competencyScore ?? 100}đ
                    </span>
                  </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs sm:text-sm">
                      <p><span className="text-slate-500">Mã NV:</span> <span className="font-semibold text-slate-800 font-mono">{currentUser.employeeCode || (currentUser as any).employeeId || currentUser.id}</span></p>
                      <p><span className="text-slate-500">Tên đăng nhập:</span> <span className="font-semibold text-slate-800 font-mono">{currentUser.username || currentUser.employeeCode || 'Chưa cấp'}</span></p>
                      <p><span className="text-slate-500">Bộ phận (Ca trực):</span> <span className="font-semibold text-slate-800">{currentUser.department || 'RTG ca 1'}</span></p>
                      <p><span className="text-slate-500">Chức danh:</span> <span className="font-semibold text-slate-800">{currentUser.position || 'Lái cẩu RTG'}</span></p>
                      <p><span className="text-slate-500">SĐT / Zalo:</span> <span className="font-semibold text-slate-800 font-mono">{currentUser.zaloPhone || currentUser.phone || 'Chưa cập nhật'}</span></p>
                      <p><span className="text-slate-500">Ngày sinh:</span> <span className="font-semibold text-slate-800">{currentUser.dateOfBirth || (currentUser as any).dob || 'Chưa cập nhật'}</span></p>
                      <p><span className="text-slate-500">Email:</span> <span className="font-semibold text-slate-800 truncate">{currentUser.email || 'Chưa cập nhật'}</span></p>
                      <p><span className="text-slate-500">Trạng thái:</span> <span className="font-semibold text-emerald-700">{currentUser.status === 'ACTIVE' ? 'Chính thức (Đang hoạt động)' : currentUser.status === 'PROBATION' ? 'Thử việc' : currentUser.status}</span></p>
                    </div>
                </div>
              </div>

              {/* 4 Pillars of Employee Competency Profile */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                  <Award className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                  <span className="text-xl font-extrabold text-indigo-950 block">
                    {currentUser.competencyScore ?? 100}đ
                  </span>
                  <span className="text-[11px] text-indigo-600 font-semibold">Điểm Năng Lực</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                  <GraduationCap className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <span className="text-xl font-extrabold text-amber-950 block">
                    {currentUser.quizzesCompleted || submissions.filter(s => s.employeeId === currentUser.id && s.passed).length}
                  </span>
                  <span className="text-[11px] text-amber-600 font-semibold">Bài Thi Đạt</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                  <Lightbulb className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <span className="text-xl font-extrabold text-emerald-950 block">
                    {feedbacks.filter(f => f.authorId === currentUser.id || (f as any).submittedBy === currentUser.id).length || currentUser.proposalsCount || 0}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">Đề Xuất Đã Gửi</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                  <AlertTriangle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                  <span className="text-xl font-extrabold text-rose-950 block">
                    {currentUser.violationRecords?.length || currentUser.violationCount || 0}
                  </span>
                  <span className="text-[11px] text-rose-600 font-semibold">Lần Vi Phạm</span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    Kết quả kiểm tra ({submissions.filter(s => s.employeeId === currentUser.id).length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {submissions.filter(s => s.employeeId === currentUser.id).length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Chưa có dữ liệu bài thi</p>
                    ) : (
                      submissions.filter(s => s.employeeId === currentUser.id).map(sub => (
                        <div key={sub.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
                          <div>
                            <span className="font-semibold text-slate-800 block">{sub.quizTitle}</span>
                            <span className="text-xs text-slate-500">{sub.submittedAt}</span>
                          </div>
                          <div className={`px-2 py-1 rounded font-bold text-xs ${sub.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {sub.score} / {sub.totalQuestions} ({sub.passed ? 'Đạt' : 'Không đạt'})
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-emerald-600" />
                    Xếp loại thi đua hàng tháng (BXXL)
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {(!currentUser.monthlyEvaluations || currentUser.monthlyEvaluations.length === 0) ? (
                      <p className="text-sm text-slate-500 italic">Chưa có kết quả xếp loại thi đua</p>
                    ) : (
                      currentUser.monthlyEvaluations.map((ev, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
                          <div>
                            <span className="font-semibold text-slate-800 block">Tháng {ev.month}</span>
                            <span className="text-xs text-slate-500">{ev.date}</span>
                            {ev.reason && <p className="text-xs text-slate-600 mt-0.5">Lý do: {ev.reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {ev.isGpt && (
                              <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-100 text-amber-800">
                                ⭐ GPT
                              </span>
                            )}
                            <span className={`px-2.5 py-1 rounded font-black text-xs ${
                              ev.rating === 'A' ? 'bg-emerald-100 text-emerald-800' :
                              ev.rating === 'a' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                              ev.rating === 'B' ? 'bg-blue-100 text-blue-800' :
                              ev.rating === 'b' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              Loại {ev.rating}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Góp ý & Đề xuất ({feedbacks.filter(f => f.authorId === currentUser.id || (f as any).submittedBy === currentUser.id).length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {feedbacks.filter(f => f.authorId === currentUser.id || (f as any).submittedBy === currentUser.id).length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Chưa có dữ liệu đề xuất</p>
                    ) : (
                      feedbacks.filter(f => f.authorId === currentUser.id || (f as any).submittedBy === currentUser.id).map(fb => (
                        <div key={fb.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800">{fb.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              fb.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                              fb.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                              fb.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {fb.status === 'APPROVED' ? 'Đã duyệt' : fb.status === 'REJECTED' ? 'Từ chối' : fb.status === 'IN_REVIEW' ? 'Đang xem xét' : 'Chờ duyệt'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">{fb.submittedAt}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Lịch sử nghỉ phép đã phê duyệt */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Lịch sử nghỉ phép đã phê duyệt ({currentUser.approvedLeaves?.length || 0})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserInfo(false);
                        setActiveTab('leave');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      Đăng ký nghỉ phép →
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {(!currentUser.approvedLeaves || currentUser.approvedLeaves.length === 0) ? (
                      <p className="text-sm text-slate-500 italic">Chưa có lịch sử nghỉ phép nào được phê duyệt.</p>
                    ) : (
                      currentUser.approvedLeaves.map((lv, idx) => (
                        <div key={lv.requestId || idx} className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-blue-900">
                            <span>
                              {lv.startDate === lv.endDate ? `Ngày: ${lv.startDate}` : `Từ ${lv.startDate} đến ${lv.endDate}`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-bold">
                              {lv.leaveType === 'ANNUAL' ? 'Phép năm' :
                               lv.leaveType === 'POLICY' ? 'Theo chế độ' :
                               lv.leaveType === 'REASONABLE' ? 'Lý do chính đáng' :
                               lv.leaveType === 'PERSONAL' ? 'Việc riêng' :
                               lv.leaveType === 'COMPENSATORY' ? 'Nghỉ bù' :
                               lv.leaveType === 'SICK' ? 'Nghỉ ốm' :
                               lv.leaveType === 'MATERNITY' ? 'Thai sản' : 'Nghỉ khác'}
                            </span>
                          </div>
                          <div className="text-slate-600">Lý do: {lv.reason}</div>
                          <div className="text-slate-500 text-[10px]">Người duyệt: {lv.approvedBy} ({lv.approvedAt})</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Điều chỉnh điểm thi đua & thưởng / phạt năng lực */}
                {currentUser.customScoreAdjustments && currentUser.customScoreAdjustments.length > 0 && (
                  <div>
                    <h4 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5 text-indigo-600" />
                      Điểm thi đua & Thưởng/Phạt bổ sung ({currentUser.customScoreAdjustments.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {currentUser.customScoreAdjustments.map((adj) => (
                        <div key={adj.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-800 block">{adj.reason}</span>
                            <span className="text-[10px] text-slate-500">{adj.date} {adj.adjustedByName ? `• Người ký: ${adj.adjustedByName}` : ''}</span>
                          </div>
                          <span className={`font-black text-xs px-2 py-1 rounded ${
                            adj.points >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {adj.points >= 0 ? `+${adj.points}` : `${adj.points}`} điểm
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      Lỗi vi phạm ghi nhận ({currentUser.violationRecords?.length || currentUser.violationCount || 0})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserInfo(false);
                        setActiveTab('violations');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      Mở mục Vi phạm & Sự cố →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(!currentUser.violationRecords || currentUser.violationRecords.length === 0) ? (
                      <p className="text-sm text-emerald-600 font-medium bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                        Hồ sơ an toàn, không có lỗi vi phạm hoặc sự cố nào được ghi nhận.
                      </p>
                    ) : (
                      currentUser.violationRecords.map((rec) => (
                        <div key={rec.id} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-rose-800">
                            <span>{rec.incidentCode}: {rec.what}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-rose-200 text-rose-800 rounded-full font-bold">-{rec.pointsDeducted} điểm</span>
                          </div>
                          <div className="text-slate-600">Thời gian: {rec.time} | Địa điểm: {rec.location} {rec.equipment ? `(${rec.equipment})` : ''}</div>
                          <div className="text-slate-700 italic">Xử lý: {rec.how}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowUserInfo(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cập nhật thông báo - Chỉ dành cho Admin */}
      {isEditAnnouncementOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-red-600">
                <BellRing className="w-5 h-5" />
                <h3 className="font-bold text-lg text-slate-900">Cập nhật nội dung thông báo</h3>
              </div>
              <button
                onClick={() => setIsEditAnnouncementOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!announcementContentInput.trim()) {
                  alert('Vui lòng nhập nội dung thông báo.');
                  return;
                }
                setIsSavingAnnouncement(true);
                try {
                  if (onSaveAppSettings) {
                    await onSaveAppSettings({
                      announcementTitle: announcementTitleInput.trim() || 'Thông báo',
                      announcementContent: announcementContentInput.trim(),
                      announcementUpdatedAt: new Date().toISOString(),
                      announcementUpdatedBy: currentUser.fullName,
                    });
                  }
                  setIsEditAnnouncementOpen(false);
                } catch (err) {
                  console.error('Lỗi khi lưu thông báo:', err);
                  alert('Không thể lưu thông báo. Vui lòng thử lại.');
                } finally {
                  setIsSavingAnnouncement(false);
                }
              }}
              className="mt-4 space-y-4 text-left"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tiêu đề thông báo
                </label>
                <input
                  type="text"
                  value={announcementTitleInput}
                  onChange={(e) => setAnnouncementTitleInput(e.target.value)}
                  placeholder="Ví dụ: Thông báo"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nội dung thông báo <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={announcementContentInput}
                  onChange={(e) => setAnnouncementContentInput(e.target.value)}
                  placeholder="Nhập nội dung thông báo hiển thị tại trang chủ..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-hidden transition-all resize-y"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Thông báo này sẽ được hiển thị đồng bộ tới toàn bộ nhân viên công ty ngay sau khi lưu.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditAnnouncementOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingAnnouncement}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingAnnouncement ? (
                    <span>Đang lưu...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lưu thông báo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cài Đặt Đường Link Các Nút Tính Năng - Dành Cho Admin */}
      {isEditLinksOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                    Cài Đặt Đường Link Các Nút Tính Năng (Admin)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu hình liên kết tự động mở trang khi nhân sự bấm các nút ở màn hình Tổng quan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditLinksOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveLinksSuccess && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveLinksSuccess}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingLinks(true);
                try {
                  if (onSaveAppSettings) {
                    await onSaveAppSettings({
                      traCuuLink: traCuuLinkInput.trim(),
                      libraryLink: libraryLinkInput.trim(),
                      nqQdDriveLink: libraryLinkInput.trim() || appSettings?.nqQdDriveLink || '',
                      vehicleStatusLink: vehicleStatusLinkInput.trim(),
                      engineRoofIncidentLink: engineRoofIncidentLinkInput.trim(),
                      violationReportLink: violationReportLinkInput.trim(),
                      quizLink: quizLinkInput.trim(),
                    });
                  }
                  setSaveLinksSuccess('Đã lưu cấu hình đường link thành công!');
                  setTimeout(() => {
                    setIsEditLinksOpen(false);
                    setSaveLinksSuccess(null);
                  }, 1200);
                } catch (err) {
                  console.error('Lỗi khi lưu link cài đặt:', err);
                  alert('Không thể lưu cấu hình. Vui lòng thử lại.');
                } finally {
                  setIsSavingLinks(false);
                }
              }}
              className="mt-5 space-y-4 text-left"
            >
              {/* 2-Column Grid Layout for Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Tra Cứu */}
                <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-blue-950 flex items-center gap-2">
                        <Search className="w-4 h-4 text-blue-600" />
                        <span>1. Nút "Tra Cứu"</span>
                      </label>
                      {traCuuLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(traCuuLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Tra cứu thông tin, lịch tàu, danh bạ nội bộ hoặc tài liệu bến cảng.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={traCuuLinkInput}
                    onChange={(e) => setTraCuuLinkInput(e.target.value)}
                    placeholder="https://... (Ví dụ: Tra cứu dữ liệu cảng)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                  />
                </div>

                {/* 2. Thư Viện */}
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-teal-950 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-teal-600" />
                        <span>2. Nút "Thư Viện"</span>
                      </label>
                      {libraryLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(libraryLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Kho tài liệu, quy định, nghị quyết, quy trình vận hành cẩu RTG.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={libraryLinkInput}
                    onChange={(e) => setLibraryLinkInput(e.target.value)}
                    placeholder="https://drive.google.com/... (Kho thư viện quy định/tài liệu)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden transition-all"
                  />
                </div>

                {/* 3. Tình trạng Phương tiện */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        <span>3. Nút "Tình trạng Phương tiện"</span>
                      </label>
                      {vehicleStatusLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(vehicleStatusLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      File bảng tính hoặc hệ thống theo dõi tình trạng kỹ thuật cẩu RTG.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={vehicleStatusLinkInput}
                    onChange={(e) => setVehicleStatusLinkInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/... (Theo dõi kỹ thuật)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all"
                  />
                </div>

                {/* 4. Nổ máy/ Thủng nóc */}
                <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-amber-950 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-600" />
                        <span>4. Nút "Nổ máy/ Thủng nóc"</span>
                      </label>
                      {engineRoofIncidentLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(engineRoofIncidentLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-amber-600 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Báo cáo và theo dõi chi tiết các sự cố nổ máy, thủng nóc vỏ container bãi cảng.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={engineRoofIncidentLinkInput}
                    onChange={(e) => setEngineRoofIncidentLinkInput(e.target.value)}
                    placeholder="https://docs.google.com/... (Theo dõi nổ máy/thủng nóc)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition-all"
                  />
                </div>

                {/* 5. Vi phạm */}
                <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-rose-950 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>5. Nút "Vi phạm"</span>
                      </label>
                      {violationReportLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(violationReportLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      File tổng hợp theo dõi vi phạm nội quy lao động và sự cố vận hành RTG.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={violationReportLinkInput}
                    onChange={(e) => setViolationReportLinkInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/... (Theo dõi vi phạm)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden transition-all"
                  />
                </div>

                {/* 6. Kiểm tra (Tùy chọn) */}
                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-purple-950 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-purple-600" />
                        <span>6. Nút "Kiểm tra" (Tùy chọn)</span>
                      </label>
                      {quizLinkInput.trim() && (
                        <button
                          type="button"
                          onClick={() => window.open(quizLinkInput.trim(), '_blank', 'noopener,noreferrer')}
                          className="text-[11px] font-bold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở thử</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Để trống để thi trực tiếp trong ứng dụng, hoặc nhập link bài thi trắc nghiệm ngoài.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={quizLinkInput}
                    onChange={(e) => setQuizLinkInput(e.target.value)}
                    placeholder="Để trống để làm bài trên app hoặc nhập link ngoài..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 sticky bottom-0 bg-white z-10 pb-1">
                <span className="text-xs text-slate-400">
                  * Nhấp "Mở thử" để kiểm tra đường link trước khi lưu
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditLinksOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingLinks}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingLinks ? (
                      <span>Đang lưu...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lưu tất cả link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
