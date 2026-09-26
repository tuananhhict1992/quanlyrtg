import {GoogleSyncPanel} from './GoogleSyncPanel';
import React, { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  Lock,
  Unlock,
  Users,
  Settings2,
  Save,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Eye,
  EyeOff,
  Sliders,
  Search,
  RotateCcw,
  Check,
  ChevronRight,
  Building2,
  Layers,
  CheckSquare,
  Square,
  Scale,
  SlidersHorizontal,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  RefreshCw,
  Send,
  Code,
  CheckCircle,
  HelpCircle,
  Clock,
  Radio,
  Truck,
  Flame,
  Link2,
  BookOpen,
  GraduationCap,
  AlertTriangle,
} from 'lucide-react';
import { CompetencyStandardsView } from './CompetencyStandardsView';
import { RoleTemplateManager } from './RoleTemplateManager';
import {
  Employee,
  PermissionKey,
  UserRole,
  TabType,
  AppSettings,
  QuizSubmission,
  FeedbackProposal,
  BxxlRecord,
  IncidentViolation,
} from '../types';
import {
  ALL_PERMISSIONS,
  ROLE_CONFIGS,
  ALL_MODULE_TABS,
  DEFAULT_VISIBLE_TABS_BY_ROLE,
  ModuleTabConfig,
} from '../mockData';
import {
  testGoogleSheetWebhook,
  syncAllDataToGoogleSheet,
  syncAllQuizzesToSheet,
  syncAllFeedbacksToSheet,
  syncAllBxxlToSheet,
  syncAllEmployeesToSheet,
  syncAllViolationsToSheet,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../services/googleSheetSyncService';

interface PermissionsViewProps {
  employees: Employee[];
  currentUser: Employee;
  appSettings: AppSettings | null;
  onUpdateEmployeePermissions: (
    employeeId: string,
    newPermissions: PermissionKey[],
    newVisibleTabs?: TabType[],
    managedDepartments?: string[]
  ) => void;
  onUpdateEmployeeRole: (employeeId: string, newRole: UserRole) => void;
  onBatchUpdateRolePermissions?: (
    role: UserRole,
    newPermissions: PermissionKey[],
    newVisibleTabs: TabType[],
    defaultScope?: 'ALL' | 'DIRECT' | 'NONE'
  ) => void;
  onSaveAppSettings: (settings: Partial<AppSettings>) => void;
  onBackToDashboard?: () => void;
  initialSelectedEmpId?: string;
  onUpdateEmployee?: (emp: Employee) => void;
  initialViewSection?: 'PERMISSIONS' | 'COMPETENCY' | 'GOOGLE_SHEETS' | 'QUICK_LINKS';
  allSubmissions?: QuizSubmission[];
  allFeedbacks?: FeedbackProposal[];
  allBxxlRecords?: BxxlRecord[];
  allViolations?: IncidentViolation[];
}

// 4 Cấp vai trò chuẩn hóa đơn thuần
const OFFICIAL_ROLES: UserRole[] = ['ADMIN', 'MANAGER_L1', 'MANAGER_L2', 'USER'];

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  employees = [],
  currentUser,
  appSettings,
  onUpdateEmployeePermissions,
  onUpdateEmployeeRole,
  onBatchUpdateRolePermissions,
  onSaveAppSettings,
  onBackToDashboard,
  initialSelectedEmpId,
  onUpdateEmployee,
  initialViewSection,
  allSubmissions = [],
  allFeedbacks = [],
  allBxxlRecords = [],
  allViolations = [],
}) => {
  const [viewSection, setViewSection] = useState<'PERMISSIONS' | 'COMPETENCY' | 'GOOGLE_SHEETS' | 'QUICK_LINKS'>(
    initialViewSection || 'PERMISSIONS'
  );
  const [permissionsSubMode, setPermissionsSubMode] = useState<'ROLES' | 'INDIVIDUAL' | 'MATRIX'>(
    initialSelectedEmpId ? 'INDIVIDUAL' : 'ROLES'
  );

  React.useEffect(() => {
    if (initialViewSection) {
      setViewSection(initialViewSection);
    }
  }, [initialViewSection]);

  // Quick Links State for Dashboard Buttons
  const [traCuuLink, setTraCuuLink] = useState(appSettings?.traCuuLink || '');
  const [libraryLink, setLibraryLink] = useState(appSettings?.libraryLink || appSettings?.nqQdDriveLink || '');
  const [vehicleStatusLink, setVehicleStatusLink] = useState(appSettings?.vehicleStatusLink || '');
  const [engineRoofIncidentLink, setEngineRoofIncidentLink] = useState(appSettings?.engineRoofIncidentLink || '');
  const [violationReportLink, setViolationReportLink] = useState(appSettings?.violationReportLink || '');
  const [quizLink, setQuizLink] = useState(appSettings?.quizLink || '');
  const [quickLinksSavedMsg, setQuickLinksSavedMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (appSettings) {
      setTraCuuLink(appSettings.traCuuLink || '');
      setLibraryLink(appSettings.libraryLink || appSettings.nqQdDriveLink || '');
      setVehicleStatusLink(appSettings.vehicleStatusLink || '');
      setEngineRoofIncidentLink(appSettings.engineRoofIncidentLink || '');
      setViolationReportLink(appSettings.violationReportLink || '');
      setQuizLink(appSettings.quizLink || '');
    }
  }, [appSettings]);

  const handleSaveQuickLinks = () => {
    onSaveAppSettings({
      traCuuLink: traCuuLink.trim(),
      libraryLink: libraryLink.trim(),
      nqQdDriveLink: libraryLink.trim() || appSettings?.nqQdDriveLink || '',
      vehicleStatusLink: vehicleStatusLink.trim(),
      engineRoofIncidentLink: engineRoofIncidentLink.trim(),
      violationReportLink: violationReportLink.trim(),
      quizLink: quizLink.trim(),
    });
    setQuickLinksSavedMsg('Đã lưu cấu hình đường link các nút tính năng Tổng quan thành công!');
    setTimeout(() => setQuickLinksSavedMsg(null), 3000);
  };

  // Danh sách toàn bộ các bộ phận trong đơn vị
  const allDepartments = useMemo(() => {
    const list = Array.from(
      new Set(employees.map((e) => e.department?.trim()).filter(Boolean) as string[])
    );
    if (list.length === 0) {
      return ['RTG ca 1', 'RTG ca 2', 'RTG ca 3', 'RTG ca 4', 'Đội Cơ giới', 'Phòng Khai thác'];
    }
    return list.sort();
  }, [employees]);

  // Nhân sự được chọn
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialSelectedEmpId || employees[0]?.id || ''
  );

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || employees[0];
  }, [employees, selectedEmpId]);

  // Trạng thái quyền nghiệp vụ
  const [currentPermissions, setCurrentPermissions] = useState<PermissionKey[]>(
    selectedEmployee?.assignedPermissions || []
  );

  // Trạng thái menu hiển thị
  const [currentVisibleTabs, setCurrentVisibleTabs] = useState<TabType[]>(() => {
    if (!selectedEmployee) return [];
    if (selectedEmployee.visibleTabs && selectedEmployee.visibleTabs.length > 0) {
      return selectedEmployee.visibleTabs;
    }
    return (
      DEFAULT_VISIBLE_TABS_BY_ROLE[selectedEmployee.role] || [
        'leave',
        'container_tool',
        'library',
        'quiz',
        'feedback',
        'settings',
      ]
    );
  });

  // Trạng thái các bộ phận được chỉ định quản lý
  const [currentManagedDepts, setCurrentManagedDepts] = useState<string[]>(() => {
    if (!selectedEmployee) return [];
    if (selectedEmployee.managedDepartments && selectedEmployee.managedDepartments.length > 0) {
      return selectedEmployee.managedDepartments;
    }
    if (selectedEmployee.role === 'ADMIN' || selectedEmployee.role === 'MANAGER_L1' || selectedEmployee.role === 'MANAGER') {
      return ['ALL'];
    }
    if (selectedEmployee.role === 'MANAGER_L2') {
      return [selectedEmployee.department];
    }
    return [];
  });

  const [activeSubTab, setActiveSubTab] = useState<'DEPTS' | 'PERMISSIONS' | 'MENUS'>('DEPTS');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Chọn nhân viên khác
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmpId(emp.id);
    setCurrentPermissions(emp.assignedPermissions || []);
    
    const tabs =
      emp.visibleTabs && emp.visibleTabs.length > 0
        ? emp.visibleTabs
        : DEFAULT_VISIBLE_TABS_BY_ROLE[emp.role] || [
            'container_tool',
            'library',
            'quiz',
            'feedback',
            'settings',
          ];
    setCurrentVisibleTabs(tabs);

    const depts =
      emp.managedDepartments && emp.managedDepartments.length > 0
        ? emp.managedDepartments
        : emp.role === 'ADMIN' || emp.role === 'MANAGER_L1' || emp.role === 'MANAGER'
        ? ['ALL']
        : emp.role === 'MANAGER_L2'
        ? [emp.department]
        : [];
    setCurrentManagedDepts(depts);

    setSaveSuccess(null);
    setMobileShowDetail(true);
  };

  // Toggle quyền nghiệp vụ
  const handleTogglePermission = (permKey: PermissionKey) => {
    if (selectedEmployee?.role === 'ADMIN') return;
    setCurrentPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
    setSaveSuccess(null);
  };

  // Toggle tab hiển thị
  const handleToggleVisibleTab = (tabId: TabType) => {
    if (selectedEmployee?.role === 'ADMIN') return;
    setCurrentVisibleTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
    setSaveSuccess(null);
  };

  // Quản lý phạm vi bộ phận
  const isManagingAllDepts = currentManagedDepts.includes('ALL');

  const handleToggleManageAll = () => {
    if (isManagingAllDepts) {
      // Switch to selecting specifically current employee's dept
      setCurrentManagedDepts(selectedEmployee?.department ? [selectedEmployee.department] : []);
    } else {
      setCurrentManagedDepts(['ALL']);
    }
    setSaveSuccess(null);
  };

  const handleToggleDepartment = (deptName: string) => {
    if (isManagingAllDepts) {
      // If currently ALL, replace with all depts except this one, or initialize selection
      const otherDepts = allDepartments.filter((d) => d !== deptName);
      setCurrentManagedDepts(otherDepts);
    } else {
      setCurrentManagedDepts((prev) =>
        prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
      );
    }
    setSaveSuccess(null);
  };

  const handleSelectAllDepartments = () => {
    setCurrentManagedDepts(['ALL']);
    setSaveSuccess(null);
  };

  const handleClearAllDepartments = () => {
    setCurrentManagedDepts([]);
    setSaveSuccess(null);
  };

  // Lưu phân quyền
  const handleSave = () => {
    if (!selectedEmployee) return;
    onUpdateEmployeePermissions(
      selectedEmployee.id,
      currentPermissions,
      currentVisibleTabs,
      currentManagedDepts
    );
    setSaveSuccess(`Đã lưu thành công phân quyền cho ${selectedEmployee.fullName}!`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  // Khôi phục mặc định vai trò
  const handleResetToRoleDefault = () => {
    if (!selectedEmployee) return;
    const defaultPerms = ROLE_CONFIGS[selectedEmployee.role]?.defaultPermissions || [];
    const defaultTabs =
      DEFAULT_VISIBLE_TABS_BY_ROLE[selectedEmployee.role] || ['container_tool', 'library', 'settings'];
    const defaultDepts =
      selectedEmployee.role === 'ADMIN' || selectedEmployee.role === 'MANAGER_L1'
        ? ['ALL']
        : selectedEmployee.role === 'MANAGER_L2'
        ? [selectedEmployee.department]
        : [];

    setCurrentPermissions(defaultPerms);
    setCurrentVisibleTabs(defaultTabs);
    setCurrentManagedDepts(defaultDepts);
    onUpdateEmployeePermissions(selectedEmployee.id, defaultPerms, defaultTabs, defaultDepts);
    setSaveSuccess(`Đã khôi phục quyền mặc định cho ${ROLE_CONFIGS[selectedEmployee.role]?.name}!`);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // Đổi vai trò
  const handleChangeRole = (newRole: UserRole) => {
    if (!selectedEmployee) return;
    onUpdateEmployeeRole(selectedEmployee.id, newRole);
    const newDefaults = ROLE_CONFIGS[newRole]?.defaultPermissions || [];
    const newTabs = DEFAULT_VISIBLE_TABS_BY_ROLE[newRole] || ['container_tool', 'library', 'settings'];
    const newDepts =
      newRole === 'ADMIN' || newRole === 'MANAGER_L1'
        ? ['ALL']
        : newRole === 'MANAGER_L2'
        ? [selectedEmployee.department]
        : [];

    setCurrentPermissions(newDefaults);
    setCurrentVisibleTabs(newTabs);
    setCurrentManagedDepts(newDepts);
    setSaveSuccess(`Đã chuyển vai trò của ${selectedEmployee.fullName} thành ${ROLE_CONFIGS[newRole]?.name}!`);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handleToggleCategoryPermissions = (categoryName: string, enable: boolean) => {
    if (selectedEmployee?.role === 'ADMIN') return;
    const categoryPermKeys = ALL_PERMISSIONS.filter((p) => p.category === categoryName).map((p) => p.key);
    setCurrentPermissions((prev) => {
      if (enable) {
        return Array.from(new Set([...prev, ...categoryPermKeys]));
      } else {
        return prev.filter((k) => !categoryPermKeys.includes(k));
      }
    });
    setSaveSuccess(null);
  };

  // Nhóm quyền nghiệp vụ
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

  // Lọc danh sách nhân viên
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchRole =
        roleFilter === 'ALL'
          ? true
          : roleFilter === 'MANAGER_L1'
          ? emp.role === 'MANAGER_L1' || emp.role === 'MANAGER'
          : roleFilter === 'USER'
          ? emp.role === 'USER' || emp.role === 'VIEWER'
          : emp.role === roleFilter;

      const matchText =
        emp.fullName.toLowerCase().includes(searchUser.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchUser.toLowerCase()) ||
        (emp.department || '').toLowerCase().includes(searchUser.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchUser.toLowerCase());
      return matchRole && matchText;
    });
  }, [employees, roleFilter, searchUser]);

  return (
    <div className="space-y-6">
      <GoogleSyncPanel currentUser={currentUser} />
      {/* Mobile Back Button */}
      {onBackToDashboard && (
        <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-200">
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
            <span>Quay lại Tổng quan</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500">Phân Quyền & Quản Lý</span>
        </div>
      )}

      {/* Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Phân Quyền Quản Lý & Truy Cập
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Chỉ Định Phạm Vi Từng Người
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hệ thống 4 vai trò: <b>Admin</b>, <b>Quản lý cấp 1</b>, <b>Quản lý cấp 2</b> và <b>Người dùng</b>. Chỉ định cụ thể từng bộ phận được quyền quản lý cho từng cá nhân.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
      </div>

      {/* Switcher Tab between Cấp Quyền & Hiển Thị Nhân Sự vs Đồng Bộ Google Sheet vs Quy Chuẩn Đánh Giá Năng Lực */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-fit border border-slate-300/60 flex-wrap">
        <button
          type="button"
          onClick={() => setViewSection('PERMISSIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            viewSection === 'PERMISSIONS'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Phân Quyền & Hiển Thị Menu</span>
        </button>
        <button
          type="button"
          onClick={() => setViewSection('GOOGLE_SHEETS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            viewSection === 'GOOGLE_SHEETS'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Đồng Bộ Google Sheet</span>
        </button>
        <button
          type="button"
          onClick={() => setViewSection('COMPETENCY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            viewSection === 'COMPETENCY'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Quy Chuẩn Đánh Giá Năng Lực</span>
        </button>
        <button
          type="button"
          onClick={() => setViewSection('QUICK_LINKS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            viewSection === 'QUICK_LINKS'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Link2 className="w-4 h-4 text-blue-600" />
          <span>Link Nút Tổng Quan</span>
        </button>
      </div>

      {/* Sub-mode switcher for PERMISSIONS */}
      {viewSection === 'PERMISSIONS' && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200/90 flex-wrap">
          <button
            type="button"
            onClick={() => setPermissionsSubMode('ROLES')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              permissionsSubMode === 'ROLES'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Cài Đặt Theo Tệp 4 Vai Trò</span>
          </button>
          <button
            type="button"
            onClick={() => setPermissionsSubMode('INDIVIDUAL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              permissionsSubMode === 'INDIVIDUAL'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Cài Đặt Theo Từng Nhân Sự</span>
          </button>
          <button
            type="button"
            onClick={() => setPermissionsSubMode('MATRIX')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              permissionsSubMode === 'MATRIX'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Ma Trận Phân Quyền 4 Cấp</span>
          </button>
        </div>
      )}

      {viewSection === 'COMPETENCY' ? (
        <CompetencyStandardsView
          currentUser={currentUser}
          employees={employees}
          appSettings={appSettings || undefined}
          onSaveAppSettings={onSaveAppSettings}
          onBackToDashboard={onBackToDashboard}
          allSubmissions={allSubmissions}
          allFeedbacks={allFeedbacks}
          allBxxlRecords={allBxxlRecords}
          allViolations={allViolations}
          onUpdateEmployee={onUpdateEmployee}
        />
      ) : viewSection === 'GOOGLE_SHEETS' ? <p className="rounded-xl border bg-white p-4 text-sm">Sử dụng bảng Google Sync phía trên để xem hàng đợi, Retry, Backup và Preview/Confirm Import. Kết nối Google được quản lý trên server.</p> : viewSection === 'QUICK_LINKS' ? (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-white rounded-3xl border border-blue-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Link2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Cài Đặt Đường Link Nút Tính Năng (Trang Tổng Quan)</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    Quyền Admin
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Cấu hình đường dẫn URL mở nhanh cho các nút tại khối lối tắt trên màn hình Tổng quan.
                  Người dùng khi bấm vào nút sẽ tự động mở liên kết Google Drive, Google Sheets, Google Forms hoặc website theo cấu hình dưới đây.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveQuickLinks}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:scale-102 shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Cấu Hình Link</span>
            </button>
          </div>

          {quickLinksSavedMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quickLinksSavedMsg}</span>
            </div>
          )}

          {/* Grid các trường link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Tra Cứu */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <span>1. Nút "Tra Cứu"</span>
                </label>
                {traCuuLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(traCuuLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Đường link tra cứu dữ liệu hàng hóa, bãi cảng hoặc cổng thông tin tra cứu.
              </p>
              <input
                type="url"
                value={traCuuLink}
                onChange={(e) => setTraCuuLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>

            {/* 2. Thư Viện (NQ - QĐ) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span>2. Nút "Thư Viện" (NQ - QĐ)</span>
                </label>
                {libraryLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(libraryLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Đường link thư mục Google Drive chứa văn bản Nghị quyết, Quyết định và Quy trình vận hành.
              </p>
              <input
                type="url"
                value={libraryLink}
                onChange={(e) => setLibraryLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-teal-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>

            {/* 3. Tình trạng Phương tiện */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span>3. Nút "Tình trạng Phương tiện"</span>
                </label>
                {vehicleStatusLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(vehicleStatusLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Đường link bảng tính hoặc hệ thống theo dõi tình trạng kỹ thuật cẩu RTG, dầu nhớt, kiểm định.
              </p>
              <input
                type="url"
                value={vehicleStatusLink}
                onChange={(e) => setVehicleStatusLink(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>

            {/* 4. Nổ máy/ Thủng nóc */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span>4. Nút "Nổ máy/ Thủng nóc"</span>
                </label>
                {engineRoofIncidentLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(engineRoofIncidentLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Đường link theo dõi hoặc báo cáo nhanh sự cố nổ máy, va chạm thủng nóc vỏ container bãi cảng.
              </p>
              <input
                type="url"
                value={engineRoofIncidentLink}
                onChange={(e) => setEngineRoofIncidentLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>

            {/* 5. Vi phạm */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span>5. Nút "Vi phạm"</span>
                </label>
                {violationReportLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(violationReportLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Đường link theo dõi tổng hợp các biên bản sự cố, vi phạm nội quy lao động & an toàn của Tổ RTG.
              </p>
              <input
                type="url"
                value={violationReportLink}
                onChange={(e) => setViolationReportLink(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>

            {/* 6. Kiểm tra (Tùy chọn) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span>6. Nút "Kiểm tra" (Tùy chọn)</span>
                </label>
                {quizLink.trim() && (
                  <button
                    type="button"
                    onClick={() => window.open(quizLink.trim(), '_blank', 'noopener,noreferrer')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở thử</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Link bài thi trực tuyến ngoài (nếu có). Để trống nếu muốn nhân viên làm bài trắc nghiệm nội bộ trên app.
              </p>
              <input
                type="url"
                value={quizLink}
                onChange={(e) => setQuizLink(e.target.value)}
                placeholder="https://forms.google.com/... (để trống để dùng bài thi nội bộ)"
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs sm:text-sm font-medium outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveQuickLinks}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Toàn Bộ Cấu Hình Link</span>
            </button>
          </div>
        </div>
      ) : permissionsSubMode === 'ROLES' ? (
        <RoleTemplateManager
          employees={employees}
          currentUser={currentUser}
          appSettings={appSettings}
          onSaveAppSettings={onSaveAppSettings}
          onBatchUpdateRolePermissions={onBatchUpdateRolePermissions}
          onSelectEmployeeForDetail={(emp) => {
            handleSelectEmployee(emp);
            setPermissionsSubMode('INDIVIDUAL');
          }}
          viewMode="ROLES"
        />
      ) : permissionsSubMode === 'MATRIX' ? (
        <RoleTemplateManager
          employees={employees}
          currentUser={currentUser}
          appSettings={appSettings}
          onSaveAppSettings={onSaveAppSettings}
          onBatchUpdateRolePermissions={onBatchUpdateRolePermissions}
          viewMode="MATRIX"
        />
      ) : (
        <>
          {/* 4 Standard Role Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {OFFICIAL_ROLES.map((roleKey) => {
          const conf = ROLE_CONFIGS[roleKey];
          const count = employees.filter((e) => {
            if (roleKey === 'MANAGER_L1') return e.role === 'MANAGER_L1' || e.role === 'MANAGER';
            if (roleKey === 'USER') return e.role === 'USER' || e.role === 'VIEWER';
            return e.role === roleKey;
          }).length;

          return (
            <div
              key={roleKey}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1 hover:border-indigo-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${conf?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  {conf?.name || roleKey}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {count} tài khoản
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{conf?.name}</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2">
                {conf?.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main Workspace: Left Employee List + Right Detail Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Account Selection */}
        <div
          className={`lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-xs p-4 space-y-3 ${
            mobileShowDetail ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Danh Sách Nhân Sự</span>
            </h3>
            <span className="text-xs font-medium text-slate-400">
              {filteredEmployees.length}/{employees.length} người
            </span>
          </div>

          {/* Search & Role Filter Tabs */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Tìm theo tên, mã NV, bộ phận..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>

            {/* Role Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              {(['ALL', 'ADMIN', 'MANAGER_L1', 'MANAGER_L2', 'USER'] as const).map((r) => {
                const label =
                  r === 'ALL'
                    ? 'Tất cả'
                    : r === 'ADMIN'
                    ? 'Admin'
                    : r === 'MANAGER_L1'
                    ? 'Quản lý cấp 1'
                    : r === 'MANAGER_L2'
                    ? 'Quản lý cấp 2'
                    : 'Người dùng';

                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                      roleFilter === r
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = emp.id === selectedEmployee?.id;
              const roleConfig = ROLE_CONFIGS[emp.role] || ROLE_CONFIGS.USER;

              // Compute managed departments display
              const managedList = emp.managedDepartments || (
                emp.role === 'ADMIN' || emp.role === 'MANAGER_L1' || emp.role === 'MANAGER'
                  ? ['ALL']
                  : emp.role === 'MANAGER_L2'
                  ? [emp.department]
                  : []
              );
              const isAllDepts = managedList.includes('ALL');

              return (
                <div
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-200'
                      : 'hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <img
                    src={emp.avatar || undefined}
                    alt={emp.fullName}
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 text-xs truncate">
                        {emp.fullName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleConfig.badgeColor}`}
                      >
                        {roleConfig.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {emp.position} • {emp.department}
                    </div>

                    {/* Managed Department & Access Status Tag */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? 'Đã cấp quyền' : 'Khóa đăng nhập'}
                      </span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-indigo-500 inline shrink-0" />
                        {isAllDepts
                          ? 'Quản lý: Tất cả bộ phận'
                          : managedList.length > 0
                          ? `Quản lý: ${managedList.length} bộ phận`
                          : 'Không quản lý bộ phận'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 lg:hidden" />
                </div>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                Không tìm thấy nhân sự phù hợp
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Configuration for Selected Employee */}
        {selectedEmployee && (
          <div
            className={`lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between space-y-6 ${
              mobileShowDetail ? 'block' : 'hidden lg:flex'
            }`}
          >
            <div className="space-y-6">
              {/* Mobile Back Button to list */}
              <div className="lg:hidden flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setMobileShowDetail(false)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-600" />
                  <span>Quay lại danh sách nhân sự</span>
                </button>
                <span className="text-xs font-semibold text-slate-400">Chi tiết phân quyền</span>
              </div>

              {/* Profile Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedEmployee.avatar || undefined}
                    alt={selectedEmployee.fullName}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {selectedEmployee.fullName}
                      </h3>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        {selectedEmployee.employeeCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Thuộc: {selectedEmployee.department}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedEmployee.position} • {selectedEmployee.email}
                    </p>
                  </div>
                </div>

                {/* Access Status & Role Selector Dropdowns */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Quyền truy cập:</label>
                    <select
                      value={selectedEmployee.status || 'ACTIVE'}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'ACTIVE' | 'TERMINATED';
                        if (onUpdateEmployee) {
                          onUpdateEmployee({
                            ...selectedEmployee,
                            status: newStatus,
                          });
                          setSaveSuccess(
                            newStatus === 'ACTIVE'
                              ? `Đã kích hoạt cấp quyền đăng nhập cho ${selectedEmployee.fullName}`
                              : `Đã khóa quyền truy cập của ${selectedEmployee.fullName} (chặn đăng nhập tuyệt đối)`
                          );
                          setTimeout(() => setSaveSuccess(null), 3500);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs outline-none cursor-pointer transition-colors ${
                        selectedEmployee.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      <option value="ACTIVE">Đã cấp quyền (Được đăng nhập)</option>
                      <option value="TERMINATED">Khóa truy cập (Chặn đăng nhập)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Vai trò:</label>
                    <select
                      value={
                        selectedEmployee.role === 'MANAGER'
                          ? 'MANAGER_L1'
                          : selectedEmployee.role === 'VIEWER'
                          ? 'USER'
                          : selectedEmployee.role
                      }
                      onChange={(e) => handleChangeRole(e.target.value as UserRole)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER_L1">Quản lý cấp 1</option>
                      <option value="MANAGER_L2">Quản lý cấp 2</option>
                      <option value="USER">Người dùng</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Warning if account is locked / not authorized */}
              {selectedEmployee.status !== 'ACTIVE' && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-rose-600 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold block">Tài khoản này đang bị khóa truy cập:</span>
                    Người dùng chưa được cấp quyền tuyệt đối không thể đăng nhập vào hệ thống ở bất cứ tình huống nào (chỉ có thể đăng nhập khi Quản trị viên kích hoạt trạng thái "Đã cấp quyền").
                  </div>
                </div>
              )}

              {/* Sub Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('DEPTS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    activeSubTab === 'DEPTS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>
                    1. Bộ Phận Quản Lý ({isManagingAllDepts ? 'Tất cả' : `${currentManagedDepts.length} bộ phận`})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('PERMISSIONS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    activeSubTab === 'PERMISSIONS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>
                    2. Quyền Nghiệp Vụ ({selectedEmployee.role === 'ADMIN' ? ALL_PERMISSIONS.length : currentPermissions.length}/{ALL_PERMISSIONS.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('MENUS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    activeSubTab === 'MENUS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>
                    3. Menu Hiển Thị ({selectedEmployee.role === 'ADMIN' ? ALL_MODULE_TABS.length : currentVisibleTabs.length}/{ALL_MODULE_TABS.length})
                  </span>
                </button>
              </div>

              {/* ========================================================================= */}
              {/* TAB 1: PHÂN QUYỀN QUẢN LÝ TỪNG BỘ PHẬN CHO NGƯỜI NÀY */}
              {/* ========================================================================= */}
              {activeSubTab === 'DEPTS' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <span>Chỉ Định Các Bộ Phận Người Này Được Quyền Quản Lý</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Chỉ định phạm vi các bộ phận mà nhân sự này có thẩm quyền theo dõi, đánh giá BXXL, quản lý nhân sự và nhận báo cáo.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllDepartments}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isManagingAllDepts
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả bộ phận
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllDepartments}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors"
                      >
                        Bỏ chọn hết
                      </button>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                      isManagingAllDepts
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                        : currentManagedDepts.length > 0
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isManagingAllDepts
                            ? 'text-indigo-600'
                            : currentManagedDepts.length > 0
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      />
                      <span>
                        {isManagingAllDepts ? (
                          <>
                            Nhân sự <b>{selectedEmployee.fullName}</b> được phân quyền quản lý <b>Toàn bộ {allDepartments.length} bộ phận/phòng ban</b> trong đơn vị.
                          </>
                        ) : currentManagedDepts.length > 0 ? (
                          <>
                            Nhân sự <b>{selectedEmployee.fullName}</b> được chỉ định quản lý <b>{currentManagedDepts.length} bộ phận</b>: {currentManagedDepts.join(', ')}.
                          </>
                        ) : (
                          <>
                            Nhân sự <b>{selectedEmployee.fullName}</b> hiện không được giao quyền quản lý bộ phận nào (chỉ xem thông tin cá nhân).
                          </>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleManageAll}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold shadow-2xs shrink-0"
                    >
                      {isManagingAllDepts ? 'Tùy chọn từng bộ phận' : 'Quản lý toàn bộ'}
                    </button>
                  </div>

                  {/* Department Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {allDepartments.map((deptName) => {
                      const isManaged = isManagingAllDepts || currentManagedDepts.includes(deptName);
                      const deptMembers = employees.filter(
                        (e) => (e.department?.trim() || '') === deptName
                      );
                      const isOwnDept = (selectedEmployee.department?.trim() || '') === deptName;

                      return (
                        <div
                          key={deptName}
                          onClick={() => handleToggleDepartment(deptName)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isManaged
                              ? 'bg-white border-indigo-300 ring-2 ring-indigo-200/60 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isManaged ? (
                              <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-lg border-2 border-slate-300 bg-white" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {deptName}
                              </span>
                              {isOwnDept && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                  Bộ phận gốc
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {deptMembers.length} nhân sự
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: QUYỀN NGHIỆP VỤ */}
              {/* ========================================================================= */}
              {activeSubTab === 'PERMISSIONS' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Settings2 className="w-4 h-4 text-indigo-600" />
                        <span>Chỉ Định Quyền Thao Tác Nghiệp Vụ</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Cấp quyền hành động chi tiết theo các lĩnh vực chuyên môn
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetToRoleDefault}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục theo vai trò</span>
                    </button>
                  </div>

                  {selectedEmployee.role === 'ADMIN' && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Tài khoản <b>Admin</b> mặc định sở hữu toàn quyền quản trị tất cả các phân hệ và dữ liệu trong hệ thống.
                      </span>
                    </div>
                  )}

                  {/* Categorized Permissions */}
                  <div className="space-y-4">
                    {Array.from(permissionsByCategory.entries()).map(([catName, permList]) => {
                      const selectedCount = permList.filter(
                        (p) => selectedEmployee.role === 'ADMIN' || currentPermissions.includes(p.key)
                      ).length;

                      return (
                        <div
                          key={catName}
                          className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-200/60">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              {catName}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({selectedCount}/{permList.length})
                              </span>
                            </span>

                            {selectedEmployee.role !== 'ADMIN' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategoryPermissions(catName, true)}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs"
                                >
                                  Chọn tất cả
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategoryPermissions(catName, false)}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {permList.map((perm) => {
                              const isChecked =
                                selectedEmployee.role === 'ADMIN' || currentPermissions.includes(perm.key);
                              const isLockedByAdmin = selectedEmployee.role === 'ADMIN';

                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => !isLockedByAdmin && handleTogglePermission(perm.key)}
                                  className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                                    isChecked
                                      ? 'bg-white border-indigo-300 shadow-2xs ring-1 ring-indigo-200/50'
                                      : 'bg-white/60 border-slate-200 hover:bg-white'
                                  } ${isLockedByAdmin ? 'cursor-default opacity-90' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isLockedByAdmin}
                                    onChange={() => {}}
                                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="font-bold text-xs text-slate-900 block leading-snug">
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
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: QUYỀN HIỂN THỊ MENU */}
              {/* ========================================================================= */}
              {activeSubTab === 'MENUS' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span>Cấu Hình Hiển Thị Thanh Menu</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Chọn các mục chức năng hiển thị trên menu của nhân sự này. Mục tắt sẽ được ẩn hoàn toàn.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentVisibleTabs(ALL_MODULE_TABS.map((m) => m.id))}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-colors"
                      >
                        Bật tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentVisibleTabs([
                            'container_tool',
                            'library',
                            'quiz',
                            'feedback',
                            'settings',
                          ])
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        Mẫu chuẩn
                      </button>
                    </div>
                  </div>

                  {selectedEmployee.role === 'ADMIN' && (
                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        Tài khoản <b>Admin</b> mặc định hiển thị tất cả các mục menu điều hành để đảm bảo kiểm soát toàn diện.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ALL_MODULE_TABS.map((mod: ModuleTabConfig) => {
                      const isVisible =
                        selectedEmployee.role === 'ADMIN' || currentVisibleTabs.includes(mod.id);
                      const isLockedAdmin = selectedEmployee.role === 'ADMIN';

                      return (
                        <div
                          key={mod.id}
                          onClick={() => !isLockedAdmin && handleToggleVisibleTab(mod.id)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                            isVisible
                              ? 'bg-emerald-50/50 border-emerald-200 ring-1 ring-emerald-200/50 shadow-2xs'
                              : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50 opacity-75'
                          } ${isLockedAdmin ? 'cursor-default' : ''}`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isVisible ? (
                              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center">
                                <EyeOff className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 block">
                                {mod.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isVisible
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {isVisible ? 'Hiển thị' : 'Đang ẩn'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                              {mod.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 space-y-0.5">
                <div>
                  Phạm vi quản lý: <b>{isManagingAllDepts ? 'Tất cả các bộ phận' : `${currentManagedDepts.length} bộ phận`}</b>
                </div>
                <div>
                  Quyền cấp: <b>{currentPermissions.length}</b>/{ALL_PERMISSIONS.length} nghiệp vụ • Menu: <b>{currentVisibleTabs.length}</b>/{ALL_MODULE_TABS.length}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToRoleDefault}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Mặc định vai trò
                </button>
                <button
                  id="btn-save-employee-permissions"
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-indigo-200 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Phân Quyền & Quản Lý</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};
