import {api} from '../services/supabase';
import {GoogleReportDialog} from './GoogleReportActions';
import {ArchivedImage} from './ArchivedFile';
import React, { useState, useRef } from 'react';
import {
  Lightbulb,
  Plus,
  Image as ImageIcon,
  Images,
  Camera,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  User,
  Shield,
  Eye,
  Filter,
  X,
  Smartphone,
  ArrowLeft,
  Loader2,
  Trash2,
  Maximize2,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  FileDown,
  Settings,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { FeedbackProposal, FeedbackCategory, Employee, AppSettings } from '../types';
import { getCachedToken, signInWithGoogleDrive } from '../services/googleDriveAuth';
import {
  createFeedbackGoogleSpreadsheet,
  syncAllFeedbacksToSheet,
  syncFeedbackViaWebhook,
  exportFeedbacksToCsv,
  extractSpreadsheetId,
} from '../services/googleSheetsFeedbackSync';

interface FeedbackViewProps {
  feedbacks: FeedbackProposal[];
  currentUser: Employee;
  employees?: Employee[];
  appSettings?: AppSettings;
  onSaveAppSettings?: (newSettings: Partial<AppSettings>) => Promise<void>;
  onAddFeedback: (fb: Omit<FeedbackProposal, 'id' | 'submittedAt'>) => void;
  onUpdateFeedbackStatus: (
    id: string,
    status: FeedbackProposal['status'],
    adminResponse?: FeedbackProposal['adminResponse'],
    customPenaltyPoints?: number
  ) => void;
  onClearApprovedFeedbackImages?: (feedbackIds: string[]) => void;
  onSendZaloNotification?: (title: string, content: string, empName: string, empPhone: string) => void;
  onDeleteFeedback?: (id: string) => void;
  onBackToDashboard?: () => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  feedbacks,
  currentUser,
  employees = [],
  appSettings,
  onSaveAppSettings,
  onAddFeedback,
  onUpdateFeedbackStatus,
  onClearApprovedFeedbackImages,
  onSendZaloNotification,
  onDeleteFeedback,
  onBackToDashboard,
}) => {
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | FeedbackProposal['status']>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | FeedbackCategory>('ALL');
  const [activeFeedbackDetail, setActiveFeedbackDetail] = useState<FeedbackProposal | null>(null);
  const [previewEnlargedImage, setPreviewEnlargedImage] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  // Cảnh báo nguy hiểm states
  const [dangerCauserName, setDangerCauserName] = useState('');
  const [dangerCauserId, setDangerCauserId] = useState('');
  const [dangerCauserCode, setDangerCauserCode] = useState('');
  const [dangerCauserDepartment, setDangerCauserDepartment] = useState('');
  const [penaltyPoints, setPenaltyPoints] = useState<number>(5);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Review approval penalty points state
  const [reviewPenaltyPoints, setReviewPenaltyPoints] = useState<number>(5);

  // Response form for admin
  const [adminComment, setAdminComment] = useState('');
  const [adminActionPlan, setAdminActionPlan] = useState('');

  // Dual file input refs: one strictly for gallery / file picker (NO capture), one for camera
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const canManageFeedback =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.role === 'MANAGER_L2' ||
    currentUser.assignedPermissions.includes('MANAGE_FEEDBACK') ||
    currentUser.assignedPermissions.includes('APPROVE_FEEDBACK');

  const categories: { id: FeedbackCategory; name: string; desc: string }[] = [
    { id: 'DONG_GOP', name: 'Đóng góp', desc: 'Ý kiến cải tiến quy trình, nâng cao hiệu suất làm việc' },
    { id: 'DE_XUAT', name: 'Đề xuất', desc: 'Sáng kiến trang thiết bị, cải tiến cơ sở vật chất' },
    { id: 'CANH_BAO_NGUY_HIEM', name: 'Cảnh báo nguy hiểm', desc: 'Báo cáo nguy cơ mất an toàn, sự cố rủi ro tại hiện trường' },
    { id: 'KHAC', name: 'Khác', desc: 'Các câu hỏi, tâm tư nguyện vọng hoặc ý kiến chung' },
  ];

  // Client-side image compression utility using HTML5 Canvas
  // Resizes huge smartphone photos (often 5MB - 18MB) down to crisp ~150KB JPEG
  // to avoid browser crashes and ensure instant uploads on mobile devices
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawData = e.target?.result as string;
        if (!rawData) {
          resolve('');
          return;
        }

        const img = new Image();
        img.onload = () => {
          const maxDim = 1400;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawData);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = () => resolve(rawData);
        img.src = rawData;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle Image Selection (From Gallery or Camera)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImages(true);
    try {
      const fileList: File[] = Array.from(files);
      const results = await Promise.all(fileList.map((f: File) => compressImage(f)));
      const validImages = results.filter((img) => Boolean(img));
      setAttachedImages((prev) => [...prev, ...validImages]);
    } catch (err) {
      console.error('Lỗi khi đọc ảnh từ thiết bị:', err);
    } finally {
      setIsProcessingImages(false);
      // Reset input value so selecting the same image triggers onChange
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung đề xuất.');
      return;
    }

    if (category === 'CANH_BAO_NGUY_HIEM' && !dangerCauserName.trim()) {
      alert('Vui lòng nhập hoặc chọn Tên nhân viên gây nguy hiểm / Vi phạm quy trình.');
      return;
    }

    const catObj = categories.find((c) => c.id === category);
    const isDanger = category === 'CANH_BAO_NGUY_HIEM';

    onAddFeedback({
      title,
      category: category || 'DONG_GOP',
      categoryName: catObj?.name || 'Góp ý',
      content,
      images: attachedImages,
      isAnonymous,
      authorId: currentUser.id,
      authorName: isAnonymous ? 'Nhân sự giấu tên' : currentUser.fullName,
      authorDepartment: isAnonymous ? 'Bảo mật thông tin' : currentUser.department,
      status: 'PENDING',
      ...(isDanger
        ? {
            dangerCauserName: dangerCauserName.trim(),
            dangerCauserId: dangerCauserId || undefined,
            dangerCauserCode: dangerCauserCode || undefined,
            dangerCauserDepartment: dangerCauserDepartment || undefined,
            penaltyPoints: penaltyPoints || 5,
            pointsDeductedApplied: false,
          }
        : {}),
    });

    // Reset & close
    setTitle('');
    setContent('');
    setAttachedImages([]);
    setIsAnonymous(false);
    setShowFormModal(false);
    setCategory('');
    setDangerCauserName('');
    setDangerCauserId('');
    setDangerCauserCode('');
    setDangerCauserDepartment('');
    setPenaltyPoints(5);
    setShowEmployeeDropdown(false);
  };

  const openFeedbackDetail = (fb: FeedbackProposal) => {
    setActiveFeedbackDetail(fb);
    setReviewPenaltyPoints(fb.penaltyPoints || 5);
    setAdminComment(fb.adminResponse?.comment || '');
    setAdminActionPlan(fb.adminResponse?.actionPlan || '');
  };

  const handleAdminRespond = (status: FeedbackProposal['status']) => {
    if (!activeFeedbackDetail) return;
    if (!adminComment.trim()) {
      alert('Vui lòng nhập nội dung phản hồi từ Ban Quản lý.');
      return;
    }

    const responseObj = {
      by: `${currentUser.fullName} (${currentUser.position})`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      comment: adminComment,
      actionPlan: adminActionPlan || undefined,
    };

    onUpdateFeedbackStatus(
      activeFeedbackDetail.id,
      status,
      responseObj,
      status === 'APPROVED' ? reviewPenaltyPoints : undefined
    );

    // If author is known and Zalo notification is requested
    if (!activeFeedbackDetail.isAnonymous && onSendZaloNotification) {
      const authorEmp = employees.find(
        (e) => e.id === activeFeedbackDetail.authorId || e.fullName === activeFeedbackDetail.authorName
      );
      const authorPhone = authorEmp?.zaloPhone || authorEmp?.phone || '';

      onSendZaloNotification(
        `[PHẢN HỒI ĐỀ XUẤT] ${activeFeedbackDetail.title}`,
        `Chào bạn, đề xuất của bạn đã được ${currentUser.fullName} xử lý với trạng thái: ${status}. Nội dung: "${adminComment}"`,
        activeFeedbackDetail.authorName,
        authorPhone
      );
    }

    setAdminComment('');
    setAdminActionPlan('');
    setActiveFeedbackDetail(null);
  };

  const filteredFeedbacks = feedbacks.filter((fb) => {
    const matchesStatus = selectedStatus === 'ALL' || fb.status === selectedStatus;
    const matchesCategory = selectedCategory === 'ALL' || fb.category === selectedCategory;
    return matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: FeedbackProposal['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'IN_REVIEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusText = (status: FeedbackProposal['status']) => {
    switch (status) {
      case 'PENDING':
        return 'Chờ tiếp nhận';
      case 'IN_REVIEW':
        return 'Đang xử lý';
      case 'APPROVED':
        return 'Đã phê duyệt';
      case 'REJECTED':
        return 'Chưa duyệt';
    }
  };

  // Google Sheets Sync state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSheetConfigModal, setShowSheetConfigModal] = useState(false);
  const [customSheetUrlInput, setCustomSheetUrlInput] = useState('');


  // Handle Sync to Google Sheets
  const handleSyncToGoogleSheets = async () => {
    if (!confirm('Xếp hàng báo cáo góp ý đã lưu?')) return;
    setIsSyncingSheets(true); setSyncStatusMsg(null);
    try { const result = await api('/google/sync',{method:'POST',body:JSON.stringify({module:'feedbacks'})}); setSyncStatusMsg({type:'success',text:result.message}); }
    catch(err:any) { setSyncStatusMsg({type:'error',text:err.message}); }
    finally { setIsSyncingSheets(false); }
  };

  const handleExportCsv = () => {
    try {
      exportFeedbacksToCsv(feedbacks);
      setSyncStatusMsg({
        type: 'success',
        text: 'Đã xuất file bảng tính CSV (hỗ trợ tiếng Việt đầy đủ cho Excel & Trang tính)!',
      });
    } catch (err: any) {
      alert(`Lỗi xuất file: ${err.message}`);
    }
  };

  

  

  return (
    <div className="space-y-6">
      {/* Mobile Back Button to Dashboard */}
      {onBackToDashboard && (
        <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-200">
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>Quay lại Tổng quan</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500">Góp ý & Sáng kiến</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Hòm Thư Góp Ý & Đề Xuất Sáng Kiến
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {feedbacks.length} Đề xuất
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mọi cán bộ nhân viên có thể gửi đề xuất cải tiến và đính kèm ảnh chụp trực tiếp từ bộ sưu tập điện thoại
          </p>
        </div>

        <button
          id="btn-open-feedback-form"
          onClick={() => setShowFormModal(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Gửi Đề xuất / Góp ý Mới</span>
        </button>
      </div>

      {/* Google Sheets Sync Banner - Chỉ người có thẩm quyền quản lý mới nhìn thấy và sử dụng */}
      {canManageFeedback && (
        <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Đồng bộ Google Trang tính (Lưu vào file Data_RTG)
                  </h3>
                  {appSettings?.googleSheetSpreadsheetUrl || appSettings?.feedbackGoogleSheetUrl || appSettings?.feedbackGoogleSheetId ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-700" />
                      Đã liên kết file Data_RTG
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Chưa liên kết file Data_RTG (Nhấn Đồng bộ để tự động tạo)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tất cả {feedbacks.length} ý kiến, đề xuất và cảnh báo nguy hiểm được lưu tập trung vào tab "Góp Ý & Sáng Kiến" trong file Data_RTG.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(appSettings?.googleSheetSpreadsheetUrl || appSettings?.feedbackGoogleSheetUrl || appSettings?.feedbackGoogleSheetId) && (
                <a
                  href={
                    appSettings?.googleSheetSpreadsheetUrl ||
                    appSettings?.feedbackGoogleSheetUrl ||
                    `https://docs.google.com/spreadsheets/d/${appSettings?.feedbackGoogleSheetId}/edit`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Mở file Data_RTG trên Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mở file Data_RTG</span>
                </a>
              )}

              <button
                onClick={handleSyncToGoogleSheets}
                disabled={isSyncingSheets}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                title="Đồng bộ ngay vào tab Góp Ý & Sáng Kiến trong file Data_RTG"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                <span>{isSyncingSheets ? 'Đang đồng bộ...' : 'Đồng bộ Google Trang tính'}</span>
              </button>

              <button
                onClick={() => {
                  setCustomSheetUrlInput(
                    appSettings?.googleSheetSpreadsheetUrl ||
                    appSettings?.feedbackGoogleSheetUrl ||
                    (appSettings?.feedbackGoogleSheetId ? `https://docs.google.com/spreadsheets/d/${appSettings.feedbackGoogleSheetId}/edit` : '')
                  );

                  setShowSheetConfigModal(true);
                }}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold transition-colors shadow-2xs"
                title="Cấu hình Google Trang tính (file Data_RTG)"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sync Status Banner */}
          {syncStatusMsg && (
            <div
              className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>{syncStatusMsg.text}</span>
              <button
                onClick={() => setSyncStatusMsg(null)}
                className="text-slate-500 hover:text-slate-800 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({feedbacks.length})
          </button>
          <button
            onClick={() => setSelectedStatus('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedStatus === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Chờ tiếp nhận ({feedbacks.filter((f) => f.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setSelectedStatus('IN_REVIEW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedStatus === 'IN_REVIEW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đang xử lý ({feedbacks.filter((f) => f.status === 'IN_REVIEW').length})
          </button>
          <button
            onClick={() => setSelectedStatus('APPROVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedStatus === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đã duyệt ({feedbacks.filter((f) => f.status === 'APPROVED').length})
          </button>
        </div>

        {/* Category selector & Export */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none"
          >
            <option value="ALL">Tất cả lĩnh vực</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Tải tệp bảng tính CSV (hỗ trợ mở bằng Excel hoặc Google Sheets)"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Feedbacks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFeedbacks.map((fb) => (
          <div
            key={fb.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all p-5 flex flex-col justify-between"
          >
            <div>
              {/* Header tags */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {fb.categoryName}
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                    fb.status
                  )}`}
                >
                  {getStatusText(fb.status)}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-bold text-slate-900 text-base mb-2">{fb.title}</h3>

              {/* Content text */}
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3">
                {fb.content}
              </p>

              {/* Danger Warning Causer Badge if present */}
              {(fb.dangerCauserName || fb.category === 'CANH_BAO_NGUY_HIEM') && (
                <div className="mb-3 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-amber-900 font-bold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span className="truncate">
                        NV gây nguy hiểm: <span className="underline decoration-amber-400">{fb.dangerCauserName || 'Chưa ghi tên'}</span>
                      </span>
                    </div>
                    {(canManageFeedback || fb.pointsDeductedApplied) && (
                      <span className="ml-1.5 flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold">
                        -{fb.penaltyPoints || 5}đ
                      </span>
                    )}
                  </div>
                  {fb.dangerCauserDepartment && (
                    <div className="text-[11px] text-amber-800 flex items-center gap-1">
                      <span>Bộ phận: {fb.dangerCauserDepartment}</span>
                      {fb.dangerCauserCode && <span>({fb.dangerCauserCode})</span>}
                    </div>
                  )}
                  <div className="text-[11px] pt-0.5">
                    {fb.pointsDeductedApplied ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        Đã tự động lưu hồ sơ & trừ {fb.penaltyPoints || 5}đ
                      </span>
                    ) : (
                      <span className="text-amber-700 italic flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        {canManageFeedback
                          ? 'Chờ duyệt để tự động cập nhật hồ sơ & trừ điểm'
                          : 'Cảnh báo đã được gửi đến Ban Lãnh đạo thẩm định'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Images preview if any */}
              {fb.images && fb.images.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-slate-500">
                    <Images className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{fb.images.length} ảnh đính kèm:</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {fb.images.map((img, idx) => (
                      <div key={idx} className="relative flex-shrink-0 group">
                        <ArchivedImage
                          src={img}
                          alt="Ảnh đính kèm"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer group-hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewEnlargedImage(img)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewEnlargedImage(img)}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-white"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archived image notice if images were cleared to save storage */}
              {fb.imagesArchived && (
                <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Ảnh minh chứng đã lưu trữ Drive / Sheet (Đã giải phóng bộ nhớ)</span>
                </div>
              )}
            </div>

            <div>
              {/* Admin response snippet if any */}
              {fb.adminResponse && (
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-950 mb-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Phản hồi từ {fb.adminResponse.by}:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed line-clamp-2">
                    {fb.adminResponse.comment}
                  </p>
                </div>
              )}

              {/* Author & Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-600 truncate max-w-[150px]">
                    {fb.authorName} ({fb.authorDepartment})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">{fb.submittedAt.split(' ')[0]}</span>
                  {onDeleteFeedback && (canManageFeedback || currentUser.id === fb.authorId || currentUser.role === 'ADMIN') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Bạn có chắc muốn xóa đề xuất "${fb.title}"?`)) {
                          onDeleteFeedback(fb.id);
                        }
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Xóa đề xuất"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openFeedbackDetail(fb)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    Chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFeedbacks.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Lightbulb className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-sm">Chưa có đề xuất hoặc góp ý nào trong mục này</p>
          <p className="text-xs text-slate-400">Hãy là người đầu tiên đóng góp sáng kiến cho công ty!</p>
        </div>
      )}

      {/* Modal: View & Process Feedback Details */}
      {activeFeedbackDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Modal Top Header with Prominent Back Button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                onClick={() => setActiveFeedbackDetail(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-600" />
                <span>Quay lại danh sách đề xuất</span>
              </button>
              <div className="flex items-center gap-2">
                {onDeleteFeedback && (canManageFeedback || currentUser.id === activeFeedbackDetail.authorId || currentUser.role === 'ADMIN') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Bạn có chắc chắn muốn xóa đề xuất này?')) {
                        onDeleteFeedback(activeFeedbackDetail.id);
                        setActiveFeedbackDetail(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveFeedbackDetail(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status & Title */}
            <div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                  activeFeedbackDetail.status
                )}`}
              >
                {getStatusText(activeFeedbackDetail.status)}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                {activeFeedbackDetail.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Người gửi: <b>{activeFeedbackDetail.authorName}</b> • {activeFeedbackDetail.authorDepartment} • Ngày gửi: {activeFeedbackDetail.submittedAt}
              </p>
            </div>

            {/* Content text */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
              {activeFeedbackDetail.content}
            </div>

            {/* Danger employee section if hazard warning */}
            {(activeFeedbackDetail.dangerCauserName || activeFeedbackDetail.category === 'CANH_BAO_NGUY_HIEM') && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Nhân sự vi phạm / Gây nguy hiểm:</span>
                    <span className="text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md font-extrabold">
                      {activeFeedbackDetail.dangerCauserName || 'Chưa ghi rõ'}
                    </span>
                  </div>
                  {(canManageFeedback || activeFeedbackDetail.pointsDeductedApplied) && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                      -{activeFeedbackDetail.penaltyPoints || 5} điểm
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-900 pt-1">
                  <div>
                    <span className="font-semibold text-amber-800">Bộ phận / Tổ:</span>{' '}
                    <span>{activeFeedbackDetail.dangerCauserDepartment || 'Chưa xác định'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-amber-800">Mã nhân sự:</span>{' '}
                    <span className="font-mono">{activeFeedbackDetail.dangerCauserCode || 'Chưa có'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200 text-xs">
                  {activeFeedbackDetail.pointsDeductedApplied ? (
                    <div className="flex items-center gap-2 text-emerald-800 font-bold bg-emerald-100/80 px-3 py-2 rounded-xl border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        Đã tự động lưu vào Hồ sơ năng lực cá nhân & trừ {activeFeedbackDetail.penaltyPoints || 5} điểm ({activeFeedbackDetail.pointsDeductedAt ? new Date(activeFeedbackDetail.pointsDeductedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : 'Đã duyệt'}).
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-900 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed text-[11px]">
                        <b>Chờ phê duyệt:</b> Khi người có thẩm quyền phê duyệt cảnh báo này, hệ thống sẽ <b>tự động lưu vào hồ sơ năng lực</b> và <b>trừ điểm</b> của nhân sự trên.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Images full view */}
            {activeFeedbackDetail.images && activeFeedbackDetail.images.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Images className="w-4 h-4 text-emerald-600" />
                  <span>Hình ảnh đính kèm minh chứng ({activeFeedbackDetail.images.length} ảnh):</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeFeedbackDetail.images.map((img, i) => (
                    <div key={i} className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                      <ArchivedImage
                        src={img}
                        alt="Ảnh đính kèm"
                        className="w-full h-36 sm:h-44 object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewEnlargedImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewEnlargedImage(img)}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/70 text-white text-xs backdrop-blur-xs flex items-center gap-1"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span className="text-[10px]">Xem to</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thông báo dọn dẹp ảnh sau khi đã đồng bộ Google Drive / Sheets */}
            {activeFeedbackDetail.imagesArchived && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-emerald-900">
                    Ảnh minh chứng đã đồng bộ Google Drive / Sheet thành công
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    {activeFeedbackDetail.imagesArchivedNote ||
                      'Dữ liệu ảnh base64 dung lượng lớn đã được tự động giải phóng sau khi phê duyệt để giảm tải bộ nhớ cho ứng dụng.'}
                  </p>
                </div>
              </div>
            )}

            {/* Existing response if any */}
            {activeFeedbackDetail.adminResponse && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ý kiến phản hồi từ Ban Lãnh đạo ({activeFeedbackDetail.adminResponse.by}):</span>
                </div>
                <p className="text-xs text-emerald-950 leading-relaxed">
                  {activeFeedbackDetail.adminResponse.comment}
                </p>
                {activeFeedbackDetail.adminResponse.actionPlan && (
                  <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                    📌 Kế hoạch hành động: {activeFeedbackDetail.adminResponse.actionPlan}
                  </p>
                )}
              </div>
            )}

            {/* Admin Action Form (If user has permission to manage feedback) */}
            {canManageFeedback && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-900">
                  Dành cho Ban Quản lý / HR: Phản hồi & Xử lý đề xuất
                </h4>
                <textarea
                  rows={3}
                  placeholder="Nhập nội dung ý kiến chỉ đạo, tiếp nhận hoặc phản hồi tới nhân viên..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
                <input
                  type="text"
                  placeholder="Kế hoạch thực hiện (Ví dụ: Hoàn tất trước ngày 25/03)..."
                  value={adminActionPlan}
                  onChange={(e) => setAdminActionPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />

                {/* Approver Penalty Point Adjuster if hazard warning is not yet deducted */}
                {(activeFeedbackDetail.dangerCauserName || activeFeedbackDetail.category === 'CANH_BAO_NGUY_HIEM') && !activeFeedbackDetail.pointsDeductedApplied && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Mức trừ điểm năng lực khi Phê duyệt:</span>
                      </div>
                      <span className="text-xs font-bold text-rose-700">-{reviewPenaltyPoints} điểm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={reviewPenaltyPoints}
                        onChange={(e) => setReviewPenaltyPoints(Number(e.target.value) || 0)}
                        className="w-20 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <div className="flex items-center gap-1">
                        {[5, 10, 15, 20].map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setReviewPenaltyPoints(pts)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              reviewPenaltyPoints === pts
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            -{pts}đ
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      ⚡ <b>Cơ chế tự động:</b> Khi bạn nhấn nút <b>"Phê duyệt đề xuất"</b> bên dưới, hệ thống sẽ <b>tự động lưu vào Hồ sơ năng lực</b> của nhân sự <b>{activeFeedbackDetail.dangerCauserName || 'được chỉ định'}</b> và <b>trừ {reviewPenaltyPoints} điểm</b>.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleAdminRespond('IN_REVIEW')}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors"
                  >
                    Chuyển sang "Đang xử lý"
                  </button>
                  <button
                    onClick={() => handleAdminRespond('APPROVED')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Phê duyệt đề xuất</span>
                  </button>
                  <button
                    onClick={() => handleAdminRespond('REJECTED')}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    Chưa phê duyệt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Feedback Proposal Form */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Modal Header with Prominent Back Button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setCategory('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-600" />
                <span>Quay lại</span>
              </button>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Gửi Góp Ý / Đề Xuất Sáng Kiến</h3>
              <button
                onClick={() => {
                  setShowFormModal(false);
                  setCategory('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden Dual File Inputs */}
            {/* 1. Gallery input: strictly NO capture attribute so mobile opens Photo Gallery / Album picker */}
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            {/* 2. Camera input: dedicated capture for instant shutter */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />

            {!category ? (
              <div className="space-y-3 py-2">
                <p className="text-xs sm:text-sm text-slate-600 font-medium text-center">
                  Vui lòng chọn lĩnh vực bạn muốn đóng góp ý kiến:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-slate-800 border border-slate-200 transition-all text-center font-bold flex flex-col items-center justify-center gap-2"
                    >
                      {c.id === 'DONG_GOP' && <Lightbulb className="w-6 h-6 text-indigo-600" />}
                      {c.id === 'DE_XUAT' && <Plus className="w-6 h-6 text-emerald-600" />}
                      {c.id === 'CANH_BAO_NGUY_HIEM' && <Shield className="w-6 h-6 text-rose-600" />}
                      {c.id === 'KHAC' && <MessageSquare className="w-6 h-6 text-amber-600" />}
                      <span className="text-xs sm:text-sm">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCategory('')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Đổi lĩnh vực</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-emerald-600">
                    {categories.find((c) => c.id === category)?.name}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tiêu đề đề xuất *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Đề xuất thay thế hệ thống máy in tầng 2..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nội dung chi tiết & Lợi ích mang lại *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Mô tả thực trạng hiện tại, giải pháp cụ thể và lợi ích thiết thực cho công ty..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                {/* Section riêng biệt khi mục là CẢNH BÁO NGUY HIỂM */}
                {category === 'CANH_BAO_NGUY_HIEM' && (
                  <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-3">
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Thông tin Nhân viên gây nguy hiểm / Vi phạm an toàn</span>
                    </div>

                    {/* Ô Tên nhân viên gây nguy hiểm với tìm kiếm / gợi ý tự động */}
                    <div className="relative">
                      <label className="block text-slate-700 font-semibold mb-1 text-xs">
                        Tên nhân viên gây nguy hiểm / Vi phạm quy trình *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="danger-causer-name-input"
                          required
                          placeholder="Nhập tên nhân viên (gõ để tìm nhanh trong danh mục)..."
                          value={dangerCauserName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDangerCauserName(val);
                            setShowEmployeeDropdown(true);
                            const matched = employees.find(
                              (emp) => emp.fullName.toLowerCase() === val.trim().toLowerCase()
                            );
                            if (matched) {
                              setDangerCauserId(matched.id);
                              setDangerCauserCode(matched.employeeCode);
                              setDangerCauserDepartment(matched.department);
                            } else {
                              setDangerCauserId('');
                            }
                          }}
                          onFocus={() => setShowEmployeeDropdown(true)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 focus:ring-2 focus:ring-amber-500/20 outline-none text-xs"
                        />
                        {dangerCauserName && (
                          <button
                            type="button"
                            onClick={() => {
                              setDangerCauserName('');
                              setDangerCauserId('');
                              setDangerCauserCode('');
                              setDangerCauserDepartment('');
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown gợi ý danh sách nhân sự */}
                      {showEmployeeDropdown && employees.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 divide-y divide-slate-100">
                          {employees
                            .filter((emp) => {
                              if (!dangerCauserName.trim()) return true;
                              const q = dangerCauserName.toLowerCase();
                              return (
                                emp.fullName.toLowerCase().includes(q) ||
                                emp.employeeCode.toLowerCase().includes(q) ||
                                (emp.department && emp.department.toLowerCase().includes(q))
                              );
                            })
                            .slice(0, 10)
                            .map((emp) => (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setDangerCauserName(emp.fullName);
                                  setDangerCauserId(emp.id);
                                  setDangerCauserCode(emp.employeeCode);
                                  setDangerCauserDepartment(emp.department);
                                  setShowEmployeeDropdown(false);
                                }}
                                className="px-3 py-2 hover:bg-amber-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 overflow-hidden">
                                    {emp.avatar ? (
                                      <img
                                        src={emp.avatar}
                                        alt={emp.fullName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      emp.fullName.charAt(0)
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-800">{emp.fullName}</span>
                                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                                      ({emp.employeeCode})
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                  {emp.department || 'Tổ RTG'}
                                </span>
                              </div>
                            ))}
                          <div className="p-1.5 bg-slate-50 text-center">
                            <button
                              type="button"
                              onClick={() => setShowEmployeeDropdown(false)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                            >
                              Đóng gợi ý (✕)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Thông tin xác nhận nhân sự đã chọn */}
                      {dangerCauserDepartment && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-900 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                          <span className="font-semibold">Bộ phận:</span>
                          <span>{dangerCauserDepartment}</span>
                          {dangerCauserCode && (
                            <>
                              <span className="text-amber-400">•</span>
                              <span className="font-mono">Mã: {dangerCauserCode}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thông tin quy trình xử lý an toàn */}
                    <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
                      <div className="font-bold flex items-center gap-1 text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Quy trình xử lý vi phạm & trừ điểm:</span>
                      </div>
                      <p className="text-[11px] text-amber-900/90">
                        Sau khi bạn gửi cảnh báo nguy hiểm, cấp quản lý có thẩm quyền sẽ kiểm tra, xác minh và trực tiếp <b>đánh giá mức độ vi phạm</b> để <b>tự động lưu vào hồ sơ năng lực</b> và <b>trừ điểm KPI</b> của nhân viên trên theo đúng quy chế an toàn cảng.
                      </p>
                    </div>
                  </div>
                )}

                {/* Upload Image Section - Optimized for Mobile Album & Camera */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 font-semibold">
                      Đính kèm hình ảnh minh chứng
                    </label>
                    <span className="text-[11px] text-slate-400">Tối ưu cho điện thoại</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Primary Button: Open Photo Library / Gallery on mobile */}
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="p-3 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
                    >
                      <Images className="w-4 h-4 text-emerald-600" />
                      <span>Bộ sưu tập ảnh</span>
                    </button>

                    {/* Secondary Button: Direct Camera Shot */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
                    >
                      <Camera className="w-4 h-4 text-slate-600" />
                      <span>Chụp ảnh mới</span>
                    </button>
                  </div>

                  {isProcessingImages && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Đang nén và xử lý hình ảnh từ điện thoại...</span>
                    </div>
                  )}

                  {/* Previews */}
                  {attachedImages.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600">
                          Đã chọn {attachedImages.length} ảnh:
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachedImages([])}
                          className="text-[11px] text-rose-600 hover:underline font-semibold"
                        >
                          Xóa tất cả ảnh
                        </button>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {attachedImages.map((img, i) => (
                          <div key={i} className="relative flex-shrink-0 group">
                            <ArchivedImage
                              src={img}
                              alt="preview"
                              className="w-18 h-18 rounded-xl object-cover border border-slate-200 shadow-2xs cursor-pointer"
                              onClick={() => setPreviewEnlargedImage(img)}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAttachedImages(attachedImages.filter((_, idx) => idx !== i))
                              }
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Anonymous Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chk-anonymous"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="chk-anonymous" className="text-xs text-slate-700 cursor-pointer">
                    <b>Gửi ẩn danh:</b> Không hiển thị tên và phòng ban của tôi trong danh sách công khai.
                  </label>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormModal(false);
                      setCategory('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm shadow-emerald-200"
                  >
                    Gửi đề xuất đi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Fullscreen Image Preview */}
      {previewEnlargedImage && (
        <div
          onClick={() => setPreviewEnlargedImage(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <ArchivedImage
              src={previewEnlargedImage}
              alt="Chi tiết ảnh"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setPreviewEnlargedImage(null)}
              className="mt-3 px-4 py-1.5 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors"
            >
              Đóng xem ảnh (✕)
            </button>
          </div>
        </div>
      )}

      {/* Modal: Google Sheets Configuration (Chỉ dành cho người được cấp quyền) */}
      {showSheetConfigModal && <GoogleReportDialog module="feedbacks" onClose={() => setShowSheetConfigModal(false)} />}
    </div>
  );
};
