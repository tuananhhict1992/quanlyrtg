import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
const id = "00000000-0000-4000-8000-000000000001";
test("migrations, RLS, audit immutability, queue uniqueness and archive guard", async () => {
  const db = await testDatabase();
  try {
    const tables = await db.query<any>(
      "select tablename,rowsecurity from pg_tables where schemaname in ('private','public')",
    );
    assert(tables.rows.every((r) => r.rowsecurity));
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "insert into private.records(module,id,data,owner_id,checksum) values('employees','e1','{\"status\":\"ACTIVE\"}','e1','hash')",
    );
    await db.query(
      "insert into private.accounts(auth_user_id,employee_id) values($1,$2)",
      [id, "e1"],
    );
    await db.exec(
      "insert into public.record_changes(module) values('employees')",
    );
    await db.exec("set role anon");
    await assert.rejects(() => db.query("select * from private.records"));
    await assert.rejects(() => db.query("select * from public.record_changes"));
    await db.exec("reset role");
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    assert.equal(
      (await db.query("select * from public.record_changes")).rows.length,
      1,
    );
    await assert.rejects(() => db.query("select * from private.records"));
    await assert.rejects(() => db.query("select * from private.exam_attempts"));
    await assert.rejects(() =>
      db.query("insert into public.record_changes(module) values('employees')"),
    );
    await assert.rejects(() =>
      db.query("select * from private.claim_sync_job()"),
    );
    await db.exec("reset role");
    await db.exec(
      "update private.records set data='{\"status\":\"LOCKED\"}' where id='e1'",
    );
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.record_changes")).rows.length,
      0,
    );
    await db.exec("reset role");
    await db.query(
      "insert into private.audit_log(actor_id,action) values('e1','login')",
    );
    await assert.rejects(() => db.query("delete from private.audit_log"));
    await db.query(
      "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive','employees','e1','same','{}','e1')",
      [id],
    );
    await assert.rejects(() =>
      db.query(
        "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values('00000000-0000-4000-8000-000000000002','drive','employees','e1','same','{}','e1')",
      ),
    );
    assert.equal(
      (await db.query("select * from private.claim_sync_job()")).rows.length,
      0,
    );
    await db.query(
      "insert into private.temporary_files(job_id,bytes,processed_at,business_saved_at) values($1,$2,now(),now())",
      [id, new Uint8Array([1, 2])],
    );
    const claimed = await db.query<any>(
      "select * from private.claim_sync_job()",
    );
    assert.equal(claimed.rows[0].status, "processing");
    assert.equal(
      (await db.query("select * from private.claim_sync_job()")).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query("delete from private.temporary_files where job_id=$1", [id]),
    );
    await db.query(
      "insert into private.file_metadata(job_id,drive_file_id,drive_url,file_name,mime_type,size,module,record_id,uploaded_by) values($1,'drive-id','https://drive.google.com/file/d/drive-id/view','file.pdf','application/pdf',2,'employees','e1','e1')",
      [id],
    );
    await assert.rejects(() =>
      db.query("delete from private.temporary_files where job_id=$1", [id]),
    );
    await db.query(
      "update private.temporary_files set archived_at=now() where job_id=$1",
      [id],
    );
    await db.query("delete from private.temporary_files where job_id=$1", [id]);
    assert.equal(
      (await db.query("select * from private.temporary_files")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
