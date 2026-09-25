import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { processNextJob } from "../backend/worker";
test("ambiguous Drive upload retains original bytes; retry reuses file ID and only then deletes temporary bytes", async () => {
  const db = await testDatabase();
  const savedQuery = pool.query,
    savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    if (sql.includes("pg_try_advisory_lock"))
      return { rows: [{ acquired: true }] };
    if (sql.includes("pg_advisory_unlock")) return { rows: [] };
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  (pool as any).query = query;
  (pool as any).connect = async () => ({ query, release() {} });
  const id = "00000000-0000-4000-8000-000000000021";
  let reserveCount = 0,
    uploadCalls = 0;
  const ids: string[] = [];
  const adapters: any = {
    ensureStructure: async () => ({ "01_NHAN_SU": "folder" }),
    ensureSheetRows: async () => {},
    spreadsheetId: () => "sheet",
    googleClients: () => ({
      sheets: { spreadsheets: { values: { update: async () => ({}) } } },
    }),
    reserveDriveId: async () => {
      reserveCount++;
      return "reserved-id";
    },
    archiveToDrive: async (id: string) => {
      ids.push(id);
      uploadCalls++;
      if (uploadCalls === 1)
        throw new Error("Upload completed remotely but response was lost");
      return {
        id,
        webViewLink: "https://drive.google.com/file/d/" + id + "/view",
      };
    },
  };
  try {
    await db.query(
      "insert into private.records(module,id,data,owner_id,checksum) values('employees','e1','{\"id\":\"e1\"}','e1','business')",
    );
    await db.query(
      "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive','employees','e1','file-checksum','{\"fileName\":\"f.pdf\",\"mimeType\":\"application/pdf\",\"size\":2}','e1')",
      [id],
    );
    await db.query(
      "insert into private.temporary_files(job_id,bytes,processed_at,business_saved_at) values($1,$2,now(),now())",
      [id, new Uint8Array([1, 2])],
    );
    await processNextJob(adapters);
    assert.equal(
      (await db.query<any>("select status from private.sync_queue")).rows[0]
        .status,
      "failed",
    );
    assert.equal(
      (await db.query("select * from private.temporary_files")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from private.records")).rows.length,
      1,
    );
    await db.query(
      "update private.sync_queue set status='pending' where job_id=$1",
      [id],
    );
    await processNextJob(adapters);
    assert.equal(
      (await db.query<any>("select status from private.sync_queue")).rows[0]
        .status,
      "success",
    );
    assert.equal(
      (await db.query("select * from private.temporary_files")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from private.file_metadata")).rows.length,
      1,
    );
    assert.equal(reserveCount, 1);
    assert.deepEqual(ids, ["reserved-id", "reserved-id"]);
  } finally {
    (pool as any).query = savedQuery;
    (pool as any).connect = savedConnect;
    await db.close();
  }
});
