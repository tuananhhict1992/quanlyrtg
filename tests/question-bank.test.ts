import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {testDatabase} from '../scripts/check-migrations';
import {pool} from '../backend/db';
import {importQuestionBank} from '../backend/question-bank';
import {recordsRouter,writeRecord} from '../backend/records';
import {parseQuestionWorkbook,parseQuestionText} from '../src/utils/questionImport';

const question=(n:number)=>({id:'source-'+n,question:'Câu hỏi số '+n,options:[{id:'a',text:'Phương án A'},{id:'b',text:'Phương án B'}],correctOptionId:'b'});
test('all 386 questions across sheets and long numbered text are read without AI truncation',()=>{
  const book=XLSX.utils.book_new();
  for(const [sheet,start,count] of [['Phần 1',0,21],['Phần 2',21,365]] as const){
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Bộ câu hỏi kiểm thử'],['Câu hỏi','Lựa chọn A','Lựa chọn B','Đáp án đúng'],...Array.from({length:count},(_,i)=>[question(start+i).question,'Phương án A','Phương án B','B'])]),sheet);
  }
  const excel=parseQuestionWorkbook(book);
  assert.equal(excel.detected,386);assert.equal(excel.questions.length,386);assert.equal(new Set(excel.questions.map(q=>q.id)).size,386);
  assert.ok(excel.questions.every(q=>q.correctOptionId==='opt-b'));assert.equal(excel.issues.length,2);
  const text=Array.from({length:386},(_,i)=>`Câu ${i+1}: Quy trình kiểm thử thao tác cẩu khung số ${i+1}?\nA. Đáp án thứ nhất\nB. Đáp án thứ hai\nC. Đáp án thứ ba\nD. Đáp án thứ tư\nĐáp án đúng: B\nGiải thích: Diễn giải đầy đủ\n`).join('\n');
  assert.ok(text.length>30000);
  const parsed=parseQuestionText(text);
  assert.equal(parsed.detected,386);assert.equal(parsed.questions.length,386);assert.equal(parsed.issues.length,0);assert.equal(parsed.questions[385].correctOptionId,'opt-b');
});
test('invalid or missing answer is reported instead of silently choosing A',()=>{
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Câu hỏi','A','B','Đáp án đúng'],['Thiếu đáp án','Một','Hai',''],['Sai đáp án','Một','Hai','D'],['Thiếu lựa chọn','Một','','A'],['Nhiều đáp án','Một','Hai','A/B']]),'Test');
  const parsed=parseQuestionWorkbook(book);
  assert.equal(parsed.detected,4);assert.equal(parsed.questions.length,3);assert.equal(parsed.issues.length,4);assert.ok(parsed.questions.every(q=>!q.correctOptionId));
});
test('386-question import is atomic, retry safe, skips existing questions and folder deletion persists',async()=>{
  const db=await testDatabase(),originalQuery=pool.query,originalConnect=pool.connect;
  const query=async(sql:string,args:any[]=[])=>{const r=await db.query<Record<string,any>>(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
  (pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
  const admin={id:'admin',role:'ADMIN',status:'ACTIVE'};
  const folder={id:'folder',name:'Bộ câu hỏi'};
  let actor:any=admin;
  const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.user=actor;next();});app.use(recordsRouter);app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:e.message}));
  const input={job_id:randomUUID(),folderId:'folder',questions:Array.from({length:386},(_,i)=>question(i))};
  try{
    await writeRecord({query},admin,'questionFolders','folder',folder);
    await assert.rejects(importQuestionBank({id:'user',role:'USER',status:'ACTIVE'},input),(e:any)=>e.status===403);
    await assert.rejects(importQuestionBank(admin,{...input,questions:[question(0),{...question(1),correctOptionId:'missing'}]}),(e:any)=>e.status===400);
    assert.equal((await query("select count(*)::int as count from private.records where module='questionBank'")).rows[0].count,0);
    // Fail the receipt after the bulk insert; neither questions nor success may commit.
    (pool as any).connect=async()=>({query:async(sql:string,args:any[])=>{if(sql.startsWith('insert into private.audit_log'))throw new Error('receipt unavailable');return query(sql,args);},release(){}});
    await assert.rejects(importQuestionBank(admin,input),/receipt unavailable/);
    assert.equal((await query("select count(*)::int as count from private.records where module='questionBank'")).rows[0].count,0);
    (pool as any).connect=async()=>({query,release(){}});
    // A previous partial upload can be completed without duplicating its 21 rows.
    for(let i=0;i<21;i++)await writeRecord({query},admin,'questionBank','legacy-'+i,{...question(i),folderId:'folder'});
    const imported=await importQuestionBank(admin,input);
    assert.equal(imported.added,365);assert.equal(imported.skipped,21);assert.equal(imported.submitted,386);
    assert.deepEqual(await importQuestionBank(admin,input),imported);
    assert.equal((await importQuestionBank(admin,{...input,job_id:randomUUID()})).added,0);
    assert.equal((await query("select count(*)::int as count from private.records where module='questionBank'")).rows[0].count,386);
    await assert.rejects(importQuestionBank(admin,{...input,questions:[question(9)]}),(e:any)=>e.status===409);
    actor={id:'user',role:'USER',status:'ACTIVE'};
    assert.equal((await request(app).get('/records/questionBank')).body.items.length,0);
    assert.equal((await request(app).delete('/records/questionFolders/folder')).status,403);
    actor=admin;
    assert.equal((await request(app).delete('/records/questionFolders/folder')).status,200);
    assert.equal((await request(app).get('/records/questionFolders')).body.items.length,0);
    assert.equal((await query("select count(*)::int as count from private.records where module='questionBank' and data->>'folderId' is null")).rows[0].count,386);
    assert.equal((await request(app).put('/records/questionFolders/folder').send({data:folder})).status,409);
    assert.equal((await request(app).put('/records/questionBank/legacy-0').send({data:{...question(0),folderId:'folder'}})).status,409);
    assert.equal((await request(app).delete('/records/questionBank/legacy-0')).status,200);
    assert.equal((await request(app).put('/records/questionBank/legacy-0').send({data:question(0)})).status,409);
    assert.equal((await query("select count(*)::int as count from private.records where module='questionBank'")).rows[0].count,385);
  }finally{(pool as any).query=originalQuery;(pool as any).connect=originalConnect;await db.close();}
});
