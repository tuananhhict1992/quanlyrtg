import { verifyAccessToken } from './auth-verification';
import { pool, HttpError } from "./db";
export function assertSessionPolicy(account: any, claims: any, path: string) {
  if (!account?.data || account.data.status !== 'ACTIVE') throw new HttpError(403, 'Tài khoản chưa được cấp quyền hoặc đã bị khóa.');
  if (!account.session_created_at) throw new HttpError(401, 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
  if (account.data.role !== 'ADMIN' && !claims.amr?.some((method: any) => method.method === 'password'))
    throw new HttpError(403, 'Đăng nhập Google chỉ dành cho Admin. Vui lòng dùng tên đăng nhập và mật khẩu.');
  if (account.credentials_changed_at && (!account.session_created_at ||
    new Date(account.session_created_at).getTime() <= new Date(account.credentials_changed_at).getTime()))
    throw new HttpError(401, 'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.');
  if (account.must_change_password && !['/me', '/session', '/account/password'].includes(path))
    throw new HttpError(403, 'Vui lòng đổi mật khẩu ban đầu trước khi sử dụng hệ thống.');
}
export const requireAuth = async (req: any, _res: any, next: any) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, "Vui lòng đăng nhập.");
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      key =
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !process.env.DATABASE_URL)
      throw new HttpError(503, "Chưa cấu hình Supabase trên server.");
    const authUser = await verifyAccessToken(url, key, token);
    // Claims are inspected only AFTER Supabase verifies this token with getUser.
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const sessionId = typeof claims.session_id === 'string' && /^[0-9a-f-]{36}$/i.test(claims.session_id) ? claims.session_id : null;
    const result = await pool.query(
      `select r.data,a.must_change_password,a.credentials_changed_at,s.created_at as session_created_at
       from private.accounts a join private.records r on r.module='employees' and r.id=a.employee_id
       left join auth.sessions s on s.id=$2 and s.user_id=a.auth_user_id where a.auth_user_id=$1`,
      [authUser.id, sessionId],
    );
    const account = result.rows[0];
    const user = account?.data;
    assertSessionPolicy(account, claims, req.path);
    req.user = { ...user, requiresCredentialChange: account.must_change_password };
    req.authUser = authUser;
    next();
  } catch (e) {
    next(e);
  }
};
