import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './Brand';
import { changeOwnPassword, logoutUser } from '../services/supabase';

export function FirstPasswordChange({ onComplete }: { onComplete: () => Promise<void> }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="min-h-dvh bg-slate-50 flex items-center justify-center p-5">
    <form className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 w-full max-w-md space-y-5" onSubmit={async event => {
      event.preventDefault(); setError('');
      if (password !== repeat) { setError('Hai mật khẩu mới không khớp.'); return; }
      if (current === password) { setError('Mật khẩu mới phải khác mật khẩu ban đầu.'); return; }
      setBusy(true);
      try { await changeOwnPassword(current, password); setCurrent(''); setPassword(''); setRepeat(''); await onComplete(); }
      catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <BrandLogo />
      <h1 className="font-bold text-xl text-slate-900 flex items-center gap-2"><ShieldCheck className="text-sky-700" /> Đổi mật khẩu ban đầu</h1>
      <p className="text-sm text-slate-600">Đặt mật khẩu riêng trước khi sử dụng hệ thống. Mật khẩu mới cần ít nhất 8 ký tự.</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <label className="block text-sm font-semibold">Mật khẩu hiện tại
        <input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} className="hict-login-input mt-2" />
      </label>
      <label className="block text-sm font-semibold">Mật khẩu mới
        <input type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="hict-login-input mt-2" />
      </label>
      <label className="block text-sm font-semibold">Nhập lại mật khẩu mới
        <input type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={repeat} onChange={e => setRepeat(e.target.value)} className="hict-login-input mt-2" />
      </label>
      <button type="button" aria-pressed={visible} onClick={() => setVisible(x => !x)} className="text-sm flex items-center gap-2 text-sky-700">{visible ? <EyeOff size={17} /> : <Eye size={17} />}{visible ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}</button>
      <button type="submit" disabled={busy} className="bg-sky-700 hover:bg-sky-800 text-white rounded-xl p-3 font-bold w-full disabled:opacity-60">{busy ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu và tiếp tục'}</button>
      <button type="button" disabled={busy} onClick={() => void logoutUser()} className="text-slate-500 text-sm w-full">Đăng xuất</button>
    </form>
  </main>;
}
