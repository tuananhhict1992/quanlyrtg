import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/supabase";
import {
  runZaloBatch,
  type ZaloDraft,
  type ZaloPreview,
  type ZaloRecipient,
} from "../services/zaloNotifications";
import { formatDate } from "../utils/date";

export function ZaloNotificationComposer({
  draft,
  onClose,
  onComplete,
}: {
  draft: ZaloDraft;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const [title, setTitle] = useState(draft.title),
    [content, setContent] = useState(draft.content);
  const [type, setType] = useState(draft.recipientType || "INDIVIDUAL");
  const [department, setDepartment] = useState(draft.department || "");
  const [ids, setIds] = useState(draft.recipientIds || []);
  const [mode, setMode] = useState("INDIVIDUAL"),
    [scheduledAt, setScheduledAt] = useState("");
  const [audience, setAudience] = useState<ZaloRecipient[]>([]),
    [canBroadcast, setCanBroadcast] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<ZaloPreview | null>(null),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [completed, setCompleted] = useState(false);
  const pending = useRef(false),
    jobId = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    const query = draft.source
      ? "?" +
        new URLSearchParams({
          module: draft.source.module,
          recordId: draft.source.id,
        })
      : "";
    api<{ recipients: ZaloRecipient[]; canBroadcast: boolean }>(
      "/zalo/audience" + query,
    )
      .then((result) => {
        if (active) {
          setAudience(result.recipients);
          setCanBroadcast(result.canBroadcast);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draft]);
  const input = () => ({
    source: draft.source,
    title,
    content,
    recipientType: type,
    recipientIds: ids,
    department,
    deliveryMode: mode,
    scheduledAt: scheduledAt || undefined,
  });
  const edit = (fn: () => void) => {
    fn();
    setPreview(null);
    setError("");
  };
  const check = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setPreview(
        await api("/zalo/preview", {
          method: "POST",
          body: JSON.stringify(input()),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const send = async () => {
    if (!preview || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    let saved = false;
    try {
      const result = await api<{ jobId: string }>("/zalo/send", {
        method: "POST",
        body: JSON.stringify({
          ...input(),
          jobId: jobId.current,
          previewChecksum: preview.checksum,
        }),
      });
      saved = true;
      setCompleted(true);
      if (!scheduledAt)
        await runZaloBatch(result.jobId, (count) =>
          setNotice(`Đang xử lý người nhận ${count}… Giữ cửa sổ mở.`),
        );
      const resultState = await api<{ deliveries: { status: string }[] }>(
        `/zalo/notifications/${result.jobId}`,
      );
      const success = resultState.deliveries.filter(
        (d) => d.status === "success",
      ).length;
      const failed = resultState.deliveries.filter(
        (d) => d.status === "failed",
      ).length;
      const unknown = resultState.deliveries.filter(
        (d) => d.status === "unknown",
      ).length;
      setNotice(
        scheduledAt
          ? "Đã lưu lịch gửi. Worker cần hoạt động để phát tin đúng giờ."
          : `Zalo tiếp nhận ${success}/${resultState.deliveries.length} tin; lỗi ${failed}, chưa xác định ${unknown}. Xem nhật ký để xử lý những tin còn chờ.`,
      );
      onComplete?.();
    } catch (e) {
      setError(
        (saved
          ? "Thông báo đã lưu. Mở nhật ký để tiếp tục xử lý, không tạo lại. "
          : "") + (e as Error).message,
      );
      if (saved) onComplete?.();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const departments = [
    ...new Set(audience.map((e) => e.department).filter(Boolean)),
  ].sort();
  const filtered = audience.filter((e) =>
    `${e.name} ${e.department}`
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/50 p-3 sm:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Soạn thông báo Zalo"
    >
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between gap-4">
          <h2 className="text-xl font-bold">Thông báo Zalo</h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="border rounded-lg px-3 py-1 disabled:opacity-50"
          >
            Đóng
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Chọn người nhận và nội dung trước khi gửi. Thao tác nghiệp vụ đã lưu
          được giữ nguyên nếu Zalo lỗi.
        </p>
        {loading && <p role="status">Đang tải phạm vi được cấp quyền…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-800">
            {notice}
          </p>
        )}
        {!loading && !audience.length && (
          <p>Chưa có người nhận đang hoạt động trong phạm vi của bạn.</p>
        )}
        {!completed && (
          <fieldset
            disabled={busy || loading}
            className="space-y-4 disabled:opacity-70"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                Phạm vi nhận
                <select
                  aria-label="Phạm vi nhận"
                  value={type}
                  onChange={(e) =>
                    edit(() => {
                      setType(e.target.value as typeof type);
                      if (e.target.value === "INDIVIDUAL")
                        setMode("INDIVIDUAL");
                    })
                  }
                  className="mt-1 block w-full border rounded-lg p-2"
                >
                  <option value="INDIVIDUAL">Cá nhân</option>
                  <option value="DEPARTMENT">Ca RTG</option>
                  {canBroadcast && <option value="ALL">Tập thể RTG</option>}
                </select>
              </label>
              {type === "DEPARTMENT" && (
                <label className="text-sm font-medium">
                  Chọn Ca RTG
                  <select
                    aria-label="Chọn Ca RTG"
                    value={department}
                    onChange={(e) => edit(() => setDepartment(e.target.value))}
                    className="mt-1 block w-full border rounded-lg p-2"
                  >
                    <option value="">Chọn ca</option>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {type === "INDIVIDUAL" && (
              <div className="space-y-2">
                <input
                  aria-label="Tìm người nhận"
                  placeholder="Tìm họ tên, Ca RTG"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
                <div className="max-h-44 overflow-auto border rounded-lg p-2 space-y-2">
                  {filtered.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={ids.includes(e.id)}
                        onChange={(event) =>
                          edit(() =>
                            setIds((current) =>
                              event.target.checked
                                ? [...current, e.id]
                                : current.filter((id) => id !== e.id),
                            ),
                          )
                        }
                      />
                      <span>
                        {e.name} · {e.department}
                        {!e.linked && (
                          <span className="text-amber-700">
                            {" "}
                            · Chưa liên kết Zalo
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs">Đã chọn {ids.length} người nhận.</p>
              </div>
            )}
            {type !== "INDIVIDUAL" && (
              <label className="block text-sm font-medium">
                Cách gửi
                <select
                  value={mode}
                  onChange={(e) => edit(() => setMode(e.target.value))}
                  className="mt-1 block w-full border rounded-lg p-2"
                >
                  <option value="INDIVIDUAL">Gửi riêng từng thành viên</option>
                  <option value="GROUP">
                    Gửi một tin vào nhóm Zalo OA (GMF)
                  </option>
                </select>
              </label>
            )}
            <label className="block text-sm font-medium">
              Tiêu đề
              <input
                aria-label="Tiêu đề Zalo"
                value={title}
                maxLength={120}
                onChange={(e) => edit(() => setTitle(e.target.value))}
                className="mt-1 w-full border rounded-lg p-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Nội dung
              <textarea
                aria-label="Nội dung Zalo"
                value={content}
                maxLength={1700}
                onChange={(e) => edit(() => setContent(e.target.value))}
                rows={6}
                className="mt-1 w-full border rounded-lg p-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Hẹn giờ (giờ Việt Nam, để trống để gửi ngay)
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => edit(() => setScheduledAt(e.target.value))}
                className="mt-1 block w-full border rounded-lg p-2"
              />
            </label>
            <button
              type="button"
              onClick={check}
              className="rounded-lg border px-4 py-2 font-semibold"
            >
              {busy ? "Đang kiểm tra…" : "Xem trước thông báo"}
            </button>
          </fieldset>
        )}
        {preview && !completed && (
          <section
            className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3"
            aria-label="Xem trước Zalo"
          >
            <h3 className="font-semibold">Xác nhận nội dung và người nhận</h3>
            <p className="text-sm">
              {preview.recipients.length} nhân viên · {preview.deliveryCount}{" "}
              tin Zalo
              {preview.sendAt ? ` · ${formatDate(preview.sendAt, true)}` : ""}
            </p>
            <p className="text-xs max-h-24 overflow-auto">
              {preview.recipients.map((e) => e.name).join(", ")}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-sm">
              {preview.text}
            </p>
            {!preview.configured && (
              <p role="alert" className="text-amber-800">
                Chưa cấu hình Zalo OA trên server. Chưa có tin nào được gửi.
              </p>
            )}
            {!!preview.missing.length && (
              <p role="alert" className="text-amber-800">
                Chưa liên kết mã người nhận OA/nhóm GMF:{" "}
                {preview.missing.join(", ")}.
              </p>
            )}
            <p className="text-xs text-slate-600">
              Tin văn bản cá nhân tuân theo điều kiện tương tác của Zalo OA.
              Chọn nhóm chỉ dùng được với nhóm GMF của OA, không dùng nhóm Zalo
              cá nhân thông thường.
            </p>
            <button
              type="button"
              disabled={busy || !preview.configured || !!preview.missing.length}
              onClick={send}
              className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              {busy
                ? "Đang xử lý…"
                : scheduledAt
                  ? "Xác nhận lưu lịch gửi"
                  : "Xác nhận gửi Zalo"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
