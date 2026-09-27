import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import {
  previewInternal,
  sendInternal,
} from "../backend/internal-notifications";
import { readScope } from "../backend/security";
import { scheduledMaintenance } from "../backend/scheduler";

test("Internal notifications persist once, reach only selected employees, enforce source permissions and dispatch schedules", async () => {
  const db = await testDatabase(),
    oldQuery = pool.query,
    oldConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  const admin = {
    id: "admin",
    fullName: "Quản trị",
    status: "ACTIVE",
    role: "ADMIN",
    department: "RTG ca 1",
  };
  const manager = {
    ...admin,
    id: "manager",
    role: "USER",
    assignedPermissions: ["MANAGE_LEAVE", "MANAGE_VIOLATIONS"],
  };
  const ids = Array.from({ length: 76 }, (_, i) => "e" + i);
  try {
    await db.query(
      `insert into private.records(module,id,data,owner_id,checksum)
      select 'employees',id,jsonb_build_object('id',id,'fullName',id,'status','ACTIVE','department','RTG ca 1'),id,'x' from unnest($1::text[]) id`,
      [ids],
    );
    await db.query(
      "insert into private.records(module,id,data,owner_id,checksum) values('incidents','i1','{\"isRtgRelated\":true,\"department\":\"RTG ca 1\"}','admin','x'),('leaveRequests','l1','{\"employeeId\":\"e0\",\"status\":\"APPROVED\"}','e0','x')",
    );
    const input: any = {
      title: "Thông báo nội bộ",
      content: "Nội dung điều hành",
      recipientType: "INDIVIDUAL",
      recipientIds: ids,
      jobId: "test-request",
    };
    const preview = await previewInternal(pool, admin, input);
    const saved = await sendInternal(admin, {
      ...input,
      previewChecksum: preview.checksum,
    });
    assert.equal(saved.channel, "IN_APP");
    assert.equal(saved.status, "DELIVERED");
    await sendInternal(admin, { ...input, previewChecksum: preview.checksum });
    assert.equal(
      (
        await db.query(
          "select * from private.records where module='zaloMessages'",
        )
      ).rows.length,
      1,
    );
    for (const id of [...ids, "outsider"]) {
      const scope = readScope(
        { id, role: "USER", status: "ACTIVE", department: "RTG ca 1" },
        "zaloMessages",
      );
      const visible = (
        await db.query(
          `select id from private.records where module=$1 and (${scope.clause})`,
          ["zaloMessages", ...scope.params],
        )
      ).rows;
      assert.equal(visible.length, id === "outsider" ? 0 : 1, id);
    }
    assert.equal(
      (
        await db.query(
          "select * from private.audit_log where action='notification.create'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select * from private.sync_queue where module='zaloMessages'",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      sendInternal(admin, { ...input, previewChecksum: "tampered" }),
      (e: any) => e.status === 409,
    );
    await assert.rejects(
      previewInternal(pool, manager, input),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      previewInternal(pool, manager, {
        ...input,
        source: { module: "incidents", id: "i1" },
        recipientType: "ALL",
      }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      previewInternal(
        pool,
        { ...manager, department: "RTG ca 2" },
        { ...input, source: { module: "leaveRequests", id: "l1" } },
      ),
      (e: any) => e.status === 403,
    );
    for (const source of [
      { module: "incidents", id: "i1" },
      { module: "leaveRequests", id: "l1" },
    ]) {
      const p = await previewInternal(pool, manager, {
        ...input,
        source,
        recipientIds: ["e0"],
      });
      const m = await sendInternal(manager, {
        ...input,
        source,
        recipientIds: ["e0"],
        jobId: source.id,
        previewChecksum: p.checksum,
      });
      assert.deepEqual(m.recipientIds, ["e0"]);
      assert.equal(m.source.module, source.module);
    }
    const schedule = {
      ...input,
      jobId: "scheduled",
      recipientIds: ["e0"],
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    };
    const p = await previewInternal(pool, admin, schedule);
    const scheduled = await sendInternal(admin, {
      ...schedule,
      previewChecksum: p.checksum,
    });
    await scheduledMaintenance(true);
    assert.equal(
      (
        await db.query<any>(
          "select data->>'status' as status from private.records where id=$1",
          [scheduled.id],
        )
      ).rows[0].status,
      "SCHEDULED",
    );
    await db.query(
      "update private.records set data=jsonb_set(data,'{scheduledAt}',to_jsonb((now()-interval '1 minute')::text)) where id=$1",
      [scheduled.id],
    );
    await scheduledMaintenance(true);
    await scheduledMaintenance(true);
    assert.equal(
      (
        await db.query<any>(
          "select data->>'status' as status from private.records where id=$1",
          [scheduled.id],
        )
      ).rows[0].status,
      "DELIVERED",
    );
    assert.equal(
      (
        await db.query(
          "select * from private.audit_log where action='notification.dispatch'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from private.zalo_deliveries")).rows.length,
      0,
    );
  } finally {
    (pool as any).query = oldQuery;
    (pool as any).connect = oldConnect;
    await db.close();
  }
});
