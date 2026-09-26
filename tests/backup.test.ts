import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { operationsRouter } from "../backend/operations";

test("Backup stages a redacted snapshot with a UUID job and text record ID before any Drive access", async () => {
  const db = await testDatabase();
  const savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).connect = async () => ({ query, release() {} });
  const app = express();
  let role = "ADMIN";
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: "admin", role, status: "ACTIVE" };
    next();
  });
  app.use(operationsRouter);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  try {
    await db.query("insert into private.records(module,id,owner_id,checksum,data) values('employees','e1','e1','test',$1)", [
      JSON.stringify({ id: "e1", fullName: "Test employee", nested: { password: "must-not-export" } }),
    ]);
    const result = await request(app).post("/backup").send({});
    assert.equal(result.status, 202, JSON.stringify(result.body));
    const staged = (await db.query<any>(
      "select q.job_id,q.record_id,q.status,t.bytes,t.archived_at from private.sync_queue q join private.temporary_files t using(job_id) where q.job_id=$1",
      [result.body.job_id],
    )).rows[0];
    assert.equal(staged.record_id, staged.job_id);
    assert.equal(staged.status, "pending");
    assert.equal(staged.archived_at, null);
    const snapshot = JSON.parse(Buffer.from(staged.bytes).toString());
    assert.equal(snapshot.records[0].data.fullName, "Test employee");
    assert.equal(snapshot.records[0].data.nested.password, undefined);
    assert.equal((await db.query("select * from private.audit_log where action='backup'")).rows.length, 1);
    role = "USER";
    assert.equal((await request(app).post("/backup").send({})).status, 403);
    assert.equal((await db.query("select * from private.sync_queue where module='backup'")).rows.length, 1);
  } finally {
    (pool as any).connect = savedConnect;
    await db.close();
  }
});
