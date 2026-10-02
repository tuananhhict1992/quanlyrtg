import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  CalendarDays,
  Menu,
} from 'lucide-react';
import { Employee, TabType } from '../types';
import { isTabAllowed } from '../utils/permissionUtils';

interface BottomNavProps {
  activeTab: TabType | 'settings';
  setActiveTab: (tab: TabType) => void;
  currentUser: Employee;
  onOpenMenu: () => void;
  badgeCounts?: {
    leave?: number;
    violations?: number;
    chat?: number;
  };
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenMenu,
  badgeCounts,
}) => {
  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Tổng quan',
      icon: LayoutDashboard,
      allowed: isTabAllowed('dashboard', currentUser),
    },
    {
      id: 'violations' as TabType,
      label: 'Sự cố / Lỗi',
      icon: AlertTriangle,
      badge: badgeCounts?.violations,
      allowed: isTabAllowed('violations', currentUser),
    },
    {
      id: 'hr' as TabType,
      label: 'Nhân sự',
      icon: Users,
      allowed: isTabAllowed('hr', currentUser),
    },
    {
      id: 'leave' as TabType,
      label: 'Nghỉ phép',
      icon: CalendarDays,
      badge: badgeCounts?.leave,
      allowed: isTabAllowed('leave', currentUser),
    },
  ];

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Thanh điều hướng nhanh di động"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          if (!item.allowed) return null;
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all relative cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-xs">
                    {item.badge! > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Nút Mở rộng Menu tất cả phân hệ */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex-1 flex flex-col items-center justify-center py-1 px-1 text-slate-500 hover:text-slate-800 font-medium transition-all relative cursor-pointer select-none active:scale-95"
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
            {Boolean(badgeCounts?.chat && badgeCounts.chat > 0) && (
              <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-indigo-600" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Thêm</span>
        </button>
      </div>
    </nav>
  );
};
