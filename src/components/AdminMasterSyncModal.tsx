import {api} from '../services/supabase';
import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Download,
  Users,
  AlertTriangle,
  GraduationCap,
  Lightbulb,
  Truck,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  Employee,
  IncidentViolation,
  QuizSubmission,
  FeedbackProposal,
  BxxlRecord,
  LeaveRequest,
  AppSettings,
} from '../types';
import {
  syncAllDataToDataRtgGoogleSheet,
  exportDataRtgFullMasterExcel,
  DATA_RTG_TITLE,
  THONG_TIN_NHAN_SU_TAB,
  THEO_DOI_VI_PHAM_TAB,
  BAI_THI_KIEM_TRA_TAB,
  GOP_Y_SANG_KIEN_TAB,
  BANG_XEP_XE_TAB,
  DANG_KY_NGHI_PHEP_TAB,
} from '../services/googleSheetSyncService';
import { getCachedToken, signInWithGoogleDrive } from '../services/googleDriveAuth';

interface AdminMasterSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  violations: IncidentViolation[];
  submissions: QuizSubmission[];
  feedbacks: FeedbackProposal[];
  bxxlRecords: BxxlRecord[];
  leaveRequests: LeaveRequest[];
  appSettings?: AppSettings | null;
  onAddToast?: (type: 'loading' | 'success' | 'error', message: string) => void;
}

export const AdminMasterSyncModal: React.FC<AdminMasterSyncModalProps> = ({
  isOpen,
  onClose,
  employees = [],
  violations = [],
  submissions = [],
  feedbacks = [],
  bxxlRecords = [],
  leaveRequests = [],
  appSettings,
  onAddToast,
}) => {
  const defaultSheetUrl =
    appSettings?.googleSheetReportUrl ||
    appSettings?.googleDriveLink ||
    'https://docs.google.com/spreadsheets/d/1XexampleId...';

  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(defaultSheetUrl);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentStepName, setCurrentStepName] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    spreadsheetUrl: string;
    sheetStats: { name: string; rowCount: number }[];
    totalRows: number;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    if (!confirm('Xếp hàng toàn bộ báo cáo từ dữ liệu PostgreSQL đã lưu?')) return;
    setErrorMsg(null); setSyncResult(null); setIsSyncing(true); setCurrentStepName('Đang xếp hàng báo cáo…'); setProgressPercent(10);
    try {
      const result = await api('/google/sync',{method:'POST',body:'{}'});
      setProgressPercent(100); setSyncResult(result); onAddToast?.('success',result.message);
    } catch(err:any) { setErrorMsg(err.message); onAddToast?.('error',err.message); }
    finally { setIsSyncing(false); }
  };

  const handleDownloadMasterExcel = () => {
    exportDataRtgFullMasterExcel(
      employees,
      violations,
      submissions,
      feedbacks,
      bxxlRecords,
      leaveRequests
    );
    if (onAddToast) {
      onAddToast('success', 'Đã xuất file Data_RTG_Master_Full.xlsx đầy đủ 6 sheet.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-100 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Đẩy Toàn Bộ Dữ Liệu Lên Google Sheet
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Nút Tổng Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cập nhật tức thì cả 6 sheet trong file <strong className="font-mono text-slate-700">{DATA_RTG_TITLE}</strong> từ hệ thống
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-5 space-y-5">
          {/* Target Spreadsheet Input */}
          <p className="text-sm text-slate-600">Báo cáo được gửi tới bảng RTG do quản trị viên cấu hình. Theo dõi từng tác vụ tại Google Sync; dữ liệu nghiệp vụ được giữ trong PostgreSQL.</p>

          {/* 6 Data Sources Summary Grid */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Tổng hợp 6 nguồn dữ liệu sẽ được đẩy lên:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">1. ThongTinNhanSu</span>
                  <span className="font-bold text-slate-900">{employees.length} Nhân sự</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">2. TheoDoiViPham</span>
                  <span className="font-bold text-slate-900">{violations.length} Vụ việc (5W1H)</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">3. BaiThi_KiemTra</span>
                  <span className="font-bold text-slate-900">{submissions.length} Lượt thi</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">4. GopY_SangKien</span>
                  <span className="font-bold text-slate-900">{feedbacks.length} Sáng kiến</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">5. BangXepXe_BXXL</span>
                  <span className="font-bold text-slate-900">{bxxlRecords.length} BXXL</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block truncate">6. DangKyNghiPhep</span>
                  <span className="font-bold text-slate-900">{leaveRequests.length} Đơn nghỉ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Progress Bar */}
          {isSyncing && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  {currentStepName || 'Đang thực thi đồng bộ...'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {syncResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-emerald-900">
                    Đã xếp hàng toàn bộ báo cáo
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {syncResult.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={syncResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở bảng báo cáo Google</span>
                </a>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-rose-900">Lỗi khi đẩy dữ liệu:</span>
                  <span className="whitespace-pre-line">{errorMsg}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleDownloadMasterExcel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            title="Tải tệp Excel tổng hợp cả 6 sheet để lưu trữ nội bộ hoặc mở trên máy tính"
          >
            <Download className="w-4 h-4" />
            <span>Tải file Excel dự phòng (.xlsx)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleStartSync}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang đẩy dữ liệu...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                  <span>Bắt đầu đẩy lên Google Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
