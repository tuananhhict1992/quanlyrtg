import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { api } from '../services/supabase';
import type { SyncSummary } from '../utils/googleSync';

export function SyncQueueNotice({
  summary,
  onOpen,
  onCleaned,
}: {
  summary: SyncSummary;
  onOpen?: () => void;
  onCleaned?: () => void;
}) {
  const [cleaning, setCleaning] = useState(false);
  const [cleanedMsg, setCleanedMsg] = useState('');

  const handleCleanup = async () => {
    setCleaning(true);
    setCleanedMsg('');
    try {
      const res = await api<{ cleanedCount: number }>('/google/jobs/cleanup-unconfirmed', {
        method: 'POST',
      });
      setCleanedMsg(`Đã dọn dẹp thành công ${res.cleanedCount} file tạm.`);
      onCleaned?.();
    } catch (e: any) {
      setCleanedMsg(e.message || 'Không thể dọn dẹp hàng đợi file tạm.');
    } finally {
      setCleaning(false);
    }
  };

  if (!summary.total) return null;
  return (
    <div
      role="status"
      data-testid="sync-backup-warning"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2"
    >
      <p className="font-bold flex items-start gap-2">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        Có {summary.total} tác vụ chưa hoàn tất lưu trữ & báo cáo
      </p>
      <p className="text-sm">
        {summary.drive} file chờ lưu trên Drive · {summary.sheet} lượt cập nhật báo cáo Sheets
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          Chờ xác nhận dữ liệu: <b>{summary.waitingConfirmation}</b>
        </span>
        <span>
          Chờ đồng bộ: <b>{summary.pending}</b>
        </span>
        <span>
          Đang xử lý: <b>{summary.processing}</b>
        </span>
        <span className={summary.failed ? 'text-red-700' : ''}>
          Lỗi cần thử lại: <b>{summary.failed}</b>
        </span>
        {!!summary.needsAttention && <span>Cần kiểm tra file: <b>{summary.needsAttention}</b></span>}
      </div>
      {!!summary.waitingConfirmation && (
        <div className="text-sm bg-white/80 p-3 rounded-lg border border-amber-200/60 space-y-1.5">
          <p>
            <b>{summary.waitingConfirmation} file chờ xác nhận</b> là các tệp tạm phát sinh khi tải lên xem trước nhưng chưa bấm lưu chính thức ở phân hệ tương ứng. Đây không phải lỗi hệ thống hay lỗi Google.
          </p>
          <p className="text-xs text-amber-900">
            Nếu bạn không còn nhu cầu nhập các file tạm này, bạn có thể bấm dọn dẹp để làm sạch hàng đợi cảnh báo.
          </p>
        </div>
      )}
      {cleanedMsg && (
        <p className="text-xs font-bold text-emerald-800 bg-emerald-100 p-2 rounded-lg flex items-center gap-1.5">
          <CheckCircle2 size={15} />
          <span>{cleanedMsg}</span>
        </p>
      )}
      <p className="text-xs text-slate-500">
        Đếm trên toàn bộ hàng đợi; một hồ sơ có thể phát sinh nhiều tác vụ. Dữ liệu đã lưu trong hệ thống vẫn được giữ.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {onOpen && (
          <button type="button" onClick={onOpen} className="hict-button bg-white text-xs">
            Xem hàng đợi sao lưu
          </button>
        )}
        {!!summary.waitingConfirmation && (
          <button
            type="button"
            disabled={cleaning}
            onClick={handleCleanup}
            className="hict-button bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            <span>{cleaning ? 'Đang dọn dẹp…' : `Dọn dẹp ${summary.waitingConfirmation} file tạm`}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Mounted for ADMIN only. One summary request/minute while the dashboard is visible.
export function AdminGoogleSyncNotice({ onOpen }: { onOpen: () => void }) {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState(false);

  const fetchSummary = async (signal?: AbortSignal) => {
    try {
      const value = await api<SyncSummary>('/google/jobs/summary', { signal });
      setSummary(value);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchSummary(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void fetchSummary();
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      {error && (
        <p role="status" className="text-sm text-amber-700">
          Chưa cập nhật được cảnh báo sao lưu.{summary ? ' Đang hiển thị số liệu gần nhất.' : ''}
        </p>
      )}
      {summary && <SyncQueueNotice summary={summary} onOpen={onOpen} onCleaned={() => void fetchSummary()} />}
    </>
  );
}
