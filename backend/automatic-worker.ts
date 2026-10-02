import { createHash } from 'node:crypto';
import { pool, HttpError } from './db';
import { setEmployeePassword } from './accounts';
import { processNextJob } from './worker';

export async function consumeWorkerToken(authorization: string | undefined) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization || '')?.[1];
  if (!token) throw new HttpError(401, 'Worker authorization required.');
  const hash = createHash('sha256').update(token).digest('hex');
  const row = (await pool.query(`update private.worker_dispatches set claimed_at=now(),status='processing'
    where token_hash=$1 and status='pending' and claimed_at is null and expires_at>now()
    and exists(select 1 from private.worker_config where enabled)
    returning id`, [hash])).rows[0];
  if (!row) throw new HttpError(401, 'Worker authorization invalid or expired.');
  return row.id as string;
}

export async function processInitialAccount() {
  const lock = await pool.connect();
  try {
    if (!(await lock.query('select pg_try_advisory_lock(726450) as acquired')).rows[0].acquired) return false;
    const task = (await lock.query(`select q.*,r.data as employee,a.data as actor from private.initial_account_queue q
      left join private.records r on r.module='employees' and r.id=q.employee_id
      left join private.records a on a.module='employees' and a.id=q.actor_id
      where q.status in ('pending','processing') order by q.created_at,q.employee_id limit 1`)).rows[0];
    if (!task) return false;
    await lock.query("update private.initial_account_queue set status='processing',updated_at=now() where job_id=$1", [task.job_id]);
    try {
      await setEmployeePassword(task.actor, task.employee_id, {
        job_id: task.job_id, username: task.employee?.username, password: '123456',
      }, undefined, true);
      await lock.query("update private.initial_account_queue set status='success',last_error=null,updated_at=now() where job_id=$1", [task.job_id]);
    } catch {
      await lock.query("update private.initial_account_queue set status='failed',last_error='Chưa cấp được tài khoản; kiểm tra hồ sơ và cấu hình Auth.',updated_at=now() where job_id=$1", [task.job_id]);
    }
    return true;
  } finally {
    await lock.query('select pg_advisory_unlock(726450)');
    lock.release();
  }
}

// Keep the request alive while working: request-based Cloud Run can suspend idle CPU.
export async function runAutomaticWorker(authorization: string | undefined) {
  const id = await consumeWorkerToken(authorization);
  let processed = 0;
  const deadline = Date.now() + 45000;
  try {
    // Both queues are bounded; account batches cannot reset already-linked credentials.
    for (let count = 0; count < 12 && Date.now() < deadline - 20000; count++) {
      if (!await processInitialAccount()) break;
      processed++;
    }
    for (let count = 0; count < 8 && Date.now() < deadline; count++) {
      if (!await processNextJob()) break;
      processed++;
    }
    await pool.query("update private.worker_dispatches set status='success',processed=$2,finished_at=now() where id=$1", [id,processed]);
    return { processed };
  } catch {
    await pool.query("update private.worker_dispatches set status='failed',processed=$2,finished_at=now() where id=$1", [id,processed]);
    throw new HttpError(503, 'Worker chưa hoàn thành; dữ liệu hàng đợi được giữ lại.');
  }
}

export async function listUnfinishedSyncJobs(pageInput: unknown) {
  const page = Math.min(100000, Math.max(0, Math.floor(Number(pageInput) || 0)));
  return (await pool.query(`select q.job_id,q.kind,q.module,q.record_id,q.status,q.attempts,q.last_error,q.created_at,q.next_attempt_at,
    q.payload->>'fileName' as file_name, ${syncStageSql} as stage
    from private.sync_queue q left join private.temporary_files t on t.job_id=q.job_id
    where q.status<>'success' order by q.sequence desc limit 50 offset $1`, [page*50])).rows;
}

const syncStageSql = `case
  when q.status<>'pending' then q.status
  when q.kind='drive' and t.job_id is null then 'missing_file'
  when q.kind='drive' and t.processed_at is null then 'waiting_processing'
  when q.kind='drive' and t.business_saved_at is null then 'waiting_confirmation'
  else 'pending' end`;

export async function summarizeUnfinishedSyncJobs() {
  return (await pool.query(`with unfinished as (
    select q.kind,${syncStageSql} as stage from private.sync_queue q
    left join private.temporary_files t on t.job_id=q.job_id where q.status<>'success'
  ) select count(*)::int as total,
    count(*) filter (where kind='drive')::int as drive,
    count(*) filter (where kind='sheet')::int as sheet,
    count(*) filter (where stage='waiting_confirmation')::int as "waitingConfirmation",
    count(*) filter (where stage='pending')::int as pending,
    count(*) filter (where stage='processing')::int as processing,
    count(*) filter (where stage='failed')::int as failed,
    count(*) filter (where stage in ('missing_file','waiting_processing'))::int as "needsAttention"
    from unfinished`)).rows[0];
}
