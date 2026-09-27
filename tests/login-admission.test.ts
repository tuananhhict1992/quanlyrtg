import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { AUTH_BUSY, createLoginAdmission, pacedPasswordSignIn } from '../backend/login-admission';

test('80 concurrent logins fit a simulated provider burst/refill budget without rejecting users', async () => {
  // Time is scaled 250x: the real default is 2.5s/token, this test uses 10ms.
  const admission = createLoginAdmission({ intervalMs: 10 });
  let providerTokens = 30, providerLast = performance.now(), active = 0, peak = 0;
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: 80 }, (_, id) => admission.run(async () => {
    const now = performance.now();
    providerTokens = Math.min(30, providerTokens + (now - providerLast) / 8);
    providerLast = now;
    assert(providerTokens >= 1, 'request would have triggered provider 429'); providerTokens--;
    peak = Math.max(peak, ++active); await pause(1); active--; return id;
  })));
  assert.equal(results.length, 80); assert.equal(new Set(results).size, 80);
  assert(peak <= 4); assert(performance.now() - started >= 550, 'burst must actually be paced');
});

test('pending login cancellation and bounded capacity never execute abandoned credentials', async () => {
  const admission = createLoginAdmission({ burst: 1, intervalMs: 1000, maxPending: 1, concurrency: 1 });
  let release!: () => void, calls = 0;
  const first = admission.run(() => new Promise<void>(resolve => { release = resolve; }));
  await Promise.resolve();
  const controller = new AbortController();
  const second = admission.run(async () => { calls++; }, controller.signal);
  const rejected = assert.rejects(second, (error: any) => error.status === 503);
  await assert.rejects(admission.run(async () => { calls++; }), (error: any) => error.status === 503);
  controller.abort(); await rejected; release(); await first;
  assert.equal(calls, 0);
});

test('temporary provider errors retry in the same attempt, invalid password does not retry', async () => {
  const statuses = [429, 503, 200];
  let calls = 0, cooldowns = 0, waits = 0;
  const admission = { run: async (fn: any) => fn(), cooldown: () => { cooldowns++; } };
  const client = { auth: { signInWithPassword: async () => {
    const status = statuses[calls++]; return status === 200 ? { data: { session: 'ok' }, error: null } : { data: {}, error: { status } };
  } } };
  const signal = new AbortController().signal;
  const result = await pacedPasswordSignIn(client, { email: 'synthetic@example.invalid', password: 'fake' }, signal, admission, async () => { waits++; });
  assert.equal(result.data.session, 'ok'); assert.equal(calls, 3); assert.equal(cooldowns, 1); assert.equal(waits, 2);
  calls = 0;
  client.auth.signInWithPassword = async () => { calls++; return { data: {}, error: { status: 400 } }; };
  assert.equal((await pacedPasswordSignIn(client, { email: 'synthetic@example.invalid', password: 'fake' }, signal, admission)).error.status, 400);
  assert.equal(calls, 1);
  calls = 0;
  client.auth.signInWithPassword = async () => { calls++; return { data: {}, error: { status: 429 } }; };
  await assert.rejects(pacedPasswordSignIn(client, { email: 'synthetic@example.invalid', password: 'fake' }, signal, admission, async () => {}), (error: any) => error.status === 503 && error.message === AUTH_BUSY);
  assert.equal(calls, 4);
});
