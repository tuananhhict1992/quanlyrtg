import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { pool, transaction, HttpError, asyncRoute } from './db';
import { audit } from './records';

export const INVALID_LOGIN = 'Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản chưa được cấp quyền.';
export const normalizeUsername = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export function validateUsername(value: unknown) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9._-]{2,64}$/.test(username))
    throw new HttpError(400, 'Tên đăng nhập cần 2–64 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  return username;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const accountEmail = (employeeId: string) => `rtg.${hash(employeeId).slice(0,40)}@accounts.invalid`;
export const accountAdminConfigured = () => !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
export function authClient(admin = false) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = admin ? (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) :
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !key || !process.env.DATABASE_URL)
    throw new HttpError(503, admin ? 'Chưa cấu hình khóa quản trị Supabase trên máy chủ.' : 'Chưa cấu hình Supabase trên máy chủ.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
}
export function assertAccountAdmin(user: any) {
  if (user?.role !== 'ADMIN' || user?.status !== 'ACTIVE')
    throw new HttpError(403, 'Chỉ Admin được quản lý tài khoản và mật khẩu.');
}
export function validateNewPassword(value: unknown, initial = false) {
  if (typeof value !== 'string' || value.length > 128 ||
    (initial ? value.length < 6 : value.length < 8) || (!initial && /^(.)\1+$|^12345678$|^password$/i.test(value)))
    throw new HttpError(400, initial ? 'Mật khẩu cần từ 6 đến 128 ký tự.' : 'Mật khẩu mới cần 8–128 ký tự và không dùng chuỗi quá dễ đoán.');
  return value;
}
// Shared database limiter works across Cloud Run instances. Store only a hash, never identifiers/passwords.
export async function loginByUsername(usernameInput: unknown, password: unknown, clientFactory = authClient) {
  const username = normalizeUsername(usernameInput);
  if (!/^[a-z0-9._-]{2,64}$/.test(username) || typeof password !== 'string' || !password || password.length > 128)
    throw new HttpError(401, INVALID_LOGIN);
  const client = clientFactory();
  const key = hash(username);
  await pool.query('delete from private.login_limits where expires_at < now()');
  const limit = (await pool.query(`insert into private.login_limits(key_hash,attempts,expires_at) values($1,1,now()+interval '15 minutes')
    on conflict(key_hash) do update set attempts=private.login_limits.attempts+1 returning attempts`, [key])).rows[0];
  if (limit.attempts > 10) throw new HttpError(429, 'Đã thử đăng nhập nhiều lần. Vui lòng chờ 15 phút rồi thử lại.');
  const row = (await pool.query(`select a.auth_user_id,u.email from private.records r
    join private.accounts a on a.employee_id=r.id join auth.users u on u.id=a.auth_user_id
    where r.module='employees' and lower(btrim(r.data->>'username'))=$1 and r.data->>'status'='ACTIVE'`, [username])).rows[0];
  const { data, error } = await client.auth.signInWithPassword({ email: row?.email || 'unassigned@accounts.invalid', password });
  if (error || !row || data.user?.id !== row.auth_user_id || !data.session)
    throw new HttpError(401, INVALID_LOGIN);
  await pool.query('delete from private.login_limits where key_hash=$1', [key]);
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export async function verifyAccountAdminKey(authUserId: string, clientFactory = authClient) {
  const { data, error } = await clientFactory(true).auth.admin.getUserById(authUserId);
  if (error || data.user?.id !== authUserId)
    throw new HttpError(503, 'Chưa xác thực được khóa quản trị Supabase. Kiểm tra khóa của đúng project trên máy chủ rồi thử lại.');
}
export async function accountStatus(actor: any, id: string, authUserId?: string) {
  assertAccountAdmin(actor);
  const row = (await pool.query(`select r.data->>'username' as username, a.auth_user_id is not null as linked,
    coalesce(a.must_change_password,false) as must_change_password
    from private.records r left join private.accounts a on a.employee_id=r.id where r.module='employees' and r.id=$1`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'Không tìm thấy nhân sự.');
  if (accountAdminConfigured() && authUserId) await verifyAccountAdminKey(authUserId);
  return { ...row, configured: accountAdminConfigured() };
}

export async function setEmployeePassword(actor: any, id: string, body: any, clientFactory = authClient, initialOnly = false) {
  assertAccountAdmin(actor);
  const password = validateNewPassword(body?.password, true);
  const expectedUsername = validateUsername(body?.username);
  const job = body?.job_id;
  if (typeof job !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job))
    throw new HttpError(400, 'Mã tác vụ không hợp lệ.');
  const client = clientFactory(true);
  await pool.query('insert into private.account_jobs(job_id,employee_id,actor_id) values($1,$2,$3) on conflict do nothing', [job, id, actor.id]);
  // The intent is committed before the external Auth call, so uncertain outcomes remain traceable.
  await pool.query(`insert into private.audit_log(actor_id,action,module,record_id,detail,dedupe_key)
    values($1,'account.credentials.request','employees',$2,$3,$4) on conflict(dedupe_key) do nothing`,
    [actor.id, id, JSON.stringify({ job_id: job }), 'account:' + job]);
  try {
    return await transaction(async db => {
      const task = (await db.query('select * from private.account_jobs where job_id=$1 for update', [job])).rows[0];
      if (task.employee_id !== id || task.actor_id !== actor.id) throw new HttpError(409, 'Mã tác vụ đã được sử dụng.');
      if (task.status === 'success') return { success: true, alreadyCompleted: true };
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", ['employees:' + id]);
      const employee = (await db.query("select data from private.records where module='employees' and id=$1 for update", [id])).rows[0]?.data;
      if (!employee) throw new HttpError(404, 'Không tìm thấy nhân sự.');
      if (employee.status !== 'ACTIVE') throw new HttpError(409, 'Chỉ cấp hoặc đổi mật khẩu cho nhân sự đang hoạt động.');
      if (validateUsername(employee.username) !== expectedUsername) throw new HttpError(409, 'Hãy lưu tên đăng nhập trong hồ sơ trước khi cấp hoặc đổi mật khẩu.');
      await db.query("update private.account_jobs set status='processing',updated_at=now() where job_id=$1", [job]);
      const linked = (await db.query('select auth_user_id from private.accounts where employee_id=$1', [id])).rows[0];
      if (initialOnly && linked) {
        await db.query("update private.account_jobs set status='success',updated_at=now() where job_id=$1", [job]);
        return { success: true, alreadyCompleted: true };
      }
      let authId = linked?.auth_user_id;
      if (!authId) {
        // Synthetic address is an internal Supabase identifier, never a delivery address or HR email.
        const email = accountEmail(id);
        const orphan = (await db.query('select id,raw_app_meta_data from auth.users where lower(email)=$1', [email])).rows[0];
        if (orphan) {
          if (orphan.raw_app_meta_data?.rtg_employee_id !== id ||
            (await db.query('select 1 from private.accounts where auth_user_id=$1', [orphan.id])).rows.length)
            throw new HttpError(409, 'Tài khoản đã thuộc hồ sơ khác.');
          authId = orphan.id;
        } else {
          const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { rtg_employee_id: id } });
          if (error || !data.user) throw new HttpError(502, 'Supabase chưa cấp được tài khoản. Kiểm tra cấu hình máy chủ rồi thử lại.');
          authId = data.user.id;
        }
      }
      const { error } = await client.auth.admin.updateUserById(authId, { password });
      if (error) throw new HttpError(502, 'Supabase chưa cập nhật được mật khẩu. Kiểm tra chính sách mật khẩu rồi thử lại.');
      await db.query(`insert into private.accounts(auth_user_id,employee_id,must_change_password,credentials_changed_at) values($1,$2,true,clock_timestamp())
        on conflict(employee_id) do update set must_change_password=true,credentials_changed_at=clock_timestamp()`, [authId, id]);
      await audit(db, actor.id, linked ? 'account.password.reset' : 'account.create', 'employees', id, { job_id: job });
      await db.query("update private.account_jobs set status='success',updated_at=now() where job_id=$1", [job]);
      return { success: true, alreadyCompleted: false };
    });
  } catch (error) {
    await pool.query("update private.account_jobs set status='failed',updated_at=now() where job_id=$1 and actor_id=$2 and employee_id=$3 and status<>'success'", [job, actor.id, id]);
    throw error;
  }
}

export async function changeOwnPassword(actor: any, authUser: any, body: any, clientFactory = authClient) {
  const password = validateNewPassword(body?.password);
  if (typeof body?.currentPassword !== 'string' || body.currentPassword.length > 128 || body.currentPassword === password)
    throw new HttpError(400, 'Nhập mật khẩu hiện tại và chọn mật khẩu mới khác mật khẩu cũ.');
  const client = clientFactory();
  await transaction(async db => {
    await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['employees:' + actor.id]);
    const verified = await client.auth.signInWithPassword({ email: authUser.email, password: body.currentPassword });
    if (verified.error || verified.data.user?.id !== authUser.id) throw new HttpError(400, 'Mật khẩu hiện tại không đúng.');
    // Update using the user's verified session; no admin key is needed for self-service changes.
    const updated = await client.auth.updateUser({ password });
    if (updated.error) throw new HttpError(400, 'Không thể đổi mật khẩu. Hãy chọn mật khẩu mạnh hơn và thử lại.');
    await db.query('update private.accounts set must_change_password=false,credentials_changed_at=clock_timestamp() where auth_user_id=$1 and employee_id=$2', [authUser.id, actor.id]);
    await audit(db, actor.id, 'account.password.change', 'employees', actor.id);
  });
  // Create a fresh session after the cut-off; old sessions remain blocked even if refreshed.
  const fresh = await client.auth.signInWithPassword({ email: authUser.email, password });
  if (fresh.error || !fresh.data.session) return { success: true, signInAgain: true };
  return { success: true, session: { access_token: fresh.data.session.access_token, refresh_token: fresh.data.session.refresh_token } };
}

export const publicAccountsRouter = Router();
publicAccountsRouter.post('/login', rateLimit({ windowMs: 300000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Đã thử nhiều lần. Vui lòng thử lại sau.' } }), json({ limit: '4kb' }),
  asyncRoute(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(await loginByUsername(req.body?.username, req.body?.password)); }));
export const accountsRouter = Router();
accountsRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
accountsRouter.get('/admin/accounts/:id', asyncRoute(async (req, res) => res.json(await accountStatus(req.user, req.params.id, req.authUser.id))));
accountsRouter.post('/admin/accounts/:id/password', rateLimit({ windowMs: 60000, limit: 15, keyGenerator: (req: any) => req.user.id }),
  asyncRoute(async (req, res) => res.json(await setEmployeePassword(req.user, req.params.id, req.body))));
accountsRouter.post('/account/password', rateLimit({ windowMs: 60000, limit: 5, keyGenerator: (req: any) => req.user.id }),
  asyncRoute(async (req, res) => res.json(await changeOwnPassword(req.user, req.authUser, req.body))));
