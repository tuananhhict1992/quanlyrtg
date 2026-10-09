import { randomUUID } from 'node:crypto';
import { transaction, HttpError } from './db';
import { assertPermission, checksum } from './security';

const text = (value: unknown) => String(value ?? '').normalize('NFC').trim();
export function validateBankQuestion(input: any) {
  if (!input || !text(input.question) || text(input.question).length > 20000 || !Array.isArray(input.options) || input.options.length < 2 || input.options.length > 50 ||
    input.options.some((o:any)=>!o || !text(o.id) || !text(o.text) || text(o.text).length>10000) ||
    new Set(input.options.map((o:any)=>o.id)).size !== input.options.length)
    throw new HttpError(400,'Câu hỏi cần nội dung, ít nhất hai lựa chọn hợp lệ.');

  const correctIds: string[] = Array.isArray(input.correctOptionIds) && input.correctOptionIds.length > 0
    ? input.correctOptionIds.map((s: any) => text(s)).filter(Boolean)
    : typeof input.correctOptionId === 'string' && text(input.correctOptionId)
      ? text(input.correctOptionId).split(/[,;\s]+/).map((s: string) => text(s)).filter(Boolean)
      : [];

  if (!correctIds.length || !correctIds.every((cid: string) => input.options.some((o: any) => o.id === cid)))
    throw new HttpError(400,'Câu hỏi cần ít nhất một đáp án đúng hợp lệ nằm trong các lựa chọn.');

  return {
    question: text(input.question),
    options: input.options.map((o:any)=>({id:text(o.id),text:text(o.text)})),
    correctOptionId: text(input.correctOptionId) || correctIds.join(','),
    correctOptionIds: correctIds,
    questionType: correctIds.length > 1 ? 'MULTIPLE' : 'SINGLE',
    explanation: text(input.explanation),
    citation: text(input.citation)
  };
}
const identity = (q:any,folderId:string) => {
  const correct = (Array.isArray(q.correctOptionIds) && q.correctOptionIds.length
    ? q.correctOptionIds
    : (q.correctOptionId ? String(q.correctOptionId).split(/[,;\s]+/) : [])).map((s: string) => text(s)).filter(Boolean).sort();
  return checksum([folderId, text(q.question), q.options.map((o:any)=>text(o.text)), correct]);
};

// A single database transaction commits the complete reviewed import, including
// its receipt. Retrying the same job cannot partially save or duplicate questions.
export async function importQuestionBank(user:any,input:any) {
  assertPermission(user,'MANAGE_QUIZ');
  if(!/^[0-9a-f-]{36}$/i.test(input?.job_id || '') || !Array.isArray(input.questions) || !input.questions.length || input.questions.length>2000)
    throw new HttpError(400,'Chọn từ 1 đến 2.000 câu hỏi và xác nhận lại lần nhập.');
  const folderId=text(input.folderId);
  const questions=input.questions.map(validateBankQuestion), hash=checksum([folderId,questions]);
  return transaction(async db=>{
    await db.query("select pg_advisory_xact_lock(hashtextextended('question-bank',0))");
    const dedupeKey='question-import:'+user.id+':'+input.job_id;
    const receipt=(await db.query('select detail from private.audit_log where dedupe_key=$1',[dedupeKey])).rows[0]?.detail;
    if(receipt){if(receipt.checksum!==hash)throw new HttpError(409,'Nội dung lần nhập đã thay đổi. Hãy xác nhận bằng một lần nhập mới.');return receipt;}
    if(folderId && !(await db.query("select 1 from private.records where module='questionFolders' and id=$1",[folderId])).rows.length)
      throw new HttpError(409,'Thư mục đã bị xóa. Hãy chọn lại thư mục trước khi lưu.');
    const existing=(await db.query("select data from private.records where module='questionBank' and coalesce(data->>'folderId','')=$1",[folderId])).rows;
    const known=new Set(existing.filter(r=>Array.isArray(r.data.options)).map(r=>identity(r.data,folderId)));
    const added:any[]=[];
    for(const q of questions){const key=identity(q,folderId);if(known.has(key))continue;known.add(key);
      const data={...q,id:'q-'+randomUUID(),folderId:folderId || null};
      added.push({id:data.id,data,checksum:checksum(data)});
    }
    if(added.length) await db.query(`insert into private.records(module,id,data,owner_id,checksum)
      select 'questionBank',x.id,x.data,$2,x.checksum from jsonb_to_recordset($1::jsonb) as x(id text,data jsonb,checksum text)`,[JSON.stringify(added),user.id]);
    const result={job_id:input.job_id,checksum:hash,status:'success',submitted:questions.length,added:added.length,skipped:questions.length-added.length};
    await db.query("insert into private.audit_log(actor_id,action,module,record_id,detail,dedupe_key) values($1,'questionBank.import','questionBank',$2,$3,$4)",[user.id,input.job_id,JSON.stringify(result),dedupeKey]);
    if(added.length)await db.query("insert into public.record_changes(module) values('questionBank')");
    return result;
  });
}
