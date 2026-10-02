import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { testDatabase } from '../scripts/check-migrations';
import { pool } from '../backend/db';
import { createRequestQueue } from '../src/services/request-queue';
import { createRealtimeHub } from '../src/services/realtime-hub';
import { verifyAccessToken } from '../backend/auth-verification';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('80 Realtime clients use 80 channels, route updates, reconnect and clean up', async () => {
  let joined = 0, removed = 0, delivered = 0;
  const connections: { event: (payload: any) => void; status: (status: string) => void }[] = [];
  const unsubscribe: (() => void)[] = [];
  for (let i = 0; i < 80; i++) {
    const callbacks: any = {};
    const channel: any = { on: (_event: any, _filter: any, fn: any) => { callbacks.event = fn; return channel; },
      subscribe: (fn: any) => { joined++; callbacks.status = fn; return channel; } };
    const hub = createRealtimeHub({ channel: () => channel, removeChannel: async () => { removed++; return 'ok'; } } as any);
    for (let module = 0; module < 12; module++) unsubscribe.push(hub(String(module), () => delivered++));
    connections.push(callbacks);
  }
  assert.equal(joined, 80);
  connections.forEach(c => c.event({ new: { module: '3' } }));
  assert.equal(delivered, 80);
  connections.forEach(c => c.status('SUBSCRIBED'));
  assert.equal(delivered, 80 + 960);
  unsubscribe.forEach(fn => fn());
  await Promise.resolve();
  assert.equal(removed, 80);
  connections.forEach(c => c.event({ new: { module: '3' } }));
  assert.equal(delivered, 1040, 'unmounted clients must not receive callbacks');
});

test('permission listener replacement reuses the channel and ignores events after disposal', async () => {
  const channels: any[] = [];
  let removed = 0, delivered = 0;
  const hub = createRealtimeHub({ channel: () => {
    const next: any = { on: (_event:any, _filter:any, callback:any) => { next.event=callback; return next; },
      subscribe: (callback:any) => { next.status=callback; return next; } };
    channels.push(next); return next;
  }, removeChannel: async () => { removed++; return 'ok'; } } as any);
  for(let i=0;i<100;i++) hub('employees',()=>delivered++)();
  const stop=hub('employees',()=>delivered++);
  await Promise.resolve();
  assert.equal(channels.length,1);
  assert.equal(removed,0);
  channels[0].event({new:{module:'employees'}});
  assert.equal(delivered,1);
  stop(); await Promise.resolve();
  assert.equal(removed,1);
  const stopNext=hub('employees',()=>delivered++);
  channels[0].event({new:{module:'employees'}});
  channels[0].status('SUBSCRIBED');
  assert.equal(delivered,1,'disposed channels cannot notify new listeners');
  channels[1].event({new:{module:'employees'}});
  assert.equal(delivered,2);
  stopNext(); await Promise.resolve();
  assert.equal(removed,2);
});

test('collection reads remain bounded and a failed read releases its slot', async () => {
  const run = createRequestQueue(3);
  let active = 0, peak = 0;
  const results = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => run(async () => {
    peak = Math.max(peak, ++active);
    await pause(1); active--;
    if (i === 3) throw new Error('simulated network failure');
    return i;
  })));
  assert.equal(peak, 3);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 99);
});

test('80 simultaneous synthetic logins, scoped startup reads and permission revocation', { timeout: 240000 }, async () => {
  // Entire test is isolated: in-memory PostgreSQL and fake Auth provider only.
  // No credentials, employee records, or requests from production are used.
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://capacity-auth.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-key';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1/test';
  const db = await testDatabase();
  await db.exec('create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now())');
  const users = Array.from({ length: 80 }, (_, i) => ({ id: randomUUID(), session: randomUUID(), employee: `test-${i}`, username: `load${i}`, email: `load${i}@example.invalid` }));
  const userMap = new Map(users.map(u => [u.id, u]));
  for (const u of users) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [u.id, u.email]);
    await db.query("insert into private.records(module,id,data,owner_id,checksum) values('employees',$1,$2,$1,'test')", [u.employee, JSON.stringify({ id: u.employee, username: u.username, role: 'USER', status: 'ACTIVE', visibleTabs: ['dashboard','settings'] })]);
    await db.query('insert into private.accounts(auth_user_id,employee_id) values($1,$2)', [u.id,u.employee]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [u.session,u.id]);
  }
  await db.query("insert into private.records(module,id,data,owner_id,checksum) values('settings','global','{\"id\":\"global\",\"announcementTitle\":\"before\"}','test-admin','test')");
  const originalQuery = pool.query, originalConnect = pool.connect, originalFetch = globalThis.fetch;
  // PGlite has one connection; serialize transactions to preserve real PostgreSQL semantics.
  let tail = Promise.resolve();
  const lock = async () => { const previous = tail; let unlock!: () => void; tail = new Promise<void>(r => unlock = r); await previous; return unlock; };
  const rawQuery = async (sql: string, args: any[] = []) => { const r = await db.query(sql,args); return { ...r, rowCount: r.affectedRows ?? r.rows.length }; };
  (pool as any).query = async (sql: string, args: any[] = []) => { const release = await lock(); try { return await rawQuery(sql,args); } finally { release(); } };
  (pool as any).connect = async () => { const release = await lock(); return { query: rawQuery, release }; };
  let authChecks = 0, providerStatus = 200;
  let grantTokens = 30, grantLast = performance.now(), providerRateLimits = 0;
  const token = (u: typeof users[number]) => ['test', Buffer.from(JSON.stringify({sub:u.id,session_id:u.session,amr:[{method:'password'}],exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'), 'signature'].join('.');
  let localOrigin = '';
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (localOrigin && url.origin === localOrigin) return originalFetch(input,init);
    assert.equal(url.origin, 'https://capacity-auth.invalid', 'test must never call an external service');
    await pause(75); // Simulate network latency at the external Auth boundary.
    if (providerStatus !== 200) return Response.json({msg:'test provider unavailable'},{status:providerStatus});
    let u: typeof users[number] | undefined;
    if (url.pathname === '/auth/v1/token') {
      const now = performance.now();
      grantTokens = Math.min(30, grantTokens + (now - grantLast) / 2000); grantLast = now;
      if (grantTokens < 1) { providerRateLimits++; return Response.json({msg:'simulated token bucket empty'},{status:429}); }
      grantTokens--;
      const credentials = JSON.parse(String(init?.body));
      u = users.find(x => x.email === credentials.email);
      assert.equal(credentials.password,'Synthetic-Test-Password!');
      assert(u);
      return Response.json({access_token:token(u),refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:{id:u.id,email:u.email}});
    }
    assert.equal(url.pathname,'/auth/v1/user'); authChecks++;
    const header = new Headers(init?.headers).get('authorization')!;
    u = userMap.get(JSON.parse(Buffer.from(header.split('.')[1],'base64url').toString()).sub);
    assert(u); return Response.json({id:u.id,email:u.email});
  };
  const { app } = await import('../server');
  const server = app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve => server.once('listening',resolve));
  localOrigin = `http://127.0.0.1:${(server.address() as any).port}`;
  const timings: Record<string, number[]> = {};
  let requests = 0, errors = 0;
  const send = async (phase:string, path:string, init:RequestInit={}, expected=200) => {
    const start = performance.now();
    const response = await fetch(localOrigin+path,{...init,signal:AbortSignal.timeout(phase==='login'?210000:20000)});
    (timings[phase] ||= []).push(performance.now()-start); requests++;
    if(response.status!==expected) errors++;
    assert.equal(response.status,expected,`${phase}: ${path}`);
    return response.json();
  };
  try {
    const sessions = await Promise.all(users.map(u => send('login','/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.username,password:'Synthetic-Test-Password!'})})));
    assert.equal(providerRateLimits,0,'login pacing must stay within the simulated provider token quota');
    const modules = ['employees','internalDocuments','questionFolders','questionBank','quizzes','quizSubmissions','feedbacks','zaloMessages','bxxlRecords','leaveRequests','incidents','settings'];
    await Promise.all(users.map(async (u,i) => {
      const queue = createRequestQueue(3), headers = {Authorization:'Bearer '+sessions[i].access_token};
      await send('profile','/api/me',{headers});
      await send('audit','/api/session',{method:'POST',headers});
      await Promise.all(modules.map(module => queue(async () => {
        const data = await send('startup',`/api/records/${module}?limit=200`,{headers});
        if(module==='employees') assert.deepEqual(data.items.map((x:any)=>x.id),[u.employee]);
      })));
    }));
    await db.exec("update private.records set data=jsonb_set(data,'{announcementTitle}','\"after\"') where module='settings'");
    await Promise.all(users.map((u,i) => send('refresh','/api/records/settings',{headers:{Authorization:'Bearer '+sessions[i].access_token}}).then(d=>assert.equal(d.items[0].announcementTitle,'after'))));
    await db.query("update private.records set data=jsonb_set(data,'{status}','\"LOCKED\"') where module='employees' and id=$1",[users[0].employee]);
    await send('revocation','/api/me',{headers:{Authorization:'Bearer '+sessions[0].access_token}},403);
    // Fresh authorization is checked even when the token was just used.
    await db.query('delete from auth.sessions where user_id=$1',[users[1].id]);
    await send('revocation','/api/me',{headers:{Authorization:'Bearer '+sessions[1].access_token}},401);
    const before = authChecks;
    await Promise.all(Array.from({length:12},()=>verifyAccessToken(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,sessions[2].access_token)));
    assert.equal(authChecks-before,1,'overlapping verification should call provider once');
    await verifyAccessToken(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,sessions[2].access_token);
    assert.equal(authChecks-before,2,'completed verification is never cached');
    providerStatus=429;
    await assert.rejects(()=>verifyAccessToken(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,sessions[3].access_token),(e:any)=>e.status===503);
    const report = {testedAt:new Date().toISOString(),users:80,requests,unexpectedErrors:errors,authChecks,providerRateLimits,environment:'Local Express; PGlite serialized transactions; fake Auth with 75ms delay, burst 30, refill 150/5min; no production traffic',phases:Object.fromEntries(Object.entries(timings).map(([name,values])=>{values.sort((a,b)=>a-b);return [name,{requests:values.length,p95ms:Math.round(values[Math.ceil(values.length*.95)-1]),maxMs:Math.round(values.at(-1)!)}];}))};
    await mkdir('artifacts',{recursive:true}); await writeFile('artifacts/capacity-80.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
    await db.exec('begin; insert into public.record_changes(module) select \'employees\' from generate_series(1,80); insert into public.record_changes(module) values(\'settings\'); commit;');
    assert.equal((await db.query<any>('select count(*)::int n from public.record_changes')).rows[0].n,2);
    await db.exec("insert into public.record_changes(module) values('employees')");
    assert.equal((await db.query<any>('select count(*)::int n from public.record_changes')).rows[0].n,3,'a later transaction must still notify');
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    globalThis.fetch=originalFetch; (pool as any).query=originalQuery; (pool as any).connect=originalConnect; await db.close();
  }
});
