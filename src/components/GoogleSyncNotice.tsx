import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../services/supabase';
import type { SyncSummary } from '../utils/googleSync';

export function SyncQueueNotice({summary, onOpen}: {summary: SyncSummary; onOpen?: () => void}) {
  if (!summary.total) return null;
  return <div role="status" data-testid="sync-backup-warning" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
    <p className="font-bold flex items-start gap-2"><AlertTriangle size={18} className="shrink-0 mt-0.5" />Có {summary.total} tác vụ chưa hoàn tất lưu trữ & báo cáo</p>
    <p className="text-sm">{summary.drive} file chờ lưu trên Drive · {summary.sheet} lượt cập nhật báo cáo Sheets</p>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span>Chờ xác nhận dữ liệu: <b>{summary.waitingConfirmation}</b></span>
      <span>Chờ đồng bộ: <b>{summary.pending}</b></span>
      <span>Đang xử lý: <b>{summary.processing}</b></span>
      <span className={summary.failed ? 'text-red-700' : ''}>Lỗi cần thử lại: <b>{summary.failed}</b></span>
      {!!summary.needsAttention && <span>Cần kiểm tra file: <b>{summary.needsAttention}</b></span>}
    </div>
    {!!summary.waitingConfirmation && <p className="text-sm">File chờ xác nhận chỉ được sao lưu sau khi người có thẩm quyền xác nhận dữ liệu ở phân hệ tương ứng. Đây chưa phải lỗi Google.</p>}
    <p className="text-xs">Đếm trên toàn bộ hàng đợi; một hồ sơ có thể phát sinh nhiều tác vụ. Dữ liệu đã lưu trong hệ thống vẫn được giữ.</p>
    {onOpen && <button type="button" onClick={onOpen} className="hict-button bg-white">Xem hàng đợi sao lưu</button>}
  </div>;
}

// Mounted for ADMIN only. One summary request/minute while the dashboard is visible.
export function AdminGoogleSyncNotice({onOpen}: {onOpen: () => void}) {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const refresh = async () => {
      if (fetching || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const value = await api<SyncSummary>('/google/jobs/summary', {signal: controller.signal});
        if (!controller.signal.aborted) {setSummary(value); setError(false);}
      } catch { if (!controller.signal.aborted) setError(true); }
      finally {fetching = false;}
    };
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => {controller.abort(); window.clearInterval(timer);};
  }, []);
  return <>
    {error && <p role="status" className="text-sm text-amber-700">Chưa cập nhật được cảnh báo sao lưu.{summary ? ' Đang hiển thị số liệu gần nhất.' : ''}</p>}
    {summary && <SyncQueueNotice summary={summary} onOpen={onOpen} />}
  </>;
}
