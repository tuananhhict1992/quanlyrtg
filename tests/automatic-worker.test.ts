import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pool } from '../backend/db';
import { testDatabase } from '../scripts/check-migrations';
import { consumeWorkerToken, listUnfinishedSyncJobs } from '../backend/automatic-worker';
import { isTabAllowed } from '../src/utils/permissionUtils';

test('scheduled worker rejects unknown, expired and replayed credentials; RLS protects intents', async () => {
  const db=await testDatabase(), saved=pool.query;
  (pool as any).query=(sql:string,args:any[]=[])=>db.query(sql,args);
  try {
    const token=randomBytes(32).toString('hex'), hash=createHash('sha256').update(token).digest('hex');
    await db.query("insert into private.worker_dispatches(token_hash,expires_at) values($1,now()+interval '5 minutes')",[hash]);
    await assert.rejects(()=>consumeWorkerToken('Bearer '+token),(e:any)=>e.status===401);
    await db.query('update private.worker_config set enabled=true');
    for(const header of [undefined,'Bearer invalid','Bearer '+randomBytes(32).toString('hex')])
      await assert.rejects(()=>consumeWorkerToken(header),(e:any)=>e.status===401);
    assert(await consumeWorkerToken('Bearer '+token));
    await assert.rejects(()=>consumeWorkerToken('Bearer '+token),(e:any)=>e.status===401);
    await db.query("update private.worker_dispatches set status='pending',claimed_at=null,expires_at=now()-interval '1 minute'");
    await assert.rejects(()=>consumeWorkerToken('Bearer '+token),(e:any)=>e.status===401);
    await db.exec('set role authenticated');
    for(const table of ['worker_config','worker_dispatches','initial_account_queue']) await assert.rejects(()=>db.query('select * from private.'+table));
    await assert.rejects(()=>db.query('select private.dispatch_worker()'));
    await db.exec('reset role');
  } finally {(pool as any).query=saved;await db.close();}
});

test('successful Google jobs are filtered before pagination; retries wait and stop after three',async()=>{
  const db=await testDatabase(),saved=pool.query;
  (pool as any).query=(sql:string,args:any[]=[])=>db.query(sql,args);
  try {
    const id=randomUUID();
    await db.query("insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by,status,next_attempt_at) values($1,'sheet','employees','e','hash','{}','admin','failed',now()+interval '1 minute')",[id]);
    await db.query("insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by,status) select gen_random_uuid(),'sheet','employees',x::text,'hash','{}','admin','success' from generate_series(1,60)x");
    assert.equal((await listUnfinishedSyncJobs(0)).length,1);
    assert.equal((await listUnfinishedSyncJobs(0))[0].job_id,id);
    assert.equal((await db.query('select * from private.claim_sync_job()')).rows.length,0);
    for(let retry=1;retry<=3;retry++) {
      await db.query("update private.sync_queue set status='failed',next_attempt_at=now()-interval '1 minute' where job_id=$1",[id]);
      assert.equal((await db.query<any>('select * from private.claim_sync_job()')).rows[0].retry_count,retry);
    }
    await db.query("update private.sync_queue set status='failed',next_attempt_at=now()-interval '1 minute' where job_id=$1",[id]);
    assert.equal((await db.query('select * from private.claim_sync_job()')).rows.length,0);
    assert.equal((await db.query<any>("select count(*)::int n from private.sync_queue where status='success'")).rows[0].n,60);
  }finally{(pool as any).query=saved;await db.close();}
});

test('granting Dashboard menu works without granting management or analytics permissions',()=>{
  const user:any={id:'u',role:'USER',status:'ACTIVE',visibleTabs:['dashboard','settings'],assignedPermissions:[]};
  assert.equal(isTabAllowed('dashboard',user),true);
  assert.equal(isTabAllowed('hr',user),false);
  assert.equal(isTabAllowed('permissions',user),false);
  assert.equal(isTabAllowed('dashboard',{...user,visibleTabs:['settings']}),false);
  assert.equal(isTabAllowed('dashboard',{...user,status:'LOCKED'}),false);
});
