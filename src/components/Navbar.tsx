import React, { useState, useRef, useEffect } from "react";
import { BrandLogo, UserAvatar } from "./Brand";
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
} from "lucide-react";
import { Employee } from "../types";
import { ROLE_CONFIGS } from "../mockData";

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
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node))
        setDropdownOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [dropdownOpen]);

  const usersList = allUsers || allEmployees || [];
  const switchUserHandler = onSwitchUser || onSelectUser || (() => {});
  const currentRoleConfig = currentUser?.role
    ? ROLE_CONFIGS[currentUser.role]
    : ROLE_CONFIGS.USER;

  return (
    <header className="hict-topbar">
      <div className="hict-topbar-inner">
        <div className="hict-brand-lockup">
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="hict-icon-button lg:hidden"
            aria-label="Mở menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="workspace-navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <BrandLogo />
          <div className="hict-brand-caption">
            <strong>Điều hành RTG</strong>
            <span>Quản trị nhân sự & vận hành</span>
          </div>
        </div>
        <div className="hict-topbar-actions">
          <span className="hict-workspace-label">HICT / Không gian nội bộ</span>
          {onOpenMasterSync && currentUser?.role === "ADMIN" && (
            <button
              id="navbar-admin-sync-master-btn"
              type="button"
              onClick={onOpenMasterSync}
              className="hict-icon-button hict-sync-button"
              title="Đồng bộ báo cáo Google"
              aria-label="Đồng bộ báo cáo Google"
            >
              <FileSpreadsheet size={19} />
              <span className="hidden xl:inline">Báo cáo Google</span>
            </button>
          )}
          {onToggleChat && (
            <button
              id="navbar-open-quickchat-btn"
              type="button"
              onClick={onToggleChat}
              className="hict-icon-button relative"
              title="Mở cửa sổ Chat nhanh để nhận, đọc và gửi tin tức thì"
              aria-label="Mở cửa sổ Chat nhanh để nhận, đọc và gửi tin tức thì"
            >
              <MessageSquare size={20} />
              {unreadChatCount > 0 && (
                <span className="hict-unread-badge">
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              )}
            </button>
          )}
          {/* User Profile Dropdown */}
          {currentUser && (
            <div className="relative" ref={accountRef}>
              <button
                id="user-role-switcher-btn"
                aria-label={`Tài khoản ${currentUser.fullName}`}
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="hict-account-button"
              >
                <UserAvatar
                  src={currentUser.avatar}
                  name={currentUser.fullName}
                  className="w-9 h-9"
                />
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>{currentUser.position}</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border hidden lg:inline-block ${
                    currentRoleConfig?.badgeColor || ""
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
                      Tài khoản của bạn
                    </p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {currentUser.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {currentUser.email}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {onOpenMasterSync && currentUser.role === "ADMIN" && (
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
                      <span>Đăng xuất</span>
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
