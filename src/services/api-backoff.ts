export function waitFor(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// All reads in this browser share the server's Retry-After window. Mutations
// are never replayed automatically because their effects may not be idempotent.
export function createApiBackoff(notify: () => void, now = Date.now, wait = waitFor) {
  let blockedUntil = 0, notifiedUntil = 0;
  return async (request: () => Promise<Response>, read: boolean, signal?: AbortSignal) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      while (read && now() < blockedUntil) await wait(blockedUntil - now(), signal);
      signal?.throwIfAborted();
      const response = await request();
      if (response.status !== 429) return response;
      const retryAfter = response.headers.get('Retry-After');
      const parsed = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : retryAfter ? Date.parse(retryAfter) - now() : 60_000;
      blockedUntil = Math.max(blockedUntil, now() + Math.min(120_000, Math.max(1000, Number.isFinite(parsed) ? parsed : 60_000)));
      if (now() >= notifiedUntil) { notifiedUntil = blockedUntil; notify(); }
      if (!read || attempt === 1) return response;
    }
    throw new Error('Không thể tải dữ liệu.');
  };
}
