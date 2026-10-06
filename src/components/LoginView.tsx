import { BrandLogo } from "./Brand";
import React, { useState, useEffect, useRef } from "react";
import { Employee } from "../types";
import { loginWithGoogle, loginWithUsername, getApiBaseUrl } from "../services/supabase";
import {
  LogIn,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  ExternalLink,
  Smartphone,
  Download,
  Server,
  Settings,
  Check,
  X,
  Zap,
  Bookmark,
  Trash2,
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
  const loginRequest = useRef<AbortController | null>(null);
  const [credentialWaiting, setCredentialWaiting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getApiBaseUrl());
  const [serverSavedSuccess, setServerSavedSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('rtg_remember_login') === 'true';
  });
  const [savedAccount, setSavedAccount] = useState<{ username: string; password?: string } | null>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('rtg_saved_credentials') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (savedAccount && !usernameOrEmail && savedAccount.username) {
      setUsernameOrEmail(savedAccount.username);
      if (savedAccount.password) {
        setPassword(savedAccount.password);
      }
    }
  }, []);

  const handleSaveCredentialsManually = () => {
    const input = usernameOrEmail.trim();
    const pass = password.trim();
    if (!input || !pass) {
      setError("Vui lòng điền tên đăng nhập và mật khẩu trước khi lưu.");
      return;
    }
    localStorage.setItem('rtg_remember_login', 'true');
    localStorage.setItem('rtg_saved_credentials', JSON.stringify({ username: input, password: pass }));
    setSavedAccount({ username: input, password: pass });
    setRememberMe(true);
    setError(null);
  };

  const handleClearSavedAccount = () => {
    localStorage.removeItem('rtg_saved_credentials');
    localStorage.setItem('rtg_remember_login', 'false');
    setSavedAccount(null);
    setRememberMe(false);
  };

  const handleQuickLogin = async (savedUser?: string, savedPass?: string) => {
    if (loading || loginRequest.current) return;
    const u = (savedUser || usernameOrEmail).trim();
    const p = (savedPass || password).trim();
    if (!u || !p) {
      setError("Không tìm thấy thông tin đăng nhập đã lưu.");
      return;
    }

    setUsernameOrEmail(u);
    setPassword(p);

    const controller = new AbortController();
    loginRequest.current = controller;
    setWaitSeconds(0);
    setCredentialWaiting(true);
    setLoading(true);
    setError(null);
    if (onClearAuthError) onClearAuthError();

    try {
      await loginWithUsername(u, p, AbortSignal.any([controller.signal, AbortSignal.timeout(250_000)]));
      localStorage.setItem('rtg_remember_login', 'true');
      localStorage.setItem('rtg_saved_credentials', JSON.stringify({ username: u, password: p }));
      setSavedAccount({ username: u, password: p });
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(
          err.name === 'TimeoutError'
            ? 'Hết thời gian chờ đăng nhập. Vui lòng thử lại sau.'
            : err instanceof TypeError
            ? 'Mất kết nối. Vui lòng kiểm tra mạng rồi thử đăng nhập lại.'
            : err.message || "Đăng nhập thất bại."
        );
      }
    } finally {
      loginRequest.current = null;
      setCredentialWaiting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => () => loginRequest.current?.abort(), []);
  useEffect(() => {
    if (!credentialWaiting) return;
    const started = Date.now();
    const timer = setInterval(() => setWaitSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [credentialWaiting]);

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
    if (loading || loginRequest.current) return;
    const input = usernameOrEmail.trim();
    const pass = password.trim();

    if (!input || !pass) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    const controller = new AbortController();
    loginRequest.current = controller;
    setWaitSeconds(0);
    setCredentialWaiting(true);
    setLoading(true);
    setError(null);
    if (onClearAuthError) onClearAuthError();

    try {
      await loginWithUsername(input, password, AbortSignal.any([controller.signal, AbortSignal.timeout(250_000)]));
      if (rememberMe) {
        localStorage.setItem('rtg_remember_login', 'true');
        localStorage.setItem('rtg_saved_credentials', JSON.stringify({ username: input, password: pass }));
        setSavedAccount({ username: input, password: pass });
      } else {
        localStorage.removeItem('rtg_saved_credentials');
        localStorage.setItem('rtg_remember_login', 'false');
        setSavedAccount(null);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) setError(err.name === 'TimeoutError' ? 'Hết thời gian chờ đăng nhập. Vui lòng thử lại sau.' : err instanceof TypeError ? 'Mất kết nối. Vui lòng kiểm tra mạng rồi thử đăng nhập lại.' : err.message || "Đăng nhập thất bại.");
    } finally {
      loginRequest.current = null;
      setCredentialWaiting(false);
      setPassword('');
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
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Đăng nhập để tiếp tục công việc của bạn.
          </p>

          {/* Hộp Đăng nhập nhanh nếu đã lưu thông tin */}
          {savedAccount && (
            <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-sky-50 border border-blue-200 shadow-2xs space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    <Zap size={15} className="fill-current text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {savedAccount.username}
                    </div>
                    <div className="text-[10px] text-slate-500">Đã lưu thông tin đăng nhập</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSavedAccount}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors text-[11px] flex items-center gap-1 hover:bg-rose-50"
                  title="Xóa tài khoản đã lưu khỏi trình duyệt"
                >
                  <Trash2 size={13} />
                  <span>Xóa</span>
                </button>
              </div>
              <button
                type="button"
                id="quick-login-btn"
                disabled={loading}
                onClick={() => handleQuickLogin(savedAccount.username, savedAccount.password)}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>Đăng nhập nhanh với {savedAccount.username}</span>
              </button>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleCredentialSignIn}>
            <div>
              <label htmlFor="username-or-email" className="block mb-2">
                Tên đăng nhập
              </label>
              <input
                id="username-or-email"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={loading}
                value={usernameOrEmail}
                onChange={(e) => {
                  setUsernameOrEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="hict-login-input"
                placeholder="Nhập tên đăng nhập của bạn"
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
                  disabled={loading}
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

            {/* Checkbox và Nút lưu thông tin đăng nhập */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  id="remember-login-checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    if (checked && usernameOrEmail.trim() && password.trim()) {
                      localStorage.setItem('rtg_remember_login', 'true');
                      localStorage.setItem('rtg_saved_credentials', JSON.stringify({ username: usernameOrEmail.trim(), password: password.trim() }));
                      setSavedAccount({ username: usernameOrEmail.trim(), password: password.trim() });
                    } else if (!checked) {
                      handleClearSavedAccount();
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <span className="font-medium text-slate-700">Lưu thông tin đăng nhập</span>
              </label>

              {usernameOrEmail && password && (
                <button
                  type="button"
                  onClick={handleSaveCredentialsManually}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                  title="Lưu ngay tên đăng nhập và mật khẩu vào thiết bị để đăng nhập nhanh lần sau"
                >
                  <Bookmark size={12} />
                  <span>Lưu thông tin</span>
                </button>
              )}
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
            {credentialWaiting && (
              <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 leading-relaxed">
                <p>{waitSeconds < 3 ? 'Đang xác thực tài khoản…' : 'Đang chờ lượt xác thực. Khi nhiều người đăng nhập, có thể cần vài phút.'}</p>
                <p className="text-xs mt-1" aria-live="off">Đã chờ {waitSeconds} giây. Bạn chỉ cần bấm đăng nhập một lần.</p>
                <button type="button" className="mt-2 underline underline-offset-4" onClick={() => loginRequest.current?.abort()}>Hủy chờ đăng nhập</button>
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
            <span>Admin đăng nhập với Google</span>
          </button>
          {typeof window !== 'undefined' && window.self !== window.top && (
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition-colors shadow-2xs"
              title="Mở ứng dụng trong tab mới để đăng nhập Google không bị chặn bởi khung xem trước"
            >
              <ExternalLink size={13} className="text-sky-600 shrink-0" />
              <span>Mở trong Tab mới (Chế độ xem trước Google AI Studio)</span>
            </button>
          )}
          {deferredPrompt && (
            <button
              type="button"
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const choice = await deferredPrompt.userChoice;
                  if (choice.outcome === 'accepted') setDeferredPrompt(null);
                }
              }}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Smartphone size={13} className="text-indigo-600 shrink-0" />
              <span>Cài đặt ứng dụng vào điện thoại (PWA)</span>
            </button>
          )}
          <a
            href="https://github.com/tuananhhict1992/quanlyrtg/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors shadow-2xs"
            title="Tải tệp cài đặt APK cho điện thoại Android từ GitHub Releases"
          >
            <Download size={13} className="text-emerald-600 shrink-0" />
            <span>Tải ứng dụng Android (.APK)</span>
          </a>
          <button
            type="button"
            onClick={() => setShowServerModal(true)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
            title="Xem hoặc đổi địa chỉ IP/máy chủ backend để kết nối từ điện thoại"
          >
            <Server size={13} className="text-slate-500 shrink-0" />
            <span>Địa chỉ máy chủ: {serverUrlInput ? serverUrlInput.replace(/^https?:\/\//, '') : 'Mặc định'}</span>
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

      {/* Modal Cấu hình Máy chủ Backend */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Địa chỉ Máy chủ Backend</h3>
                  <p className="text-xs text-slate-500">Cấu hình kết nối API cho ứng dụng di động / APK</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowServerModal(false);
                  setServerSavedSuccess(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đường dẫn máy chủ API (Server URL)
                </label>
                <input
                  type="url"
                  value={serverUrlInput}
                  onChange={(e) => {
                    setServerUrlInput(e.target.value);
                    setServerSavedSuccess(false);
                  }}
                  placeholder="http://192.168.1.5:3000 hoặc https://my-app.run.app"
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">💡 Gợi ý nhanh:</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setServerUrlInput('http://192.168.1.5:3000')}
                    className="text-left text-blue-600 hover:text-blue-800 hover:underline font-mono"
                  >
                    • Mạng Wi-Fi nội bộ: <b>http://192.168.1.5:3000</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServerUrlInput('')}
                    className="text-left text-slate-600 hover:text-slate-800 hover:underline"
                  >
                    • Mặc định: <b>Tự động nhận theo trình duyệt (Same Origin)</b>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
                  Khi cài file APK vào điện thoại, hãy nhập địa chỉ IP máy chủ của bạn (ví dụ <code>http://192.168.1.5:3000</code>) hoặc tên miền Cloud đã deploy để app gửi dữ liệu về máy chủ.
                </p>
              </div>

              {serverSavedSuccess && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium animate-in fade-in">
                  <Check size={15} className="text-emerald-600 shrink-0" />
                  <span>Đã lưu thành công địa chỉ máy chủ! Ứng dụng sẽ kết nối đến địa chỉ này.</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowServerModal(false);
                  setServerSavedSuccess(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = serverUrlInput.trim().replace(/\/$/, '');
                  if (cleaned) {
                    localStorage.setItem('rtg_server_url', cleaned);
                  } else {
                    localStorage.removeItem('rtg_server_url');
                  }
                  setServerSavedSuccess(true);
                  setTimeout(() => {
                    setShowServerModal(false);
                    setServerSavedSuccess(false);
                  }, 1200);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Lưu cấu hình</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
