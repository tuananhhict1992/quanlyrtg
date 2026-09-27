import React, { useCallback, useEffect, useRef, useState } from "react";
import { Employee, ZaloMessage } from "../types";
import { api } from "../services/supabase";
import {
  canNotify,
  deliveryLabel,
  runZaloBatch,
  type ZaloDelivery,
  type ZaloDraft,
  type ZaloJob,
} from "../services/zaloNotifications";
import { ZaloNotificationComposer } from "./ZaloNotificationComposer";
import { formatDate } from "../utils/date";

type Props = {
  employees: Employee[];
  currentUser: Employee;
  messages: ZaloMessage[];
  onSendMessage: (msg: ZaloMessage) => void;
  onDeleteMessage?: (id: string) => void;
  onSendScheduledNow?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onOpenChat?: (id?: string) => void;
  prefilledRecipient?: Employee | null;
  onClearPrefilled?: () => void;
  onBackToDashboard?: () => void;
};
type Target = {
  kind: "user" | "group";
  local_key: string;
  zalo_id: string;
  oa_id: string;
};
const button =
  "rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40";

export function ZaloView({
  employees,
  currentUser,
  messages,
  onDeleteMessage,
  onSendScheduledNow,
  onMarkAsRead,
  prefilledRecipient,
  onClearPrefilled,
  onBackToDashboard,
}: Props) {
  const [draft, setDraft] = useState<ZaloDraft | null>(null),
    [jobs, setJobs] = useState<ZaloJob[]>([]);
  const [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<{
    job_id: string;
    content: string;
    deliveries: ZaloDelivery[];
  } | null>(null);
  const [config, setConfig] = useState<{
    configured: boolean;
    oaId: string;
    targets: Target[];
  } | null>(null);
  const [kind, setKind] = useState<"user" | "group">("user"),
    [localKey, setLocalKey] = useState(""),
    [zaloId, setZaloId] = useState("");
  const mounted = useRef(true),
    pending = useRef(false);
  const canConfigure = canNotify(currentUser, "MANAGE_PERMISSIONS");
  const canCompose = canNotify(currentUser, "MANAGE_ZALO");
  const load = useCallback(async () => {
    const result = await api<ZaloJob[]>("/zalo/notifications?page=" + page);
    if (mounted.current) setJobs(result);
  }, [page]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setLoading(true);
    setError("");
    load()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const timer = setInterval(() => {
      if (!pending.current) load().catch(() => {});
    }, 15000);
    return () => {
      active = false;
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (prefilledRecipient) {
      setDraft({
        title: "Thông báo RTG",
        content: "",
        recipientType: "INDIVIDUAL",
        recipientIds: [prefilledRecipient.id],
      });
      onClearPrefilled?.();
    }
  }, [prefilledRecipient, onClearPrefilled]);
  const action = async (fn: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const openDetail = async (id: string) =>
    setDetail(await api("/zalo/notifications/" + id));
  const process = (job: ZaloJob, retry = false) =>
    action(async () => {
      if (
        !window.confirm(
          retry
            ? "Gửi lại những tin Zalo đã báo thất bại? Tin đã tiếp nhận hoặc chưa xác định sẽ không gửi lại."
            : "Tiếp tục gửi các tin đang chờ của thông báo này?",
        )
      )
        return;
      if (retry)
        await api(`/zalo/notifications/${job.job_id}/retry`, {
          method: "POST",
        });
      await runZaloBatch(job.job_id, (n) => {
        if (mounted.current) setNotice(`Đang xử lý tin ${n}… Giữ trang mở.`);
      });
      await load();
      await openDetail(job.job_id);
      setNotice("Đã xử lý hàng đợi. Xem trạng thái từng người nhận bên dưới.");
    });
  const loadTargets = async () => setConfig(await api("/zalo/targets"));
  const groups = [
    ...new Set(employees.map((e) => e.department).filter(Boolean)),
  ].sort();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thông báo Zalo</h1>
          <p className="text-sm text-slate-600 mt-1">
            Cá nhân · Ca RTG · Tập thể RTG
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={onBackToDashboard}>
            Tổng quan
          </button>
          {canCompose && (
            <button
              className={button + " bg-blue-700 text-white"}
              onClick={() => setDraft({ title: "Thông báo RTG", content: "" })}
            >
              Soạn thông báo Zalo
            </button>
          )}
        </div>
      </header>
      {!canCompose && (
        <p className="text-sm">
          Soạn thông báo từ vụ việc, giao bài kiểm tra hoặc phiếu nghỉ phép
          thuộc quyền xử lý của bạn.
        </p>
      )}
      {error && (
        <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="bg-blue-50 text-blue-800 rounded-xl p-3">
          {notice}
        </p>
      )}
      <section className="space-y-3">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Nhật ký gửi Zalo</h2>
          <button
            disabled={busy}
            className={button}
            onClick={() => action(load)}
          >
            Tải lại
          </button>
        </div>
        {loading ? (
          <p role="status">Đang tải thông báo…</p>
        ) : (
          !jobs.length && (
            <p className="rounded-xl border bg-white p-5">
              Chưa có thông báo Zalo trong trang này.
            </p>
          )
        )}
        {jobs.map((job) => (
          <article
            key={job.job_id}
            className="rounded-xl border bg-white p-4 space-y-3 break-words"
          >
            <div>
              <h3 className="font-semibold">{job.title}</h3>
              <p className="text-xs text-slate-500">
                {formatDate(job.created_at, true)} ·{" "}
                {job.recipient_type === "ALL"
                  ? "Tập thể RTG"
                  : job.department || "Cá nhân"}
              </p>
            </div>
            <p className="text-sm">
              Zalo tiếp nhận: {job.success}/{job.total} · Chờ: {job.pending} ·
              Lỗi: {job.failed} · Chưa xác định: {job.unknown}
            </p>
            {job.cancelled_at ? (
              <p className="text-sm">Đã hủy các tin chưa gửi.</p>
            ) : (
              new Date(job.send_at).getTime() > Date.now() && (
                <p className="text-sm">
                  Hẹn giờ: {formatDate(job.send_at, true)} — cần worker hoạt
                  động.
                </p>
              )
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => action(() => openDetail(job.job_id))}
              >
                Chi tiết
              </button>
              {!!job.pending && !job.cancelled_at && (
                <>
                  <button
                    className={button}
                    disabled={
                      busy || new Date(job.send_at).getTime() > Date.now()
                    }
                    onClick={() => process(job)}
                  >
                    Tiếp tục gửi
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        if (
                          !window.confirm(
                            "Hủy các tin chưa gửi? Tin đã gửi hoặc đang gửi không thể thu hồi.",
                          )
                        )
                          return;
                        await api(`/zalo/notifications/${job.job_id}/cancel`, {
                          method: "POST",
                        });
                        await load();
                        setNotice("Đã hủy các tin chưa gửi.");
                      })
                    }
                  >
                    Hủy phần chưa gửi
                  </button>
                </>
              )}
              {!!job.failed && !job.cancelled_at && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => process(job, true)}
                >
                  Thử lại tin lỗi
                </button>
              )}
            </div>
          </article>
        ))}
        <div className="flex items-center justify-center gap-3">
          <button
            className={button}
            disabled={page === 0 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            className={button}
            disabled={jobs.length < 20 || busy}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </button>
        </div>
      </section>
      {detail && (
        <section
          aria-label="Kết quả từng người nhận"
          className="rounded-xl border bg-white p-4 space-y-3"
        >
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">Kết quả từng người nhận</h2>
            <button className={button} onClick={() => setDetail(null)}>
              Đóng chi tiết
            </button>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">
            {detail.content}
          </p>
          <p className="text-xs text-slate-600">
            “Zalo đã tiếp nhận” chưa xác nhận người nhận đã đọc. Tin “chưa xác
            định” cần đối chiếu trên OA; hệ thống không tự gửi lại để tránh
            trùng.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {detail.deliveries.map((d) => (
              <div
                className="border rounded-lg p-3 text-sm break-words"
                key={d.id}
              >
                <b>{d.recipient_label}</b>
                <p>{deliveryLabel[d.status] || d.status}</p>
                {d.error_code && (
                  <p className="text-red-700">Mã lỗi: {d.error_code}</p>
                )}
                <p className="text-xs text-slate-500">
                  Lần xử lý: {d.attempts}
                  {d.provider_message_id
                    ? " · Mã Zalo: " + d.provider_message_id
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {canConfigure && (
        <details
          className="rounded-xl border bg-white p-4"
          onToggle={(e) => {
            if (e.currentTarget.open && !config) void action(loadTargets);
          }}
        >
          <summary className="cursor-pointer font-semibold">
            Liên kết Zalo OA và người nhận
          </summary>
          <div className="mt-4 space-y-3 text-sm">
            {!config ? (
              <p>Đang tải cấu hình…</p>
            ) : (
              <p>
                {config.configured
                  ? "Server đã có cấu hình OA."
                  : "Chưa đủ cấu hình ZALO_OA_ID / ZALO_OA_ACCESS_TOKEN trên server."}{" "}
                OA: {config.oaId || "chưa cấu hình"}
              </p>
            )}
            <p>
              Mỗi nhân viên cần UID do OA cấp. Số điện thoại không phải UID.
              Nhóm phải là nhóm GMF do OA quản lý. Access token chỉ lưu trong
              Secrets của server.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  if (
                    !window.confirm(
                      "Xác nhận mã Zalo này đúng với nhân viên hoặc nhóm đã chọn?",
                    )
                  )
                    return;
                  await api("/zalo/targets", {
                    method: "PUT",
                    body: JSON.stringify({ kind, localKey, zaloId }),
                  });
                  await loadTargets();
                  setZaloId("");
                  setNotice("Đã lưu liên kết người nhận Zalo.");
                });
              }}
              className="grid sm:grid-cols-2 gap-3"
            >
              <label>
                Loại liên kết
                <select
                  className="block w-full border rounded-lg p-2"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as typeof kind);
                    setLocalKey("");
                  }}
                >
                  <option value="user">Nhân viên → UID</option>
                  <option value="group">Ca/Tập thể → Nhóm GMF</option>
                </select>
              </label>
              <label>
                Nhân viên / Nhóm
                <select
                  required
                  className="block w-full border rounded-lg p-2"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                >
                  <option value="">Chọn người nhận</option>
                  {kind === "user" ? (
                    employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} · {e.department}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="ALL">Tập thể RTG</option>
                      {groups.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </>
                  )}
                </select>
              </label>
              <label>
                Mã UID / Group ID
                <input
                  required
                  value={zaloId}
                  onChange={(e) => setZaloId(e.target.value.trim())}
                  className="block w-full border rounded-lg p-2"
                  autoComplete="off"
                />
              </label>
              <button className={button} disabled={busy || !config?.oaId}>
                Lưu liên kết
              </button>
            </form>
            {!!config?.targets.length && (
              <div className="max-h-56 overflow-auto space-y-2">
                {config.targets.map((t) => (
                  <p
                    key={t.kind + t.local_key}
                    className="break-all border rounded p-2"
                  >
                    {employees.find((e) => e.id === t.local_key)?.fullName ||
                      t.local_key}
                    : {t.zalo_id}
                    {t.oa_id !== config.oaId && " · OA cũ, cần liên kết lại"}
                  </p>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
      <details className="rounded-xl border bg-white p-4">
        <summary className="font-semibold cursor-pointer">
          Lịch sử thông báo trong ứng dụng ({messages.length})
        </summary>
        <p className="text-sm mt-3 text-slate-600">
          Thông báo cũ và thông báo giao bài được giữ lại. Các bản ghi này không
          xác nhận đã gửi qua Zalo.
        </p>
        {!messages.length && (
          <p className="mt-3">Chưa có lịch sử trong ứng dụng.</p>
        )}
        <div className="mt-3 max-h-96 overflow-auto space-y-3">
          {messages.map((msg) => (
            <article
              key={msg.id}
              className="border rounded-lg p-3 space-y-2 break-words"
            >
              <b>{msg.title}</b>
              <p className="text-xs">
                {msg.sentBy} ·{" "}
                {formatDate(
                  msg.sentAt.includes("T")
                    ? msg.sentAt
                    : msg.sentAt.replace(" ", "T") + "+07:00",
                  true,
                )}
              </p>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <div className="flex flex-wrap gap-2">
                {!msg.readByIds?.includes(currentUser.id) && (
                  <button
                    className={button}
                    onClick={() => onMarkAsRead?.(msg.id)}
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
                {canCompose && (
                  <button
                    className={button}
                    onClick={() => onSendScheduledNow?.(msg.id)}
                  >
                    Soạn lại qua Zalo
                  </button>
                )}
                {canCompose && (
                  <button
                    className={button}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Xóa bản ghi lịch sử này trong ứng dụng?",
                        )
                      )
                        onDeleteMessage?.(msg.id);
                    }}
                  >
                    Xóa lịch sử
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </details>
      {draft && (
        <ZaloNotificationComposer
          draft={draft}
          onClose={() => setDraft(null)}
          onComplete={() => {
            void action(load);
          }}
        />
      )}
    </div>
  );
}
