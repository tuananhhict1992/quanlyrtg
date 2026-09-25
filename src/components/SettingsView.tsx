import {supabase} from '../services/supabase';
import React, { useState } from 'react';
import {
  UserCheck,
  Camera,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Shield,
  Phone,
  Calendar,
  Building,
  User,
  BadgeCheck,
} from 'lucide-react';
import { Employee, AppSettings } from '../types';

interface SettingsViewProps {
  currentUser: Employee;
  onUpdateEmployee: (emp: Employee) => void;
  appSettings: AppSettings | null;
  onSaveAppSettings?: (settings: Partial<AppSettings>) => void;
  onNavigateToPermissions?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateEmployee,
  appSettings,
  onNavigateToPermissions,
}) => {
  const isAdminOrManager =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.role === 'MANAGER';

  // Profile state
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar || '');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = (formData.get('fullName') as string)?.trim() || currentUser.fullName;
    const dateOfBirth = formData.get('dateOfBirth') as string;
    const zaloPhone = (formData.get('zaloPhone') as string)?.trim();

    const updatedUser: Employee = {
      ...currentUser,
      fullName,
      dateOfBirth,
      zaloPhone,
      zaloSynced: !!zaloPhone,
      avatar: avatarPreview,
    };
    onUpdateEmployee(updatedUser);
    setProfileSuccess('Cập nhật thông tin cá nhân thành công!');
    setTimeout(() => setProfileSuccess(null), 3500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    const verified=await supabase.auth.signInWithPassword({email:currentUser.email,password:currentPassword});
    if(verified.error){setPasswordError('Mật khẩu hiện tại không đúng.');return;}
    const {error}=await supabase.auth.updateUser({password:newPassword});
    if(error){setPasswordError(error.message);return;}
    setPasswordSuccess('Đổi mật khẩu tài khoản thành công!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Cài Đặt Tài Khoản Cá Nhân
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý thông tin hồ sơ nhân viên, số điện thoại kết nối Zalo và bảo mật tài khoản
          </p>
        </div>

        {isAdminOrManager && onNavigateToPermissions && (
          <button
            type="button"
            onClick={onNavigateToPermissions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Đồng Bộ Google Sheet & Cấp Quyền</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Admin/Manager Callout Card for Google Sheet */}
      {isAdminOrManager && onNavigateToPermissions && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl border border-emerald-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Cấu Hình Tự Động Đồng Bộ Google Sheet</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Đã chuyển sang Cấp Quyền & Hiển Thị
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Theo dõi hàng đợi báo cáo Google, thử lại đồng bộ lỗi và sao lưu tại mục <b>Cấp quyền & Hiển thị</b>.
                {appSettings?.googleSheetLastSyncAt && (
                  <span className="block mt-1 text-slate-500 font-semibold">
                    • Lần đồng bộ gần nhất: {appSettings.googleSheetLastSyncAt}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToPermissions}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            <span>Mở Cài Đặt Google Sheet</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account Info Form Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Thông tin hồ sơ nhân sự</span>
            </h3>
            <p className="text-xs text-slate-500">Cập nhật họ tên, ngày sinh, số Zalo nhận thông báo vận hành cảng</p>
          </div>
          {profileSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {profileSuccess}
            </span>
          )}
        </div>

        <div className="p-6">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
              <div className="relative">
                <img
                  src={
                    avatarPreview ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      currentUser.fullName
                    )}&background=random`
                  }
                  alt="Avatar"
                  className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-100 shadow-xs"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-2 -right-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer transition-colors"
                  title="Thay đổi ảnh đại diện"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                  <span>{currentUser.fullName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentUser.employeeCode}
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  {currentUser.position} • {currentUser.department}
                </p>
                <p className="text-[11px] text-slate-400">
                  Hỗ trợ định dạng JPG, PNG hoặc GIF. Dung lượng tối đa 2MB.
                </p>
              </div>
            </div>

            {/* Readonly Identity Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Mã Nhân Viên</span>
                </label>
                <div className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  {currentUser.employeeCode}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>Bộ Phận / Ca Trực</span>
                </label>
                <div className="text-xs font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200 truncate">
                  {currentUser.department}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-slate-400" />
                  <span>Chức Danh / Vị Trí</span>
                </label>
                <div className="text-xs font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200 truncate">
                  {currentUser.position}
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Họ và Tên:</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  defaultValue={currentUser.fullName}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ngày Sinh:</span>
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  defaultValue={currentUser.dateOfBirth || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Số Điện Thoại Zalo:</span>
                </label>
                <input
                  type="tel"
                  name="zaloPhone"
                  defaultValue={currentUser.zaloPhone || ''}
                  placeholder="Nhập số điện thoại của bạn"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                Lưu Thay Đổi Hồ Sơ
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Bảo mật & Đổi mật khẩu</span>
            </h3>
            <p className="text-xs text-slate-500">Cập nhật mật khẩu để bảo vệ tài khoản của bạn</p>
          </div>
          {passwordSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {passwordSuccess}
            </span>
          )}
        </div>

        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại:
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mới:
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới:
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer"
              >
                Cập Nhật Mật Khẩu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
