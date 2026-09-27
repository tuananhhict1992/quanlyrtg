// Bound collection reads per browser; writes and authentication never wait in this queue.
export function createRequestQueue(limit = 3) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>(resolve => {
      const start = () => { running++; resolve(); };
      if (running < limit) start(); else waiting.push(start);
    });
    try { return await task(); }
    finally { running--; waiting.shift()?.(); }
  };
}
