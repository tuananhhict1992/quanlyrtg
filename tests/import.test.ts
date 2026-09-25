import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { googleRouter } from "../backend/google-routes";
import { checksum } from "../backend/security";
import { parseReportRows } from "../backend/report-import";

test("Report preview uses the latest version and never resurrects deleted records", () => {
  const header = ["job_id", "record_id", "checksum", "snapshot_json"];
  const line = (value: any) => ["", value.id, "", JSON.stringify(value)];
  const rows = [
    header,
    line({ id: "deleted", name: "old" }),
    line({ id: "kept", name: "old" }),
    line({ id: "deleted", deleted: true }),
    line({ id: "kept", name: "latest", password: "excluded" }),
  ];
  assert.deepEqual(parseReportRows(rows), [{ id: "kept", name: "latest" }]);
  assert.throws(
    () => parseReportRows([header, ["", "", "", "{invalid"]]),
    /không hợp lệ/,
  );
  assert.throws(
    () =>
      parseReportRows([
        header,
        ...Array.from({ length: 10001 }, () => line({ id: "x" })),
      ]),
    /10.000/,
  );
});

test("A module manager can queue their own reports without gaining other module or global sync access", async () => {
  const savedConnect = pool.connect;
  (pool as any).connect = async () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    release() {},
  });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      id: "hr-manager",
      role: "USER",
      status: "ACTIVE",
      assignedPermissions: ["MANAGE_HR"],
    };
    next();
  });
  app.use(googleRouter);
  app.use((e: any, _req: any, res: any, _next: any) =>
    res.status(e.status || 500).json({ error: e.message }),
  );
  try {
    assert.equal(
      (await request(app).post("/sync").send({ module: "employees" })).status,
      202,
    );
    assert.equal(
      (await request(app).post("/sync").send({ module: "incidents" })).status,
      403,
    );
    assert.equal((await request(app).post("/sync").send({})).status, 403);
  } finally {
    (pool as any).connect = savedConnect;
  }
});
test("Google import requires the stored preview, exact checksum and owner; confirmation is idempotent", async () => {
  const db = await testDatabase(),
    savedQuery = pool.query,
    savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: "admin", role: "ADMIN", status: "ACTIVE" };
    next();
  });
  app.use(googleRouter);
  app.use((e: any, _req: any, res: any, _next: any) =>
    res.status(e.status || 500).json({ error: e.message }),
  );
  const id = "00000000-0000-4000-8000-000000000031",
    rows = [
      {
        id: "e1",
        employeeCode: "EMP1",
        role: "USER",
        status: "ACTIVE",
        fullName: "Nhân viên kiểm thử",
      },
    ],
    hash = checksum(rows);
  try {
    assert.equal(
      (
        await request(app)
          .post("/import/" + id + "/confirm")
          .send({ checksum: hash })
      ).status,
      404,
    );
    await db.query(
      "insert into private.import_previews(job_id,actor_id,module,checksum,rows) values($1,'admin','employees',$2,$3)",
      [id, hash, JSON.stringify(rows)],
    );
    assert.equal(
      (
        await request(app)
          .post("/import/" + id + "/confirm")
          .send({ checksum: "changed" })
      ).status,
      409,
    );
    assert.equal(
      (await db.query("select * from private.records")).rows.length,
      0,
    );
    const first = await request(app)
      .post("/import/" + id + "/confirm")
      .send({ checksum: hash, rows: [{ id: "attacker" }] });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(
      (await db.query<any>("select id from private.records")).rows[0].id,
      "e1",
    );
    const second = await request(app)
      .post("/import/" + id + "/confirm")
      .send({ checksum: hash });
    assert.equal(second.body.duplicate, true);
    assert.equal(
      (await db.query("select * from private.sync_queue")).rows.length,
      1,
    );
    await db.query(
      "update private.import_previews set actor_id='someone-else' where job_id=$1",
      [id],
    );
    assert.equal(
      (
        await request(app)
          .post("/import/" + id + "/confirm")
          .send({ checksum: hash })
      ).status,
      404,
    );
  } finally {
    (pool as any).query = savedQuery;
    (pool as any).connect = savedConnect;
    await db.close();
  }
});
