import React, { useState } from "react";
import { api } from "../services/supabase";

export function GoogleReportActions({
  module,
  allowImport = true,
}: {
  module: string;
  allowImport?: boolean;
}) {
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 min-w-0" aria-label="Báo cáo Google">
      <p className="text-sm text-slate-600">
        Sử dụng bảng báo cáo RTG do quản trị viên cấu hình. Dữ liệu nghiệp vụ
        được lưu trong PostgreSQL; quản trị viên theo dõi kết quả và Retry tại
        Google Sync.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 text-red-700 p-3 break-words"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 text-emerald-800 p-3"
        >
          {notice}
        </p>
      )}
      {busy && <p role="status">Đang xử lý…</p>}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          className="rounded-xl bg-indigo-600 text-white px-4 py-2 disabled:opacity-50"
          onClick={() => {
            if (confirm("Đưa dữ liệu đã lưu vào hàng đợi báo cáo Google?"))
              void run(async () => {
                const result = await api("/google/sync", {
                  method: "POST",
                  body: JSON.stringify({ module }),
                });
                setNotice(result.message);
              });
          }}
        >
          Xếp hàng đồng bộ
        </button>
        {allowImport && (
          <button
            disabled={busy}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                setPreview(null);
                setPreview(
                  await api("/google/import/preview", {
                    method: "POST",
                    body: JSON.stringify({ module }),
                  }),
                );
                setNotice("Đã tạo bản xem trước. Chưa ghi dữ liệu nghiệp vụ.");
              })
            }
          >
            Preview Google Sheets
          </button>
        )}
      </div>
      {preview && (
        <div className="border rounded-xl p-3 space-y-3">
          <strong>
            {preview.rows.length} bản ghi ·{" "}
            {preview.status === "success" ? "Đã nhập trước đó" : "Chờ xác nhận"}
          </strong>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(preview.rows, null, 2)}
          </pre>
          <button
            disabled={busy || preview.status === "success"}
            className="rounded-xl bg-indigo-600 text-white px-4 py-2 disabled:opacity-50"
            onClick={() => {
              if (
                confirm(
                  "Xác nhận nhập đúng các bản ghi đang xem vào PostgreSQL?",
                )
              )
                void run(async () => {
                  await api("/google/import/" + preview.job_id + "/confirm", {
                    method: "POST",
                    body: JSON.stringify({ checksum: preview.checksum }),
                  });
                  setPreview(null);
                  setNotice("Đã nhập dữ liệu vào PostgreSQL.");
                });
            }}
          >
            Confirm Import
          </button>
        </div>
      )}
    </section>
  );
}

export function GoogleReportDialog({
  module,
  onClose,
  allowImport = true,
}: {
  module: string;
  onClose: () => void;
  allowImport?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lưu trữ và báo cáo Google"
        className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-auto space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-bold">Lưu trữ & báo cáo Google</h3>
          <button onClick={onClose} className="border rounded-lg px-3 py-2">
            Đóng
          </button>
        </div>
        <GoogleReportActions module={module} allowImport={allowImport} />
      </div>
    </div>
  );
}
