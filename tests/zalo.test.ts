import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import {
  previewZalo,
  createZaloNotification,
  processZaloDelivery,
  zaloRouter,
} from "../backend/zalo-notifications";
import { sendZaloText } from "../backend/zalo-provider";

test("Zalo provider requires a confirmed message ID, uses OA UID/GMF and never fabricates success", async () => {
  process.env.ZALO_OA_ID = "test-oa";
  process.env.ZALO_OA_ACCESS_TOKEN = "test-token";
  const calls: any[] = [];
  const success: typeof fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({ error: 0, data: { message_id: "receipt" } }),
    );
  };
  assert.equal(
    (await sendZaloText("user", "oa-user-id", "Nội dung", success)).status,
    "success",
  );
  assert.equal(calls[0].url, "https://openapi.zalo.me/v3.0/oa/message/cs");
  assert.deepEqual(JSON.parse(calls[0].init.body).recipient, {
    user_id: "oa-user-id",
  });
  await sendZaloText("group", "gmf-group-id", "Nội dung", success);
  assert.equal(calls[1].url, "https://openapi.zalo.me/v3.0/oa/group/message");
  assert.deepEqual(JSON.parse(calls[1].init.body).recipient, {
    group_id: "gmf-group-id",
  });
  for (const body of [{ error: 0 }, {}, { data: { message_id: "receipt" } }]) {
    assert.equal(
      (
        await sendZaloText(
          "user",
          "uid",
          "text",
          async () => new Response(JSON.stringify(body)),
        )
      ).status,
      "unknown",
    );
  }
  assert.deepEqual(
    await sendZaloText(
      "user",
      "uid",
      "text",
      async () =>
        new Response(
          JSON.stringify({ error: -216, message: "private provider response" }),
        ),
    ),
    { status: "failed", errorCode: "zalo_-216" },
  );
  assert.equal(
    (
      await sendZaloText(
        "user",
        "uid",
        "text",
        async () => new Response("", { status: 503 }),
      )
    ).status,
    "unknown",
  );
  assert.equal(
    (
      await sendZaloText("user", "uid", "text", async () => {
        throw Error("network");
      })
    ).status,
    "unknown",
  );
  delete process.env.ZALO_OA_ACCESS_TOKEN;
  assert.equal(
    (await sendZaloText("user", "uid", "text", success)).errorCode,
    "not_configured",
  );
  assert.equal(calls.length, 2);
});

test("Zalo outbox: 76 unique recipients, scoped authority, stable retries, crash recovery, RLS and source retention", async () => {
  const db = await testDatabase(),
    savedConnect = pool.connect,
    savedQuery = pool.query;
  process.env.ZALO_OA_ID = "test-oa";
  process.env.ZALO_OA_ACCESS_TOKEN = "test-token";
  const query = async (sql: string, args: any[] = []) => {
    if (sql.includes("pg_try_advisory_lock"))
      return { rows: [{ acquired: true }] };
    if (sql.includes("pg_advisory_unlock")) return { rows: [] };
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  const admin = {
    id: "admin",
    fullName: "Quản trị",
    role: "ADMIN",
    status: "ACTIVE",
    department: "RTG ca 1",
  };
  const manager = {
    ...admin,
    id: "manager",
    role: "USER",
    assignedPermissions: ["MANAGE_VIOLATIONS", "MANAGE_QUIZ", "MANAGE_LEAVE"],
  };
  const ids = Array.from(
    { length: 76 },
    (_, i) => "employee-" + i.toString().padStart(2, "0"),
  );
  const record = async (module: string, id: string, data: any) =>
    db.query(
      "insert into private.records(module,id,data,owner_id,checksum) values($1,$2,$3,$2,'x')",
      [module, id, JSON.stringify({ id, ...data })],
    );
  const base: any = {
    source: { module: "quizzes", id: "quiz-1" },
    title: "Thông báo kiểm tra",
    content: "Mời làm bài kiểm tra.",
    recipientType: "INDIVIDUAL",
    recipientIds: ids,
  };
  const make = async (input: any = base, user: any = admin) => {
    const p = await previewZalo(pool, user, input);
    return createZaloNotification(user, {
      ...input,
      jobId: randomUUID(),
      previewChecksum: p.checksum,
    });
  };
  try {
    await record("employees", "admin", admin);
    await record("employees", "manager", manager);
    await record("quizzes", "quiz-1", { title: "Kiểm tra" });
    await record("incidents", "i1", {
      isRtgRelated: true,
      department: "RTG ca 1",
    });
    await record("incidents", "i2", {
      isRtgRelated: false,
      department: "Tổ đầu kéo",
    });
    for (const [i, id] of ids.entries()) {
      await record("employees", id, {
        fullName: id,
        status: "ACTIVE",
        department: i % 2 ? "RTG ca 2" : "RTG ca 1",
      });
      await db.query(
        "insert into private.zalo_targets(kind,local_key,oa_id,zalo_id,updated_by) values('user',$1,'test-oa',$2,'admin')",
        [id, "uid-" + id],
      );
    }
    await record("employees", "inactive", {
      fullName: "Inactive",
      status: "INACTIVE",
      department: "RTG ca 1",
    });
    await record("leaveRequests", "l1", {
      employeeId: ids[1],
      status: "PENDING",
    });
    await assert.rejects(
      previewZalo(pool, { ...manager, assignedPermissions: [] }, base),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      previewZalo(pool, manager, { ...base, recipientIds: [ids[1]] }),
      (e: any) => e.status === 400,
    );
    await assert.rejects(
      previewZalo(pool, manager, { ...base, recipientType: "ALL" }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      previewZalo(pool, admin, {
        ...base,
        source: { module: "incidents", id: "i2" },
      }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      previewZalo(pool, manager, {
        ...base,
        source: { module: "leaveRequests", id: "l1" },
      }),
      (e: any) => e.status === 403,
    );
    const scoped = await previewZalo(pool, manager, {
      ...base,
      recipientType: "DEPARTMENT",
      department: "RTG ca 1",
    });
    assert.equal(scoped.recipients.length, 40); // 38 employees + admin + manager
    assert(!scoped.recipients.some((e: any) => e.id === "inactive"));
    await assert.rejects(
      make({ ...base, recipientType: "ALL" }),
      (e: any) => e.status === 409,
    ); // unmapped admin/manager
    const preview = await previewZalo(pool, admin, base);
    const job = await createZaloNotification(admin, {
      ...base,
      jobId: randomUUID(),
      previewChecksum: preview.checksum,
    });
    const repeat = await createZaloNotification(admin, {
      ...base,
      jobId: job.jobId,
      previewChecksum: preview.checksum,
    });
    assert.equal(repeat.duplicate, true);
    assert.equal((await make(base)).jobId, job.jobId); // reopened composer cannot duplicate unchanged content
    assert.equal(
      (await db.query("select * from private.zalo_deliveries")).rows.length,
      76,
    );
    const sent: string[] = [];
    const provider = async (_kind: any, id: string) => {
      sent.push(id);
      return { status: "success" as const, messageId: "receipt-" + id };
    };
    while (await processZaloDelivery(job.jobId, provider)) {}
    assert.equal(sent.length, 76);
    assert.equal(new Set(sent).size, 76);
    assert.deepEqual(
      sent,
      ids.map((id) => "uid-" + id),
    );
    assert.equal(await processZaloDelivery(job.jobId, provider), false);

    const mixed = await make({
      ...base,
      content: "Thông báo tiếp theo",
      recipientIds: ids.slice(0, 3),
    });
    await processZaloDelivery(mixed.jobId, provider);
    await processZaloDelivery(mixed.jobId, async () => ({
      status: "failed",
      errorCode: "zalo_-216",
    }));
    await processZaloDelivery(mixed.jobId, async () => ({
      status: "unknown",
      errorCode: "connection_unconfirmed",
    }));
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = admin;
      next();
    });
    app.use(zaloRouter);
    app.use((e: any, _req: any, res: any, _next: any) =>
      res.status(e.status || 500).json({ error: e.message }),
    );
    await request(app)
      .post("/notifications/" + mixed.jobId + "/retry")
      .expect(200);
    const states = (
      await db.query<any>(
        "select status from private.zalo_deliveries where job_id=$1 order by id",
        [mixed.jobId],
      )
    ).rows.map((r) => r.status);
    assert.deepEqual(states, ["success", "pending", "unknown"]);
    await processZaloDelivery(mixed.jobId, provider);
    assert.equal(await processZaloDelivery(mixed.jobId, provider), false);
    assert.equal(sent.length, 78);
    const future = await make({
      ...base,
      content: "Hẹn giờ",
      recipientIds: [ids[0]],
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    assert.equal(await processZaloDelivery(future.jobId, provider), false);
    await request(app)
      .post("/notifications/" + future.jobId + "/cancel")
      .expect(200);
    assert.equal(
      (
        await db.query<any>(
          "select status from private.zalo_deliveries where job_id=$1",
          [future.jobId],
        )
      ).rows[0].status,
      "cancelled",
    );
    const interrupted = await make({
      ...base,
      content: "Sự cố gián đoạn",
      recipientIds: [ids[0]],
    });
    await db.query(
      "update private.zalo_deliveries set status='processing' where job_id=$1",
      [interrupted.jobId],
    );
    assert.equal(await processZaloDelivery(interrupted.jobId, provider), false);
    assert.equal(
      (
        await db.query<any>(
          "select status from private.zalo_deliveries where job_id=$1",
          [interrupted.jobId],
        )
      ).rows[0].status,
      "unknown",
    );
    const changed = await make(
      { ...base, content: "Quyền đã đổi", recipientIds: [ids[0]] },
      manager,
    );
    await db.query(
      "update private.records set data=data||'{\"assignedPermissions\":[]}'::jsonb where module='employees' and id='manager'",
    );
    await processZaloDelivery(changed.jobId, provider);
    assert.equal(
      (
        await db.query<any>(
          "select error_code from private.zalo_deliveries where job_id=$1",
          [changed.jobId],
        )
      ).rows[0].error_code,
      "permission_changed",
    );
    assert.equal(sent.length, 78);
    assert.equal(
      (await db.query("select * from private.records where module='quizzes'"))
        .rows.length,
      1,
    );
    await request(app)
      .put("/targets")
      .send({ kind: "group", localKey: ids[0], zaloId: "group123" })
      .expect(400);
    await request(app)
      .put("/targets")
      .send({ kind: "user", localKey: ids[1], zaloId: "uid-" + ids[0] })
      .expect(409);
    await db.exec("set role authenticated");
    for (const table of [
      "zalo_targets",
      "zalo_notifications",
      "zalo_deliveries",
    ])
      await assert.rejects(
        db.query("select * from private." + table),
        /permission denied/,
      );
    await db.exec("reset role");
  } finally {
    (pool as any).connect = savedConnect;
    (pool as any).query = savedQuery;
    delete process.env.ZALO_OA_ACCESS_TOKEN;
    delete process.env.ZALO_OA_ID;
    await db.close();
  }
});
