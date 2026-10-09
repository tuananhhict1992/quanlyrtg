/**
 * Polyfills & cross-browser compatibility helpers.
 * Ensures complete compatibility for Safari / iOS 16.x devices
 * which do not support AbortSignal.any, AbortSignal.timeout, or crypto.randomUUID on HTTP.
 */

// 1. Polyfill AbortSignal.any
if (typeof AbortSignal !== 'undefined') {
  if (typeof (AbortSignal as any).any !== 'function') {
    (AbortSignal as any).any = function any(signals: Iterable<AbortSignal>): AbortSignal {
      const controller = new AbortController();
      const list = Array.from(signals).filter(Boolean);
      for (const sig of list) {
        if (sig.aborted) {
          controller.abort((sig as any).reason);
          return controller.signal;
        }
      }
      const onAbort = function (this: AbortSignal) {
        controller.abort((this as any).reason);
        cleanup();
      };
      const cleanup = () => {
        for (const sig of list) {
          sig.removeEventListener('abort', onAbort);
        }
      };
      for (const sig of list) {
        sig.addEventListener('abort', onAbort, { once: true });
      }
      return controller.signal;
    };
  }

  // 2. Polyfill AbortSignal.timeout
  if (typeof (AbortSignal as any).timeout !== 'function') {
    (AbortSignal as any).timeout = function timeout(ms: number): AbortSignal {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        controller.abort(err);
      }, ms);
      controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
      return controller.signal;
    };
  }

  // 3. Polyfill AbortSignal.prototype.throwIfAborted
  if (typeof (AbortSignal.prototype as any).throwIfAborted !== 'function') {
    (AbortSignal.prototype as any).throwIfAborted = function throwIfAborted() {
      if (this.aborted) {
        const err = (this as any).reason || new Error('The operation was aborted');
        if (!err.name) err.name = 'AbortError';
        throw err;
      }
    };
  }
}

// 4. Polyfill crypto.randomUUID (especially for non-secure HTTP / LAN environments on iOS Safari)
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    (window.crypto as any).randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      if (window.crypto.getRandomValues) {
        return ('10000000-1000-4000-8000-100000000000').replace(/[018]/g, (c: any) =>
          (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        ) as `${string}-${string}-${string}-${string}-${string}`;
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

/**
 * Safe helper to create a timeout signal that works on any browser version.
 */
export function safeTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    try {
      return (AbortSignal as any).timeout(ms);
    } catch {}
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    controller.abort(err);
  }, ms);
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

/**
 * Safe helper to merge multiple abort signals without throwing on older browsers.
 */
export function safeAbortSignalAny(signals: (AbortSignal | undefined | null)[]): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => Boolean(s));
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];

  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).any === 'function') {
    try {
      return (AbortSignal as any).any(valid);
    } catch {}
  }

  const controller = new AbortController();
  for (const s of valid) {
    if (s.aborted) {
      controller.abort((s as any).reason);
      return controller.signal;
    }
  }

  const onAbort = function (this: AbortSignal) {
    controller.abort((this as any).reason);
    cleanup();
  };
  const cleanup = () => {
    for (const s of valid) {
      s.removeEventListener('abort', onAbort);
    }
  };
  for (const s of valid) {
    s.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}
