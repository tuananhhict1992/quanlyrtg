import { createClient, type User } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { HttpError } from './db';

// Share only work currently in flight, never a cached authorization decision.
const pending = new Map<string, Promise<User>>();
export function verifyAccessToken(url: string, key: string, token: string): Promise<User> {
  const fingerprint = createHash('sha256').update(url + ':' + token).digest('hex');
  const existing = pending.get(fingerprint);
  if (existing) return existing;
  const verification = (async () => {
    const { data, error } = await createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
    }).auth.getUser(token);
    if (error && (!error.status || error.status === 429 || error.status >= 500))
      throw new HttpError(503, 'Dịch vụ xác thực đang bận. Vui lòng thử lại sau.');
    if (error || !data.user) throw new HttpError(401, 'Phiên đăng nhập hết hạn.');
    return data.user;
  })().finally(() => pending.delete(fingerprint));
  pending.set(fingerprint, verification);
  return verification;
}
