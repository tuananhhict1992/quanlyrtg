import { Router } from "express";
import { pool, transaction, HttpError, asyncRoute } from "./db";
import { assertPermission, checksum, hasPermission } from "./security";
import { audit, enqueue } from "./records";
import { sendZaloText, zaloConfiguration } from "./zalo-provider";

const SOURCE_PERMISSIONS: Record<string, string> = {
  incidents: "MANAGE_VIOLATIONS",
  quizzes: "MANAGE_QUIZ",
  leaveRequests: "MANAGE_LEAVE",
  feedbacks: "MANAGE_FEEDBACK",
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isAdmin = (user: any) =>
  user?.status === "ACTIVE" && user.role === "ADMIN";
export const mayUseZalo = (user: any) =>
  hasPermission(user, "MANAGE_ZALO") ||
  Object.values(SOURCE_PERMISSIONS).some((permission) =>
    hasPermission(user, permission),
  ) ||
  hasPermission(user, "CREATE_QUIZ");
const departmentsFor = (user: any): string[] | null => {
  if (isAdmin(user) || hasPermission(user, "SEND_BROADCAST_NOTIFICATION"))
    return null;
  return user.managedDepartments?.length
    ? user.managedDepartments
    : [user.department].filter(Boolean);
};
function assertDepartment(user: any, department?: string) {
  const allowed = departmentsFor(user);
  if (allowed && (!department || !allowed.includes(department)))
    throw new HttpError(
      403,
      "Bạn không được gửi thông báo ngoài Ca RTG được phân công.",
    );
}

export async function authorizeZaloSource(db: any, user: any, source?: any) {
  if (!source?.module && !source?.id) {
    assertPermission(user, "MANAGE_ZALO");
    return null;
  }
  if (
    !SOURCE_PERMISSIONS[source?.module] ||
    typeof source.id !== "string" ||
    source.id.length > 180
  )
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
      "Lưu dữ liệu nghiệp vụ thành công trước khi gửi thông báo.",
    );
  if (!(
    source.module === "quizzes" &&
    hasPermission(user, "CREATE_QUIZ") &&
    row.owner_id === user.id
  ))
    assertPermission(user, SOURCE_PERMISSIONS[source.module]);
  if (source.module === "incidents") {
    if (row.data.isRtgRelated !== true)
      throw new HttpError(403, "Chỉ gửi thông báo về vụ việc thuộc Tổ RTG.");
    assertDepartment(user, row.data.matchedDepartment || row.data.department);
  }
  if (source.module === "leaveRequests") {
    const employee = (
      await db.query(
        "select data from private.records where module='employees' and id=$1",
        [row.data.employeeId],
      )
    ).rows[0]?.data;
    assertDepartment(user, employee?.department);
  }
  return { module: source.module, id: source.id };
}

export async function zaloAudience(db: any, user: any, source?: any) {
  await authorizeZaloSource(db, user, source);
  const { oaId } = zaloConfiguration();
  const allowed = departmentsFor(user);
  return (
    await db.query(
      `select r.id,r.data->>'fullName' as name,r.data->>'department' as department,t.zalo_id as target_id
     from private.records r left join private.zalo_targets t on t.kind='user' and t.local_key=r.id and t.oa_id=$1
     where r.module='employees' and r.data->>'status'='ACTIVE'
       and ($2::text[] is null or r.data->>'department'=any($2::text[])) order by r.id`,
      [oaId, allowed],
    )
  ).rows;
}

export async function previewZalo(db: any, user: any, input: any) {
  const source = await authorizeZaloSource(db, user, input?.source);
  const title = String(input?.title || "").trim(),
    content = String(input?.content || "").trim();
  if (!title || title.length > 120 || !content || content.length > 1700)
    throw new HttpError(
      400,
      "Nhập tiêu đề (tối đa 120 ký tự) và nội dung (tối đa 1.700 ký tự).",
    );
  if (!["INDIVIDUAL", "DEPARTMENT", "ALL"].includes(input.recipientType))
    throw new HttpError(400, "Chọn cá nhân, Ca RTG hoặc tập thể.");
  if (input.recipientType === "ALL")
    assertPermission(user, "SEND_BROADCAST_NOTIFICATION");
  if (input.recipientType === "DEPARTMENT")
    assertDepartment(user, input.department);
  const audience = await zaloAudience(db, user, source);
  const ids = Array.isArray(input.recipientIds)
    ? [...new Set(input.recipientIds)]
    : [];
  const selected = audience.filter(
    (employee: any) =>
      input.recipientType === "ALL" ||
      (input.recipientType === "DEPARTMENT"
        ? employee.department === input.department
        : ids.includes(employee.id)),
  );
  if (
    !selected.length ||
    selected.length > 500 ||
    (input.recipientType === "INDIVIDUAL" && selected.length !== ids.length)
  )
    throw new HttpError(
      400,
      "Chọn 1–500 nhân viên đang hoạt động trong phạm vi được cấp quyền.",
    );
  const mode = input.deliveryMode || "INDIVIDUAL";
  if (
    !["INDIVIDUAL", "GROUP"].includes(mode) ||
    (mode === "GROUP" && input.recipientType === "INDIVIDUAL")
  )
    throw new HttpError(400, "Kiểu gửi không hợp lệ.");
  let sendAt: string | null = null;
  if (input.scheduledAt) {
    const date = String(input.scheduledAt);
    const stamp = Date.parse(
      /(Z|[+-]\d\d:\d\d)$/.test(date) ? date : date + "+07:00",
    );
    if (
      !Number.isFinite(stamp) ||
      stamp < Date.now() + 30000 ||
      stamp > Date.now() + 90 * 86400000
    )
      throw new HttpError(
        400,
        "Lịch gửi phải sau hiện tại ít nhất 30 giây và trong 90 ngày.",
      );
    sendAt = new Date(stamp).toISOString();
  }
  const { oaId, configured } = zaloConfiguration();
  const targets =
    mode === "GROUP"
      ? (
          await db.query(
            "select zalo_id from private.zalo_targets where kind='group' and local_key=$1 and oa_id=$2",
            [input.recipientType === "ALL" ? "ALL" : input.department, oaId],
          )
        ).rows
      : [];
  const deliveries =
    mode === "GROUP"
      ? [
          {
            kind: "group",
            key: input.recipientType === "ALL" ? "ALL" : input.department,
            label:
              input.recipientType === "ALL" ? "Tập thể RTG" : input.department,
            targetId: targets[0]?.zalo_id || null,
            recipientIds: selected.map((e: any) => e.id),
          },
        ]
      : selected.map((e: any) => ({
          kind: "user",
          key: e.id,
          label: e.name,
          targetId: e.target_id || null,
          recipientIds: [e.id],
        }));
  const text = `${title}\n\n${content}\n\nNgười gửi: ${user.fullName || user.id}`;
  if (text.length > 2000)
    throw new HttpError(400, "Nội dung gửi Zalo không được vượt 2.000 ký tự.");
  const normalized = {
    source,
    title,
    content,
    text,
    recipientType: input.recipientType,
    department: input.recipientType === "DEPARTMENT" ? input.department : null,
    mode,
    sendAt,
    oaId,
    deliveries,
  };
  return {
    ...normalized,
    checksum: checksum(normalized),
    configured,
    recipients: selected.map((e: any) => ({
      id: e.id,
      name: e.name,
      department: e.department,
      linked: Boolean(e.target_id),
    })),
    missing: deliveries
      .filter((d: any) => !d.targetId)
      .map((d: any) => d.label),
  };
}

export async function createZaloNotification(user: any, input: any) {
  if (!UUID.test(String(input?.jobId || "")))
    throw new HttpError(400, "Mã yêu cầu không hợp lệ.");
  return transaction(async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "zalo:" + input.jobId,
    ]);
    const old = (
      await db.query(
        "select checksum,requested_by from private.zalo_notifications where job_id=$1",
        [input.jobId],
      )
    ).rows[0];
    if (old) {
      if (
        old.requested_by !== user.id ||
        old.checksum !== input.previewChecksum
      )
        throw new HttpError(409, "Yêu cầu này đã được dùng cho nội dung khác.");
      return { jobId: input.jobId, duplicate: true };
    }
    const preview = await previewZalo(db, user, input);
    if (preview.checksum !== input.previewChecksum)
      throw new HttpError(
        409,
        "Dữ liệu người nhận hoặc nội dung đã đổi. Hãy xem trước lại.",
      );
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "zalo-content:" + user.id + ":" + preview.checksum,
    ]);
    const same = (
      await db.query(
        "select job_id from private.zalo_notifications where requested_by=$1 and checksum=$2",
        [user.id, preview.checksum],
      )
    ).rows[0];
    if (same) return { jobId: same.job_id, duplicate: true };
    if (!preview.configured)
      throw new HttpError(503, "Chưa cấu hình Zalo OA trên máy chủ.");
    if (preview.missing.length)
      throw new HttpError(409, "Còn người nhận/nhóm chưa liên kết mã Zalo OA.");
    await db.query(
      `insert into private.zalo_notifications(job_id,checksum,requested_by,source_module,source_record_id,recipient_type,department,title,content,send_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10::timestamptz,now()))`,
      [
        input.jobId,
        preview.checksum,
        user.id,
        preview.source?.module || null,
        preview.source?.id || null,
        preview.recipientType,
        preview.department,
        preview.title,
        preview.text,
        preview.sendAt,
      ],
    );
    await db.query(
      `insert into private.zalo_deliveries(job_id,target_kind,local_key,recipient_label,target_id,oa_id,recipient_ids)
       select $1,kind,key,label,"targetId",$3,"recipientIds" from jsonb_to_recordset($2::jsonb)
       as d(kind text,key text,label text,"targetId" text,"recipientIds" jsonb)`,
      [input.jobId, JSON.stringify(preview.deliveries), preview.oaId],
    );
    await audit(
      db,
      user.id,
      "zalo.notification.create",
      preview.source?.module,
      preview.source?.id,
      {
        job_id: input.jobId,
        checksum: preview.checksum,
        recipientCount: preview.recipients.length,
        deliveryCount: preview.deliveries.length,
      },
    );
    return { jobId: input.jobId, duplicate: false };
  });
}

async function assertJob(db: any, user: any, jobId: string) {
  if (!UUID.test(jobId)) throw new HttpError(400, "Mã yêu cầu không hợp lệ.");
  const row = (
    await db.query("select * from private.zalo_notifications where job_id=$1", [
      jobId,
    ])
  ).rows[0];
  if (!row || (!isAdmin(user) && row.requested_by !== user.id))
    throw new HttpError(404, "Không tìm thấy thông báo.");
  return row;
}

export async function processZaloDelivery(jobId?: string, send = sendZaloText) {
  const lock = await pool.connect();
  try {
    if (
      !(await lock.query("select pg_try_advisory_lock(726448) as acquired"))
        .rows[0].acquired
    )
      return false;
    // A previous process may have died after the HTTP send. Do not send it again automatically.
    await lock.query(
      "update private.zalo_deliveries set status='unknown',error_code='interrupted_unconfirmed',updated_at=now() where status='processing'",
    );
    const delivery = await transaction(async (db) => {
      const row = (
        await db.query(
          `select d.*,n.requested_by,n.source_module,n.source_record_id,n.recipient_type,n.department,n.content
         from private.zalo_deliveries d join private.zalo_notifications n using(job_id)
         where d.status='pending' and n.cancelled_at is null and n.send_at<=now()
           and ($1::uuid is null or d.job_id=$1) order by d.id for update of d skip locked limit 1`,
          [jobId || null],
        )
      ).rows[0];
      if (!row) return null;
      await db.query(
        "update private.zalo_deliveries set status='processing',attempts=attempts+1,started_at=now(),updated_at=now() where id=$1",
        [row.id],
      );
      return row;
    });
    if (!delivery) return false;
    let result: Awaited<ReturnType<typeof sendZaloText>>;
    try {
      const actor = (
        await lock.query(
          "select data from private.records where module='employees' and id=$1",
          [delivery.requested_by],
        )
      ).rows[0]?.data;
      await authorizeZaloSource(
        lock,
        actor,
        delivery.source_module
          ? { module: delivery.source_module, id: delivery.source_record_id }
          : null,
      );
      if (delivery.recipient_type === "ALL")
        assertPermission(actor, "SEND_BROADCAST_NOTIFICATION");
      const active = (
        await lock.query(
          "select data from private.records where module='employees' and id=any($1::text[]) and data->>'status'='ACTIVE'",
          [delivery.recipient_ids],
        )
      ).rows;
      if (active.length !== delivery.recipient_ids.length)
        throw new HttpError(409, "recipient_changed");
      for (const employee of active)
        assertDepartment(actor, employee.data.department);
      if (delivery.oa_id !== zaloConfiguration().oaId)
        throw new HttpError(409, "oa_changed");
      const mapping = (
        await lock.query(
          "select zalo_id from private.zalo_targets where kind=$1 and local_key=$2 and oa_id=$3",
          [delivery.target_kind, delivery.local_key, delivery.oa_id],
        )
      ).rows[0];
      if (mapping?.zalo_id !== delivery.target_id)
        throw new HttpError(409, "target_changed");
      result = await send(
        delivery.target_kind,
        delivery.target_id,
        delivery.content,
      );
    } catch (error) {
      result = {
        status: "failed",
        errorCode:
          error instanceof HttpError
            ? error.status === 403
              ? "permission_changed"
              : error.message
            : "validation_unavailable",
      };
    }
    await transaction(async (db) => {
      await db.query(
        "update private.zalo_deliveries set status=$2,provider_message_id=$3,error_code=$4,updated_at=now() where id=$1",
        [
          delivery.id,
          result.status,
          result.messageId || null,
          result.errorCode || null,
        ],
      );
      await audit(
        db,
        delivery.requested_by,
        "zalo.delivery." + result.status,
        delivery.source_module,
        delivery.source_record_id,
        {
          job_id: delivery.job_id,
          delivery_id: delivery.id,
          error_code: result.errorCode,
        },
      );
      await enqueue(
        db,
        "zaloMessages",
        `${delivery.job_id}:${delivery.id}`,
        {
          id: `${delivery.job_id}:${delivery.id}`,
          channel: "ZALO",
          job_id: delivery.job_id,
          recipientIds: delivery.recipient_ids,
          status: result.status,
          providerMessageId: result.messageId || null,
          title: delivery.content.split("\n")[0],
          updatedAt: new Date().toISOString(),
        },
        delivery.requested_by,
      );
    });
    return true;
  } finally {
    await lock.query("select pg_advisory_unlock(726448)");
    lock.release();
  }
}

export const zaloRouter = Router();
zaloRouter.use((req: any, _res, next) => {
  if (!mayUseZalo(req.user))
    return next(new HttpError(403, "Bạn chưa được cấp quyền thông báo Zalo."));
  next();
});
zaloRouter.get(
  "/audience",
  asyncRoute(async (req: any, res: any) => {
    const source = req.query.module
      ? { module: req.query.module, id: req.query.recordId }
      : null;
    const recipients = await zaloAudience(pool, req.user, source);
    res.json({
      ...zaloConfiguration(),
      canBroadcast: hasPermission(req.user, "SEND_BROADCAST_NOTIFICATION"),
      recipients: recipients.map((r: any) => ({
        id: r.id,
        name: r.name,
        department: r.department,
        linked: Boolean(r.target_id),
      })),
    });
  }),
);
zaloRouter.post(
  "/preview",
  asyncRoute(async (req: any, res: any) => {
    const { deliveries, ...preview } = await previewZalo(
      pool,
      req.user,
      req.body,
    );
    res.json({ ...preview, deliveryCount: deliveries.length });
  }),
);
zaloRouter.post(
  "/send",
  asyncRoute(async (req: any, res: any) =>
    res.status(202).json(await createZaloNotification(req.user, req.body)),
  ),
);
zaloRouter.get(
  "/notifications",
  asyncRoute(async (req: any, res: any) => {
    const page = Math.max(0, Number(req.query.page) || 0);
    res.json(
      (
        await pool.query(
          `select n.*,count(d.id)::int as total,
      count(d.id) filter(where d.status='success')::int as success,
      count(d.id) filter(where d.status='failed')::int as failed,
      count(d.id) filter(where d.status='unknown')::int as unknown,
      count(d.id) filter(where d.status in ('pending','processing'))::int as pending
     from private.zalo_notifications n left join private.zalo_deliveries d using(job_id)
     where ($1::boolean or n.requested_by=$2) group by n.job_id order by n.created_at desc,n.job_id limit 20 offset $3`,
          [isAdmin(req.user), req.user.id, page * 20],
        )
      ).rows,
    );
  }),
);
zaloRouter.get(
  "/notifications/:id",
  asyncRoute(async (req: any, res: any) => {
    const job = await assertJob(pool, req.user, req.params.id);
    res.json({
      ...job,
      deliveries: (
        await pool.query(
          "select id,recipient_label,status,attempts,provider_message_id,error_code from private.zalo_deliveries where job_id=$1 order by id",
          [job.job_id],
        )
      ).rows,
    });
  }),
);
zaloRouter.post(
  "/notifications/:id/process",
  asyncRoute(async (req: any, res: any) => {
    await assertJob(pool, req.user, req.params.id);
    res.json({ processed: await processZaloDelivery(req.params.id) });
  }),
);
zaloRouter.post(
  "/notifications/:id/retry",
  asyncRoute(async (req: any, res: any) => {
    await transaction(async (db) => {
      const job = await assertJob(db, req.user, req.params.id);
      if (job.cancelled_at) throw new HttpError(409, "Thông báo đã hủy.");
      await db.query(
        "update private.zalo_deliveries set status='pending',error_code=null,updated_at=now() where job_id=$1 and status='failed'",
        [job.job_id],
      );
      await audit(db, req.user.id, "zalo.retry", undefined, job.job_id);
    });
    res.json({ success: true });
  }),
);
zaloRouter.post(
  "/notifications/:id/cancel",
  asyncRoute(async (req: any, res: any) => {
    await transaction(async (db) => {
      const job = await assertJob(db, req.user, req.params.id);
      await db.query(
        "update private.zalo_notifications set cancelled_at=now() where job_id=$1",
        [job.job_id],
      );
      await db.query(
        "update private.zalo_deliveries set status='cancelled',updated_at=now() where job_id=$1 and status='pending'",
        [job.job_id],
      );
      await audit(db, req.user.id, "zalo.cancel", undefined, job.job_id);
    });
    res.json({ success: true });
  }),
);
zaloRouter.get(
  "/targets",
  asyncRoute(async (req: any, res: any) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    res.json({
      ...zaloConfiguration(),
      targets: (
        await pool.query(
          "select kind,local_key,zalo_id,oa_id from private.zalo_targets order by kind,local_key",
        )
      ).rows,
    });
  }),
);
zaloRouter.put(
  "/targets",
  asyncRoute(async (req: any, res: any) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const { kind, localKey, zaloId } = req.body;
    if (
      !["user", "group"].includes(kind) ||
      typeof localKey !== "string" ||
      !localKey ||
      localKey.length > 180 ||
      typeof zaloId !== "string" ||
      !/^[A-Za-z0-9_-]{5,100}$/.test(zaloId)
    )
      throw new HttpError(400, "Mã liên kết không hợp lệ.");
    const { oaId } = zaloConfiguration();
    if (!oaId)
      throw new HttpError(
        503,
        "Cấu hình ZALO_OA_ID trên server trước khi liên kết.",
      );
    await transaction(async (db) => {
      const rows = (
        await db.query(
          "select id from private.records where module='employees' and (($2='user' and id=$1) or ($2='group' and data->>'department'=$1)) limit 1",
          [localKey, kind],
        )
      ).rows;
      if (!rows.length && !(kind === "group" && localKey === "ALL"))
        throw new HttpError(400, "Nhân viên/Ca RTG không tồn tại.");
      if (
        kind === "user" &&
        !(
          await db.query(
            "select id from private.records where module='employees' and id=$1",
            [localKey],
          )
        ).rows.length
      )
        throw new HttpError(400, "Nhân viên không tồn tại.");
      try {
        await db.query(
          `insert into private.zalo_targets(kind,local_key,oa_id,zalo_id,updated_by) values($1,$2,$3,$4,$5)
        on conflict(kind,local_key) do update set oa_id=excluded.oa_id,zalo_id=excluded.zalo_id,updated_by=excluded.updated_by,updated_at=now()`,
          [kind, localKey, oaId, zaloId, req.user.id],
        );
      } catch (error: any) {
        if (error.code === "23505")
          throw new HttpError(
            409,
            "Mã Zalo này đã liên kết với người nhận khác.",
          );
        throw error;
      }
      await audit(db, req.user.id, "zalo.target.link", kind, localKey, {
        oa_id: oaId,
      });
    });
    res.json({ success: true });
  }),
);
