import { setTimeout as pause } from 'node:timers/promises';
import { HttpError } from './db';

export const AUTH_BUSY = 'Hệ thống đăng nhập đang bận. Vui lòng chờ một lúc rồi thử lại.';
export const LOGIN_DEADLINE_MS = 240_000;
const busy = () => new HttpError(503, AUTH_BUSY);

// Process-local pacing matches the current single-instance Free deployment.
// Only pending callbacks live in memory; no password/session is persisted in a queue.
// Leave headroom below Auth's 30-token burst and 150 requests / 5 minutes.
export function createLoginAdmission(options: { burst?: number; intervalMs?: number; maxPending?: number; concurrency?: number; now?: () => number } = {}) {
  const { burst = 20, intervalMs = 2500, maxPending = 100, concurrency = 4, now = Date.now } = options;
  let tokens = burst, last = now(), active = 0, cooldownUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  type Entry = { start: () => void; cancel: () => void; signal?: AbortSignal };
  const queue: Entry[] = [];
  function pump() {
    if (timer) { clearTimeout(timer); timer = undefined; }
    const time = now();
    tokens = Math.min(burst, tokens + Math.max(0, time - last) / intervalMs);
    last = Math.max(last, time);
    while (queue.length && active < concurrency && tokens >= 1 && time >= cooldownUntil) {
      const entry = queue.shift()!;
      entry.signal?.removeEventListener('abort', entry.cancel);
      if (entry.signal?.aborted) { entry.cancel(); continue; }
      tokens--; active++; entry.start();
    }
    if (queue.length && active < concurrency) {
      const wait = Math.max(1, cooldownUntil - time, (1 - tokens) * intervalMs);
      timer = setTimeout(pump, Math.ceil(wait));
    }
  }
  return {
    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted || queue.length >= maxPending) return Promise.reject(busy());
      return new Promise<T>((resolve, reject) => {
        const entry: Entry = {
          signal,
          cancel() { const index = queue.indexOf(entry); if (index >= 0) queue.splice(index, 1); signal?.removeEventListener('abort', entry.cancel); reject(busy()); pump(); },
          start() { Promise.resolve().then(() => { if (signal?.aborted) throw busy(); return task(); }).then(resolve, reject).finally(() => { active--; pump(); }); },
        };
        queue.push(entry); signal?.addEventListener('abort', entry.cancel, { once: true }); pump();
      });
    },
    cooldown(ms: number) { cooldownUntil = Math.max(cooldownUntil, now() + ms); tokens = 0; last = cooldownUntil; pump(); },
  };
}

export const loginAdmission = createLoginAdmission();
export const transientAuthError = (error: any) => !!error && (
  error.status === 429 || error.status >= 500 || error.status === 0 ||
  error.name === 'AuthRetryableFetchError' || error.name === 'TypeError' || error.name === 'TimeoutError'
);

// Retry only provider failures, never rejected credentials. The caller's deadline
// bounds queueing + requests + retries together, without repeated browser POSTs.
export async function pacedPasswordSignIn(client: any, credentials: { email: string; password: string }, signal: AbortSignal,
  admission = loginAdmission, wait = (ms: number) => pause(ms, undefined, { signal })) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (signal.aborted) throw busy();
    let result: any;
    try { result = await admission.run(() => client.auth.signInWithPassword(credentials), signal); }
    catch (error) {
      if (!transientAuthError(error)) throw error;
      result = { error };
    }
    if (!transientAuthError(result.error)) return result;
    if (result.error.status === 429) admission.cooldown(10_000);
    if (attempt === 3) throw busy();
    try { await wait(Math.min(8000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500)); }
    catch { throw busy(); }
  }
  throw busy();
}
