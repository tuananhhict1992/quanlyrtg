import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/supabase";
import type {
  InternalDraft,
  InternalPreview,
  InternalRecipient,
} from "../services/internalNotifications";
import type { ZaloMessage } from "../types";

export function InternalNotificationComposer({
  draft,
  onClose,
  onComplete,
}: {
  draft: InternalDraft;
  onClose: () => void;
  onComplete?: (message: ZaloMessage) => void;
}) {
  const [title, setTitle] = useState(draft.title),
    [content, setContent] = useState(draft.content);
  const [type, setType] = useState(draft.recipientType || "INDIVIDUAL"),
    [department, setDepartment] = useState(draft.department || "");
  const [ids, setIds] = useState(draft.recipientIds || []),
    [audience, setAudience] = useState<InternalRecipient[]>([]);
  const [canBroadcast, setCanBroadcast] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [complete, setComplete] = useState(false),
    [preview, setPreview] = useState<InternalPreview | null>(null);
  const [search, setSearch] = useState("");
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
    api<{ recipients: InternalRecipient[]; canBroadcast: boolean }>(
      "/internal-notifications/audience" + query,
    )
      .then((r) => {
        if (active) {
          setAudience(r.recipients);
          setCanBroadcast(r.canBroadcast);
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
    department,
    recipientIds: ids,
  });
  const edit = (change: () => void) => {
    change();
    jobId.current = crypto.randomUUID();
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
        await api("/internal-notifications/preview", {
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
    try {
      const message = await api<ZaloMessage>("/internal-notifications/send", {
        method: "POST",
        body: JSON.stringify({
          ...input(),
          jobId: jobId.current,
          previewChecksum: preview.checksum,
        }),
      });
      setComplete(true);
      onComplete?.(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const departments = [
    ...new Set(audience.map((e) => e.department).filter(Boolean)),
  ].sort();
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/50 overflow-y-auto p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Soạn thông báo nội bộ"
    >
      <div className="max-w-2xl mx-auto rounded-2xl bg-white shadow-xl p-4 sm:p-6 space-y-4">
        <div className="flex justify-between gap-3">
          <h2 className="text-xl font-bold">Thông báo nội bộ</h2>
          <button
            disabled={busy}
            onClick={onClose}
            className="border rounded-lg px-3 py-1"
          >
            Đóng
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Thông báo được gửi vào hộp thư trong ứng dụng của người nhận.
        </p>
        {loading && <p role="status">Đang tải phạm vi người nhận…</p>}
        {error && (
          <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">
            {error}
          </p>
        )}
        {complete ? (
          <p
            role="status"
            className="p-3 rounded-lg bg-emerald-50 text-emerald-800"
          >
            Đã gửi thông báo vào hộp thư nội bộ.
          </p>
        ) : (
          <fieldset
            disabled={busy || loading}
            className="space-y-4 disabled:opacity-60"
          >
            <label className="block text-sm font-medium">
              Phạm vi nhận
              <select
                aria-label="Phạm vi nhận"
                value={type}
                onChange={(e) =>
                  edit(() => setType(e.target.value as typeof type))
                }
                className="mt-1 block border rounded-lg p-2 w-full"
              >
                <option value="INDIVIDUAL">Cá nhân</option>
                <option value="DEPARTMENT">Ca RTG</option>
                {canBroadcast && <option value="ALL">Tập thể RTG</option>}
              </select>
            </label>
            {type === "DEPARTMENT" && (
              <label className="block text-sm">
                Ca RTG
                <select
                  aria-label="Ca RTG"
                  value={department}
                  onChange={(e) => edit(() => setDepartment(e.target.value))}
                  className="mt-1 block border rounded-lg p-2 w-full"
                >
                  <option value="">Chọn ca</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            )}
            {type === "INDIVIDUAL" && (
              <div className="space-y-2">
                <input
                  aria-label="Tìm người nhận"
                  placeholder="Tìm tên, Ca RTG"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
                <div className="max-h-44 overflow-auto border rounded-lg p-2 space-y-2">
                  {audience
                    .filter((e) =>
                      `${e.name} ${e.department}`
                        .toLocaleLowerCase("vi")
                        .includes(search.toLocaleLowerCase("vi")),
                    )
                    .map((e) => (
                      <label key={e.id} className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={ids.includes(e.id)}
                          onChange={(event) =>
                            edit(() =>
                              setIds((old) =>
                                event.target.checked
                                  ? [...old, e.id]
                                  : old.filter((id) => id !== e.id),
                              ),
                            )
                          }
                        />
                        {e.name} · {e.department}
                      </label>
                    ))}
                </div>
              </div>
            )}
            {!loading && !audience.length && (
              <p>Chưa có nhân viên trong phạm vi được cấp quyền.</p>
            )}
            <label className="block text-sm font-medium">
              Tiêu đề
              <input
                aria-label="Tiêu đề thông báo"
                value={title}
                maxLength={150}
                onChange={(e) => edit(() => setTitle(e.target.value))}
                className="mt-1 w-full border rounded-lg p-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Nội dung
              <textarea
                aria-label="Nội dung thông báo"
                value={content}
                maxLength={10000}
                rows={6}
                onChange={(e) => edit(() => setContent(e.target.value))}
                className="mt-1 w-full border rounded-lg p-2"
              />
            </label>
            <button onClick={check} className="border rounded-lg px-4 py-2">
              Xem trước thông báo
            </button>
            {preview && (
              <section
                aria-label="Xem trước thông báo"
                className="border bg-indigo-50 rounded-xl p-4 space-y-3"
              >
                <h3 className="font-semibold">{preview.title}</h3>
                <p className="text-sm">
                  {preview.recipients.length} người nhận:{" "}
                  {preview.recipients.map((e) => e.name).join(", ")}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {preview.content}
                </p>
                <button
                  onClick={send}
                  className="bg-indigo-700 text-white rounded-lg px-4 py-2"
                >
                  {busy ? "Đang gửi…" : "Xác nhận gửi vào app"}
                </button>
              </section>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
