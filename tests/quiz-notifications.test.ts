import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../scripts/check-migrations";
import { pool } from "../backend/db";
import { assignQuiz } from "../backend/quiz-notifications";
import { readScope } from "../backend/security";

test("76 quiz recipients see one notification each; retries preserve read state and failures roll back", async () => {
  const db = await testDatabase(), savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).connect = async () => ({ query, release() {} });
  const manager = { id: "manager", fullName: "Quản lý", role: "USER", status: "ACTIVE", assignedPermissions: ["MANAGE_QUIZ"] };
  const ids = Array.from({length:76}, (_, i) => `employee-${i}`);
  try {
    await db.query("insert into private.records(module,id,data,owner_id,checksum) values('quizzes','quiz-1',$1,'creator','x')", [JSON.stringify({id:'quiz-1',title:'Kiểm tra RTG'})]);
    await db.query(`insert into private.records(module,id,data,owner_id,checksum)
      select 'employees',id,jsonb_build_object('id',id,'fullName',id,'status','ACTIVE'),id,'x' from unnest($1::text[]) as id`, [ids]);
    await assert.rejects(assignQuiz({...manager,assignedPermissions:[]}, 'quiz-1', ids), (e:any) => e.status === 403);
    await assert.rejects(assignQuiz({...manager,assignedPermissions:['CREATE_QUIZ']}, 'quiz-1', ids), (e:any) => e.status === 403);
    await assert.rejects(assignQuiz(manager,'quiz-1',['']), (e:any) => e.status === 400);
    await assert.rejects(assignQuiz(manager,'quiz-1',[...ids,'missing']), (e:any) => e.status === 409);
    const first = await assignQuiz(manager, 'quiz-1', [...ids,ids[0]]);
    assert.equal(first.sentCount,76);
    assert.equal(first.recipientCount,76);
    for (const id of [...ids,'outsider']) {
      const scope = readScope({id,department:'RTG ca 1',role:'USER',status:'ACTIVE'}, 'zaloMessages');
      const visible = (await db.query<any>(`select data from private.records where module=$1 and (${scope.clause})`, ['zaloMessages',...scope.params])).rows;
      assert.equal(visible.length, id === 'outsider' ? 0 : 1, id);
      if (visible.length) assert.deepEqual(visible[0].data.recipientIds,[id]);
    }
    const messageId = first.messages[0].id;
    await db.query("update private.records set data=jsonb_set(data,'{readByIds}',$2) where module='zaloMessages' and id=$1", [messageId,JSON.stringify(first.messages[0].recipientIds)]);
    const repeat = await assignQuiz(manager,'quiz-1',ids.slice().reverse());
    assert.equal(repeat.sentCount,0);
    assert.equal(repeat.alreadyAssignedCount,76);
    assert.equal((await db.query("select * from private.audit_log where action='exam.assign'")).rows.length,1);
    assert.equal((await db.query("select * from private.sync_queue where module='zaloMessages'")).rows.length,76);
    assert.deepEqual((await db.query<any>("select data from private.records where module='zaloMessages' and id=$1",[messageId])).rows[0].data.readByIds,first.messages[0].recipientIds);
    await db.query("insert into private.records(module,id,data,owner_id,checksum) values('quizzes','quiz-2',$1,'creator','x')", [JSON.stringify({id:'quiz-2',title:'Bài thứ hai'})]);
    (pool as any).connect = async () => ({query:async (sql:string,args:any[]) => {
      if (sql.includes('insert into private.sync_queue')) throw Error('simulated queue failure');
      return query(sql,args);
    },release(){}});
    await assert.rejects(assignQuiz(manager,'quiz-2',ids), /simulated/);
    assert.equal((await db.query("select * from private.records where module='zaloMessages'")).rows.length,76);
    (pool as any).connect = async () => ({query,release(){}});
    const selected = await assignQuiz({...manager,id:'creator',assignedPermissions:['CREATE_QUIZ']},'quiz-2',[ids[1]]);
    assert.equal(selected.sentCount,1);
    assert.deepEqual(selected.messages[0].recipientIds,[ids[1]]);
  } finally {
    (pool as any).connect = savedConnect;
    await db.close();
  }
});
