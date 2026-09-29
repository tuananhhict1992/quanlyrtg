import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {testDatabase} from '../scripts/check-migrations';
import {pool} from '../backend/db';
import {operationsRouter} from '../backend/operations';
import {recordsRouter} from '../backend/records';
import {googleRouter} from '../backend/google-routes';

test('dashboard exposes accurate aggregate counts for own shift without exposing personnel records',async()=>{
  const db=await testDatabase(),saved=pool.query;
  (pool as any).query=(sql:string,args:any[]=[])=>db.query(sql,args);
  let user:any={id:'u1',role:'USER',status:'ACTIVE',department:'RTG ca 1',visibleTabs:['dashboard'],assignedPermissions:[]};
  const app=express();app.use((req:any,_res,next)=>{req.user=user;next();});app.use('/operations',operationsRouter);app.use(recordsRouter);
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:e.message}));
  try {
    const employees=[user,{...user,id:'u2',department:' rtg CA 1 ',status:'PROBATION'}, {...user,id:'u3',department:'RTG ca 2'}, {...user,id:'u4',department:'RTG ca 2',status:'INACTIVE'}];
    for (const e of employees) await db.query("insert into private.records(module,id,data,owner_id,checksum) values('employees',$1,$2,$1,'seed')",[e.id,JSON.stringify({...e,fullName:'Tên riêng',email:'private@example.test'})]);
    const counts=await request(app).get('/operations/dashboard/headcount?department=RTG%20ca%202');
    assert.equal(counts.status,200);assert.equal(counts.headers['cache-control'],'no-store');
    assert.deepEqual(counts.body,{totalEmployees:4,activeEmployees:2,probationEmployees:1,shift:{name:'RTG ca 1',totalEmployees:2}});
    assert.equal(JSON.stringify(counts.body).includes('private@example.test'),false);
    const own=await request(app).get('/records/employees');assert.deepEqual(own.body.items.map((e:any)=>e.id),['u1']);
    await db.query("delete from private.records where module='employees' and id='u2'");
    assert.equal((await request(app).get('/operations/dashboard/headcount')).body.shift.totalEmployees,1);
    user={...user,department:''};assert.deepEqual((await request(app).get('/operations/dashboard/headcount')).body.shift,{name:null,totalEmployees:0});
    user={...user,visibleTabs:['settings']};assert.equal((await request(app).get('/operations/dashboard/headcount')).status,403);
    user={...user,role:'ADMIN',status:'INACTIVE'};assert.equal((await request(app).get('/operations/dashboard/headcount')).status,403);
  } finally {(pool as any).query=saved;await db.close();}
});

test('admin backup warning counts all pages, distinguishes unconfirmed sources, hides success and denies users',async()=>{
  const db=await testDatabase(),saved=pool.query;
  (pool as any).query=(sql:string,args:any[]=[])=>db.query(sql,args);
  let user:any={id:'admin',role:'ADMIN',status:'ACTIVE',assignedPermissions:[]};
  const app=express();app.use((req:any,_res,next)=>{req.user=user;next();});app.use(googleRouter);
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:e.message}));
  try {
    await db.query("insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by,status) select gen_random_uuid(),'sheet','employees',x::text,'hash','{}','admin','pending' from generate_series(1,55)x");
    const file=randomUUID();
    await db.query("insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive','incidents','import:test','hash',$2,'admin')",[file,JSON.stringify({fileName:'Bao-cao.xlsx',secret:'must-not-return'})]);
    await db.query("insert into private.temporary_files(job_id,bytes,processed_at) values($1,$2,now())",[file,new Uint8Array([1,2,3])]);
    const queue=await request(app).get('/jobs?includeSummary=true');assert.equal(queue.status,200);
    assert.equal(queue.body.items.length,50);assert.equal(queue.body.items[0].file_name,'Bao-cao.xlsx');assert.equal(queue.body.items[0].stage,'waiting_confirmation');
    assert.equal(JSON.stringify(queue.body).includes('must-not-return'),false);
    assert.deepEqual(queue.body.summary,{total:56,drive:1,sheet:55,waitingConfirmation:1,pending:55,processing:0,failed:0,needsAttention:0});
    assert.equal((await request(app).get('/jobs?page=1')).body.length,6);
    await db.query("update private.temporary_files set business_saved_at=now() where job_id=$1",[file]);
    assert.equal((await request(app).get('/jobs?includeSummary=true')).body.items[0].stage,'pending');
    await db.query("update private.sync_queue set status='success' where kind='sheet'");
    await db.query("update private.sync_queue set status='failed' where job_id=$1",[file]);
    const summary=(await request(app).get('/jobs/summary')).body;
    assert.equal(summary.total,1);assert.equal(summary.failed,1);assert.equal(summary.pending,0);
    user={...user,role:'USER',assignedPermissions:['MANAGE_PERMISSIONS']};
    assert.equal((await request(app).get('/jobs/summary')).status,403);
    assert.equal((await request(app).get('/jobs?includeSummary=true')).status,403);
    user={...user,role:'ADMIN',status:'INACTIVE'};assert.equal((await request(app).get('/jobs/summary')).status,403);
  } finally {(pool as any).query=saved;await db.close();}
});
