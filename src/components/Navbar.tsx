import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  ChevronDown,
  Sparkles,
  Smartphone,
  Menu,
  X,
  Database,
  LogOut,
  RefreshCw,
  Key,
  MessageSquare,
  FileSpreadsheet,
} from 'lucide-react';
import { Employee } from '../types';
import { ROLE_CONFIGS } from '../mockData';

interface NavbarProps {
  currentUser: Employee;
  allUsers?: Employee[];
  allEmployees?: Employee[];
  onSwitchUser?: (user: Employee) => void;
  onSelectUser?: (user: Employee) => void;
  onLogout?: () => void;
  onSeedData?: () => void;
  onOpenMasterSync?: () => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  unreadCount?: number;
  unreadChatCount?: number;
  onToggleChat?: () => void;
  totalZaloSynced?: number;
  totalEmployees?: number;
  PostgreSQLOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  allEmployees,
  onSwitchUser,
  onSelectUser,
  onLogout,
  onSeedData,
  onOpenMasterSync,
  mobileMenuOpen = false,
  setMobileMenuOpen = (_open: boolean) => {},
  unreadChatCount = 0,
  onToggleChat,
  totalZaloSynced,
  totalEmployees,
  PostgreSQLOnline = true,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const usersList = allUsers || allEmployees || [];
  const switchUserHandler = onSwitchUser || onSelectUser || (() => {});
  const currentRoleConfig = currentUser?.role ? ROLE_CONFIGS[currentUser.role] : ROLE_CONFIGS.USER;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-3 transition-colors" style={{ backgroundColor: '#f5f7f7' }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & App title */}
        <div className="flex items-center gap-3">
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg leading-tight">
                  Quản Trị Nhân Sự & Vận Hành
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  AI Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Hệ thống Tra cứu Nội bộ • Đánh giá Năng lực • Tin nhắn Nội bộ • Camera AI
              </p>
            </div>
          </div>
        </div>

        {/* Right side controls: PostgreSQL Status, Internal Messaging, User profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Cloud PostgreSQL Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>PostgreSQL: Realtime DB</span>
          </div>

          {/* Internal Messaging Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>Thông báo nội bộ: </span>
            <span className="font-semibold">Hoạt động</span>
          </div>

          {/* Nút Tổng Admin: Đẩy toàn bộ dữ liệu lên Google Sheet (Data_RTG) */}
          {onOpenMasterSync && currentUser?.role === 'ADMIN' && (
            <button
              id="navbar-admin-sync-master-btn"
              type="button"
              onClick={onOpenMasterSync}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-emerald-200 cursor-pointer"
              title="Nút Tổng Admin: Đẩy toàn bộ 6 nguồn dữ liệu (Nhân sự, Vi phạm 5W1H, Bài thi, Sáng kiến, BXXL, Nghỉ phép) lên Google Sheet Data_RTG"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden xl:inline">Đẩy lên Google Sheet</span>
              <span className="hidden sm:inline xl:hidden">Đẩy Sheet</span>
            </button>
          )}

          {/* Internal Quick Chat Toggle Button */}
          {onToggleChat && (
            <button
              id="navbar-open-quickchat-btn"
              type="button"
              onClick={onToggleChat}
              className="relative flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-indigo-200"
              title="Mở cửa sổ Chat nhanh để nhận, đọc và gửi tin tức thì"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cửa Sổ Chat</span>
              {unreadChatCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ring-2 ring-white animate-bounce">
                  {unreadChatCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile Dropdown */}
          {currentUser && (
            <div className="relative">
              <button
                id="user-role-switcher-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-left"
              >
                <img
                  src={currentUser.avatar || undefined}
                  alt={currentUser.fullName}
                  className="w-8 h-8 rounded-lg object-cover ring-2 ring-indigo-500/20"
                />
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>{currentUser.position}</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border hidden lg:inline-block ${
                    currentRoleConfig?.badgeColor || ''
                  }`}
                >
                  {currentUser.role}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tài khoản xác thực Supabase
                    </p>
                    <p className="text-sm font-bold text-slate-900 truncate">{currentUser.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      <Key className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">UID: {currentUser.id}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {onOpenMasterSync && currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenMasterSync();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-emerald-50 text-emerald-700 transition-colors text-xs font-semibold"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đẩy toàn bộ lên Google Sheet (Data_RTG)</span>
                      </button>
                    )}

                    {onSeedData && currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onSeedData();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 text-indigo-700 transition-colors text-xs font-semibold"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Đồng bộ dữ liệu chuẩn lên PostgreSQL</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        if (onLogout) {
                          onLogout();
                        } else {
                          switchUserHandler(null as any);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-rose-50 text-rose-600 transition-colors text-xs font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất (Supabase Sign Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
