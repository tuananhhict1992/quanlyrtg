import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { finalizeRanking } from "../backend/rankings";

test("Ranking finalization commits employees and report together and deduplicates retries", async () => {
  const db = await testDatabase(),
    savedQuery = pool.query,
    savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  const user = {
    id: "manager",
    fullName: "Quản lý",
    role: "USER",
    status: "ACTIVE",
    assignedPermissions: ["MANAGE_BXXL"],
  };
  const record = {
    id: "ranking-1",
    evaluationMonth: "09/2026",
    departmentName: "Đội Cơ giới",
    groupName: "Tổ RTG",
    createdDate: "25",
    createdMonth: "09",
    createdYear: "2026",
    listA: [{ employeeId: "e1" }],
    listB: [],
    listSmallB: [],
    listC: [],
    listGpt: [{ employeeId: "e1" }],
  };
  try {
    await db.query(
      'insert into private.records(module,id,owner_id,checksum,data) values(\'employees\',\'e1\',\'e1\',\'x\',\'{"id":"e1","role":"USER","status":"ACTIVE"}\'),(\'employees\',\'e2\',\'e2\',\'y\',\'{"id":"e2","role":"USER","status":"ACTIVE"}\')',
    );
    await assert.rejects(
      finalizeRanking(user, record, ["e1", "missing"]),
      (e: any) => e.status === 409,
    );
    assert.equal(
      (
        await db.query(
          "select * from private.records where module='bxxlRecords'",
        )
      ).rows.length,
      0,
    );
    const first = await finalizeRanking(user, record, ["e1", "e2"]);
    const before = (await db.query("select * from private.audit_log")).rows
      .length;
    const repeat = await finalizeRanking(
      user,
      { ...record, id: "new-client-id", createdAt: "later" },
      ["e2", "e1"],
    );
    assert.equal(repeat.duplicate, true);
    assert.equal(repeat.record.id, first.record.id);
    assert.equal(
      (await db.query("select * from private.audit_log")).rows.length,
      before,
    );
    const employees = (
      await db.query<any>(
        "select data from private.records where module='employees' order by id",
      )
    ).rows;
    assert.equal(employees[0].data.monthlyEvaluations[0].rating, "A");
    assert.equal(employees[0].data.monthlyEvaluations[0].isGpt, true);
    assert.equal(employees[1].data.monthlyEvaluations[0].rating, "a");
    assert.equal(employees[0].data.role, "USER");
    // Force failure after the report write to prove all changes roll back together.
    (pool as any).connect = async () => ({
      query: async (sql: string, args: any[]) => {
        if (
          sql.startsWith("insert into private.records") &&
          args?.[0] === "employees"
        )
          throw Error("simulated employee write failure");
        return query(sql, args);
      },
      release() {},
    });
    await assert.rejects(
      finalizeRanking(user, { ...record, generalNote: "new revision" }, [
        "e1",
        "e2",
      ]),
      /simulated/,
    );
    assert.equal(
      (
        await db.query<any>(
          "select data from private.records where module='bxxlRecords'",
        )
      ).rows[0].data.generalNote,
      undefined,
    );
  } finally {
    (pool as any).query = savedQuery;
    (pool as any).connect = savedConnect;
    await db.close();
  }
});
