import React, { useState, useEffect } from "react";
import { api } from "../services/supabase";
import { connectGoogleDriveStorage } from "../services/googleDriveAuth";
import { formatDate } from "../utils/date";
import type { Employee } from "../types";
export function GoogleSyncPanel({ currentUser }: { currentUser: Employee }) {
  const [jobs, setJobs] = useState<any[]>([]),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connection, setConnection] = useState<any>(null),
    [automation, setAutomation] = useState<any>(null),
    [refresh, setRefresh] = useState(0),
    [preview, setPreview] = useState<any>(null),
    [module, setModule] = useState("employees"),
    [busy, setBusy] = useState(false);
  const allowed = currentUser.role === 'ADMIN';
  const load = () => setRefresh(value => value + 1);
  useEffect(() => {
    if (!allowed) return;
    let active = true, fetching = false;
    const cancelled = new AbortController();
    setLoading(true);
    const fetchState = async () => {
      if (fetching || !active || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const [items, connected, automatic] = await Promise.all([
          api<any[]>('/google/jobs?page=' + page,{signal:cancelled.signal}), api('/google/connection',{signal:cancelled.signal}), api('/google/automation',{signal:cancelled.signal}),
        ]);
        if (!active) return;
        const unfinished = items.filter(item => item.status !== 'success');
        setJobs(unfinished); setConnection(connected); setAutomation(automatic); setError('');
        if (!unfinished.length && page > 0) setPage(value => value - 1);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    void fetchState();
    const timer = setInterval(fetchState, 15000);
    return () => { active = false; cancelled.abort(); clearInterval(timer); };
  }, [page, allowed, refresh]);
  if (!allowed) return null;
  const act = async (fn: () => Promise<any>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="rounded-2xl border border-indigo-200 bg-white p-4 sm:p-6 space-y-4 min-w-0"
      aria-label="Google Sync"
    >
      <h3 className="font-bold text-lg">Google Sync · Lưu trữ & báo cáo</h3>
      <p className="rounded-lg bg-blue-50 text-blue-800 p-3 text-sm" role="status">
        {automation?.enabled
          ? 'Đồng bộ tự động mỗi phút, kể cả khi đóng app. Chỉ hiển thị tác vụ đang chờ, đang chạy hoặc cần xử lý lỗi.'
          : 'Lịch đồng bộ tự động chưa được bật trên máy chủ.'}
      </p>
      <p className="text-sm text-slate-600">
        Dữ liệu nghiệp vụ được lưu tại PostgreSQL. Google lỗi không làm mất bản
        ghi đã lưu.
      </p>
      <div className="rounded-lg bg-slate-50 p-3 space-y-2 text-sm">
        <p>
          {connection?.connected
            ? `Đã liên kết kho Google: ${connection.email}`
            : "Chưa liên kết kho Google của admin."}
        </p>
        {connection?.folderUrl && (
          <a
            className="text-indigo-700 underline mr-4"
            href={connection.folderUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mở RTG_SYSTEM
          </a>
        )}
        {connection?.spreadsheetUrl && (
          <a
            className="text-indigo-700 underline"
            href={connection.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mở báo cáo Sheets
          </a>
        )}
        <p>
          Đăng nhập Google và quyền lưu trữ là hai bước riêng. Chỉ admin kết nối
          kho; dữ liệu gốc vẫn ở PostgreSQL.
        </p>
        <button
          disabled={busy || !connection?.oauthAvailable}
          className="px-3 py-2 border rounded-lg disabled:opacity-50"
          onClick={() => {
            if (
              !confirm(
                "Kết nối tài khoản Google của admin để RTG tạo thư mục và file báo cáo?",
              )
            )
              return;
            void act(connectGoogleDriveStorage, "Đang mở trang cấp quyền Google…");
          }}
        >
          {connection?.connected
            ? "Kết nối lại Google Drive"
            : "Kết nối Google Drive"}
        </button>
        {connection?.oauthAppUrl && connection.oauthAppUrl !== location.origin && (
          <p>Kết nối kho Google sẽ mở website chính thức; hãy đăng nhập admin tại đó.</p>
        )}
        {connection && !connection.oauthAvailable && (
          <p>
            Quản trị triển khai cần cấu hình Google OAuth trên server trước.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-emerald-700 bg-emerald-50 p-3 rounded-lg"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg"
          onClick={() =>
            void act(
              () => api("/google/setup", { method: "POST" }),
              "Đã kiểm tra cấu trúc thư mục và tab báo cáo.",
            )
          }
        >
          Chuẩn bị Google
        </button>
        <button
          disabled={busy}
          className="px-3 py-2 border rounded-lg"
          onClick={() => {
            if (confirm("Đưa dữ liệu hiện tại vào hàng đợi báo cáo?"))
              void act(async () => {
                await api("/google/sync", { method: "POST", body: "{}" });
              }, "Đã xếp hàng báo cáo. Máy chủ sẽ tự động xử lý.");
          }}
        >
          Đồng bộ báo cáo
        </button>
        <button
          disabled={busy}
          className="px-3 py-2 border rounded-lg"
          onClick={() => {
            if (confirm("Tạo bản sao lưu dữ liệu lên Drive?"))
              void act(async () => {
                await api("/operations/backup", { method: "POST" });
              }, "Đã xếp hàng sao lưu. Máy chủ sẽ tự động xử lý.");
          }}
        >
          Backup
        </button>
        <button
          disabled={loading}
          className="px-3 py-2 border rounded-lg"
          onClick={() => void load()}
        >
          Làm mới
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="sync-module">Nhập từ báo cáo</label>
        <select
          id="sync-module"
          value={module}
          onChange={(e) => {
            setModule(e.target.value);
            setPreview(null);
          }}
          className="border rounded-lg p-2"
        >
          {[
            ["employees", "EMPLOYEES"],
            ["incidents", "VIOLATIONS"],
            ["bxxlRecords", "RANKINGS"],
            ["leaveRequests", "LEAVE"],
            ["shipProductivity", "SHIP_PRODUCTIVITY"],
            ["feedbacks", "FEEDBACK"],
            ["zaloMessages", "NOTIFICATIONS"],
            ["competencyEvents", "COMPETENCY_EVENTS"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="border rounded-lg p-2"
          onClick={() =>
            void act(
              async () =>
                setPreview(
                  await api("/google/import/preview", {
                    method: "POST",
                    body: JSON.stringify({ module }),
                  }),
                ),
              "Đã tạo bản xem trước. Chưa ghi dữ liệu nghiệp vụ.",
            )
          }
        >
          Preview
        </button>
      </div>
      {preview && (
        <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
          <strong>
            {preview.rows.length} bản ghi ·{" "}
            {preview.status === "success" ? "Đã nhập trước đó" : "Chờ xác nhận"}
          </strong>
          <div className="max-h-72 overflow-auto">
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(preview.rows, null, 2)}
            </pre>
          </div>
          <button
            disabled={busy || preview.status === "success"}
            className="bg-indigo-600 text-white rounded-lg px-3 py-2"
            onClick={() => {
              if (confirm("Xác nhận nhập đúng các bản ghi đang xem?"))
                void act(async () => {
                  await api("/google/import/" + preview.job_id + "/confirm", {
                    method: "POST",
                    body: JSON.stringify({ checksum: preview.checksum }),
                  });
                  setPreview(null);
                }, "Đã nhập dữ liệu vào PostgreSQL.");
            }}
          >
            Confirm Import
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Đang tải hàng đợi…</p>
      ) : jobs.length === 0 ? (
        <p className="text-slate-500 p-4">Không có tác vụ cần xử lý. Các mục đã thành công được ẩn; lịch sử vẫn được lưu.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <article key={j.job_id} className="border rounded-lg p-3 min-w-0">
              <div className="flex justify-between gap-2">
                <strong className="break-all">
                  {j.module} · {j.kind}
                </strong>
                <span
                  className={
                    j.status === "failed"
                      ? "text-red-700"
                      : "text-amber-700"
                  }
                >
                  {j.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 break-all">
                {j.record_id} · {formatDate(j.created_at, true)} · Lần thử{" "}
                {j.attempts}
              </p>
              {j.last_error && (
                <p className="text-sm text-red-600 mt-2">{j.last_error}</p>
              )}
              {j.status === 'failed' && j.next_attempt_at && (
                <p className="text-xs text-amber-700 mt-2">Tự thử lại lúc {formatDate(j.next_attempt_at, true)}.</p>
              )}
              {j.status === "failed" && (
                <button
                  disabled={busy}
                  className="mt-2 border rounded-lg px-3 py-1"
                  onClick={() =>
                    void act(async () => {
                      await api("/google/jobs/" + j.job_id + "/retry", {
                        method: "POST",
                      });
                    }, "Đã xếp hàng thử lại. Máy chủ sẽ tự động xử lý.")
                  }
                >
                  Retry Sync
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          disabled={page === 0 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <span>Trang {page + 1}</span>
        <button
          disabled={jobs.length < 50 || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
    </section>
  );
}
