import { createClient } from "@supabase/supabase-js";
import { pool, HttpError } from "./db";
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
    const { data, error } = await createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.getUser(token);
    if (error || !data.user)
      throw new HttpError(401, "Phiên đăng nhập hết hạn.");
    const result = await pool.query(
      "select r.data from private.accounts a join private.records r on r.module='employees' and r.id=a.employee_id where a.auth_user_id=$1",
      [data.user.id],
    );
    const user = result.rows[0]?.data;
    if (!user || user.status !== "ACTIVE")
      throw new HttpError(
        403,
        "Tài khoản chưa được cấp quyền hoặc đã bị khóa.",
      );
    req.user = user;
    req.authUser = data.user;
    next();
  } catch (e) {
    next(e);
  }
};
