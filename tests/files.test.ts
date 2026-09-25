import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { findAccessibleArchive } from "../backend/files";

test("Archived files inherit current record visibility, including private feedback and deleted records", async () => {
  const db = await testDatabase(),
    savedQuery = pool.query;
  (pool as any).query = (sql: string, args: any[] = []) => db.query(sql, args);
  const owner = {
    id: "e1",
    role: "USER",
    status: "ACTIVE",
    assignedPermissions: [],
  };
  const other = { ...owner, id: "e2" };
  try {
    await db.query(
      "insert into private.records(module,id,owner_id,checksum,data) values('feedbacks','f1','e1','hash','{\"id\":\"f1\",\"status\":\"PENDING\"}')",
    );
    const job = "00000000-0000-4000-8000-000000000071";
    await db.query(
      "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive','feedbacks','f1','sha','{}','e1')",
      [job],
    );
    await db.query(
      "insert into private.file_metadata(job_id,drive_file_id,drive_url,file_name,mime_type,size,module,record_id,uploaded_by) values($1,'file-1','https://drive.google.com/file/d/file-1/view','image.png','image/png',12,'feedbacks','f1','e1')",
      [job],
    );
    assert.equal(
      (await findAccessibleArchive(owner, "file-1")).record_id,
      "f1",
    );
    await assert.rejects(
      findAccessibleArchive(other, "file-1"),
      (e: any) => e.status === 404,
    );
    await db.query(
      "update private.records set data=jsonb_set(data,'{status}','\"APPROVED\"') where id='f1'",
    );
    assert.equal(
      (await findAccessibleArchive(other, "file-1")).record_id,
      "f1",
    );
    await db.query("delete from private.records where id='f1'");
    await assert.rejects(
      findAccessibleArchive(owner, "file-1"),
      (e: any) => e.status === 404,
    );
  } finally {
    (pool as any).query = savedQuery;
    await db.close();
  }
});
