/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {supabase,api,type User as AuthUser} from './services/supabase';
import {
  subscribeToCollection,
  subscribeToDocument,
  fetchCollectionOnce,
  saveDocument,
  saveDocumentsBatch,
  updateDocumentFields,
  deleteDocument,
  logoutUser,
  handleDatabaseError,
  OperationType,
} from './services/supabase';
import {
  ROLE_CONFIGS,
  DEFAULT_VISIBLE_TABS_BY_ROLE,
} from './mockData';
import {
  Employee,
  InternalDocument,
  Quiz,
  QuizQuestion,
  QuestionFolder,
  QuizSubmission,
  FeedbackProposal,
  ZaloMessage,
  PermissionKey,
  UserRole,
  AppSettings,
  BxxlRecord,
  LeaveRequest,
  IncidentViolation,
  EmployeeViolationRecord,
} from './types';
import {
  normalizeRtgDepartment,
  cleanRtgPosition,
  normalizeEmployeeName,
} from './services/employeeFormatting';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
const DashboardView=lazy(()=>import('./components/DashboardView').then(m=>({default:m.DashboardView})));
const HrManagementView=lazy(()=>import('./components/HrManagementView').then(m=>({default:m.HrManagementView})));
const LibraryView=lazy(()=>import('./components/LibraryView').then(m=>({default:m.LibraryView})));
const GoogleDriveView=lazy(()=>import('./components/GoogleDriveView').then(m=>({default:m.GoogleDriveView})));
const QuizView=lazy(()=>import('./components/QuizView').then(m=>({default:m.QuizView})));
const FeedbackView=lazy(()=>import('./components/FeedbackView').then(m=>({default:m.FeedbackView})));
const ZaloView=lazy(()=>import('./components/ZaloView').then(m=>({default:m.ZaloView})));
const PermissionsView=lazy(()=>import('./components/PermissionsView').then(m=>({default:m.PermissionsView})));
import { LoginView } from './components/LoginView';
const SettingsView=lazy(()=>import('./components/SettingsView').then(m=>({default:m.SettingsView})));
import { QuickChatWindow } from './components/QuickChatWindow';
const BxxlView=lazy(()=>import('./components/BxxlView').then(m=>({default:m.BxxlView})));
const ContainerYardProcessorView=lazy(()=>import('./components/ContainerYardProcessorView').then(m=>({default:m.ContainerYardProcessorView})));
const LeaveRegistrationView=lazy(()=>import('./components/LeaveRegistrationView').then(m=>({default:m.LeaveRegistrationView})));
const CompetencyStandardsView=lazy(()=>import('./components/CompetencyStandardsView').then(m=>({default:m.CompetencyStandardsView})));
const ViolationsView=lazy(()=>import('./components/ViolationsView').then(m=>({default:m.ViolationsView})));
const AdminMasterSyncModal=lazy(()=>import('./components/AdminMasterSyncModal').then(m=>({default:m.AdminMasterSyncModal})));
import { Loader2, CheckCircle2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { isTabAllowed, getFirstAllowedTab, canUserLogin } from './utils/permissionUtils';

interface ToastMessage {
  id: string;
  type: 'loading' | 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  // Cloud PostgreSQL Realtime State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<InternalDocument[]>([]);
  const [questionBank, setQuestionBank] = useState<QuizQuestion[]>([]);
  const [questionFolders, setQuestionFolders] = useState<QuestionFolder[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackProposal[]>([]);
  const [bxxlRecords, setBxxlRecords] = useState<BxxlRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [zaloMessages, setZaloMessages] = useState<ZaloMessage[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Auth & Current User
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab & Cross-component coordination
  const [activeTab, setActiveTab] = useState<TabType | 'settings'>('dashboard');
  const [isMasterSyncOpen, setIsMasterSyncOpen] = useState<boolean>(false);

  // Đảm bảo mỗi lần người dùng đăng nhập hệ thống, luôn tự động chuyển về trang Tổng quan và Thống kê đầu tiên
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentUser && !prevUserIdRef.current) {
      setActiveTab('dashboard');
    }
    prevUserIdRef.current = currentUser ? currentUser.id : null;
  }, [currentUser?.id]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [quizInitialAiFile, setQuizInitialAiFile] = useState<{ name: string; blob?: Blob } | null>(null);
  const [zaloPrefilledRecipient, setZaloPrefilledRecipient] = useState<Employee | null>(null);
  const [selectedEmpIdForPermission, setSelectedEmpIdForPermission] = useState<string | undefined>(undefined);
  const [libraryInitialCategory, setLibraryInitialCategory] = useState<any>('ALL');

  // Quick Chat Floating Window state
  const [isQuickChatOpen, setIsQuickChatOpen] = useState<boolean>(false);
  const [quickChatRecipientId, setQuickChatRecipientId] = useState<string | undefined>(undefined);

  const handleOpenChat = useCallback((recipientId?: string) => {
    if (recipientId) {
      setQuickChatRecipientId(recipientId);
    }
    setIsQuickChatOpen(true);
  }, []);

  // Operation Feedback Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'loading' | 'success' | 'error' | 'info', message: string, durationMs: number = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (type !== 'loading' && durationMs > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getDeletedEmployeeIds=useCallback(()=>[] as string[],[]);
  const recordDeletedEmployeeId=useCallback((_id:string)=>{},[]);
  const unrecordDeletedEmployeeId=useCallback((_id:string)=>{},[]);
  const [incidents,setIncidents]=useState<IncidentViolation[]>([]);
  const [dataLoading,setDataLoading]=useState(false);
  const handleUpdateIncidents=useCallback(async(items:IncidentViolation[])=>{try{await saveDocumentsBatch('incidents',items.map(data=>({id:data.id,data})));setIncidents(items);}catch(e){addToast('error',(e as Error).message);}},[]);
  useEffect(()=>{const onError=(e:Event)=>addToast('error',(e as CustomEvent).detail);window.addEventListener('rtg:error',onError);return()=>window.removeEventListener('rtg:error',onError);},[]);
  useEffect(()=>{
    let active=true;
    const load=async(user:AuthUser|null)=>{try{if(!user){if(active){setCurrentUser(null);setEmployees([]);setFeedbacks([]);setSubmissions([]);setQuizzes([]);setQuestionBank([]);setDocuments([]);setIncidents([]);setLeaveRequests([]);setZaloMessages([]);setBxxlRecords([]);setAppSettings(null);}return;}const profile=await api<Employee>('/me');if(active){setCurrentUser(profile);setAuthError(null);}await api('/session',{method:'POST'});}catch(e){if(active){setCurrentUser(null);setAuthError((e as Error).message);}}finally{if(active)setAuthInitialized(true);}};
    void supabase.auth.getSession().then(({data})=>load(data.session?.user||null));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{if(active)void load(session?.user||null);},0);});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    if(!currentUser)return;
    setDataLoading(true);
    const sources:[string,(data:any[])=>void][]=[['employees',setEmployees],['internalDocuments',setDocuments],['questionFolders',setQuestionFolders],['questionBank',setQuestionBank],['quizzes',setQuizzes],['quizSubmissions',setSubmissions],['feedbacks',setFeedbacks],['zaloMessages',setZaloMessages],['bxxlRecords',setBxxlRecords],['leaveRequests',setLeaveRequests],['incidents',setIncidents]];
    let count=0;const done=()=>{if(++count>=sources.length)setDataLoading(false);};
    const unsubs=sources.map(([module,set])=>subscribeToCollection(module,items=>{set(items);done();},()=>done()));
    unsubs.push(subscribeToDocument<AppSettings>('settings','global',setAppSettings));
    const refresh=()=>api<Employee>('/me').then(setCurrentUser).catch(e=>{setCurrentUser(null);setAuthError(e.message);});
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
    return()=>{unsubs.forEach(fn=>fn());clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[currentUser?.id]);
  useEffect(()=>{if(currentUser&&!isTabAllowed(activeTab as TabType,currentUser))setActiveTab(getFirstAllowedTab(currentUser));},[currentUser,activeTab]);

  // Tổng hợp tất cả các hồ sơ vi phạm của nhân sự hệ thống để đồng bộ Google Sheet & Đánh giá năng lực
  const allViolationsList = React.useMemo<IncidentViolation[]>(() => {
    const listMap = new Map<string, IncidentViolation>();

    // 1. Ưu tiên danh sách sự cố/vi phạm từ incidents tập trung (Tổ RTG)
    incidents
      .filter((inc) => inc.isRtgRelated !== false)
      .forEach((inc) => {
        listMap.set(inc.id, inc);
      });

    // 2. Bổ sung các vi phạm trong hồ sơ từng nhân viên nếu chưa có trong incidents
    employees.forEach((emp) => {
      (emp.violationRecords || []).forEach((vr) => {
        if (!listMap.has(vr.id)) {
          listMap.set(vr.id, {
            id: vr.id,
            code: vr.incidentCode || `SC-${emp.employeeCode}`,
            time: vr.time,
            location: vr.location,
            violatorName: emp.fullName,
            matchedEmployeeId: emp.id,
            matchedEmployeeCode: emp.employeeCode,
            matchedDepartment: emp.department,
            department: emp.department || 'Tổ RTG',
            isMatchedWithSystem: true,
            equipment: vr.equipment,
            what: vr.what,
            why: vr.why,
            how: vr.how,
            severity: vr.severity === 'HIGH' ? 'NGHIEM_TRONG' : vr.severity === 'MEDIUM' ? 'TRUNG_BINH' : 'THAP',
            pointsDeducted: vr.pointsDeducted,
            isRtgRelated: true,
            sourceAppendix: 'PHU_LUC_2',
            isSyncedToProfile: true,
          });
        }
      });
    });

    return Array.from(listMap.values());
  }, [incidents, employees]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      localStorage.removeItem('rtg_session_user_id');
      await logoutUser();
      setCurrentUser(null);
      setActiveTab('dashboard');
      addToast('success', 'Đã đăng xuất an toàn khỏi hệ thống.');
    } catch (err: any) {
      console.error('Logout failed:', err);
      localStorage.removeItem('rtg_session_user_id');
      setCurrentUser(null);
      setActiveTab('dashboard');
    }
  };

  // Seed Data Handler (Invoked from Navbar by Admin)
  const handleManualSeed = async () => { if(!confirm('Đưa toàn bộ dữ liệu hiện tại vào hàng đợi báo cáo Google?'))return;try{await api('/google/sync',{method:'POST',body:'{}'});addToast('success','Đã đưa dữ liệu vào hàng đợi đồng bộ.');}catch(e){addToast('error',(e as Error).message);} }; 

  // Helper đóng / bỏ qua cửa sổ cập nhật thông tin
  const handleDismissOnboarding = useCallback(() => {
    if (currentUser) {
      try {
        localStorage.setItem(`rtg_onboarding_dismissed_${currentUser.id}`, 'true');
      } catch (e) {
        console.warn('Lỗi ghi nhớ bỏ qua onboarding:', e);
      }
    }
    setOnboardingDismissed(true);
  }, [currentUser]);

  // Onboarding submission handler
  const handleCompleteOnboarding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;

    // Đóng cửa sổ ngay lập tức để không cản trở người dùng đăng nhập vào hệ thống
    handleDismissOnboarding();

    const formData = new FormData(e.currentTarget);
    const fullName = (formData.get('fullName') as string)?.trim() || currentUser.fullName;
    const dateOfBirth = (formData.get('dateOfBirth') as string)?.trim() || currentUser.dateOfBirth;
    const zaloPhone = (formData.get('zaloPhone') as string)?.trim() || currentUser.zaloPhone || currentUser.phone;

    const updatedUser: Employee = {
      ...currentUser,
      fullName,
      dateOfBirth,
      zaloPhone,
      zaloSynced: !!zaloPhone,
      onboardingCompleted: true,
    };

    // Cập nhật state nội bộ ngay lập tức
    setCurrentUser(updatedUser);
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedUser.id ? updatedUser : emp))
    );
    addToast('success', 'Đã cập nhật thông tin cá nhân thành công.');

    try {
      await saveDocument('employees', updatedUser.id, updatedUser, true);
    } catch (err: any) {
      console.warn('Lỗi lưu onboarding lên PostgreSQL (đã lưu bộ nhớ):', err);
    }
  };

  // ==================== POSTGRESQL CRUD OPERATIONS ====================

  // Employee Management (HR)
  const handleAddEmployee = async (empData: Omit<Employee, 'id'>) => {
    const cleanFullName = normalizeEmployeeName(empData.fullName);
    const cleanDept = normalizeRtgDepartment(empData.department);
    const cleanPos = cleanRtgPosition(empData.position);
    const code = empData.employeeCode?.trim();

    // Gỡ khỏi danh sách ID/Mã đã xóa nếu người dùng thêm lại
    if (code) unrecordDeletedEmployeeId(code);

    const existing = employees.find(
      (e) => (code && e.employeeCode?.toLowerCase() === code.toLowerCase())
    );

    const targetId = existing ? existing.id : `emp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    unrecordDeletedEmployeeId(targetId);

    const newEmp: Employee = {
      ...(existing || {}),
      ...empData,
      id: targetId,
      fullName: cleanFullName,
      department: cleanDept,
      position: cleanPos,
      onboardingCompleted: true,
    };

    // 1. Cập nhật state nội bộ ngay lập tức và lưu cache
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === targetId || (code && e.employeeCode?.toLowerCase() === code.toLowerCase()));
      let next: Employee[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newEmp;
      } else {
        next = [...prev, newEmp];
      }
      try {
        
      } catch {}
      return next;
    });

    const toastId = addToast('loading', `Đang lưu hồ sơ ${newEmp.fullName} vào hệ thống...`, 0);
    try {
      await saveDocument('employees', targetId, newEmp, true);
      removeToast(toastId);
      addToast('success', `Đã lưu hồ sơ ${newEmp.fullName} thành công.`);
    } catch (err: any) {
      removeToast(toastId);
      console.warn('Lỗi lưu PostgreSQL:', err);
      let errMsg = err.message || 'Lỗi mạng';
      try {
        if (errMsg.startsWith('{')) {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.error || errMsg;
        }
      } catch {}
      addToast('error',errMsg);setEmployees(await fetchCollectionOnce<Employee>('employees'));throw err;
    }
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    unrecordDeletedEmployeeId(updatedEmp.id);
    if (updatedEmp.employeeCode) unrecordDeletedEmployeeId(updatedEmp.employeeCode);

    const sanitizedEmp: Employee = {
      ...updatedEmp,
      fullName: normalizeEmployeeName(updatedEmp.fullName),
      department: normalizeRtgDepartment(updatedEmp.department),
      position: cleanRtgPosition(updatedEmp.position),
      onboardingCompleted: true,
    };

    // 1. Cập nhật state nội bộ ngay lập tức và lưu cache
    setEmployees((prev) => {
      const next = prev.map((e) => (e.id === sanitizedEmp.id ? sanitizedEmp : e));
      try {
        
      } catch {}
      return next;
    });
    if (currentUser && currentUser.id === sanitizedEmp.id) {
      setCurrentUser(sanitizedEmp);
    }

    const toastId = addToast('loading', 'Đang cập nhật hồ sơ...', 0);
    try {
      await saveDocument('employees', sanitizedEmp.id, sanitizedEmp, true);
      removeToast(toastId);
      addToast('success', `Đã cập nhật hồ sơ ${sanitizedEmp.fullName} thành công.`);
    } catch (err: any) {
      removeToast(toastId);
      console.warn('Lỗi cập nhật PostgreSQL:', err);
      let errMsg = err.message || 'Lỗi mạng';
      try {
        if (errMsg.startsWith('{')) {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.error || errMsg;
        }
      } catch {}
      addToast('error',errMsg);setEmployees(await fetchCollectionOnce<Employee>('employees'));throw err;
    }
  };

  const handleBatchUpdateEmployees = async (updatedList: Employee[]) => {
    if (!updatedList || updatedList.length === 0) return;
    const sanitizedList = updatedList.map((emp) => ({
      ...emp,
      fullName: normalizeEmployeeName(emp.fullName),
      department: normalizeRtgDepartment(emp.department),
      position: cleanRtgPosition(emp.position),
      onboardingCompleted: true,
    }));
    const toastId = addToast('loading', `Đang cập nhật hồ sơ ${sanitizedList.length} nhân sự vào hệ thống...`, 0);
    try {
      // 1. Cập nhật state nội bộ ngay lập tức (Optimistic update)
      setEmployees((prev) => {
        const map = new Map(prev.map((e) => [e.id, e]));
        sanitizedList.forEach((u) => map.set(u.id, u));
        const next = Array.from(map.values());
        try {
          
        } catch {}
        return next;
      });

      // 2. Lưu vào PostgreSQL hàng loạt bằng saveDocumentsBatch
      const postgresItems = sanitizedList.map((emp) => ({ id: emp.id, data: emp }));
      await saveDocumentsBatch('employees', postgresItems, true);

      removeToast(toastId);
      addToast('success', `Đã đồng bộ hồ sơ ${updatedList.length} nhân sự thành công!`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật hồ sơ hàng loạt: ${err.message}`);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const target = employees.find((e) => e.id === id);
    const targetName = target ? target.fullName : 'nhân sự';
    const toastId = addToast('loading', `Đang xóa ${targetName} khỏi hệ thống...`, 0);

    // 1. Cập nhật state lạc quan ngay lập tức
    setEmployees((prev) => {
      const next = prev.filter((e) => e.id !== id && (!target?.employeeCode || e.employeeCode !== target.employeeCode));
      try {
        
      } catch {}
      return next;
    });

    // 2. Ghi nhận vĩnh viễn vào danh sách ID/Mã đã xóa
    recordDeletedEmployeeId(id);
    if (target?.employeeCode) {
      recordDeletedEmployeeId(target.employeeCode);
    }

    try {
      await deleteDocument('employees', id);
      if (target?.employeeCode && target.employeeCode !== id) {
        deleteDocument('employees', target.employeeCode).catch(() => {});
      }
      removeToast(toastId);
      addToast('success', `Đã xóa nhân viên ${targetName} khỏi hệ thống thành công.`);
    } catch (err: any) {
      console.warn('Lưu ý khi xóa trên Cloud PostgreSQL:', err);
      removeToast(toastId);
      addToast('error',err.message);setEmployees(await fetchCollectionOnce<Employee>('employees'));throw err;
    }
  };

  const handleBatchDeleteEmployees = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const toastId = addToast('loading', `Đang xóa ${ids.length} nhân sự đã chọn khỏi hệ thống...`, 0);

    const idsSet = new Set(ids);
    const targetCodes: string[] = [];
    employees.forEach((e) => {
      if (idsSet.has(e.id) && e.employeeCode) {
        targetCodes.push(e.employeeCode);
      }
    });

    // 1. Cập nhật state lạc quan ngay lập tức
    setEmployees((prev) => {
      const next = prev.filter((e) => !idsSet.has(e.id));
      try {
        
      } catch {}
      return next;
    });

    // 2. Ghi nhận vào danh sách loại trừ đã xóa vĩnh viễn
    ids.forEach((id) => recordDeletedEmployeeId(id));
    targetCodes.forEach((code) => recordDeletedEmployeeId(code));

    // 3. Xóa trên Cloud PostgreSQL
    try {
      await Promise.all(
        ids.map(async (id) => {
          await deleteDocument('employees', id);
          const emp = employees.find((e) => e.id === id);
          if (emp?.employeeCode && emp.employeeCode !== id) {
            await deleteDocument('employees', emp.employeeCode).catch(() => {});
          }
        })
      );
      removeToast(toastId);
      addToast('success', `Đã xóa thành công ${ids.length} nhân sự khỏi hệ thống.`);
    } catch (err: any) {
      console.warn('Lỗi khi xóa hàng loạt:', err);
      removeToast(toastId);
      addToast('error',err.message);setEmployees(await fetchCollectionOnce<Employee>('employees'));throw err;
    }
  };

  // Đồng bộ hàng loạt nhân sự từ file Data_RTG (sheet ThongTinNhanSu)
  const handleBatchUpsertEmployees = async (newOrUpdatedList: Partial<Employee>[]) => {
    if (!newOrUpdatedList || newOrUpdatedList.length === 0) return;
    const toastId = addToast('loading', `Đang đồng bộ ${newOrUpdatedList.length} nhân sự từ Data_RTG vào Quản lý nhân sự...`, 0);
    try {
      const updatedEmployees = [...employees];
      const postgresItems: { id: string; data: Partial<Employee> }[] = [];

      for (const item of newOrUpdatedList) {
        const code = item.employeeCode?.trim();
        const username = item.username?.trim();
        const rawName = item.fullName?.trim();
        const fullName = rawName ? normalizeEmployeeName(rawName) : '';

        // Đảm bảo không bị loại trừ bởi danh sách đã xóa nếu import/đồng bộ lại
        if (code) unrecordDeletedEmployeeId(code);
        if (item.id) unrecordDeletedEmployeeId(item.id);

        // Tìm nhân sự đã có trong hệ thống
        const existingIdx = updatedEmployees.findIndex(
          (e) =>
            (code && e.employeeCode?.toLowerCase() === code.toLowerCase()) ||
            (username && e.username?.toLowerCase() === username.toLowerCase()) ||
            (item.id && e.id === item.id) ||
            (fullName && e.fullName?.toLowerCase() === fullName.toLowerCase())
        );

        if (existingIdx >= 0) {
          const existing = updatedEmployees[existingIdx];
          unrecordDeletedEmployeeId(existing.id);
          if (existing.employeeCode) unrecordDeletedEmployeeId(existing.employeeCode);

          const merged: Employee = {
            ...existing,
            ...item,
            id: existing.id,
            employeeCode: item.employeeCode || existing.employeeCode,
            fullName: fullName || existing.fullName,
            phone: item.phone || existing.phone,
            zaloPhone: item.zaloPhone || item.phone || existing.zaloPhone,
            username: item.username || existing.username,
            department: normalizeRtgDepartment(item.department || existing.department),
            position: cleanRtgPosition(item.position || existing.position),
            zaloSynced: !!(item.zaloPhone || item.phone || existing.zaloPhone),
            onboardingCompleted: true,
          };
          updatedEmployees[existingIdx] = merged;
          postgresItems.push({ id: merged.id, data: merged });
        } else {
          const newId = item.id || `emp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          unrecordDeletedEmployeeId(newId);
          const newEmp: Employee = {
            id: newId,
            employeeCode: item.employeeCode || `NV-${Date.now().toString().slice(-4)}`,
            fullName: fullName || 'Nhân viên mới',
            email: item.email || `${(item.employeeCode || item.username || 'nv').toLowerCase()}@doanhnghiep.vn`,
            phone: item.phone || '',
            zaloPhone: item.zaloPhone || item.phone || '',
            zaloSynced: !!(item.zaloPhone || item.phone),
            avatar: item.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName || 'NV') + '&background=random',
            department: normalizeRtgDepartment(item.department),
            position: cleanRtgPosition(item.position),
            status: (item.status as any) || 'ACTIVE',
            role: (item.role as any) || 'USER',
            username: item.username || item.employeeCode || `user${Date.now()}`,
            joinDate: item.joinDate || new Date().toISOString().split('T')[0],
            competencyScore: item.competencyScore ?? 85,
            quizzesCompleted: item.quizzesCompleted ?? 0,
            violationCount: item.violationCount ?? 0,
            proposalsCount: item.proposalsCount ?? 0,
            onboardingCompleted: true,
            assignedPermissions: item.assignedPermissions || ROLE_CONFIGS['USER'].defaultPermissions,
          };
          updatedEmployees.push(newEmp);
          postgresItems.push({ id: newEmp.id, data: newEmp });
        }
      }

      // Cập nhật state và localStorage ngay lập tức
      setEmployees(updatedEmployees);
      try {
        
      } catch {}

      // Ghi hàng loạt vào PostgreSQL
      await saveDocumentsBatch('employees', postgresItems, true);

      removeToast(toastId);
      addToast('success', `Đã đồng bộ thành công ${newOrUpdatedList.length} nhân sự từ file Data_RTG vào Quản lý nhân sự!`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi đồng bộ nhân sự: ${err.message}`);
    }
  };

  // Internal Documents (Library)
  const handleAddDocument = async (docData: Omit<InternalDocument, 'id' | 'viewCount'>) => {
    const toastId = addToast('loading', 'Đang lưu tài liệu lên Cloud PostgreSQL...', 0);
    const newId = `doc-${Date.now()}`;
    const newDoc: InternalDocument = {
      ...docData,
      id: newId,
      viewCount: 1,
    };
    try {
      await saveDocument('internalDocuments', newId, newDoc);
      removeToast(toastId);
      addToast('success', 'Đã lưu tài liệu quy chế mới vào PostgreSQL.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi lưu tài liệu: ${err.message}`);
    }
  };

  const handleEditDocument = async (docData: InternalDocument) => {
    const toastId = addToast('loading', 'Đang cập nhật tài liệu lên PostgreSQL...', 0);
    try {
      await saveDocument('internalDocuments', docData.id, docData, true);
      removeToast(toastId);
      addToast('success', 'Đã cập nhật tài liệu thành công.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật tài liệu: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    const toastId = addToast('loading', 'Đang xóa tài liệu trên PostgreSQL...', 0);
    try {
      await deleteDocument('internalDocuments', id);
      removeToast(toastId);
      addToast('success', 'Đã xóa tài liệu khỏi Cloud PostgreSQL.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xóa tài liệu: ${err.message}`);
    }
  };

  // Quizzes & Submissions
  const handleAddQuiz = async (quiz: Quiz) => {
    const toastId = addToast('loading', 'Đang tạo bộ đề thi trên Cloud PostgreSQL...', 0);
    try {
      await saveDocument('quizzes', quiz.id, quiz);
      setQuizzes(prev => [quiz, ...prev.filter(q => q.id !== quiz.id)]);
      removeToast(toastId);
      addToast('success', `Đã tạo bài thi "${quiz.title}" thành công.`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi tạo bài thi: ${err.message}`);
      throw err;
    }
  };

  const handleEditQuiz = async (quiz: Quiz) => {
    const toastId = addToast('loading', 'Đang cập nhật đề thi trên PostgreSQL...', 0);
    try {
      await saveDocument('quizzes', quiz.id, quiz);
      setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? quiz : q)));
      removeToast(toastId);
      addToast('success', `Đã cập nhật bài thi "${quiz.title}" thành công.`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật bài thi: ${err.message}`);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const toastId = addToast('loading', 'Đang xóa đề thi...', 0);
    try {
      await deleteDocument('quizzes', quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      removeToast(toastId);
      addToast('success', 'Đã xóa bài thi thành công.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xóa bài thi: ${err.message}`);
    }
  };

  const handleSaveSubmission = async (sub: QuizSubmission) => { setSubmissions(prev=>[...prev.filter(s=>s.id!==sub.id),sub]); addToast('success',`Đã ghi nhận kết quả thi (${sub.score} điểm).`); }; 

  // Feedbacks & Proposals
  const handleAddFeedback = async (fbData: Omit<FeedbackProposal, 'id' | 'submittedAt'>) => {
    const toastId = addToast('loading', 'Đang gửi ý kiến lên Cloud PostgreSQL...', 0);
    const newId = `prop-${Date.now()}`;
    const newFb: FeedbackProposal = {
      ...fbData,
      id: newId,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    try {
      await saveDocument('feedbacks', newId, newFb);

      // Update proposal count on author
      if (!fbData.isAnonymous && fbData.authorId) {
        const author = employees.find((e) => e.id === fbData.authorId);
        if (author) {
          await updateDocumentFields('employees', author.id, {
            proposalsCount: (author.proposalsCount || 0) + 1,
          });
        }
      }

      removeToast(toastId);
      addToast('success', 'Đã gửi ý kiến / đề xuất thành công.');

    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi gửi ý kiến: ${err.message}`);
    }
  };

  const handleUpdateFeedbackStatus = async (
    id: string,
    status: FeedbackProposal['status'],
    adminResponse?: FeedbackProposal['adminResponse'],
    customPenaltyPoints?: number
  ) => {
    const toastId = addToast('loading', 'Đang cập nhật trạng thái đề xuất...', 0);
    try {
      const targetFb = feedbacks.find((f) => f.id === id);
      const updateData: Record<string, any> = { status };
      if (adminResponse !== undefined) {
        updateData.adminResponse = adminResponse;
      }

      // Xử lý tự động lưu hồ sơ năng lực và trừ điểm nếu phê duyệt Cảnh báo nguy hiểm
      let deductedEmpName = '';
      let deductedPoints = 0;

      const isDangerWarning =
        targetFb?.category === 'CANH_BAO_NGUY_HIEM' || !!targetFb?.dangerCauserName;
      const alreadyDeducted = !!targetFb?.pointsDeductedApplied;

      if (
        status === 'APPROVED' &&
        targetFb &&
        isDangerWarning &&
        !alreadyDeducted &&
        targetFb.dangerCauserName
      ) {
        const deductPoints = customPenaltyPoints ?? targetFb.penaltyPoints ?? 5;
        const causerName = targetFb.dangerCauserName.trim();
        // Chuẩn hóa tên nhân viên (vd: Phạm Ngọc Tuấn -> Phạm Ngọc Tuân)
        const normalizeEmpName = (name: string): string => {
          const trimmed = (name || '').trim();
          const lower = trimmed.toLowerCase();
          if (
            lower === 'phạm ngọc tuấn' ||
            lower === 'pham ngoc tuan' ||
            lower === 'ngọc tuấn'
          ) {
            return 'Phạm Ngọc Tuân';
          }
          return trimmed;
        };
        const normalizedCauserName = normalizeEmpName(causerName);

        // Tìm nhân viên tương ứng trong danh sách nhân sự
        const matchedEmp = employees.find((emp) => {
          if (targetFb.dangerCauserId && emp.id === targetFb.dangerCauserId) return true;
          if (
            targetFb.dangerCauserCode &&
            emp.employeeCode?.toLowerCase() === targetFb.dangerCauserCode.toLowerCase()
          )
            return true;
          const empNorm = normalizeEmpName(emp.fullName || '');
          return (
            empNorm.toLowerCase() === normalizedCauserName.toLowerCase() ||
            emp.fullName?.trim().toLowerCase() === causerName.toLowerCase()
          );
        });

        if (matchedEmp) {
          const currentScore = matchedEmp.competencyScore ?? 100;
          const newScore = Math.max(0, currentScore - deductPoints);
          const newViolationCount = (matchedEmp.violationCount || 0) + 1;

          const violationRecord: EmployeeViolationRecord = {
            id: `danger-warn-${id}-${Date.now()}`,
            incidentCode: `CB-NH-${id.slice(0, 6).toUpperCase()}`,
            time: targetFb.submittedAt || new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
            location: 'Hiện trường bãi cảng RTG',
            what: `[Cảnh báo nguy hiểm đã duyệt] ${targetFb.title}: ${targetFb.content.slice(0, 100)}`,
            why: 'Vi phạm an toàn lao động / Tác nghiệp thiết bị được phát hiện qua Cảnh báo nguy hiểm',
            how: `Được phê duyệt bởi ${adminResponse?.by || currentUser?.fullName || 'Ban Quản lý'}: Tự động lưu hồ sơ & trừ ${deductPoints} điểm`,
            severity: deductPoints >= 15 ? 'HIGH' : deductPoints >= 10 ? 'MEDIUM' : 'LOW',
            pointsDeducted: deductPoints,
            recordedAt: new Date().toISOString(),
          };

          const updatedViolationRecords = [
            ...(matchedEmp.violationRecords || []),
            violationRecord,
          ];

          // Cập nhật hồ sơ năng lực nhân viên trên PostgreSQL
          await updateDocumentFields('employees', matchedEmp.id, {
            competencyScore: newScore,
            violationCount: newViolationCount,
            violationRecords: updatedViolationRecords,
          });

          // Cập nhật state nhân viên trong App
          setEmployees((prev) =>
            prev.map((e) =>
              e.id === matchedEmp.id
                ? {
                    ...e,
                    competencyScore: newScore,
                    violationCount: newViolationCount,
                    violationRecords: updatedViolationRecords,
                  }
                : e
            )
          );

          updateData.pointsDeductedApplied = true;
          updateData.pointsDeductedAt = new Date().toISOString();
          updateData.penaltyPoints = deductPoints;
          updateData.dangerCauserId = matchedEmp.id;
          if (matchedEmp.department && !targetFb.dangerCauserDepartment) {
            updateData.dangerCauserDepartment = matchedEmp.department;
          }

          deductedEmpName = matchedEmp.fullName;
          deductedPoints = deductPoints;
        }
      }

      await updateDocumentFields('feedbacks', id, updateData);
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updateData } : f))
      );

      removeToast(toastId);
      if (deductedEmpName) {
        addToast(
          'success',
          `Đã phê duyệt cảnh báo! Tự động lưu vi phạm vào Hồ sơ năng lực & trừ ${deductedPoints} điểm của NV ${deductedEmpName}.`,
          6000
        );
      } else {
        addToast('success', 'Đã cập nhật trạng thái đề xuất thành công.');
      }

      if(status === 'APPROVED' && targetFb?.images?.length) await api('/files/feedback/' + id + '/archive', {method:'POST'});
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật đề xuất: ${err.message}`);
    }
  };

  const handleClearApprovedFeedbackImages = async (feedbackIds: string[]) => {try{for(const id of feedbackIds)await api('/files/feedback/'+id+'/archive',{method:'POST'});addToast('success','Đã xếp hàng lưu trữ. Ảnh chỉ được thay bằng liên kết sau khi Drive xác nhận.');}catch(e){addToast('error',(e as Error).message);}};

  const handleDeleteFeedback = async (feedbackId: string) => {
    const toastId = addToast('loading', 'Đang xóa ý kiến / đề xuất...', 0);
    try {
      await deleteDocument('feedbacks', feedbackId);
      setFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
      removeToast(toastId);
      addToast('success', 'Đã xóa ý kiến / đề xuất thành công.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xóa đề xuất: ${err.message}`);
    }
  };

  // Internal In-App & Scheduled Messages
  const handleSendMessage = async (msg: ZaloMessage) => {
    // 1. Optimistically update state so the message is visible immediately in the UI
    setZaloMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)]);

    const isSched = msg.status === 'SCHEDULED';
    const toastText = isSched
      ? `Đã lên lịch hẹn giờ phát thông báo: "${msg.title}" vào lúc ${msg.scheduledAt}.`
      : `Đã phát thông báo nội bộ thành công.`;
    const toastId = addToast('loading', isSched ? 'Đang lưu lịch hẹn thông báo...' : 'Đang phát thông báo nội bộ...', 0);
    try {
      await saveDocument('zaloMessages', msg.id, msg);
      removeToast(toastId);
      addToast('success', toastText);
    } catch (err: any) {
      removeToast(toastId); addToast('error',err.message||'Chưa lưu được thông báo.');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setZaloMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await deleteDocument('zaloMessages', msgId);
      addToast('success', 'Đã hủy/xóa thông báo thành công.');
    } catch (e) {
      console.warn('Error deleting message:', e);
      addToast('error', 'Chưa xóa được thông báo trên server.');
    }
  };

  const handleSendScheduledNow = async (msgId: string) => {
    const target = zaloMessages.find((m) => m.id === msgId);
    if (!target) return;
    const updated: ZaloMessage = {
      ...target,
      status: 'DELIVERED',
      sentAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isScheduled: false,
    };
    setZaloMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
    try {
      await saveDocument('zaloMessages', msgId, updated);
      addToast('success', `Đã phát thông báo "${updated.title}" ngay lập tức.`);
    } catch (e) {
      console.warn('Error sending scheduled now:', e);
      addToast('success', `Đã phát thông báo "${updated.title}" ngay lập tức.`);
    }
  };

  const handleMarkMessageAsRead = async (msgId: string) => {
    if (!currentUser) return;
    setZaloMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          const reads = m.readByIds || [];
          if (!reads.includes(currentUser.id)) {
            const updated = { ...m, readByIds: [...reads, currentUser.id] };
            api('/messages/'+msgId+'/read',{method:'POST'}).catch(e=>addToast('error',e.message));
            return updated;
          }
        }
        return m;
      })
    );
  };

  const handleAssignQuiz = async (quizId: string, recipientIds: string[]) => {
    const toastId = addToast('loading', 'Đang giao bài và gửi thông báo...', 0);
    try {
      const result = await api<{sentCount:number;alreadyAssignedCount:number;messages:ZaloMessage[]}>(
        '/exams/' + encodeURIComponent(quizId) + '/assign',
        {method:'POST',body:JSON.stringify({recipientIds})}
      );
      setZaloMessages(prev => {
        const ids = new Set(result.messages.map(m => m.id));
        return [...result.messages, ...prev.filter(m => !ids.has(m.id))];
      });
      removeToast(toastId);
      addToast('success', `Đã gửi ${result.sentCount} thông báo giao bài.${result.alreadyAssignedCount ? ` ${result.alreadyAssignedCount} nhân viên đã nhận bài trước đó, không gửi trùng.` : ''}`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi giao bài: ${err.message}`);
      throw err;
    }
  };

  // Permissions & Role Updates
  const handleUpdateEmployeePermissions = async (
    employeeId: string,
    newPermissions: PermissionKey[],
    newVisibleTabs?: TabType[],
    managedDepartments?: string[]
  ) => {
    const toastId = addToast('loading', 'Đang lưu phân quyền vào Cloud PostgreSQL...', 0);
    try {
      const updateData: any = {
        assignedPermissions: newPermissions,
      };
      if (newVisibleTabs !== undefined) {
        updateData.visibleTabs = newVisibleTabs;
      }
      if (managedDepartments !== undefined) {
        updateData.managedDepartments = managedDepartments;
      }
      await updateDocumentFields('employees', employeeId, updateData);

      // Local state sync
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                assignedPermissions: newPermissions,
                ...(newVisibleTabs !== undefined ? { visibleTabs: newVisibleTabs } : {}),
                ...(managedDepartments !== undefined ? { managedDepartments } : {}),
              }
            : e
        )
      );

      if (currentUser && currentUser.id === employeeId) {
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                assignedPermissions: newPermissions,
                ...(newVisibleTabs !== undefined ? { visibleTabs: newVisibleTabs } : {}),
                ...(managedDepartments !== undefined ? { managedDepartments } : {}),
              }
            : null
        );
      }

      removeToast(toastId);
      addToast('success', 'Đã cập nhật quyền truy cập thành công.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật quyền: ${err.message}`);
    }
  };

  const handleUpdateEmployeeRole = async (employeeId: string, newRole: UserRole) => {
    const toastId = addToast('loading', 'Đang cập nhật vai trò vào Cloud PostgreSQL...', 0);
    try {
      const defaultPerms = ROLE_CONFIGS[newRole].defaultPermissions;
      const visibleTabs = DEFAULT_VISIBLE_TABS_BY_ROLE[newRole] || ['library', 'settings'];
      await updateDocumentFields('employees', employeeId, {
        role: newRole,
        assignedPermissions: defaultPerms,
        visibleTabs: visibleTabs,
      });

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                role: newRole,
                assignedPermissions: defaultPerms,
                visibleTabs: visibleTabs,
              }
            : e
        )
      );

      if (currentUser && currentUser.id === employeeId) {
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                role: newRole,
                assignedPermissions: defaultPerms,
                visibleTabs: visibleTabs,
              }
            : null
        );
      }

      removeToast(toastId);
      addToast('success', `Đã chuyển đổi vai trò sang ${ROLE_CONFIGS[newRole].name}.`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi cập nhật vai trò: ${err.message}`);
    }
  };

  const handleBatchUpdateRolePermissions = async (
    role: UserRole,
    newPermissions: PermissionKey[],
    newVisibleTabs: TabType[],
    defaultScope: 'ALL' | 'DIRECT' | 'NONE' = 'ALL'
  ) => {
    const roleName = ROLE_CONFIGS[role]?.name || role;
    const toastId = addToast('loading', `Đang áp dụng phân quyền cho toàn bộ nhân sự vai trò ${roleName}...`, 0);
    try {
      // 1. Lưu cấu hình mẫu vai trò vào AppSettings
      const updatedTemplates = {
        ...(appSettings?.customRoleTemplates || {}),
        [role]: {
          permissions: newPermissions,
          visibleTabs: newVisibleTabs,
          defaultScope,
        },
      };
      await handleSaveAppSettings({
        customRoleTemplates: updatedTemplates,
      });

      // 2. Tìm tất cả nhân sự thuộc vai trò này (kèm role tương thích nếu có)
      const matchingEmployees = employees.filter((e) => {
        if (role === 'MANAGER_L1') return e.role === 'MANAGER_L1' || e.role === 'MANAGER';
        if (role === 'USER') return e.role === 'USER' || e.role === 'VIEWER';
        return e.role === role;
      });

      // 3. Cập nhật đồng loạt trên PostgreSQL
      for (const emp of matchingEmployees) {
        const managedDepts =
          defaultScope === 'ALL'
            ? ['ALL']
            : defaultScope === 'DIRECT' && emp.department
            ? [emp.department]
            : emp.managedDepartments || [];

        const updateData: any = {
          assignedPermissions: newPermissions,
          visibleTabs: newVisibleTabs,
        };
        if (defaultScope !== 'NONE') {
          updateData.managedDepartments = managedDepts;
        }

        try {
          await updateDocumentFields('employees', emp.id, updateData);
        } catch (e) {
          console.warn(`Lỗi cập nhật PostgreSQL cho nhân sự ${emp.fullName}:`, e);
        }
      }

      // 4. Cập nhật State trong App
      setEmployees((prev) =>
        prev.map((emp) => {
          const isMatch =
            role === 'MANAGER_L1'
              ? emp.role === 'MANAGER_L1' || emp.role === 'MANAGER'
              : role === 'USER'
              ? emp.role === 'USER' || emp.role === 'VIEWER'
              : emp.role === role;

          if (!isMatch) return emp;

          const managedDepts =
            defaultScope === 'ALL'
              ? ['ALL']
              : defaultScope === 'DIRECT' && emp.department
              ? [emp.department]
              : emp.managedDepartments || [];

          return {
            ...emp,
            assignedPermissions: newPermissions,
            visibleTabs: newVisibleTabs,
            ...(defaultScope !== 'NONE' ? { managedDepartments: managedDepts } : {}),
          };
        })
      );

      // Cập nhật currentUser nếu thuộc role này
      if (
        currentUser &&
        (currentUser.role === role ||
          (role === 'MANAGER_L1' && currentUser.role === 'MANAGER') ||
          (role === 'USER' && currentUser.role === 'VIEWER'))
      ) {
        const managedDepts =
          defaultScope === 'ALL'
            ? ['ALL']
            : defaultScope === 'DIRECT' && currentUser.department
            ? [currentUser.department]
            : currentUser.managedDepartments || [];

        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                assignedPermissions: newPermissions,
                visibleTabs: newVisibleTabs,
                ...(defaultScope !== 'NONE' ? { managedDepartments: managedDepts } : {}),
              }
            : null
        );
      }

      removeToast(toastId);
      addToast('success', `Đã đồng bộ tệp quyền & menu cho ${matchingEmployees.length} nhân sự thuộc vai trò ${roleName}!`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi đồng bộ tệp vai trò: ${err.message}`);
    }
  };

  // Question Bank Updates
  const handleUpdateQuestionBank = async (updatedList: QuizQuestion[]) => {
    // Save any newly added or edited questions to questionBank collection
    for (const q of updatedList) {
      await saveDocument('questionBank', q.id, q);
    }
    setQuestionBank(updatedList);
  };

  const handleUpdateQuestionFolders = async (updatedFolders: QuestionFolder[]) => {
    for (const f of updatedFolders) {
      await saveDocument('questionFolders', f.id, f);
    }
    setQuestionFolders(updatedFolders);
  };

  const handleSaveAppSettings = async (newSettings: Partial<AppSettings>) => {
    const updatedSettings = {
      ...appSettings,
      ...newSettings,
      id: 'global'
    } as AppSettings;
    await saveDocument('settings', 'global', updatedSettings);
    setAppSettings(updatedSettings);
  };

  const handleSaveBxxlRecord = async (record: BxxlRecord, updatedEmployees: Employee[]) => {
    const toastId = addToast('loading', 'Đang lưu biên bản và cập nhật xếp loại nhân sự...', 0);
    try {
      const result = await api('/operations/ranking/finalize', {
        method:'POST', body:JSON.stringify({record,employeeIds:updatedEmployees.map(emp=>emp.id)}),
      });
      Object.assign(record,result.record);
      setEmployees(updatedEmployees.map(emp=>({...emp,monthlyEvaluations:emp.monthlyEvaluations?.map(entry=>entry.month === record.evaluationMonth ? {...entry,recordId:record.id} : entry)})));

      removeToast(toastId);
      addToast(
        'success',
        `Đã lưu biên bản và đồng bộ kết quả xếp loại Tháng ${record.evaluationMonth} cho toàn bộ nhân sự!`
      );

    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi lưu biên bản BXXL: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteBxxlRecord = async (recordId: string) => {
    const toastId = addToast('loading', 'Đang xóa biên bản...', 0);
    try {
      await deleteDocument('bxxlRecords', recordId);
      removeToast(toastId);
      addToast('success', 'Đã xóa biên bản bình xét xếp loại.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xóa biên bản: ${err.message}`);
    }
  };

  // Leave Request Handlers (Quản lý đăng ký nghỉ phép & Đồng bộ thông tin người dùng)
  const handleCreateLeaveRequest = async (newReq: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
    const toastId = addToast('loading', 'Đang gửi phiếu đăng ký nghỉ phép...', 0);
    try {
      const id = `leave-${Date.now()}`;
      const fullReq: LeaveRequest = {
        ...newReq,
        id,
        status: 'PENDING',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };
      await saveDocument('leaveRequests', id, fullReq);
      setLeaveRequests((prev) => [fullReq, ...prev]);
      removeToast(toastId);
      addToast('success', 'Đã gửi đăng ký nghỉ phép thành công. Chờ cấp quản lý phê duyệt.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi đăng ký nghỉ phép: ${err.message}`);
    }
  };

  const handleApproveLeaveRequest = async (requestId: string, approverName?: string) => {
    const toastId = addToast('loading', 'Đang phê duyệt phiếu nghỉ phép...', 0);
    try {
      const req = leaveRequests.find((r) => r.id === requestId);
      if (!req) {
        removeToast(toastId);
        addToast('error', 'Không tìm thấy phiếu nghỉ phép.');
        return;
      }

      const approvedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const approver = approverName || currentUser?.fullName || 'Quản lý';
      const updateData: Partial<LeaveRequest> = {
        status: 'APPROVED',
        approvedBy: currentUser?.id,
        approvedByName: approver,
        approvedAt,
      };

      await updateDocumentFields('leaveRequests', requestId, updateData);

      // Đồng bộ thông tin nghỉ phép vào hồ sơ nhân sự (User info sync requirement)
      const emp = employees.find((e) => e.id === req.employeeId);
      if (emp) {
        const approvedLeaveItem = {
          requestId: req.id,
          startDate: req.startDate,
          endDate: req.endDate,
          shift: req.targetShift,
          leaveType: req.leaveType,
          reason: req.reason,
          approvedBy: approver,
          approvedAt,
        };
        const currentLeaves = emp.approvedLeaves || [];
        const updatedLeaves = [...currentLeaves.filter((l) => l.requestId !== req.id), approvedLeaveItem];

        await updateDocumentFields('employees', emp.id, {
          approvedLeaves: updatedLeaves,
        });

        // Sync local employees state
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, approvedLeaves: updatedLeaves } : e))
        );

        if (currentUser && currentUser.id === emp.id) {
          setCurrentUser((prev) => (prev ? { ...prev, approvedLeaves: updatedLeaves } : prev));
        }
      }

      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...updateData } : r))
      );

      removeToast(toastId);
      addToast('success', `Đã duyệt nghỉ phép thành công cho nhân sự ${req.employeeName}. Thông tin đã được đồng bộ vào hồ sơ.`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi phê duyệt nghỉ phép: ${err.message}`);
    }
  };

  const handleRejectLeaveRequest = async (requestId: string, approverNameOrReason: string, optionalReason?: string) => {
    const toastId = addToast('loading', 'Đang từ chối phiếu nghỉ phép...', 0);
    try {
      const req = leaveRequests.find((r) => r.id === requestId);
      if (!req) {
        removeToast(toastId);
        addToast('error', 'Không tìm thấy phiếu nghỉ phép.');
        return;
      }

      const actualReason = optionalReason || approverNameOrReason || 'Không được phê duyệt';
      const approver = (optionalReason ? approverNameOrReason : currentUser?.fullName) || 'Quản lý';
      const approvedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const updateData: Partial<LeaveRequest> = {
        status: 'REJECTED',
        approvedBy: currentUser?.id,
        approvedByName: approver,
        approvedAt,
        rejectionReason: actualReason,
        rejectReason: actualReason,
      };

      await updateDocumentFields('leaveRequests', requestId, updateData);

      // Nếu trước đó đã duyệt, loại bỏ khỏi approvedLeaves của nhân sự
      const emp = employees.find((e) => e.id === req.employeeId);
      if (emp && emp.approvedLeaves) {
        const updatedLeaves = emp.approvedLeaves.filter((l) => l.requestId !== req.id);
        await updateDocumentFields('employees', emp.id, {
          approvedLeaves: updatedLeaves,
        });
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, approvedLeaves: updatedLeaves } : e))
        );
        if (currentUser && currentUser.id === emp.id) {
          setCurrentUser((prev) => (prev ? { ...prev, approvedLeaves: updatedLeaves } : prev));
        }
      }

      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...updateData } : r))
      );

      removeToast(toastId);
      addToast('success', `Đã ghi nhận không duyệt phiếu nghỉ phép của ${req.employeeName}. Lý do: ${actualReason}`);
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xử lý phiếu nghỉ phép: ${err.message}`);
    }
  };

  const handleDeleteLeaveRequest = async (requestId: string) => {
    const toastId = addToast('loading', 'Đang xóa phiếu nghỉ phép...', 0);
    try {
      await deleteDocument('leaveRequests', requestId);
      setLeaveRequests((prev) => prev.filter((r) => r.id !== requestId));
      removeToast(toastId);
      addToast('success', 'Đã xóa phiếu nghỉ phép thành công.');
    } catch (err: any) {
      removeToast(toastId);
      addToast('error', `Lỗi xóa phiếu nghỉ phép: ${err.message}`);
    }
  };

  // If user is not logged in, show LoginView with Google & Email Auth
  if(location.pathname!=='/')return <div className="p-12 text-center"><h1>404 · Không tìm thấy trang</h1><a href="/">Về trang chủ</a></div>;
  if (!authInitialized) return <div role="status" className="p-10 text-center">Đang xác thực phiên đăng nhập…</div>;
  if (!currentUser) {
    return (
      <LoginView
        employees={employees}
        onLogin={() => {}}
        authError={authError}
        onClearAuthError={() => setAuthError(null)}
      />
    );
  }

  // Cửa sổ cập nhật thông tin chỉ hiển thị khi onboardingCompleted === false và chưa bị đóng/bỏ qua
  const isDismissed =
    onboardingDismissed ||
    (currentUser
      ? localStorage.getItem(`rtg_onboarding_dismissed_${currentUser.id}`) === 'true'
      : false);

  const showOnboarding = Boolean(
    currentUser &&
    currentUser.onboardingCompleted === false &&
    !isDismissed
  );

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification Bar */}
      <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all transform translate-y-0 ${
              toast.type === 'loading'
                ? 'bg-slate-900 text-white border-slate-700'
                : toast.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/50 shadow-emerald-900/30'
                : 'bg-rose-950 text-rose-100 border-rose-500/50 shadow-rose-900/30'
            }`}
          >
            {toast.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={handleDismissOnboarding}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
              title="Đóng / Bỏ qua"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👋</span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-xl">Chào mừng bạn!</h3>
              <p className="text-sm text-slate-500 mt-2">
                Cập nhật thông tin cá nhân để đồng bộ với hệ thống nhân sự và Zalo. Bạn có thể bỏ qua và cập nhật sau.
              </p>
            </div>

            <form onSubmit={handleCompleteOnboarding} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và Tên</label>
                <input
                  name="fullName"
                  required
                  defaultValue={currentUser.fullName}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Nhập họ và tên..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày tháng năm sinh</label>
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={currentUser.dateOfBirth || '1995-01-01'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại Zalo</label>
                <input
                  name="zaloPhone"
                  defaultValue={currentUser.zaloPhone || currentUser.phone}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Nhập số điện thoại Zalo của bạn"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDismissOnboarding}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer text-center"
                >
                  Bỏ qua & Vào hệ thống
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-colors shadow-lg shadow-indigo-600/30 cursor-pointer text-center"
                >
                  Lưu & Bắt đầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        allUsers={employees}
        allEmployees={employees}
        onLogout={handleLogout}
        onSeedData={handleManualSeed}
        onOpenMasterSync={() => setIsMasterSyncOpen(true)}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        unreadChatCount={
          zaloMessages.filter(
            (m) =>
              m.status !== 'SCHEDULED' &&
              (!m.readByIds || !m.readByIds.includes(currentUser.id)) &&
              (m.recipientType === 'ALL' ||
                (m.recipientType === 'DEPARTMENT' && m.department === currentUser.department) ||
                (m.recipientType === 'INDIVIDUAL' && m.recipientIds?.includes(currentUser.id)))
          ).length
        }
        onToggleChat={() => setIsQuickChatOpen((prev) => !prev)}
        totalZaloSynced={employees.filter((e) => e.zaloSynced).length}
        totalEmployees={employees.length}
        PostgreSQLOnline={!dataLoading}
      />

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto overflow-hidden">
        {/* Responsive Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          badgeCounts={{
            leave: leaveRequests.filter((r) => r.status === 'PENDING').length,
            library: documents.length,
            quiz: quizzes.length,
            feedback: feedbacks.filter((f) => f.status === 'PENDING').length,
            zalo: zaloMessages.length,
          }}
          pendingLeavesCount={leaveRequests.filter((r) => r.status === 'PENDING').length}
        />

        {/* Main Content View Container */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-65px)] supports-[max-height:100dvh]:max-h-[calc(100dvh-65px)] min-h-0 min-w-0">
          {dataLoading&&<p role="status" className="text-sm text-slate-500 mb-3">Đang tải dữ liệu…</p>}
          {!isTabAllowed(activeTab as TabType, currentUser) ? (
            <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto border border-rose-300">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Khu Vực Bị Giới Hạn Quyền Truy Cập
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                Chức năng này chỉ hiển thị và cho phép thao tác đối với nhân sự được cấp quyền hạn tương ứng. Tài khoản của bạn hiện chưa được Quản trị viên phân quyền cho phân hệ này.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(getFirstAllowedTab(currentUser))}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-colors cursor-pointer"
                >
                  <span>Chuyển đến phân hệ được cấp quyền</span>
                </button>
              </div>
            </div>
          ) : (
            <>
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              employees={employees}
              documents={documents}
              quizzes={quizzes}
              submissions={submissions}
              feedbacks={feedbacks}
              zaloMessages={zaloMessages}
              appSettings={appSettings}
              onSaveAppSettings={handleSaveAppSettings}
              setActiveTab={setActiveTab}
              onNavigateToLibraryCategory={(category) => {
                setLibraryInitialCategory(category);
                setActiveTab('library');
              }}
              onOpenMasterSync={() => setIsMasterSyncOpen(true)}
            />
          )}

          {activeTab === 'hr' && (
            <HrManagementView
              employees={employees}
              currentUser={currentUser}
              appSettings={appSettings}
              onSaveAppSettings={handleSaveAppSettings}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onBatchDeleteEmployees={handleBatchDeleteEmployees}
              onBatchUpsertEmployees={handleBatchUpsertEmployees}
              onSendZaloToEmployee={(emp) => {
                setZaloPrefilledRecipient(emp);
                setActiveTab('zalo');
              }}
              onNavigateToPermissions={(empId) => {
                setSelectedEmpIdForPermission(empId);
                setActiveTab('permissions');
              }}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'violations' && (
            <ViolationsView
              currentUser={currentUser}
              employees={employees}
              incidents={incidents}
              onUpdateIncidents={handleUpdateIncidents}
              onUpdateEmployee={handleUpdateEmployee}
              onBatchUpdateEmployees={handleBatchUpdateEmployees}
              onAddEmployee={handleAddEmployee}
              onBackToDashboard={() => setActiveTab('dashboard')}
              appSettings={appSettings}
              onSaveAppSettings={handleSaveAppSettings}
              onNavigateToPermissions={() => setActiveTab('permissions')}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              documents={documents}
              currentUser={currentUser}
              initialCategory={libraryInitialCategory}
              onClearInitialCategory={() => setLibraryInitialCategory('ALL')}
              onAddDocument={handleAddDocument}
              onEditDocument={handleEditDocument}
              onDeleteDocument={handleDeleteDocument}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onNavigateToViolations={() => setActiveTab('violations')}
            />
          )}

          {activeTab === 'drive' && (
            <GoogleDriveView
              currentUser={currentUser}
              onImportToQuestionBank={(fileItem, fileBlob) => {
                setQuizInitialAiFile({ name: fileItem.name, blob: fileBlob });
                setActiveTab('quiz');
              }}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizView
              quizzes={quizzes}
              questionBank={questionBank}
              onUpdateQuestionBank={handleUpdateQuestionBank}
              questionFolders={questionFolders}
              onUpdateQuestionFolders={handleUpdateQuestionFolders}
              submissions={submissions}
              currentUser={currentUser}
              allEmployees={employees}
              onSaveSubmission={handleSaveSubmission}
              onAddQuiz={handleAddQuiz}
              onEditQuiz={handleEditQuiz}
              onDeleteQuiz={handleDeleteQuiz}
              onAssignQuiz={handleAssignQuiz}
              initialAiFile={quizInitialAiFile}
              onClearInitialAiFile={() => setQuizInitialAiFile(null)}
              onBackToDashboard={() => setActiveTab('dashboard')}
              appSettings={appSettings}
            />
          )}

          {activeTab === 'feedback' && (
            <FeedbackView
              feedbacks={feedbacks}
              currentUser={currentUser}
              employees={employees}
              appSettings={appSettings}
              onSaveAppSettings={handleSaveAppSettings}
              onAddFeedback={handleAddFeedback}
              onUpdateFeedbackStatus={handleUpdateFeedbackStatus}
              onClearApprovedFeedbackImages={handleClearApprovedFeedbackImages}
              onDeleteFeedback={handleDeleteFeedback}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onSendZaloNotification={(title, content, recipientName, recipientPhone) => {
                const newMsg: ZaloMessage = {
                  id: `zmsg-auto-${Date.now()}`,
                  recipientType: 'INDIVIDUAL',
                  recipientIds: [],
                  recipientNames: [recipientName],
                  recipientPhones: [recipientPhone],
                  title,
                  content,
                  type: 'INDIVIDUAL',
                  sentAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  status: 'DELIVERED',
                  sentBy: `${currentUser.fullName} (${currentUser.position})`,
                  znsMessageId: `ZNS-${Date.now().toString().slice(-6)}`,
                };
                handleSendMessage(newMsg);
              }}
            />
          )}

          {activeTab === 'zalo' && (
            <ZaloView
              employees={employees}
              currentUser={currentUser}
              messages={zaloMessages}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onSendScheduledNow={handleSendScheduledNow}
              onMarkAsRead={handleMarkMessageAsRead}
              onOpenChat={handleOpenChat}
              prefilledRecipient={zaloPrefilledRecipient}
              onClearPrefilled={() => setZaloPrefilledRecipient(null)}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'permissions' && (
            <PermissionsView
              key="permissions"
              employees={employees}
              currentUser={currentUser}
              appSettings={appSettings}
              onUpdateEmployeePermissions={handleUpdateEmployeePermissions}
              onUpdateEmployeeRole={handleUpdateEmployeeRole}
              onBatchUpdateRolePermissions={handleBatchUpdateRolePermissions}
              onSaveAppSettings={handleSaveAppSettings}
              initialSelectedEmpId={selectedEmpIdForPermission}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onUpdateEmployee={handleUpdateEmployee}
              allSubmissions={submissions}
              allFeedbacks={feedbacks}
              allBxxlRecords={bxxlRecords}
              allViolations={allViolationsList}
            />
          )}

          {activeTab === 'bxxl' && (
            <BxxlView
              employees={employees}
              currentUser={currentUser}
              bxxlRecords={bxxlRecords}
              onSaveBxxlRecord={handleSaveBxxlRecord}
              onDeleteBxxlRecord={handleDeleteBxxlRecord}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'container_tool' && (
            <ContainerYardProcessorView
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {(activeTab === 'leave') && (
            <LeaveRegistrationView
              currentUser={currentUser}
              employees={employees}
              leaveRequests={leaveRequests}
              onCreateLeaveRequest={handleCreateLeaveRequest}
              onApproveLeaveRequest={handleApproveLeaveRequest}
              onRejectLeaveRequest={handleRejectLeaveRequest}
              onDeleteLeaveRequest={handleDeleteLeaveRequest}
            />
          )}

          {activeTab === 'competency_rules' && (
            <PermissionsView
              key="competency_rules"
              employees={employees}
              currentUser={currentUser}
              appSettings={appSettings}
              onUpdateEmployeePermissions={handleUpdateEmployeePermissions}
              onUpdateEmployeeRole={handleUpdateEmployeeRole}
              onSaveAppSettings={handleSaveAppSettings}
              initialSelectedEmpId={selectedEmpIdForPermission}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onUpdateEmployee={handleUpdateEmployee}
              initialViewSection="COMPETENCY"
              allSubmissions={submissions}
              allFeedbacks={feedbacks}
              allBxxlRecords={bxxlRecords}
              allViolations={allViolationsList}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onUpdateEmployee={handleUpdateEmployee}
              appSettings={appSettings}
              onSaveAppSettings={handleSaveAppSettings}
              onNavigateToPermissions={() => setActiveTab('permissions')}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* Quick Chat Floating Window - Hộp thoại chat nhanh nhận, đọc và gửi tin tức thì */}
      {currentUser && (
        <QuickChatWindow
          currentUser={currentUser}
          allEmployees={employees}
          employees={employees}
          messages={zaloMessages}
          onSendMessage={handleSendMessage}
          isOpen={isQuickChatOpen}
          onClose={() => setIsQuickChatOpen(false)}
          onOpen={() => setIsQuickChatOpen(true)}
          initialRecipientId={quickChatRecipientId}
          defaultRecipientId={quickChatRecipientId}
          onMarkAsRead={handleMarkMessageAsRead}
        />
      )}

      {/* Nút Tổng Admin: Cửa sổ đẩy toàn bộ dữ liệu lên Google Sheet (Data_RTG) */}
      {isMasterSyncOpen && (
        <AdminMasterSyncModal
          isOpen={isMasterSyncOpen}
          onClose={() => setIsMasterSyncOpen(false)}
          employees={employees}
          violations={incidents}
          submissions={submissions}
          feedbacks={feedbacks}
          bxxlRecords={bxxlRecords}
          leaveRequests={leaveRequests}
          appSettings={appSettings}
          onAddToast={addToast}
        />
      )}
    </div>
  );
}




