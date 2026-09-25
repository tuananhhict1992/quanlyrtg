import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  CheckCircle2,
  Lock,
  Unlock,
  Settings2,
  Save,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Check,
  ChevronRight,
  Building2,
  Layers,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  SlidersHorizontal,
  UserCheck,
  RefreshCw,
  Sliders,
  Award,
  HelpCircle,
} from 'lucide-react';
import {
  Employee,
  PermissionKey,
  UserRole,
  TabType,
  AppSettings,
  RoleTemplateConfig,
} from '../types';
import {
  ALL_PERMISSIONS,
  ROLE_CONFIGS,
  ALL_MODULE_TABS,
  DEFAULT_VISIBLE_TABS_BY_ROLE,
  ModuleTabConfig,
} from '../mockData';

const OFFICIAL_ROLES: UserRole[] = ['ADMIN', 'MANAGER_L1', 'MANAGER_L2', 'USER'];

interface RoleTemplateManagerProps {
  employees: Employee[];
  currentUser: Employee;
  appSettings: AppSettings | null;
  onSaveAppSettings: (settings: Partial<AppSettings>) => void;
  onBatchUpdateRolePermissions?: (
    role: UserRole,
    newPermissions: PermissionKey[],
    newVisibleTabs: TabType[],
    defaultScope?: 'ALL' | 'DIRECT' | 'NONE'
  ) => void;
  onSelectEmployeeForDetail?: (emp: Employee) => void;
  initialSelectedRole?: UserRole;
  viewMode?: 'ROLES' | 'MATRIX';
}

export const RoleTemplateManager: React.FC<RoleTemplateManagerProps> = ({
  employees,
  currentUser,
  appSettings,
  onSaveAppSettings,
  onBatchUpdateRolePermissions,
  onSelectEmployeeForDetail,
  initialSelectedRole = 'MANAGER_L1',
  viewMode = 'ROLES',
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialSelectedRole);
  const [activeTab, setActiveTab] = useState<'PERMS' | 'MENUS' | 'SCOPE' | 'USERS'>('PERMS');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Lấy cấu hình tệp quyền của vai trò hiện tại
  const currentRoleCustomTemplate = appSettings?.customRoleTemplates?.[selectedRole];

  const defaultRolePerms = useMemo(() => {
    return ROLE_CONFIGS[selectedRole]?.defaultPermissions || [];
  }, [selectedRole]);

  const defaultRoleTabs = useMemo(() => {
    return DEFAULT_VISIBLE_TABS_BY_ROLE[selectedRole] || [];
  }, [selectedRole]);

  const defaultRoleScope = useMemo(() => {
    return selectedRole === 'ADMIN' || selectedRole === 'MANAGER_L1'
      ? 'ALL'
      : selectedRole === 'MANAGER_L2'
      ? 'DIRECT'
      : 'NONE';
  }, [selectedRole]);

  // State cục bộ cho cấu hình tệp vai trò được chọn
  const [currentPerms, setCurrentPerms] = useState<PermissionKey[]>(
    currentRoleCustomTemplate?.permissions || defaultRolePerms
  );
  const [currentTabs, setCurrentTabs] = useState<TabType[]>(
    currentRoleCustomTemplate?.visibleTabs || defaultRoleTabs
  );
  const [currentScope, setCurrentScope] = useState<'ALL' | 'DIRECT' | 'NONE'>(
    currentRoleCustomTemplate?.defaultScope || defaultRoleScope
  );

  // Cập nhật state khi đổi vai trò hoặc appSettings thay đổi
  useEffect(() => {
    const custom = appSettings?.customRoleTemplates?.[selectedRole];
    setCurrentPerms(custom?.permissions || defaultRolePerms);
    setCurrentTabs(custom?.visibleTabs || defaultRoleTabs);
    setCurrentScope(custom?.defaultScope || defaultRoleScope);
    setSaveSuccess(null);
  }, [selectedRole, appSettings, defaultRolePerms, defaultRoleTabs, defaultRoleScope]);

  // Danh sách nhân sự thuộc vai trò được chọn
  const matchingEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedRole === 'MANAGER_L1') return e.role === 'MANAGER_L1' || e.role === 'MANAGER';
      if (selectedRole === 'USER') return e.role === 'USER' || e.role === 'VIEWER';
      return e.role === selectedRole;
    });
  }, [employees, selectedRole]);

  // Nhóm quyền nghiệp vụ theo danh mục
  const permissionsByCategory = useMemo(() => {
    const map = new Map<string, typeof ALL_PERMISSIONS>();
    ALL_PERMISSIONS.forEach((perm) => {
      const cat = perm.category || 'Quyền Hạn Khác';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(perm);
    });
    return map;
  }, []);

  // Toggle quyền trong tệp vai trò
  const handleTogglePerm = (permKey: PermissionKey) => {
    if (selectedRole === 'ADMIN') return; // Admin luôn có toàn quyền
    setCurrentPerms((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
    setSaveSuccess(null);
  };

  // Toggle menu tab trong tệp vai trò
  const handleToggleTab = (tabId: TabType) => {
    if (selectedRole === 'ADMIN') return; // Admin luôn thấy tất cả
    setCurrentTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
    setSaveSuccess(null);
  };

  // Toggle cả nhóm quyền
  const handleToggleCategory = (categoryName: string, enable: boolean) => {
    if (selectedRole === 'ADMIN') return;
    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === categoryName).map((p) => p.key);
    setCurrentPerms((prev) => {
      if (enable) {
        return Array.from(new Set([...prev, ...catPerms]));
      } else {
        return prev.filter((k) => !catPerms.includes(k));
      }
    });
    setSaveSuccess(null);
  };

  // Lưu cấu hình mẫu vai trò vào AppSettings
  const handleSaveRoleTemplateOnly = () => {
    const updatedTemplates = {
      ...(appSettings?.customRoleTemplates || {}),
      [selectedRole]: {
        permissions: currentPerms,
        visibleTabs: currentTabs,
        defaultScope: currentScope,
      },
    };
    onSaveAppSettings({
      customRoleTemplates: updatedTemplates,
    });
    setSaveSuccess(`Đã lưu tệp cấu hình mẫu cho vai trò ${ROLE_CONFIGS[selectedRole]?.name}!`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  // Áp dụng tệp quyền cho toàn bộ nhân sự thuộc vai trò
  const handleApplyToAllMatchingUsers = async () => {
    if (!onBatchUpdateRolePermissions) {
      alert('Tính năng đồng bộ hàng loạt chưa sẵn sàng.');
      return;
    }

    const roleName = ROLE_CONFIGS[selectedRole]?.name || selectedRole;
    const count = matchingEmployees.length;

    const confirmMsg = `Bạn có chắc chắn muốn áp dụng tệp quyền & menu này cho toàn bộ ${count} nhân sự thuộc vai trò "${roleName}"?\n\nThao tác này sẽ đồng bộ lại quyền nghiệp vụ và danh mục menu cho tất cả các tài khoản này trên hệ thống.`;
    if (!confirm(confirmMsg)) return;

    setIsApplying(true);
    try {
      await onBatchUpdateRolePermissions(selectedRole, currentPerms, currentTabs, currentScope);
      setSaveSuccess(`Đã đồng bộ thành công tệp quyền & menu cho toàn bộ ${count} nhân sự ${roleName}!`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      alert(`Lỗi khi đồng bộ: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Khôi phục mặc định gốc hệ thống
  const handleResetToSystemDefault = () => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn khôi phục tệp cấu hình của vai trò "${ROLE_CONFIGS[selectedRole]?.name}" về mặc định gốc của hệ thống?`
      )
    )
      return;

    setCurrentPerms(defaultRolePerms);
    setCurrentTabs(defaultRoleTabs);
    setCurrentScope(defaultRoleScope);

    const updatedTemplates = { ...(appSettings?.customRoleTemplates || {}) };
    delete updatedTemplates[selectedRole];

    onSaveAppSettings({
      customRoleTemplates: updatedTemplates,
    });

    setSaveSuccess(`Đã khôi phục tệp vai trò ${ROLE_CONFIGS[selectedRole]?.name} về mặc định hệ thống.`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  // Nếu hiển thị Ma Trận Tổng Quan (MATRIX)
  if (viewMode === 'MATRIX') {
    return (
      <div className="space-y-6">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 via-slate-50 to-white rounded-3xl border border-indigo-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Ma Trận Phân Quyền & Menu 4 Vai Trò Hệ Thống
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bảng so sánh trực quan quyền hạn nghiệp vụ và các phân hệ chức năng giữa 4 cấp vai trò: <b>Admin</b>, <b>Quản lý cấp 1</b>, <b>Quản lý cấp 2</b> và <b>Người dùng</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold text-xs w-1/3">Quyền Hạn / Menu Nghiệp Vụ</th>
                  {OFFICIAL_ROLES.map((r) => {
                    const conf = ROLE_CONFIGS[r];
                    const count = employees.filter((e) => {
                      if (r === 'MANAGER_L1') return e.role === 'MANAGER_L1' || e.role === 'MANAGER';
                      if (r === 'USER') return e.role === 'USER' || e.role === 'VIEWER';
                      return e.role === r;
                    }).length;

                    return (
                      <th key={r} className="py-3 px-3 font-bold text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${conf.badgeColor}`}>
                            {conf.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {count} tài khoản
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Phân hệ Menu */}
                <tr className="bg-indigo-50/60 font-bold text-indigo-950 text-xs">
                  <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>PHÂN HỆ MENU / TAB CHỨC NĂNG HIỂN THỊ</span>
                  </td>
                </tr>
                {ALL_MODULE_TABS.map((tab) => (
                  <tr key={tab.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      <div>{tab.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{tab.description}</div>
                    </td>
                    {OFFICIAL_ROLES.map((r) => {
                      const customTabs = appSettings?.customRoleTemplates?.[r]?.visibleTabs;
                      const roleTabs = customTabs || DEFAULT_VISIBLE_TABS_BY_ROLE[r] || [];
                      const isAllowed = r === 'ADMIN' || roleTabs.includes(tab.id);

                      return (
                        <td key={r} className="py-2.5 px-3 text-center">
                          {isAllowed ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* 2. Quyền Nghiệp Vụ */}
                <tr className="bg-indigo-50/60 font-bold text-indigo-950 text-xs">
                  <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>QUYỀN NGHIỆP VỤ & TÁC NGHIỆP HỆ THỐNG</span>
                  </td>
                </tr>
                {ALL_PERMISSIONS.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{perm.label}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                          {perm.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">{perm.description}</div>
                    </td>
                    {OFFICIAL_ROLES.map((r) => {
                      const customPerms = appSettings?.customRoleTemplates?.[r]?.permissions;
                      const rolePerms = customPerms || ROLE_CONFIGS[r]?.defaultPermissions || [];
                      const isAllowed = r === 'ADMIN' || rolePerms.includes(perm.key);

                      return (
                        <td key={r} className="py-2.5 px-3 text-center">
                          {isAllowed ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Chế độ ROLES: Cài đặt chi tiết theo tệp 4 vai trò
  return (
    <div className="space-y-6">
      {/* 4 Interactive Role Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {OFFICIAL_ROLES.map((roleKey) => {
          const conf = ROLE_CONFIGS[roleKey];
          const isSelected = selectedRole === roleKey;
          const isCustomized = Boolean(appSettings?.customRoleTemplates?.[roleKey]);
          const count = employees.filter((e) => {
            if (roleKey === 'MANAGER_L1') return e.role === 'MANAGER_L1' || e.role === 'MANAGER';
            if (roleKey === 'USER') return e.role === 'USER' || e.role === 'VIEWER';
            return e.role === roleKey;
          }).length;

          return (
            <div
              key={roleKey}
              onClick={() => setSelectedRole(roleKey)}
              className={`p-4 rounded-3xl cursor-pointer transition-all border flex flex-col justify-between space-y-2 relative shadow-2xs ${
                isSelected
                  ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300 shadow-md'
                  : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${conf.badgeColor}`}>
                    {conf.name}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                    {count} nhân sự
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  {conf.name}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {conf.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded ${
                    isCustomized
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isCustomized ? 'Đã tùy chỉnh mẫu' : 'Mặc định chuẩn'}
                </span>
                <span className="font-bold text-indigo-600 flex items-center gap-0.5">
                  <span>{isSelected ? 'Đang cấu hình' : 'Chọn tệp'}</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Workspace Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-100">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Cài Đặt Tệp Quyền: {ROLE_CONFIGS[selectedRole]?.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ROLE_CONFIGS[selectedRole]?.badgeColor}`}>
                  {matchingEmployees.length} nhân sự thuộc vai trò này
                </span>
                {selectedRole === 'ADMIN' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                    Toàn quyền hệ thống
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấu hình phân quyền & menu chuẩn cho tất cả nhân sự thuộc tệp vai trò này. Khi lưu hoặc áp dụng, hệ thống sẽ đồng bộ cho toàn bộ nhân sự.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedRole !== 'ADMIN' && (
              <button
                type="button"
                onClick={handleResetToSystemDefault}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                title="Khôi phục tệp cấu hình vai trò này về mặc định ban đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mặc định gốc</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveRoleTemplateOnly}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu mẫu vai trò</span>
            </button>
            <button
              type="button"
              disabled={isApplying}
              onClick={handleApplyToAllMatchingUsers}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-200 disabled:opacity-60"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {isApplying
                  ? 'Đang đồng bộ...'
                  : `Áp dụng cho ${matchingEmployees.length} nhân sự`}
              </span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Sub-tabs for Role Template */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('PERMS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PERMS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Quyền Nghiệp Vụ ({currentPerms.length}/{ALL_PERMISSIONS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MENUS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'MENUS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Menu & Phân Hệ ({currentTabs.length}/{ALL_MODULE_TABS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SCOPE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SCOPE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Phạm Vi Quản Lý Bộ Phận</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'USERS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Nhân Sự Thuộc Vai Trò ({matchingEmployees.length})</span>
          </button>
        </div>

        {/* Tab 1: Quyền nghiệp vụ */}
        {activeTab === 'PERMS' && (
          <div className="space-y-6">
            {selectedRole === 'ADMIN' ? (
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-3">
                <Lock className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <span className="font-bold">Vai trò Quản trị viên (Admin):</span> Mặc định luôn sở hữu toàn bộ các quyền quản lý và nghiệp vụ trong hệ thống để bảo đảm khả năng vận hành toàn diện.
                </div>
              </div>
            ) : null}

            {Array.from(permissionsByCategory.entries()).map(([category, perms]) => {
              const allChecked = perms.every((p) => currentPerms.includes(p.key));
              const someChecked = perms.some((p) => currentPerms.includes(p.key));

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-extrabold text-slate-800 text-xs tracking-tight uppercase flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      {category}
                    </span>
                    {selectedRole !== 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(category, !allChecked)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        {allChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        <span>{allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả nhóm'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {perms.map((perm) => {
                      const isGranted = selectedRole === 'ADMIN' || currentPerms.includes(perm.key);

                      return (
                        <div
                          key={perm.key}
                          onClick={() => handleTogglePerm(perm.key)}
                          className={`p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                            isGranted
                              ? 'bg-indigo-50/50 border-indigo-200 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                          } ${selectedRole === 'ADMIN' ? 'cursor-default opacity-90' : ''}`}
                        >
                          <div className="pt-0.5">
                            {isGranted ? (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-slate-900 block">
                              {perm.label}
                            </span>
                            <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                              {perm.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Menu / Module Tabs */}
        {activeTab === 'MENUS' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Chọn các menu, phân hệ được phép xuất hiện trên thanh điều hướng của nhân sự thuộc vai trò <b>{ROLE_CONFIGS[selectedRole]?.name}</b>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_MODULE_TABS.map((mod) => {
                const isVisible = selectedRole === 'ADMIN' || currentTabs.includes(mod.id);

                return (
                  <div
                    key={mod.id}
                    onClick={() => handleToggleTab(mod.id)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isVisible
                        ? 'bg-emerald-50/60 border-emerald-200 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                    } ${selectedRole === 'ADMIN' ? 'cursor-default opacity-90' : ''}`}
                  >
                    <div className="pt-0.5">
                      {isVisible ? (
                        <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900">{mod.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isVisible
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isVisible ? 'Hiển thị' : 'Ẩn'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                        {mod.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Phạm vi bộ phận mặc định */}
        {activeTab === 'SCOPE' && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-xs text-slate-500">
              Quy định phạm vi bộ phận mà nhân sự thuộc vai trò <b>{ROLE_CONFIGS[selectedRole]?.name}</b> được phép quản lý và bình xét:
            </p>

            <div className="space-y-2.5">
              <label
                onClick={() => setCurrentScope('ALL')}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentScope === 'ALL'
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Toàn bộ các bộ phận trong đơn vị (Tất cả ca RTG & Đội cơ giới)
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Phù hợp cho Quản trị viên và Quản lý cấp 1 (Tổ trưởng / Trưởng bộ phận) phụ trách chung.
                  </span>
                </div>
                <input
                  type="radio"
                  name="roleScope"
                  checked={currentScope === 'ALL'}
                  onChange={() => setCurrentScope('ALL')}
                  className="w-4 h-4 text-indigo-600"
                />
              </label>

              <label
                onClick={() => setCurrentScope('DIRECT')}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentScope === 'DIRECT'
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Chỉ bộ phận trực thuộc của từng nhân viên (Theo Ca RTG của nhân sự)
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Phù hợp cho Quản lý cấp 2 (Tổ phó / Quản lý ca) chỉ phụ trách nhân sự ca của mình.
                  </span>
                </div>
                <input
                  type="radio"
                  name="roleScope"
                  checked={currentScope === 'DIRECT'}
                  onChange={() => setCurrentScope('DIRECT')}
                  className="w-4 h-4 text-indigo-600"
                />
              </label>

              <label
                onClick={() => setCurrentScope('NONE')}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentScope === 'NONE'
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Không quản lý bộ phận nào (Tài khoản cá nhân / Lái cẩu)
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Phù hợp cho nhân viên vận hành, người dùng thông thường chỉ thao tác hồ sơ của bản thân.
                  </span>
                </div>
                <input
                  type="radio"
                  name="roleScope"
                  checked={currentScope === 'NONE'}
                  onChange={() => setCurrentScope('NONE')}
                  className="w-4 h-4 text-indigo-600"
                />
              </label>
            </div>
          </div>
        )}

        {/* Tab 4: Danh sách nhân sự thuộc vai trò */}
        {activeTab === 'USERS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Tổng cộng có <b>{matchingEmployees.length}</b> tài khoản thuộc vai trò{' '}
                <b>{ROLE_CONFIGS[selectedRole]?.name}</b>:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchingEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 transition-all flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={emp.avatar}
                      alt={emp.fullName}
                      className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {emp.employeeCode} • {emp.department}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {emp.status === 'ACTIVE' ? 'Đã cấp quyền' : 'Khóa'}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {emp.assignedPermissions?.length || 0} quyền
                        </span>
                      </div>
                    </div>
                  </div>

                  {onSelectEmployeeForDetail && (
                    <button
                      type="button"
                      onClick={() => onSelectEmployeeForDetail(emp)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold shrink-0 transition-colors"
                    >
                      Chi tiết
                    </button>
                  )}
                </div>
              ))}

              {matchingEmployees.length === 0 && (
                <div className="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Chưa có nhân sự nào được phân bổ vai trò này.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
