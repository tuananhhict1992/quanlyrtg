import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Lightbulb,
  MessageSquareShare,
  BellRing,
  Camera,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  HardDrive,
  Award,
  FileSpreadsheet,
  CalendarDays,
  SlidersHorizontal,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { Employee, PermissionKey, TabType } from '../types';
import { ROLE_CONFIGS, DEFAULT_VISIBLE_TABS_BY_ROLE } from '../mockData';
import { isTabAllowed } from '../utils/permissionUtils';

export type { TabType };

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser: Employee;
  pendingFeedbacksCount?: number;
  openQuizzesCount?: number;
  pendingLeavesCount?: number;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  badgeCounts?: {
    library?: number;
    quiz?: number;
    feedback?: number;
    zalo?: number;
    leave?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingFeedbacksCount = 0,
  openQuizzesCount = 0,
  pendingLeavesCount = 0,
  mobileMenuOpen = false,
  setMobileMenuOpen = (_open: boolean) => {},
  badgeCounts,
}) => {
  const resolvedPendingFeedbacks = badgeCounts?.feedback ?? pendingFeedbacksCount;
  const resolvedOpenQuizzes = badgeCounts?.quiz ?? openQuizzesCount;
  const resolvedPendingLeaves = badgeCounts?.leave ?? pendingLeavesCount;

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    return (currentUser.assignedPermissions || []).includes(permission);
  };

  const navItems: {
    id: TabType;
    label: string;
    sublabel?: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
    requiresPermission?: PermissionKey;
    highlight?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Tổng quan & Thống kê',
      sublabel: 'Báo cáo số liệu quản trị',
      icon: LayoutDashboard,
      requiresPermission: 'VIEW_ANALYTICS',
    },
    {
      id: 'hr',
      label: 'Quản lý Nhân sự',
      sublabel: 'Hồ sơ, phòng ban & Zalo',
      icon: Users,
      requiresPermission: 'MANAGE_HR',
    },
    {
      id: 'violations',
      label: 'Vi phạm & Sự cố',
      sublabel: 'Phân tích sự cố & vi phạm',
      icon: AlertTriangle,
    },
    {
      id: 'bxxl',
      label: 'Bình xét Xếp loại (BXXL)',
      sublabel: 'Đánh giá tháng & Xuất Word',
      icon: Award,
      requiresPermission: 'MANAGE_BXXL',
    },
    {
      id: 'leave',
      label: 'Đăng ký Nghỉ phép',
      sublabel: '1 ngày, dài ngày & duyệt nghỉ',
      icon: CalendarDays,
      badge: resolvedPendingLeaves > 0 ? `${resolvedPendingLeaves} chờ` : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'container_tool',
      label: 'Xử lý Dữ liệu Bãi',
      sublabel: 'Tự động hóa Excel Block A/B',
      icon: FileSpreadsheet,
    },
    {
      id: 'drive',
      label: 'Google Drive',
      sublabel: 'Quản lý tệp đám mây',
      icon: HardDrive,
    },
    {
      id: 'quiz',
      label: 'Kiểm tra Trắc nghiệm',
      sublabel: 'Đánh giá năng lực tự động',
      icon: GraduationCap,
      badge: resolvedOpenQuizzes > 0 ? `${resolvedOpenQuizzes} bài` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'feedback',
      label: 'Góp ý & Đề xuất',
      sublabel: 'Ý kiến, văn bản & hình ảnh',
      icon: Lightbulb,
      badge: resolvedPendingFeedbacks > 0 ? `${resolvedPendingFeedbacks} mới` : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'zalo',
      label: 'Tin nhắn nội bộ',
      sublabel: 'Cá nhân, Ca trực, Toàn thể',
      icon: BellRing,
      requiresPermission: 'MANAGE_ZALO',
    },
    {
      id: 'competency_rules',
      label: 'Quy chuẩn Đánh giá',
      sublabel: 'Thang điểm Tháng & Năm',
      icon: Scale,
      requiresPermission: 'MANAGE_PERMISSIONS',
    },
    {
      id: 'permissions',
      label: 'Cấp quyền & Hiển thị',
      sublabel: 'Phân quyền từng tài khoản',
      icon: ShieldAlert,
      requiresPermission: 'MANAGE_PERMISSIONS',
    },
    {
      id: 'settings',
      label: 'Cài đặt Tài khoản',
      sublabel: 'Cập nhật thông tin',
      icon: Users,
    },
  ];

  // Quyền hiển thị menu:
  // Nếu là ADMIN: hiển thị tất cả
  // Nếu có cấu hình visibleTabs riêng: chỉ hiển thị các tab trong visibleTabs
  // Nếu không: lấy theo DEFAULT_VISIBLE_TABS_BY_ROLE của role hiện tại
  const configuredVisibleTabs: TabType[] =
    currentUser.role === 'ADMIN'
      ? ['dashboard', 'hr', 'violations', 'bxxl', 'leave', 'container_tool', 'drive', 'quiz', 'feedback', 'zalo', 'competency_rules', 'permissions', 'settings']
      : currentUser.visibleTabs && currentUser.visibleTabs.length > 0
      ? currentUser.visibleTabs
      : DEFAULT_VISIBLE_TABS_BY_ROLE[currentUser.role] || ['violations', 'leave', 'container_tool', 'quiz', 'feedback', 'settings'];

  const visibleNavItems = navItems.filter((item) => {
    return isTabAllowed(item.id, currentUser);
  });

  const handleSelect = (id: TabType) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const roleInfo = (currentUser?.role && ROLE_CONFIGS[currentUser.role]) || ROLE_CONFIGS.USER;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header for Mobile */}
        <div className="p-4 border-b border-slate-100 lg:hidden flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              HR
            </div>
            <span className="font-bold text-slate-800 text-sm">Quản Trị Doanh Nghiệp</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-500 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/80 border border-slate-200/80">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.fullName}
              className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-xs"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">{currentUser.fullName}</h4>
              <p className="text-xs text-slate-500 truncate">{currentUser.department}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleInfo.badgeColor}`}
                >
                  {currentUser.role}
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                  {currentUser.competencyScore}đ NL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Các hạng mục chức năng
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isAccessible = !item.requiresPermission || hasPermission(item.requiresPermission);
            const isCurrent = activeTab === item.id;

            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                id={`nav-item-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                } ${!isAccessible ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : item.highlight
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate leading-tight">
                        {item.label}
                      </span>
                      {item.highlight && !isCurrent && (
                        <Sparkles className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    {item.sublabel && (
                      <p
                        className={`text-[10px] truncate ${
                          isCurrent ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {item.sublabel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isCurrent ? 'bg-white/25 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? 'text-indigo-200' : 'text-slate-300'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 mx-3 mb-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
          <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
            <span>Kênh Zalo Đồng bộ</span>
            <span className="text-blue-600">{currentUser.zaloPhone}</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Hệ thống tự động thông báo kết quả thi & duyệt đề xuất qua Zalo.
          </p>
        </div>
      </aside>
    </>
  );
};
