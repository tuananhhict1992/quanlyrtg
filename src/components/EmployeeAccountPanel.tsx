import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { api } from '../services/supabase';

type Status = { linked: boolean; configured: boolean; username: string; must_change_password: boolean };
/** Mounted only for Admin. Password exists only in this form and the dedicated TLS request. */
export function EmployeeAccountPanel({ employeeId, username, fullName }: { employeeId: string; username: string; fullName: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const [job, setJob] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setStatus(null); setError(''); setSuccess(''); setPassword(''); setVisible(false); setConfirm(false);
    api<Status>(`/admin/accounts/${encodeURIComponent(employeeId)}`).then(value => {
      if (active) { setStatus(value); setPassword(value.linked ? '' : '123456'); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [employeeId, retry]);
  const submit = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await api(`/admin/accounts/${encodeURIComponent(employeeId)}/password`, {
        method: 'POST', body: JSON.stringify({ username, password, job_id: job }),
      });
      setStatus(previous => previous && { ...previous, linked: true, must_change_password: true });
      setPassword(''); setVisible(false); setConfirm(false); setJob(crypto.randomUUID());
      setSuccess('Đã lưu mật khẩu mới. Nhân viên cần đổi mật khẩu khi đăng nhập.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section aria-label="Tài khoản đăng nhập" className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
    <h4 className="flex items-center gap-2 font-bold text-sky-900"><KeyRound size={17} /> Tài khoản đăng nhập <span className="text-[10px] uppercase bg-white border border-sky-200 rounded-full px-2 py-1">Chỉ Admin</span></h4>
    {!status && !error && <p role="status">Đang kiểm tra tài khoản…</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {!status && error && <button type="button" onClick={() => setRetry(x => x + 1)} className="inline-flex gap-2"><RefreshCw size={16} />Thử lại</button>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{success}</p>}
    {status && <>
      <p className="text-slate-600">{status.linked ? 'Đã có tài khoản. Mật khẩu hiện tại được bảo mật và không thể xem lại.' : 'Chưa có tài khoản. Mật khẩu ban đầu: 123456. Nhân viên phải đổi ở lần đăng nhập đầu.'}</p>
      {!status.configured && <p role="alert" className="text-amber-800">Máy chủ chưa được cấu hình quyền cấp và đặt lại mật khẩu. Hãy liên hệ quản trị hệ thống.</p>}
      <label htmlFor="employee-new-password" className="block font-semibold text-slate-700">{status.linked ? 'Đặt mật khẩu mới' : 'Mật khẩu ban đầu'}</label>
      <div className="relative">
        <input id="employee-new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128}
          disabled={busy || !status.configured} value={password} placeholder={status.linked ? 'Nhập mật khẩu mới' : '123456'}
          onChange={e => { setPassword(e.target.value); setJob(crypto.randomUUID()); setConfirm(false); setSuccess(''); }}
          className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2 pr-12" />
        <button type="button" aria-label={visible ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} aria-pressed={visible} disabled={busy}
          onClick={() => setVisible(x => !x)} className="absolute right-1 top-1 p-2 text-sky-700">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
      </div>
      {username.trim().toLowerCase() !== status.username?.trim().toLowerCase() && <p className="text-amber-800">Lưu hồ sơ với tên đăng nhập mới rồi mở lại cửa sổ này để cấp mật khẩu.</p>}
      {confirm ? <div className="rounded-xl bg-white border border-sky-200 p-3 space-y-3">
        <p>Xác nhận {status.linked ? 'đặt lại mật khẩu' : 'cấp tài khoản'} cho <strong>{fullName}</strong>? Các phiên cũ sẽ bị yêu cầu đăng nhập lại.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={submit} className="bg-sky-700 text-white rounded-xl px-4 py-2 font-bold">{busy ? 'Đang lưu…' : 'Xác nhận lưu mật khẩu'}</button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="bg-slate-100 rounded-xl px-4 py-2">Hủy</button>
        </div>
      </div> : <button type="button" disabled={busy || !status.configured || password.length < 6 || !username || username.trim().toLowerCase() !== status.username?.trim().toLowerCase()}
        onClick={() => { setConfirm(true); setVisible(false); setSuccess(''); }} className="bg-sky-700 text-white rounded-xl px-4 py-2 font-bold disabled:opacity-50">
        {status.linked ? 'Đặt lại mật khẩu' : 'Cấp tài khoản'}
      </button>}
      <p className="text-xs text-slate-500">Mật khẩu không được đưa vào hồ sơ, Excel, Google Sheets hoặc thông báo nội bộ.</p>
    </>}
  </section>;
}
