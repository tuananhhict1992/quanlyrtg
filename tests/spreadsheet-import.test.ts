import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseSpreadsheet } from '../backend/spreadsheet-import';
import express from 'express';
import request from 'supertest';
import { pool } from '../backend/db';
import { testDatabase } from '../scripts/check-migrations';
import { operationsRouter } from '../backend/operations';

const rows=[['BLOCK','NOTIN_LOADLIST_FLG'],['A01','N'],['B02','Y']];
const book=()=> { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Data'); return wb; };
test('import accepts real XLSX, legacy XLS and CSV with browser MIME variants',async()=>{
  for(const [ext,mime] of [['xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['xlsx','application/octet-stream'],['xlsx',''],['xls','application/vnd.ms-excel'],['xls','application/octet-stream'],['csv','application/vnd.ms-excel'],['csv','text/csv; charset=utf-8']]) {
    const bytes=Buffer.from(XLSX.write(book(),{type:'buffer',bookType:ext as XLSX.BookType}));
    const parsed=await parseSpreadsheet(bytes,mime,'báo cáo.'+ext);
    assert.deepEqual(XLSX.utils.sheet_to_json(parsed.workbook.Sheets.Data || parsed.workbook.Sheets.Sheet1,{header:1}),rows);
    assert.equal(parsed.mimeType,ext==='csv'?'text/csv':ext==='xls'?'application/vnd.ms-excel':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  const parsed=await parseSpreadsheet(Buffer.from('\ufeffMã;BLOCK\n001;A1\n','utf16le'),'text/plain','report.csv');
  assert.equal(parsed.workbook.Sheets.Sheet1.A2.v,'001');
  const disguised=await parseSpreadsheet(Buffer.from(XLSX.write(book(),{type:'buffer',bookType:'xlsx'})),'application/vnd.ms-excel','port-export.xls');
  assert.equal(disguised.mimeType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.deepEqual(XLSX.utils.sheet_to_json(disguised.workbook.Sheets.Data,{header:1}),rows);
});
test('import rejects forged extensions, MIME mismatches, binary CSV and oversized sheets',async()=>{
  const bytes=Buffer.from(XLSX.write(book(),{type:'buffer',bookType:'xlsx'}));
  for(const [data,mime,name] of [[bytes,'image/png','report.xlsx'],[bytes,'text/csv','report.csv'],[Buffer.from('<html><script>bad()</script></html>'),'application/vnd.ms-excel','report.xls'],[Buffer.from('%PDF-1.7\n'),'application/octet-stream','report.xlsx'],[Buffer.from('A,B\n\x00\x01'),'text/csv','report.csv']] as const)
    await assert.rejects(()=>parseSpreadsheet(data,mime,name),(e:any)=>e.status===415);
  await assert.rejects(()=>parseSpreadsheet(Buffer.alloc(20*1024*1024+1),'text/csv','huge.csv'),(e:any)=>e.status===413);
  const large=XLSX.utils.book_new();XLSX.utils.book_append_sheet(large,XLSX.utils.aoa_to_sheet(Array.from({length:2001},()=>['A','B'])),'Large');
  await assert.rejects(()=>parseSpreadsheet(Buffer.from(XLSX.write(large,{type:'buffer',bookType:'xlsx'})),'application/octet-stream','many.xlsx'),(e:any)=>e.status===413);
});

test('multipart port export preview stores canonical MIME and retains source until confirmed and archived',async()=>{
  const db=await testDatabase(), savedConnect=pool.connect;
  (pool as any).connect=async()=>({query:(sql:string,args:any[]=[])=>db.query(sql,args),release(){}});
  let role='ADMIN';
  const app=express();
  app.use((req:any,_res,next)=>{req.user={id:'import-test',role,status:'ACTIVE'};next();});
  app.use(operationsRouter);
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:e.message}));
  try {
    const bytes=Buffer.from(XLSX.write(book(),{type:'buffer',bookType:'xlsx'}));
    const upload=()=>request(app).post('/excel/preview').field('module','shipProductivity').attach('file',bytes,{filename:'port-export.xls',contentType:'application/vnd.ms-excel'});
    const response=await upload();assert.equal(response.status,200,JSON.stringify(response.body));
    assert.deepEqual(XLSX.utils.sheet_to_json(response.body.workbook.Sheets.Data,{header:1}),rows);
    const staged=(await db.query<any>('select q.payload,q.status,t.bytes,t.business_saved_at,t.archived_at from private.sync_queue q join private.temporary_files t using(job_id) where q.job_id=$1',[response.body.source_job_id])).rows[0];
    assert.equal(staged.payload.mimeType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(staged.status,'pending');assert.equal(staged.business_saved_at,null);assert.equal(staged.archived_at,null);
    assert.deepEqual(Buffer.from(staged.bytes),bytes);
    role='USER';assert.equal((await upload()).status,403);
  }finally{(pool as any).connect=savedConnect;await db.close();}
});
