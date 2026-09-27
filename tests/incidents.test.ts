import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {testDatabase} from '../scripts/check-migrations';
import {pool} from '../backend/db';
import {confirmIncidents,discardIncidentDrafts} from '../backend/incidents';
import {recordsRouter,writeRecord} from '../backend/records';
import {operationsRouter} from '../backend/operations';
import * as XLSX from 'xlsx';
import {parseExcelViolationsFile} from '../src/services/violationParserService';

test('incident Excel extraction excludes other teams and normalizes the RTG employee name',()=>{
  const employee:any={id:'e1',fullName:'Phạm Ngọc Tuân',department:'RTG ca 1',employeeCode:'RTG1',position:'Lái cẩu RTG'};
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
    ['STT','Thời gian','Diễn biến vụ việc','Hậu quả','Nguyên nhân','Trách nhiệm','Đơn vị quản lý','Biện pháp xử lý','Phân loại'],
    [1,'27/09/2026','Phạm Ngọc Tuấn vận hành RTG 01','Sự cố','Thiếu quan sát','Phạm Ngọc Tuấn','Tổ RTG','Nhắc nhở','Sự cố'],
    [2,'27/09/2026','Phạm Ngọc Tuấn chứng kiến sự cố đầu kéo','Sự cố','Thiếu quan sát','Nhân viên khác','Tổ Đầu kéo','Nhắc nhở','Sự cố'],
  ]),'Phụ lục 1');
  const report=parseExcelViolationsFile(workbook,[employee]);
  assert.equal(report.items.length,1);assert.equal(report.items[0].violatorName,'Phạm Ngọc Tuân');
});

test('incident confirmation is atomic, idempotent, visible to permitted viewers, and drafts stay private',async()=>{
  const db=await testDatabase(), savedQuery=pool.query,savedConnect=pool.connect;
  const query=async(sql:string,args:any[]=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
  (pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
  const manager={id:'manager',status:'ACTIVE',role:'USER',assignedPermissions:['MANAGE_VIOLATIONS'],visibleTabs:['violations']};
  let viewer:any={id:'other',status:'ACTIVE',role:'USER',assignedPermissions:[],visibleTabs:['violations']};
  const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.user=viewer;next();});app.use(recordsRouter);app.use('/operations',operationsRouter);
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:e.message}));
  const employee={id:'e1',fullName:'Phạm Ngọc Tuân',employeeCode:'RTG1',department:'RTG ca 1',status:'ACTIVE',role:'USER',assignedPermissions:[],competencyScore:85,violationCount:0};
  const draft={id:'draft-1',code:'SC-1',time:'27/09/2026',location:'Bãi A',violatorName:'Phạm Ngọc Tuấn',matchedEmployeeId:'e1',isRtgRelated:true,severity:'THAP',what:'Kiểm thử',why:'Nguyên nhân',how:'Nhắc nhở'};
  try{
    await db.query("insert into private.records(module,id,data,owner_id,checksum) values('employees','e1',$1,'e1','seed'),('incidents','draft-1',$2,'manager','draft')",[JSON.stringify(employee),JSON.stringify(draft)]);
    assert.equal((await request(app).get('/records/incidents')).body.items.length,0);
    assert.equal((await request(app).post('/operations/incidents/confirm').send({items:[draft]})).status,403);
    assert.equal((await request(app).get('/operations/incidents/employees')).status,403);
    // Fail after personnel writes: the whole transaction must roll back.
    (pool as any).connect=async()=>({query:async(sql:string,args:any[])=>{if(sql.startsWith('insert into private.records')&&args?.[0]==='incidents')throw new Error('simulated save failure');return query(sql,args);},release(){}});
    await assert.rejects(confirmIncidents(manager,[draft]),/simulated/);
    assert.equal((await db.query<any>("select data from private.records where module='employees'")).rows[0].data.competencyScore,85);
    (pool as any).connect=async()=>({query,release(){}});
    const first=await confirmIncidents(manager,[draft]);assert.equal(first.count,1);assert.equal(first.items[0].violatorName,employee.fullName);
    const retry=await confirmIncidents(manager,[{...draft,id:'new-import-id'}]);assert.equal(retry.count,0);assert.equal(retry.items[0].id,first.items[0].id);
    const current=(await db.query<any>("select data from private.records where module='employees'")).rows[0].data;
    assert.equal(current.violationCount,1);assert.equal(current.competencyScore,80);assert.equal(current.violationRecords.length,1);assert.equal(current.role,'USER');
    assert.equal((await request(app).get('/records/incidents')).body.items.length,1);
    viewer={...viewer,visibleTabs:['settings']};assert.equal((await request(app).get('/records/incidents')).body.items.length,0);
    viewer=manager;
    const directory=(await request(app).get('/operations/incidents/employees')).body;
    assert.equal(directory[0].fullName,employee.fullName);assert.equal(directory[0].violationRecords,undefined);assert.equal(directory[0].role,undefined);
    await assert.rejects(discardIncidentDrafts(manager,[first.items[0].id]),(e:any)=>e.status===409);
    await db.query("insert into private.records(module,id,data,owner_id,checksum) values('incidents','draft-remove',$1,'manager','draft')",[JSON.stringify({...draft,id:'draft-remove',code:'SC-2'})]);
    await discardIncidentDrafts(manager,['draft-remove']);await discardIncidentDrafts(manager,['draft-remove']);
    await assert.rejects(writeRecord({query},manager,'incidents','draft-remove',{...draft,id:'draft-remove'}),(e:any)=>e.status===409);
    await assert.rejects(confirmIncidents(manager,[{...draft,id:'draft-remove',code:'SC-2'}]),(e:any)=>e.status===409);
    assert.equal((await request(app).get('/records/incidents/draft-remove')).status,404);
    assert.equal((await db.query<any>("select count(*)::int as n from private.sync_queue where record_id='draft-remove' and payload->>'deleted'='true'")).rows[0].n,1);
  }finally{(pool as any).query=savedQuery;(pool as any).connect=savedConnect;await db.close();}
});
