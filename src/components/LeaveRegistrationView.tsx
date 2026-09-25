import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Sun,
  Moon,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Users,
  Building2,
  RotateCcw,
  Check,
  X,
  FileText,
  UserCheck,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  Employee,
  LeaveRequest,
  LeaveShift,
  LeaveType,
  LeaveStatus,
  PermissionKey,
} from '../types';

interface LeaveRegistrationViewProps {
  currentUser: Employee;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  onCreateLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  onApproveLeaveRequest: (requestId: string, approverName: string) => Promise<void>;
  onRejectLeaveRequest: (requestId: string, approverName: string, reason: string) => Promise<void>;
  onDeleteLeaveRequest?: (requestId: string) => Promise<void>;
}

const LEAVE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  POLICY: { label: 'Nghỉ chế độ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  REASONABLE: { label: 'Nghỉ phép có lý do', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ANNUAL: { label: 'Nghỉ phép có lý do', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PERSONAL: { label: 'Nghỉ phép có lý do', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  COMPENSATORY: { label: 'Nghỉ chế độ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  SICK: { label: 'Nghỉ chế độ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  MATERNITY: { label: 'Nghỉ chế độ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  OTHER: { label: 'Nghỉ phép có lý do', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const SHIFT_LABELS: Record<LeaveShift, { label: string; icon: React.ElementType; color: string; badgeColor: string }> = {
  DAY: {
    label: 'Ca Ngày (06:00 - 18:00)',
    icon: Sun,
    color: 'text-amber-600',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  NIGHT: {
    label: 'Ca Đêm (18:00 - 06:00)',
    icon: Moon,
    color: 'text-indigo-600',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  FULL_DAY: {
    label: 'Cả ngày (24h / Toàn bộ ca)',
    icon: CalendarDays,
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

export const LeaveRegistrationView: React.FC<LeaveRegistrationViewProps> = ({
  currentUser,
  employees,
  leaveRequests,
  onCreateLeaveRequest,
  onApproveLeaveRequest,
  onRejectLeaveRequest,
  onDeleteLeaveRequest,
}) => {
  // Calendar month state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Filters for Statistics & Table below calendar
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | LeaveShift>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Modal State for New Leave Registration
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [isMultiDay, setIsMultiDay] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(() => {
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return today.toISOString().split('T')[0];
  });
  const [leaveType, setLeaveType] = useState<LeaveType>('POLICY');
  const [reason, setReason] = useState<string>('');
  const [substituteName, setSubstituteName] = useState<string>('');
  const [selectedTargetEmployeeId, setSelectedTargetEmployeeId] = useState<string>(currentUser.id);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal State for Rejecting with Required Reason
  const [rejectModalData, setRejectModalData] = useState<{
    requestId: string;
    employeeName: string;
    dateStr: string;
  } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Quick Action notification
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Check management/approval permission
  const canApprove = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER_L1' || currentUser.role === 'MANAGER') {
      return true;
    }
    if (currentUser.role === 'MANAGER_L2') {
      return true;
    }
    return (
      (currentUser.assignedPermissions || []).includes('MANAGE_LEAVE') ||
      (currentUser.assignedPermissions || []).includes('MANAGE_HR') ||
      (currentUser.assignedPermissions || []).includes('MANAGE_DEPARTMENT_USERS')
    );
  }, [currentUser]);

  // Check if current user can approve a specific request based on department
  const canApproveForRequest = (req: LeaveRequest): boolean => {
    if (!canApprove) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER_L1' || currentUser.role === 'MANAGER') {
      return true;
    }
    // Manager L2 with managed departments
    if (currentUser.managedDepartments && currentUser.managedDepartments.length > 0) {
      if (currentUser.managedDepartments.includes('ALL')) return true;
      return currentUser.managedDepartments.includes(req.department);
    }
    // Default to own department
    return currentUser.department === req.department;
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedCalendarDate(null);
  };

  // Click on a date in calendar to open registration modal
  const handleDateClick = (dateStr: string) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setIsMultiDay(false);
    setFormError(null);
    setShowRegisterModal(true);
  };

  // Calendar Grid Calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // In Vietnam: Monday is first day of week (0: Mon, 1: Tue, ..., 6: Sun)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    const days: {
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Days from previous month for grid alignment
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNumber: d,
        dateStr: `${prevY}-${mStr}-${dStr}`,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Days of current month
    const todayStr = today.toISOString().split('T')[0];
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Days from next month to fill remaining 42 cells grid (6 rows * 7 days)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const mStr = String(nextM + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNumber: d,
        dateStr: `${nextY}-${mStr}-${dStr}`,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Map requests by date
  const requestsByDate = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();

    leaveRequests.forEach((req) => {
      // For multi-day or single-day, register into each spanned day
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);

      // Loop dates
      const curr = new Date(start);
      while (curr <= end) {
        const dStr = curr.toISOString().split('T')[0];
        if (!map.has(dStr)) {
          map.set(dStr, []);
        }
        map.get(dStr)!.push(req);
        curr.setDate(curr.getDate() + 1);
      }
    });

    return map;
  }, [leaveRequests]);

  // Statistics for currently viewed month
  const monthStats = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    // Requests that touch this month
    const thisMonthRequests = leaveRequests.filter((req) => {
      const startMonth = req.startDate.slice(0, 7);
      const endMonth = req.endDate.slice(0, 7);
      return startMonth === monthPrefix || endMonth === monthPrefix;
    });

    let totalRegistrations = thisMonthRequests.length;
    let dayShiftCount = 0;
    let nightShiftCount = 0;
    let fullDayCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    thisMonthRequests.forEach((r) => {
      if (r.targetShift === 'DAY') dayShiftCount++;
      else if (r.targetShift === 'NIGHT') nightShiftCount++;
      else fullDayCount++;

      if (r.status === 'PENDING') pendingCount++;
      else if (r.status === 'APPROVED') approvedCount++;
      else if (r.status === 'REJECTED') rejectedCount++;
    });

    // Count unique days with registrations in this month
    const daysWithRegistrations = new Set<string>();
    thisMonthRequests.forEach((r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const curr = new Date(start);
      while (curr <= end) {
        const dStr = curr.toISOString().split('T')[0];
        if (dStr.startsWith(monthPrefix)) {
          daysWithRegistrations.add(dStr);
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    return {
      totalRegistrations,
      daysWithRegistrationsCount: daysWithRegistrations.size,
      dayShiftCount,
      nightShiftCount,
      fullDayCount,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }, [leaveRequests, currentYear, currentMonth]);

  // Filtered requests for the table below calendar
  const filteredRequests = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    return leaveRequests
      .filter((req) => {
        // Month filter or calendar click date filter
        if (selectedCalendarDate) {
          const start = new Date(req.startDate);
          const end = new Date(req.endDate);
          const sel = new Date(selectedCalendarDate);
          if (sel < start || sel > end) return false;
        } else {
          // In current month
          const startMonth = req.startDate.slice(0, 7);
          const endMonth = req.endDate.slice(0, 7);
          if (startMonth !== monthPrefix && endMonth !== monthPrefix) {
            return false;
          }
        }

        // Department filter
        if (deptFilter !== 'ALL' && req.department !== deptFilter) {
          return false;
        }

        // Shift filter
        if (shiftFilter !== 'ALL' && req.targetShift !== shiftFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'ALL' && req.status !== statusFilter) {
          return false;
        }

        // Search keyword
        if (searchKeyword.trim()) {
          const q = searchKeyword.toLowerCase();
          const matchName = req.employeeName.toLowerCase().includes(q);
          const matchCode = req.employeeCode.toLowerCase().includes(q);
          const matchDept = req.department.toLowerCase().includes(q);
          const matchReason = req.reason.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchDept && !matchReason) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leaveRequests, currentYear, currentMonth, selectedCalendarDate, deptFilter, shiftFilter, statusFilter, searchKeyword]);

  // All departments list
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Handle Form Submit
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim()) {
      setFormError('Vui lòng nhập lý do xin nghỉ phép');
      return;
    }

    if (isMultiDay && (!startDate || !endDate)) {
      setFormError('Vui lòng chọn đầy đủ từ ngày đến ngày');
      return;
    }

    if (isMultiDay && new Date(startDate) > new Date(endDate)) {
      setFormError('Ngày kết thúc không được sớm hơn ngày bắt đầu');
      return;
    }

    const targetEmp = employees.find((e) => e.id === selectedTargetEmployeeId) || currentUser;

    // Calculate days count
    let count = 1;
    if (isMultiDay) {
      const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      count = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    }

    setIsSubmitting(true);
    try {
      await onCreateLeaveRequest({
        employeeId: targetEmp.id,
        employeeCode: targetEmp.employeeCode,
        employeeName: targetEmp.fullName,
        department: targetEmp.department,
        shift: targetEmp.shift,
        isMultiDay,
        startDate: startDate,
        endDate: isMultiDay ? endDate : startDate,
        leaveType,
        reason: reason.trim(),
        substituteName: substituteName.trim() || undefined,
        daysCount: count,
      });

      setShowRegisterModal(false);
      setReason('');
      setSubstituteName('');
      setActionSuccessMsg(`Đã gửi đăng ký nghỉ phép thành công cho ${targetEmp.fullName}!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi gửi đăng ký nghỉ phép');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Approve
  const handleApprove = async (req: LeaveRequest) => {
    try {
      await onApproveLeaveRequest(req.id, currentUser.fullName);
      setActionSuccessMsg(`Đã duyệt đơn nghỉ phép của ${req.employeeName} và đồng bộ thông tin thành công!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Lỗi phê duyệt: ${err.message}`);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (req: LeaveRequest) => {
    setRejectModalData({
      requestId: req.id,
      employeeName: req.employeeName,
      dateStr: req.startDate === req.endDate ? req.startDate : `${req.startDate} - ${req.endDate}`,
    });
    setRejectReasonInput('');
    setRejectError(null);
  };

  // Confirm Reject with reason
  const handleConfirmReject = async () => {
    if (!rejectModalData) return;
    if (!rejectReasonInput.trim()) {
      setRejectError('Bắt buộc phải nêu rõ lý do từ chối để nhân sự được biết.');
      return;
    }

    setIsRejecting(true);
    setRejectError(null);
    try {
      await onRejectLeaveRequest(rejectModalData.requestId, currentUser.fullName, rejectReasonInput.trim());
      setRejectModalData(null);
      setActionSuccessMsg(`Đã từ chối đơn của ${rejectModalData.employeeName} với lý do được ghi nhận.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setRejectError(`Lỗi: ${err.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast alert */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="p-1 text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CalendarDays className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Đăng Ký Nghỉ Phép
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Nghỉ 1 ngày hoặc Dài ngày
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bấm trực tiếp vào ngày trên bảng lịch để gửi đơn xin nghỉ 1 ngày hoặc dài ngày. Quản lý phê duyệt và tự động đồng bộ vào hồ sơ nhân sự.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setStartDate(now.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
              setIsMultiDay(false);
              setFormError(null);
              setShowRegisterModal(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng Ký Nghỉ Phép</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. BẢNG LỊCH THÁNG (CALENDAR TABLE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        {/* Month navigation header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
              Tháng {currentMonth + 1} / {currentYear}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {monthStats.daysWithRegistrationsCount} ngày có đăng ký nghỉ
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Go to Today */}
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Hôm nay
            </button>

            {/* Select Month Dropdown */}
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  Tháng {i + 1}
                </option>
              ))}
            </select>

            {/* Select Year Dropdown */}
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>

            {/* Prev / Next buttons */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend bar */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 font-medium py-1">
          <span className="font-bold text-slate-700">Chú thích ca nghỉ:</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <Sun className="w-3.5 h-3.5 text-amber-600" />
            <span>Ca Ngày (06:00 - 18:00)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800">
            <Moon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ca Đêm (18:00 - 06:00)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cả ngày / Dài ngày</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Nhấp vào ngày bất kỳ trên bảng để đăng ký nghỉ</span>
          </div>
        </div>

        {/* 7-column calendar grid */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-extrabold text-slate-600 py-2.5">
            <div>Thứ 2</div>
            <div>Thứ 3</div>
            <div>Thứ 4</div>
            <div>Thứ 5</div>
            <div>Thứ 6</div>
            <div className="text-indigo-600">Thứ 7</div>
            <div className="text-rose-600">Chủ Nhật</div>
          </div>

          {/* Days cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/50">
            {calendarDays.map((d, idx) => {
              const dayRequests = requestsByDate.get(d.dateStr) || [];
              const dayShiftReqs = dayRequests.filter((r) => r.targetShift === 'DAY');
              const nightShiftReqs = dayRequests.filter((r) => r.targetShift === 'NIGHT');
              const fullDayReqs = dayRequests.filter((r) => !r.targetShift || r.targetShift === 'FULL_DAY');

              const isSelected = selectedCalendarDate === d.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(d.dateStr)}
                  className={`min-h-[105px] sm:min-h-[120px] p-2 flex flex-col justify-between transition-all cursor-pointer group relative ${
                    d.isCurrentMonth ? 'bg-white hover:bg-indigo-50/30' : 'bg-slate-50/70 text-slate-300'
                  } ${d.isToday ? 'ring-2 ring-indigo-500/40 bg-indigo-50/15' : ''} ${
                    isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/40' : ''
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${
                        d.isToday
                          ? 'bg-indigo-600 text-white font-extrabold shadow-2xs'
                          : d.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {d.dayNumber}
                    </span>

                    {d.isToday && (
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                        Hôm nay
                      </span>
                    )}

                    {/* Quick plus icon on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDateClick(d.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-opacity"
                      title="Đăng ký nghỉ ngày này"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Badges of Registered Leaves in this Day */}
                  <div className="mt-1 space-y-1 flex-1">
                    {dayRequests.length > 0 ? (
                      <div className="space-y-1">
                        {/* Ca Ngày */}
                        {dayShiftReqs.length > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCalendarDate(d.dateStr);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-between"
                            title={`Ca Ngày: ${dayShiftReqs.map((r) => r.employeeName).join(', ')}`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <Sun className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span className="truncate">
                                {dayShiftReqs.length === 1
                                  ? dayShiftReqs[0].employeeName.split(' ').slice(-1)[0]
                                  : `${dayShiftReqs.length} người`}
                              </span>
                            </span>
                            <span className="text-[9px] text-amber-700 shrink-0">Ngày</span>
                          </div>
                        )}

                        {/* Ca Đêm */}
                        {nightShiftReqs.length > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCalendarDate(d.dateStr);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center justify-between"
                            title={`Ca Đêm: ${nightShiftReqs.map((r) => r.employeeName).join(', ')}`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <Moon className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                              <span className="truncate">
                                {nightShiftReqs.length === 1
                                  ? nightShiftReqs[0].employeeName.split(' ').slice(-1)[0]
                                  : `${nightShiftReqs.length} người`}
                              </span>
                            </span>
                            <span className="text-[9px] text-indigo-700 shrink-0">Đêm</span>
                          </div>
                        )}

                        {/* Cả Ngày / Dài ngày */}
                        {fullDayReqs.length > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCalendarDate(d.dateStr);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-between"
                            title={`Cả ngày: ${fullDayReqs.map((r) => r.employeeName).join(', ')}`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <CalendarDays className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                {fullDayReqs.length === 1
                                  ? fullDayReqs[0].employeeName.split(' ').slice(-1)[0]
                                  : `${fullDayReqs.length} người`}
                              </span>
                            </span>
                            <span className="text-[9px] text-emerald-700 shrink-0">24h</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-60 text-[10px] text-slate-400 font-medium">
                        + Đăng ký
                      </div>
                    )}
                  </div>

                  {/* Footer count indicator */}
                  {dayRequests.length > 0 && (
                    <div className="pt-1 flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-100/80">
                      <span>Tổng: <b>{dayRequests.length}</b></span>
                      <span className="flex items-center gap-0.5">
                        {dayRequests.some((r) => r.status === 'PENDING') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Có đơn chờ duyệt" />
                        )}
                        {dayRequests.some((r) => r.status === 'APPROVED') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Có đơn đã duyệt" />
                        )}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THỐNG KÊ CHI TIẾT BÊN DƯỚI BẢNG LỊCH (DIRECT USER REQUIREMENT) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <span>Thống Kê Đăng Ký Nghỉ Phép & Lượng Người Theo Ca</span>
              {selectedCalendarDate ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Ngày {selectedCalendarDate}
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Tháng {currentMonth + 1}/{currentYear}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Tổng hợp số lượng nhân viên đăng ký theo từng ca, tỷ lệ phê duyệt và bảng chi tiết người nghỉ.
            </p>
          </div>

          {selectedCalendarDate && (
            <button
              type="button"
              onClick={() => setSelectedCalendarDate(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors w-fit"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xem toàn bộ Tháng {currentMonth + 1}</span>
            </button>
          )}
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Tổng đăng ký */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Tổng lượt đăng ký</span>
              <CalendarDays className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {monthStats.totalRegistrations}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Trên {monthStats.daysWithRegistrationsCount} ngày trong tháng
            </p>
          </div>

          {/* Card 2: Ca Ngày */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-xs font-bold">Đăng ký Ca Ngày (☀️)</span>
              <Sun className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900">
              {monthStats.dayShiftCount}
            </div>
            <p className="text-[11px] text-amber-700 font-medium">
              Ca làm việc 06:00 - 18:00
            </p>
          </div>

          {/* Card 3: Ca Đêm */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-indigo-800">
              <span className="text-xs font-bold">Đăng ký Ca Đêm (🌙)</span>
              <Moon className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-900">
              {monthStats.nightShiftCount}
            </div>
            <p className="text-[11px] text-indigo-700 font-medium">
              Ca làm việc 18:00 - 06:00
            </p>
          </div>

          {/* Card 4: Trạng thái duyệt */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Tiến độ phê duyệt</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {monthStats.approvedCount} Đã duyệt
              </span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                {monthStats.pendingCount} Chờ duyệt
              </span>
              {monthStats.rejectedCount > 0 && (
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                  {monthStats.rejectedCount} Từ chối
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filters and search bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên, mã NV, lý do..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Department filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="ALL">Tất cả bộ phận</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Shift filter */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="ALL">Mọi ca nghỉ</option>
              <option value="DAY">☀️ Chỉ Ca Ngày</option>
              <option value="NIGHT">🌙 Chỉ Ca Đêm</option>
              <option value="FULL_DAY">📅 Cả ngày / Dài ngày</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">🟡 Chờ phê duyệt</option>
              <option value="APPROVED">🟢 Đã phê duyệt</option>
              <option value="REJECTED">🔴 Đã từ chối</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            Hiển thị <b>{filteredRequests.length}</b> bản ghi
          </div>
        </div>

        {/* Detailed Table of Leave Requests */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Thời gian nghỉ</th>
                  <th className="py-3 px-4">Nhân sự</th>
                  <th className="py-3 px-4">Ca nghỉ & Hình thức</th>
                  <th className="py-3 px-4">Loại nghỉ & Lý do</th>
                  <th className="py-3 px-4">Người trực thay</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Phê duyệt / Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const shiftInfo = SHIFT_LABELS[req.targetShift] || SHIFT_LABELS.DAY;
                  const ShiftIcon = shiftInfo.icon;
                  const typeInfo = LEAVE_TYPE_LABELS[req.leaveType] || LEAVE_TYPE_LABELS.OTHER;
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';
                  const userCanApproveThis = canApproveForRequest(req);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Thời gian */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <div className="font-bold">
                          {req.startDate === req.endDate ? (
                            <span>{req.startDate}</span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span>{req.startDate}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 inline" />
                              <span>{req.endDate}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {req.daysCount > 1 ? `${req.daysCount} ngày` : '1 ngày'}
                        </span>
                      </td>

                      {/* Nhân sự */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{req.employeeName}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono">{req.employeeCode}</span>
                          <span>•</span>
                          <span>{req.department}</span>
                        </div>
                      </td>

                      {/* Ca nghỉ */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${shiftInfo.badgeColor}`}
                        >
                          <ShiftIcon className="w-3.5 h-3.5" />
                          <span>
                            {req.targetShift === 'DAY'
                              ? 'Ca Ngày'
                              : req.targetShift === 'NIGHT'
                              ? 'Ca Đêm'
                              : 'Cả ngày (24h)'}
                          </span>
                        </span>
                      </td>

                      {/* Loại nghỉ & Lý do */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mb-1 ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <p className="text-slate-700 text-xs font-normal line-clamp-2" title={req.reason}>
                          {req.reason}
                        </p>
                        {isRejected && req.rejectReason && (
                          <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Lý do từ chối: {req.rejectReason}</span>
                          </p>
                        )}
                      </td>

                      {/* Người trực thay */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {req.substituteName ? (
                          <span className="font-medium text-slate-800">{req.substituteName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Không có</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-4">
                        {isApproved && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đã duyệt</span>
                            </span>
                            {req.approvedBy && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Bởi: {req.approvedBy}
                              </div>
                            )}
                          </div>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Từ chối</span>
                          </span>
                        )}
                      </td>

                      {/* Phê duyệt / Thao tác (Admin / Quản lý) */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending && userCanApproveThis ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Duyệt */}
                            <button
                              type="button"
                              onClick={() => handleApprove(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                              title="Duyệt đơn và đồng bộ thông tin"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Duyệt</span>
                            </button>

                            {/* Nút Không (Từ chối, bắt buộc nêu lý do) */}
                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all flex items-center gap-1"
                              title="Từ chối đơn (bắt buộc nêu lý do)"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Không</span>
                            </button>
                          </div>
                        ) : isApproved && userCanApproveThis ? (
                          <span className="text-[11px] text-emerald-700 font-semibold">
                            ✓ Đã đồng bộ hồ sơ
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            {currentUser.id === req.employeeId ? 'Đơn của bạn' : 'Xem thông tin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CalendarDays className="w-8 h-8 text-slate-300" />
                        <span>Không tìm thấy bản ghi đăng ký nghỉ phép phù hợp</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL ĐĂNG KÝ NGHỈ PHÉP (1 NGÀY HOẶC DÀI NGÀY) */}
      {/* ========================================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-in my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Đăng Ký Nghỉ Phép
                  </h3>
                  <p className="text-xs text-slate-500">
                    Điền thông tin và lý do để gửi quản lý phê duyệt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRegister} className="space-y-4 text-xs">
              {/* Nhân sự đăng ký */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nhân sự đăng ký nghỉ:
                </label>
                {canApprove ? (
                  <select
                    value={selectedTargetEmployeeId}
                    onChange={(e) => setSelectedTargetEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 bg-white font-bold"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode} - {emp.department})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between font-bold text-slate-800">
                    <span>{currentUser.fullName} ({currentUser.employeeCode})</span>
                    <span className="text-[11px] font-semibold text-slate-500">{currentUser.department}</span>
                  </div>
                )}
              </div>

              {/* Lựa chọn hình thức: Nghỉ 1 ngày hay Nghỉ dài ngày (DIRECT USER REQUEST) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Hình thức nghỉ:
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setIsMultiDay(false)}
                    className={`py-2 px-3 rounded-xl font-bold transition-all text-center ${
                      !isMultiDay
                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    1. Nghỉ 1 ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMultiDay(true)}
                    className={`py-2 px-3 rounded-xl font-bold transition-all text-center ${
                      isMultiDay
                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    2. Nghỉ dài ngày
                  </button>
                </div>
              </div>

              {/* Ngày tháng */}
              {!isMultiDay ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ngày xin nghỉ:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Từ ngày:
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Đến ngày:
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Loại nghỉ phép */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Chế độ nghỉ:
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 bg-white font-medium"
                >
                  <option value="POLICY">Nghỉ chế độ</option>
                  <option value="REASONABLE">Nghỉ phép có lý do</option>
                </select>
              </div>

              {/* Lý do nghỉ */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Lý do xin nghỉ <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ghi rõ lý do xin nghỉ phép để quản lý xét duyệt..."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Người bàn giao / trực thay */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Người bàn giao công việc / trực thay (nếu có):
                </label>
                <input
                  type="text"
                  value={substituteName}
                  onChange={(e) => setSubstituteName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A (RTG ca 1)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Modal Buttons (DIRECT USER REQUEST: "cuối cùng là ấn Đăng ký hoặc Hủy") */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Đang gửi...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đăng Ký</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL TỪ CHỐI BẮT BUỘC NÊU LÝ DO (DIRECT USER REQUEST) */}
      {/* ========================================================================= */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="p-2 rounded-xl bg-rose-50">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Từ Chối Đơn Nghỉ Phép
                </h3>
                <p className="text-xs text-slate-500">
                  Nhân sự: <b>{rejectModalData.employeeName}</b> ({rejectModalData.dateStr})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Theo quy định, quản lý bắt buộc phải nêu rõ <b>Lý do không duyệt</b> để nhân sự nắm bắt và sắp xếp lại công việc.
            </p>

            {rejectError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{rejectError}</span>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 text-xs block mb-1">
                Lý do từ chối <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Ví dụ: Ca trực hiện thiếu người vận hành cẩu RTG, đề nghị đổi sang ngày khác..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500/20"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalData(null)}
                disabled={isRejecting}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRejecting ? 'Đang lưu...' : 'Xác nhận Không duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
