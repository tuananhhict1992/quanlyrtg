import { Router } from "express";
import { pool, transaction, HttpError, asyncRoute } from "./db";
import { assertPermission, hasPermission, checksum } from "./security";
import { audit, enqueue } from "./records";

const permissions: Record<string, string> = {
  incidents: "MANAGE_VIOLATIONS",
  quizzes: "MANAGE_QUIZ",
  leaveRequests: "MANAGE_LEAVE",
  feedbacks: "MANAGE_FEEDBACK",
};
const allowedDepartments = (user: any): string[] | null =>
  user.role === "ADMIN" || hasPermission(user, "SEND_BROADCAST_NOTIFICATION")
    ? null
    : user.managedDepartments?.length
      ? user.managedDepartments
      : [user.department].filter(Boolean);
export async function internalAudience(db: any, user: any, source?: any) {
  if (source) {
    if (!permissions[source.module] || typeof source.id !== "string")
      throw new HttpError(400, "Nguồn thông báo không hợp lệ.");
    const row = (
      await db.query(
        "select data,owner_id from private.records where module=$1 and id=$2",
        [source.module, source.id],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(
        404,
        "Lưu dữ liệu nghiệp vụ trước khi gửi thông báo.",
      );
    if (!(
      source.module === "quizzes" &&
      row.owner_id === user.id &&
      hasPermission(user, "CREATE_QUIZ")
    ))
      assertPermission(user, permissions[source.module]);
    let department: string | undefined;
    if (source.module === "incidents") {
      if (row.data.isRtgRelated !== true)
        throw new HttpError(403, "Chỉ thông báo vụ việc thuộc Tổ RTG.");
      department = row.data.matchedDepartment || row.data.department;
    }
    if (source.module === "leaveRequests")
      department = (
        await db.query(
          "select data->>'department' as department from private.records where module='employees' and id=$1",
          [row.data.employeeId],
        )
      ).rows[0]?.department;
    const allowed = allowedDepartments(user);
    if (
      ["incidents", "leaveRequests"].includes(source.module) &&
      allowed &&
      (!department || !allowed.includes(department))
    )
      throw new HttpError(403, "Ngoài Ca RTG được phân công.");
  } else assertPermission(user, "MANAGE_ZALO");
  return (
    await db.query(
      "select id,data->>'fullName' as name,data->>'department' as department from private.records where module='employees' and data->>'status'='ACTIVE' and ($1::text[] is null or data->>'department'=any($1::text[])) order by id",
      [allowedDepartments(user)],
    )
  ).rows;
}
export async function previewInternal(db: any, user: any, input: any) {
  const title = String(input?.title || "").trim(),
    content = String(input?.content || "").trim();
  if (!title || title.length > 150 || !content || content.length > 10000)
    throw new HttpError(
      400,
      "Nhập tiêu đề (tối đa 150 ký tự) và nội dung (tối đa 10.000 ký tự).",
    );
  if (!["ALL", "DEPARTMENT", "INDIVIDUAL"].includes(input.recipientType))
    throw new HttpError(400, "Chọn phạm vi người nhận.");
  if (input.recipientType === "ALL")
    assertPermission(user, "SEND_BROADCAST_NOTIFICATION");
  const audience = await internalAudience(db, user, input.source);
  const ids = Array.isArray(input.recipientIds)
    ? [...new Set(input.recipientIds)]
    : [];
  const recipients = audience.filter(
    (e: any) =>
      input.recipientType === "ALL" ||
      (input.recipientType === "DEPARTMENT"
        ? e.department === input.department
        : ids.includes(e.id)),
  );
  if (
    !recipients.length ||
    recipients.length > 500 ||
    (input.recipientType === "INDIVIDUAL" && recipients.length !== ids.length)
  )
    throw new HttpError(
      400,
      "Chọn nhân viên đang hoạt động trong phạm vi được cấp quyền.",
    );
  let scheduledAt: string | null = null;
  if (input.scheduledAt) {
    const date = String(input.scheduledAt).replace(" ", "T"),
      stamp = Date.parse(
        /(Z|[+-]\d\d:\d\d)$/.test(date) ? date : date + "+07:00",
      );
    if (!Number.isFinite(stamp) || stamp < Date.now() + 30000)
      throw new HttpError(400, "Chọn lịch gửi sau thời điểm hiện tại.");
    scheduledAt = new Date(stamp).toISOString();
  }
  const normalized = {
    source: input.source
      ? { module: input.source.module, id: input.source.id }
      : null,
    title,
    content,
    recipientType: input.recipientType,
    department: input.recipientType === "DEPARTMENT" ? input.department : null,
    recipients,
    scheduledAt,
    priority: input.priority === "URGENT" ? "URGENT" : "NORMAL",
  };
  return { ...normalized, checksum: checksum(normalized) };
}
export async function sendInternal(user: any, input: any) {
  if (typeof input?.jobId !== "string" || !/^[\w-]{1,150}$/.test(input.jobId))
    throw new HttpError(400, "Mã yêu cầu không hợp lệ.");
  return transaction(async (db) => {
    const id = "internal-" + input.jobId;
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      id,
    ]);
    const old = (
      await db.query(
        "select data,owner_id from private.records where module='zaloMessages' and id=$1",
        [id],
      )
    ).rows[0];
    if (old) {
      if (
        old.owner_id !== user.id ||
        old.data.jobChecksum !== input.previewChecksum
      )
        throw new HttpError(409, "Yêu cầu này đã được dùng cho nội dung khác.");
      return old.data;
    }
    const preview = await previewInternal(db, user, input);
    if (preview.checksum !== input.previewChecksum)
      throw new HttpError(
        409,
        "Nội dung hoặc người nhận đã đổi. Hãy xem trước lại.",
      );
    const data = {
      id,
      channel: "IN_APP",
      jobId: input.jobId,
      jobChecksum: preview.checksum,
      source: preview.source,
      title: preview.title,
      content: preview.content,
      recipientType: preview.recipientType,
      recipientIds: preview.recipients.map((e: any) => e.id),
      recipientNames: preview.recipients.map((e: any) => e.name),
      ...(preview.department ? { department: preview.department } : {}),
      type: preview.recipientType === "INDIVIDUAL" ? "INDIVIDUAL" : "BROADCAST",
      priority: preview.priority,
      status: preview.scheduledAt ? "SCHEDULED" : "DELIVERED",
      isScheduled: !!preview.scheduledAt,
      ...(preview.scheduledAt ? { scheduledAt: preview.scheduledAt } : {}),
      sentAt: new Date().toISOString(),
      sentBy: user.fullName,
      senderId: user.id,
      readByIds: [user.id],
    };
    await db.query(
      "insert into private.records(module,id,data,owner_id,checksum) values('zaloMessages',$1,$2,$3,$4)",
      [id, JSON.stringify(data), user.id, checksum(data)],
    );
    await audit(db, user.id, "notification.create", "zaloMessages", id, {
      channel: "IN_APP",
      recipientCount: preview.recipients.length,
    });
    await enqueue(db, "zaloMessages", id, data, user.id);
    await db.query(
      "insert into public.record_changes(module) values('zaloMessages')",
    );
    return data;
  });
}
export const internalNotificationsRouter = Router();
internalNotificationsRouter.get(
  "/audience",
  asyncRoute(async (req: any, res: any) => {
    const source = req.query.module
      ? { module: req.query.module, id: req.query.recordId }
      : undefined;
    res.json({
      canBroadcast: hasPermission(req.user, "SEND_BROADCAST_NOTIFICATION"),
      recipients: await internalAudience(pool, req.user, source),
    });
  }),
);
internalNotificationsRouter.post(
  "/preview",
  asyncRoute(async (req: any, res: any) =>
    res.json(await previewInternal(pool, req.user, req.body)),
  ),
);
internalNotificationsRouter.post(
  "/send",
  asyncRoute(async (req: any, res: any) =>
    res.status(201).json(await sendInternal(req.user, req.body)),
  ),
);
