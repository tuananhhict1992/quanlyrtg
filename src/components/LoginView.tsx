import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import {loginWithGoogle,loginWithEmail} from '../services/supabase';
import { LogIn, Shield, Eye, EyeOff, AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { canUserLogin } from '../utils/permissionUtils';

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
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
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
      console.error('Google Sign In error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Cửa sổ đăng nhập Google đã bị đóng. Vui lòng thử lại.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép pop-up trên trang này.');
      } else {
        setError(err.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.');
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
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);
    if (onClearAuthError) onClearAuthError();

    try { await loginWithEmail(input, password); } catch(err:any) { setError(err.message || 'Đăng nhập thất bại.'); } finally {setLoading(false);}
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-indigo-500/20 border border-indigo-400/20">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Hệ Thống Quản Trị & Vận Hành RTG
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Cổng kiểm soát truy cập phân quyền nội bộ Tổ RTG
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-md py-7 px-6 shadow-2xl rounded-3xl sm:px-9 border border-slate-700/70">
          {/* Username & Password Form */}
          <form className="space-y-4" onSubmit={handleCredentialSignIn}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email đăng nhập
              </label>
              <div className="relative">
                <input
                  id="username-or-email"
                  type="email"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Điền tài khoản topx / mã nhân viên"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mật khẩu
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/80 border border-rose-500/70 p-3.5 rounded-2xl flex items-start gap-2.5 animate-fade-in shadow-lg shadow-rose-950/40">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div className="text-xs text-rose-200 leading-relaxed font-medium">
                  {error}
                </div>
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all shadow-lg shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>Đăng nhập hệ thống</span>
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-slate-400">
              Hoặc
            </span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {/* Google Sign In */}
          <button
            id="google-signin-btn"
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-[0.99] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
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
          <p className="mt-4 text-center text-xs text-slate-400">
            <a href="/privacy" className="underline hover:text-white">Thông tin quyền riêng tư</a>
          </p>

          <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Phân quyền bảo mật RBAC: Chỉ tài khoản được cấp quyền mới được truy cập</span>
          </div>
        </div>
      </div>
    </div>
  );
};

