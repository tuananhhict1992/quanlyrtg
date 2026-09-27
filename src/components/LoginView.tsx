import { BrandLogo } from "./Brand";
import React, { useState, useEffect } from "react";
import { Employee } from "../types";
import { loginWithGoogle, loginWithEmail } from "../services/supabase";
import {
  LogIn,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { canUserLogin } from "../utils/permissionUtils";

interface LoginViewProps {
  employees: Employee[];
  onLogin: (emp: Employee) => void;
  authError?: string | null;
  onClearAuthError?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  employees = [],
  onLogin,
  authError,
  onClearAuthError,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize incoming external auth errors (e.g. unauthorized Google sign in attempt)
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    if (onClearAuthError) onClearAuthError();

    try {
      await loginWithGoogle();
      // Auth state listener in App.tsx will automatically verify authorization & permissions
    } catch (err: any) {
      console.error("Google Sign In error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Cửa sổ đăng nhập Google đã bị đóng. Vui lòng thử lại.");
      } else if (err.code === "auth/popup-blocked") {
        setError(
          "Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép pop-up trên trang này.",
        );
      } else {
        setError(
          err.message || "Không thể đăng nhập bằng Google. Vui lòng thử lại.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = usernameOrEmail.trim();
    const pass = password.trim();

    if (!input || !pass) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setLoading(true);
    setError(null);
    if (onClearAuthError) onClearAuthError();

    try {
      await loginWithEmail(input, password);
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hict-login">
      <section className="hict-login-story" aria-label="HICT Điều hành RTG">
        <BrandLogo />
        <div>
          <div className="hict-eyebrow" style={{ color: "#80c6e6" }}>
            HICT · RTG PORTAL
          </div>
          <h1>
            Vận hành đồng bộ.
            <br />
            <span>Kết nối đội ngũ.</span>
          </h1>
          <p>
            Không gian làm việc dành cho Tổ RTG. Quản lý nhân sự, theo dõi công
            việc và cập nhật thông tin trong một hệ thống.
          </p>
          <div className="hict-login-features">
            <span>Nhân sự</span>
            <span>Vận hành</span>
            <span>Thông báo nội bộ</span>
          </div>
        </div>
        <footer>
          <ShieldCheck size={17} />
          <span>Hệ thống nội bộ · Truy cập theo quyền được cấp</span>
        </footer>
      </section>
      <section className="hict-login-form-area">
        <div className="hict-login-card">
          <BrandLogo />
          <div className="hict-eyebrow">Điều hành RTG</div>
          <h2>Chào mừng trở lại</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Đăng nhập để tiếp tục công việc của bạn.
          </p>
          <form className="space-y-5" onSubmit={handleCredentialSignIn}>
            <div>
              <label htmlFor="username-or-email" className="block mb-2">
                Email đăng nhập
              </label>
              <input
                id="username-or-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={usernameOrEmail}
                onChange={(e) => {
                  setUsernameOrEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="hict-login-input"
                placeholder="email@congty.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="hict-login-input pr-12"
                  placeholder="Nhập mật khẩu của bạn"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-1 top-1 text-slate-400 hover:text-blue-700 p-3 rounded-lg"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 leading-relaxed"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="hict-button hict-button-primary"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <LogIn size={17} />
              )}
              <span>Đăng nhập hệ thống</span>
            </button>
          </form>
          <div className="flex items-center gap-4 my-5">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] text-slate-400">
              hoặc đăng nhập bằng
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            id="google-signin-btn"
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="hict-button"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Đăng nhập với Google</span>
          </button>
          <p className="mt-7 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <Lock size={14} className="shrink-0 mt-0.5" />
            <span>
              Chỉ tài khoản được cấp quyền mới có thể truy cập. Liên hệ quản trị
              viên nếu bạn cần hỗ trợ.
            </span>
          </p>
          <p className="mt-6 text-center text-[11px] text-slate-400">
            <a
              href="/privacy"
              className="hover:text-blue-700 underline underline-offset-4"
            >
              Thông tin quyền riêng tư
            </a>
          </p>
        </div>
      </section>
    </div>
  );
};
