import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../backend/db';
import { testDatabase } from '../scripts/check-migrations';
import { accountEmail, accountStatus, setEmployeePassword, loginByUsername, changeOwnPassword, INVALID_LOGIN } from '../backend/accounts';
import { assertSessionPolicy } from '../backend/auth';
import { writeRecord } from '../backend/records';

const admin = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' };
const manager = { id: 'manager', role: 'USER', status: 'ACTIVE', assignedPermissions: ['MANAGE_HR','MANAGE_PERMISSIONS'] };
test('username access, Admin-only provisioning/reset, idempotency, first password, no credential archive', async () => {
  const db = await testDatabase(), savedQuery = pool.query, savedConnect = pool.connect;
  const query = async (sql: string, args: any[] = []) => {
    const result = await db.query<any>(sql, args);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  (pool as any).query = query; (pool as any).connect = async () => ({ query, release() {} });
  const authId = randomUUID(), passwords = new Map<string,string>();
  let creates = 0, updates = 0, denyUpdate = false;
  const factory: any = () => ({auth: {
    admin: {
      createUser: async (input: any) => {
        creates++;
        await query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [authId,input.email,JSON.stringify(input.app_metadata)]);
        passwords.set(authId,input.password);
        return { data: { user: { id: authId } }, error: null };
      },
      updateUserById: async (id: string, input: any) => {
        updates++;
        if (denyUpdate) return { error: { message: 'private provider error' } };
        passwords.set(id,input.password); return { error: null };
      },
    },
    signInWithPassword: async ({email,password}: any) => email === accountEmail('e1') && password === passwords.get(authId) ?
      { error: null, data: { user: { id: authId }, session: { access_token: 'test-access', refresh_token: 'test-refresh' } } } :
      { error: { message: 'invalid' }, data: {} },
    updateUser: async ({password}: any) => {passwords.set(authId,password);return { error: null };},
  }});
  try {
    await writeRecord({query}, admin, 'employees','e1',{id:'e1',employeeCode:'NV-001',username:'Nv001',status:'ACTIVE',role:'USER',password:'SHOULD_NOT_SAVE'});
    await assert.rejects(() => writeRecord({query},admin,'employees','e2',{username:' NV001 ',status:'ACTIVE',role:'USER'}), (e:any)=>e.code==='23505');
    await assert.rejects(() => writeRecord({query},manager,'employees','e1',{username:'different'}), (e:any)=>e.status===403);
    await assert.rejects(() => writeRecord({query},manager,'employees','e1',{role:'ADMIN'}), (e:any)=>e.status===403);
    await assert.rejects(() => accountStatus(manager,'e1'), (e:any)=>e.status===403);
    const task = { username: 'nv001', password:'123456',job_id:randomUUID() };
    await assert.rejects(() => setEmployeePassword(manager,'e1',task,factory),(e:any)=>e.status===403);
    await assert.rejects(() => setEmployeePassword({...admin,status:'LOCKED'},'e1',task,factory),(e:any)=>e.status===403);
    await assert.rejects(() => setEmployeePassword(admin,'e1',{...task,username:'wrong'},factory),(e:any)=>e.status===409);
    assert.equal(creates,0);
    assert.equal((await setEmployeePassword(admin,'e1',task,factory)).success,true);
    assert.equal(creates,1); assert.equal(updates,1);
    assert.equal((await setEmployeePassword(admin,'e1',task,factory)).alreadyCompleted,true);
    assert.equal(updates,1);
    assert.equal((await accountStatus(admin,'e1')).linked,true);
    assert.equal((await accountStatus(admin,'e1')).must_change_password,true);
    assert.deepEqual(await loginByUsername(' NV001 ','123456',factory),{access_token:'test-access',refresh_token:'test-refresh'});
    for (const [name, pass] of [['nv001','wrong'], ['missing','123456'], ['person@example.com','123456']])
      await assert.rejects(() => loginByUsername(name,pass,factory),(e:any)=>e.status===401 && e.message===INVALID_LOGIN);
    await assert.rejects(() => changeOwnPassword({id:'e1'},{id:authId,email:accountEmail('e1')},{currentPassword:'wrong',password:'MyNewPassword9'},factory),(e:any)=>e.status===400);
    await assert.rejects(() => changeOwnPassword({id:'e1'},{id:authId,email:accountEmail('e1')},{currentPassword:'123456',password:'123456'},factory),(e:any)=>e.status===400);
    await changeOwnPassword({id:'e1'},{id:authId,email:accountEmail('e1')},{currentPassword:'123456',password:'MyNewPassword9'},factory);
    assert.equal((await accountStatus(admin,'e1')).must_change_password,false);
    await assert.rejects(() => loginByUsername('nv001','123456',factory),(e:any)=>e.status===401);
    await loginByUsername('nv001','MyNewPassword9',factory);
    denyUpdate=true;
    const failedJob = {...task,job_id:randomUUID(),password:'Temporary987'};
    await assert.rejects(() => setEmployeePassword(admin,'e1',failedJob,factory),(e:any)=>e.status===502 && !e.message.includes('private provider'));
    assert.equal((await query('select status from private.account_jobs where job_id=$1',[failedJob.job_id])).rows[0].status,'failed');
    denyUpdate=false;
    await setEmployeePassword(admin,'e1',failedJob,factory);
    assert.equal(creates,1);
    for(let i=0;i<10;i++) await assert.rejects(()=>loginByUsername('bruteforce','wrong',factory),(e:any)=>e.status===401);
    await assert.rejects(()=>loginByUsername('bruteforce','wrong',factory),(e:any)=>e.status===429);
    const persisted = JSON.stringify((await query(`select row_to_json(r) from private.records r union all select row_to_json(a) from private.audit_log a
      union all select row_to_json(q) from private.sync_queue q union all select row_to_json(j) from private.account_jobs j`)).rows);
    for(const secret of ['SHOULD_NOT_SAVE','123456','MyNewPassword9','Temporary987']) assert(!persisted.includes(secret));
    assert(!JSON.stringify((await query('select * from private.login_limits')).rows).includes('bruteforce'));
    await db.exec('set role authenticated');
    for(const table of ['accounts','login_limits','account_jobs']) await assert.rejects(()=>db.query(`select * from private.${table}`));
    await db.exec('reset role');
  } finally { (pool as any).query=savedQuery;(pool as any).connect=savedConnect;await db.close(); }
});

test('Google Admin only, mandatory initial change, old refreshed sessions cannot access APIs', () => {
  const account:any = { data:{role:'USER',status:'ACTIVE'},must_change_password:false };
  const password = {amr:[{method:'password'}]}, google = {amr:[{method:'oauth'}]};
  assert.throws(()=>assertSessionPolicy(account,google,'/me'),(e:any)=>e.status===403);
  assert.doesNotThrow(()=>assertSessionPolicy({...account,data:admin},google,'/me'));
  assert.doesNotThrow(()=>assertSessionPolicy(account,password,'/records/employees'));
  account.must_change_password=true;
  for(const path of ['/me','/session','/account/password']) assert.doesNotThrow(()=>assertSessionPolicy(account,password,path));
  for(const path of ['/records/employees','/admin/accounts/e1','/account/password/other']) assert.throws(()=>assertSessionPolicy(account,password,path),(e:any)=>e.status===403);
  account.credentials_changed_at='2026-09-27T07:00:00Z';
  account.session_created_at='2026-09-27T06:00:00Z';
  assert.throws(()=>assertSessionPolicy(account,{...password,iat:9999999999},'/me'),(e:any)=>e.status===401);
  account.session_created_at='2026-09-27T08:00:00Z';
  assert.doesNotThrow(()=>assertSessionPolicy(account,password,'/me'));
});
