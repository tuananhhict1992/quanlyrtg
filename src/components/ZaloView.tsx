import React, { useState, useEffect } from 'react';
import { Employee, ZaloMessage } from '../types';
import {
  BellRing,
  Send,
  Clock,
  Users,
  User,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  Search,
  Trash2,
  Play,
  Check,
  Layers,
  Eye,
  Inbox,
  Filter,
  Sparkles,
  Info,
  ShieldCheck,
  Building,
  MessageSquare,
} from 'lucide-react';
import {
  formatNotificationTime,
  getTimeUntilScheduled,
  isUserRecipientOfMessage,
} from '../utils/notificationHelper';

interface ZaloViewProps {
  employees: Employee[];
  currentUser: Employee;
  messages: ZaloMessage[];
  onSendMessage: (msg: ZaloMessage) => void;
  onDeleteMessage?: (id: string) => void;
  onSendScheduledNow?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onOpenChat?: (recipientId?: string) => void;
  prefilledRecipient?: Employee | null;
  onClearPrefilled?: () => void;
  onBackToDashboard?: () => void;
}

export const ZaloView: React.FC<ZaloViewProps> = ({
  employees = [],
  currentUser,
  messages = [],
  onSendMessage,
  onDeleteMessage,
  onSendScheduledNow,
  onMarkAsRead,
  onOpenChat,
  prefilledRecipient,
  onClearPrefilled,
  onBackToDashboard,
}) => {
  // Main view tab: 'COMPOSE' (Soạn & Phát) | 'LOGS' (Nhật ký & Lịch hẹn) | 'INBOX' (Hộp thư của tôi)
  const [activeMainTab, setActiveMainTab] = useState<'COMPOSE' | 'LOGS' | 'INBOX'>('COMPOSE');

  // Target selection: 'INDIVIDUAL' (Cá nhân) | 'DEPARTMENT' (Ca trực) | 'ALL' (Toàn thể)
  const [targetType, setTargetType] = useState<'INDIVIDUAL' | 'DEPARTMENT' | 'ALL'>('INDIVIDUAL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    prefilledRecipient ? prefilledRecipient.id : employees[0]?.id || ''
  );
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('RTG ca 1');

  // Form fields (Bỏ mục Tiêu đề, chỉ còn Nội dung)
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');

  // Scheduling state
  const [isScheduledMode, setIsScheduledMode] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // Search & Filter in Logs/History
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SENT' | 'SCHEDULED'>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Selected message for detail modal
  const [selectedDetailMsg, setSelectedDetailMsg] = useState<ZaloMessage | null>(null);

  // Success toast feedback
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync prefilled recipient if provided from HR view
  useEffect(() => {
    if (prefilledRecipient) {
      setTargetType('INDIVIDUAL');
      setSelectedEmployeeId(prefilledRecipient.id);
      setActiveMainTab('COMPOSE');
    } else if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [prefilledRecipient, employees]);

  // Quick schedule presets helper
  const setPresetSchedule = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduledDateTime(formatted);
    setIsScheduledMode(true);
  };

  const setSpecificTimeSchedule = (hour: number, minute: number, isTomorrow: boolean = false) => {
    const d = new Date();
    if (isTomorrow) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(hour, minute, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduledDateTime(formatted);
    setIsScheduledMode(true);
  };

  // Departments list
  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const deptEmployees = employees.filter((e) => e.department === selectedDept);

  // Current selected employee object
  const currentSelectedEmp = employees.find((e) => e.id === selectedEmployeeId);

  // Filtered employees for individual selection dropdown
  const filteredEmployeesForSelect = employees.filter((e) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q)
    );
  });

  // Calculate stats
  const scheduledCount = messages.filter((m) => m.status === 'SCHEDULED').length;
  const sentCount = messages.filter((m) => m.status !== 'SCHEDULED').length;
  const myInboxMessages = messages.filter(
    (m) => m.status !== 'SCHEDULED' && isUserRecipientOfMessage(m, currentUser)
  );
  const myUnreadCount = myInboxMessages.filter(
    (m) => !m.readByIds || !m.readByIds.includes(currentUser.id)
  ).length;

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert('Vui lòng nhập nội dung thông báo nội bộ.');
      return;
    }

    if (isScheduledMode) {
      if (!scheduledDateTime) {
        alert('Vui lòng chọn thời gian hẹn giờ phát thông báo.');
        return;
      }
      const schedDate = new Date(scheduledDateTime);
      if (isNaN(schedDate.getTime()) || schedDate.getTime() <= Date.now()) {
        alert('Thời gian hẹn giờ phải ở tương lai. Vui lòng kiểm tra lại ngày & giờ đã chọn.');
        return;
      }
    }

    let recipientEmployees: Employee[] = [];
    let recipientNames: string[] = [];
    let recipientIds: string[] = [];

    if (targetType === 'INDIVIDUAL') {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      if (!emp) {
        alert('Vui lòng chọn nhân sự nhận thông báo.');
        return;
      }
      recipientEmployees = [emp];
      recipientNames = [emp.fullName];
      recipientIds = [emp.id];
    } else if (targetType === 'DEPARTMENT') {
      recipientEmployees = employees.filter((e) => e.department === selectedDept);
      if (recipientEmployees.length === 0) {
        alert(`Không tìm thấy nhân sự nào thuộc ca ${selectedDept}.`);
        return;
      }
      recipientNames = [`Toàn bộ ca ${selectedDept} (${recipientEmployees.length} nhân sự)`];
      recipientIds = recipientEmployees.map((e) => e.id);
    } else {
      recipientEmployees = employees;
      recipientNames = [`Toàn thể Cán bộ Nhân viên (${employees.length} nhân sự)`];
      recipientIds = employees.map((e) => e.id);
    }

    setIsSubmitting(true);

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const formattedScheduled = isScheduledMode && scheduledDateTime
      ? scheduledDateTime.replace('T', ' ')
      : undefined;

    // Trích xuất tiêu đề ngắn từ dòng đầu nội dung thông báo.
    const autoTitle =
      content.trim().split('\n')[0].slice(0, 60) || 'Thông báo điều hành nội bộ';

    const newMsg: ZaloMessage = {
      id: `inmsg-${Date.now()}`,
      type: targetType === 'ALL' ? 'BROADCAST' : 'INDIVIDUAL',
      recipientType: targetType,
      recipientIds,
      recipientNames,
      ...(targetType === 'DEPARTMENT' && selectedDept ? { department: selectedDept } : {}),
      title: autoTitle,
      content: content.trim(),
      status: isScheduledMode ? 'SCHEDULED' : 'DELIVERED',
      sentAt: nowStr,
      ...(isScheduledMode && formattedScheduled ? { scheduledAt: formattedScheduled } : {}),
      isScheduled: isScheduledMode,
      priority,
      readByIds: [currentUser.id], // Sender automatically read
      sentBy: `${currentUser.fullName} (${currentUser.position || 'Ban Điều Hành'})`,
      senderId: currentUser.id,
      znsMessageId: isScheduledMode
        ? `SCHED-${Date.now().toString().slice(-6)}`
        : `MSG-${Date.now().toString().slice(-6)}`,
    };

    onSendMessage(newMsg);

    const successMsg = isScheduledMode
      ? `Đã lên lịch hẹn giờ phát thông báo vào lúc ${formattedScheduled}`
      : `Đã phát thông báo nội bộ tới ${targetType === 'INDIVIDUAL' ? recipientNames[0] : `${recipientEmployees.length} nhân sự`}`;

    setSuccessToast(successMsg);
    setTimeout(() => setSuccessToast(null), 5000);

    // Reset Form
    setContent('');
    setIsScheduledMode(false);
    setScheduledDateTime('');
    setIsSubmitting(false);

    if (onClearPrefilled) onClearPrefilled();

    // Automatically switch to LOGS tab to view the newly created message
    setActiveMainTab('LOGS');
  };

  // Filtered messages in LOGS
  const filteredMessages = messages.filter((m) => {
    // Status Filter
    if (historyFilter === 'SCHEDULED' && m.status !== 'SCHEDULED') return false;
    if (historyFilter === 'SENT' && m.status === 'SCHEDULED') return false;

    // Search query
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.department && m.department.toLowerCase().includes(q)) ||
      (m.recipientNames && m.recipientNames.some((n) => n.toLowerCase().includes(q))) ||
      m.sentBy.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Mobile Back Button */}
      {onBackToDashboard && (
        <div className="sm:hidden mb-2">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-xs transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
            <span>Quay lại Bảng điều khiển</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-md text-xs font-semibold tracking-wide border border-indigo-400/30 text-indigo-200">
            <BellRing className="w-3.5 h-3.5 text-indigo-300" />
            <span>Trung Tâm Tin Nhắn & Thông Báo Nội Bộ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Thông Báo Điều Hành Nội Bộ
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Phát thông báo điều hành và chỉ đạo theo <strong className="text-white">Cá nhân</strong>, <strong className="text-white">Ca trực</strong> và <strong className="text-white">Toàn thể</strong> nhân viên. Hỗ trợ <strong className="text-amber-300">hẹn giờ phát tự động</strong> chính xác trong ca làm việc.
          </p>
        </div>

        {/* Top Summary Badges */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
            <div className="text-xl font-bold text-white">{sentCount}</div>
            <div className="text-[11px] text-slate-300">Đã phát</div>
          </div>
          <div className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-center">
            <div className="text-xl font-bold text-amber-300 flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{scheduledCount}</span>
            </div>
            <div className="text-[11px] text-amber-200 font-medium">Hẹn giờ chờ phát</div>
          </div>
          <div
            onClick={() => setActiveMainTab('INBOX')}
            className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-indigo-500/25 backdrop-blur-md border border-indigo-400/30 text-center cursor-pointer hover:bg-indigo-500/40 transition-colors"
          >
            <div className="text-xl font-bold text-indigo-200 flex items-center justify-center gap-1">
              <Inbox className="w-4 h-4" />
              <span>{myInboxMessages.length}</span>
              {myUnreadCount > 0 && (
                <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
                  {myUnreadCount} mới
                </span>
              )}
            </div>
            <div className="text-[11px] text-indigo-200">Hộp thư của tôi</div>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveMainTab('COMPOSE')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeMainTab === 'COMPOSE'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Soạn & Phát Thông Báo</span>
        </button>

        <button
          onClick={() => setActiveMainTab('LOGS')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeMainTab === 'LOGS'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Nhật Ký & Lịch Hẹn Giờ</span>
          {scheduledCount > 0 && (
            <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
              {scheduledCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveMainTab('INBOX')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeMainTab === 'INBOX'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Hộp Thư Nhận Của Tôi</span>
          {myUnreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
              {myUnreadCount} mới
            </span>
          )}
        </button>

        {onOpenChat && (
          <button
            onClick={() => onOpenChat()}
            className="ml-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200 transition-all shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cửa Sổ Chat Nhanh</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: COMPOSE & SEND NOTIFICATION */}
      {/* ============================================================== */}
      {activeMainTab === 'COMPOSE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <span>Soạn Thông Báo Điều Hành Nội Bộ</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Lựa chọn phạm vi nhận thông báo, soạn thảo tiêu đề và đặt lịch phát thông báo tự động.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Type Selection (3 Options requested by User: Cá nhân, Ca, Toàn thể) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  1. Chọn Hình thức Gửi Thông Báo <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Cá nhân */}
                  <button
                    type="button"
                    onClick={() => setTargetType('INDIVIDUAL')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      targetType === 'INDIVIDUAL'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          targetType === 'INDIVIDUAL'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </div>
                      {targetType === 'INDIVIDUAL' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Cá nhân</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Gửi riêng tới 1 nhân sự cụ thể
                      </div>
                    </div>
                  </button>

                  {/* Ca trực */}
                  <button
                    type="button"
                    onClick={() => setTargetType('DEPARTMENT')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      targetType === 'DEPARTMENT'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          targetType === 'DEPARTMENT'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Building className="w-4 h-4" />
                      </div>
                      {targetType === 'DEPARTMENT' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Theo Ca trực</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Gửi cho toàn bộ nhân sự trong ca
                      </div>
                    </div>
                  </button>

                  {/* Toàn thể */}
                  <button
                    type="button"
                    onClick={() => setTargetType('ALL')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      targetType === 'ALL'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          targetType === 'ALL'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      {targetType === 'ALL' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Toàn thể</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Tất cả cán bộ công nhân viên ({employees.length} người)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-selector depending on Target Type */}
              {targetType === 'INDIVIDUAL' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700">
                      Chọn Nhân sự Nhận Thông báo:
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Tìm nhân sự theo tên, mã..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
                      />
                    </div>
                  </div>

                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    {filteredEmployeesForSelect.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode}) — {emp.position} • {emp.department}
                      </option>
                    ))}
                  </select>

                  {currentSelectedEmp && (
                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-600">
                      <img
                        src={currentSelectedEmp.avatar}
                        alt={currentSelectedEmp.fullName}
                        className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <span className="font-bold text-slate-900">{currentSelectedEmp.fullName}</span>
                        <span className="mx-1.5 text-slate-300">•</span>
                        <span>{currentSelectedEmp.position}</span>
                        <span className="mx-1.5 text-slate-300">•</span>
                        <span className="text-indigo-600 font-semibold">{currentSelectedEmp.department}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {targetType === 'DEPARTMENT' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Chọn Ca trực nhận thông báo:
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept} ({employees.filter((e) => e.department === dept).length} nhân sự)
                      </option>
                    ))}
                  </select>

                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Nhân sự trong ca: </span>
                    <span>
                      {deptEmployees.map((e) => e.fullName).join(', ') || 'Chưa có nhân sự trong ca này.'}
                    </span>
                  </div>
                </div>
              )}

              {targetType === 'ALL' && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-center gap-3 text-xs text-blue-900">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Thông báo này sẽ được gửi tới <strong>toàn thể {employees.length} cán bộ nhân viên</strong> của công ty và hiển thị trong hộp thư nội bộ của từng tài khoản.
                  </span>
                </div>
              )}

              {/* Priority Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Mức độ ưu tiên
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPriority('NORMAL')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      priority === 'NORMAL'
                        ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-2xs font-bold'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Thông thường
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('URGENT')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      priority === 'URGENT'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-300 font-bold'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Khẩn cấp / Quan trọng</span>
                  </button>
                </div>
              </div>

              {/* Content Textarea (Mục 3) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Nội dung Thông báo <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  placeholder="Nhập chi tiết nội dung chỉ đạo, thông báo ca trực, văn bản quy chế hoặc phản hồi nội bộ..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                />
              </div>

              {/* Scheduling Section (HẸN GIỜ PHÁT THÔNG BÁO) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">
                      4. Chế độ Phát Thông Báo
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduledMode(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        !isScheduledMode
                          ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      Phát ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsScheduledMode(true);
                        if (!scheduledDateTime) setPresetSchedule(30);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                        isScheduledMode
                          ? 'bg-amber-500 text-white shadow-2xs font-bold'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hẹn giờ phát</span>
                    </button>
                  </div>
                </div>

                {isScheduledMode ? (
                  <div className="space-y-3 pt-2 border-t border-amber-200/60 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        Thời điểm phát:
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {scheduledDateTime && (
                        <span className="text-xs text-amber-800 font-medium">
                          ({getTimeUntilScheduled(scheduledDateTime.replace('T', ' '))})
                        </span>
                      )}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">Phím tắt nhanh:</span>
                      <button
                        type="button"
                        onClick={() => setPresetSchedule(15)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium"
                      >
                        +15 phút
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetSchedule(60)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium"
                      >
                        +1 giờ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecificTimeSchedule(7, 30, true)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium"
                      >
                        Ca sáng mai (07:30)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecificTimeSchedule(19, 30, false)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium"
                      >
                        Giao ca tối (19:30)
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Thông báo sẽ được gửi và hiển thị trực tiếp ngay lập tức trên màn hình của người nhận.
                  </p>
                )}
              </div>

              {/* Action Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                    isScheduledMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  }`}
                >
                  {isScheduledMode ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Lên Lịch Hẹn Giờ Phát Thông Báo</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Phát Thông Báo Nội Bộ Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live In-App Preview (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 sticky top-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">Xem trước trong App</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  In-App Card
                </span>
              </div>

              {/* Simulated in-app notification card */}
              <div
                className={`p-4 rounded-2xl bg-white border shadow-xs space-y-3 transition-all ${
                  priority === 'URGENT' ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        targetType === 'ALL'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : targetType === 'DEPARTMENT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {targetType === 'ALL'
                        ? 'Toàn thể'
                        : targetType === 'DEPARTMENT'
                        ? `Ca: ${selectedDept}`
                        : 'Cá nhân'}
                    </span>

                    {priority === 'URGENT' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Khẩn cấp
                      </span>
                    )}

                    {isScheduledMode && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Hẹn giờ
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">Vừa xong</span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-850 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Nội dung thông báo phát đi:</span>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-6 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {content.trim() || 'Nội dung thông báo sẽ hiển thị trực tiếp tại đây trên màn hình và hộp thư của người nhận.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Gửi bởi: <strong className="text-slate-600">{currentUser.fullName}</strong>
                  </span>
                  <span>{currentUser.position}</span>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ưu điểm thông báo nội bộ:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                  <li>Không giới hạn ký tự & hoàn toàn miễn phí.</li>
                  <li>Tự động đẩy vào Hộp thư cá nhân từng nhân viên.</li>
                  <li>Hẹn giờ phát tự động đúng ca trực, không lo quên việc.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: LOGS & SCHEDULED MESSAGES */}
      {/* ============================================================== */}
      {activeMainTab === 'LOGS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  historyFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({messages.length})
              </button>
              <button
                onClick={() => setHistoryFilter('SENT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  historyFilter === 'SENT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Đã phát ({sentCount})
              </button>
              <button
                onClick={() => setHistoryFilter('SCHEDULED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  historyFilter === 'SCHEDULED'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Chờ phát (Hẹn giờ) ({scheduledCount})</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm tiêu đề, nội dung, người nhận..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Messages List */}
          <div className="space-y-3">
            {filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <BellRing className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">Chưa có thông báo nào trong danh mục này.</p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isScheduled = msg.status === 'SCHEDULED';
                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border transition-all hover:border-indigo-200 ${
                      isScheduled ? 'bg-amber-50/40 border-amber-200/80' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              msg.recipientType === 'ALL'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : msg.recipientType === 'DEPARTMENT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {msg.recipientType === 'ALL'
                              ? 'Toàn thể'
                              : msg.recipientType === 'DEPARTMENT'
                              ? `Ca: ${msg.department}`
                              : 'Cá nhân'}
                          </span>

                          {msg.priority === 'URGENT' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Khẩn cấp
                            </span>
                          )}

                          {isScheduled ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Hẹn giờ phát: {formatNotificationTime(msg.scheduledAt)}</span>
                              <span className="font-normal text-amber-700">
                                ({getTimeUntilScheduled(msg.scheduledAt)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Đã phát</span>
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400 font-mono">
                            Mã: {msg.znsMessageId || msg.id}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900">{msg.title}</h3>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{msg.content}</p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                          <span>
                            Người nhận:{' '}
                            <strong className="text-slate-700">
                              {msg.recipientNames?.join(', ') || 'N/A'}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>Phát bởi: <strong className="text-slate-600">{msg.sentBy}</strong></span>
                          <span>•</span>
                          <span>
                            {isScheduled ? `Tạo lúc: ${msg.sentAt}` : `Thời gian phát: ${msg.sentAt}`}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons on message item */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedDetailMsg(msg)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Chi tiết</span>
                        </button>

                        {/* Scheduled Specific Actions: Gửi ngay & Hủy */}
                        {isScheduled && onSendScheduledNow && (
                          <button
                            onClick={() => onSendScheduledNow(msg.id)}
                            title="Phát thông báo ngay lập tức"
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Phát ngay</span>
                          </button>
                        )}

                        {onDeleteMessage && (
                          <button
                            onClick={() => {
                              if (window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
                                onDeleteMessage(msg.id);
                              }
                            }}
                            title="Hủy/Xóa thông báo"
                            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MY INBOX (THÔNG BÁO NHẬN ĐƯỢC) */}
      {/* ============================================================== */}
      {activeMainTab === 'INBOX' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-600" />
                <span>Hộp Thư Thông Báo Của Tôi</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các thông báo điều hành gửi đích danh cho bạn ({currentUser.fullName}), cho ca ({currentUser.department}) hoặc toàn thể công ty.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Tổng cộng: <strong className="text-slate-900">{myInboxMessages.length}</strong> thông báo
            </div>
          </div>

          <div className="space-y-3">
            {myInboxMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">Bạn chưa có thông báo nào trong hộp thư đến.</p>
              </div>
            ) : (
              myInboxMessages.map((msg) => {
                const isRead = msg.readByIds && msg.readByIds.includes(currentUser.id);
                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isRead
                        ? 'bg-white border-slate-200 opacity-90'
                        : 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-300/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              msg.recipientType === 'ALL'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : msg.recipientType === 'DEPARTMENT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {msg.recipientType === 'ALL'
                              ? 'Toàn thể'
                              : msg.recipientType === 'DEPARTMENT'
                              ? `Ca trực: ${msg.department}`
                              : 'Gửi riêng bạn'}
                          </span>

                          {msg.priority === 'URGENT' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Khẩn cấp
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400">{msg.sentAt}</span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900">{msg.title}</h3>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Phát bởi: <strong className="text-slate-600">{msg.sentBy}</strong></span>
                          {!isRead && onMarkAsRead && (
                            <button
                              onClick={() => onMarkAsRead(msg.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đánh dấu đã đọc</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MESSAGE DETAIL MODAL */}
      {/* ============================================================== */}
      {selectedDetailMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Chi Tiết Thông Báo Nội Bộ
                </span>
              </div>
              <button
                onClick={() => setSelectedDetailMsg(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedDetailMsg.recipientType === 'ALL'
                    ? 'Toàn thể'
                    : selectedDetailMsg.recipientType === 'DEPARTMENT'
                    ? `Ca: ${selectedDetailMsg.department}`
                    : 'Cá nhân'}
                </span>
                {selectedDetailMsg.status === 'SCHEDULED' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Hẹn: {selectedDetailMsg.scheduledAt}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Đã phát thành công
                  </span>
                )}
              </div>

              <h2 className="text-base font-extrabold text-slate-900">{selectedDetailMsg.title}</h2>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedDetailMsg.content}
              </div>

              <div className="space-y-1 text-xs text-slate-500 pt-1">
                <div>
                  <span className="font-semibold text-slate-700">Người nhận: </span>
                  <span>{selectedDetailMsg.recipientNames?.join(', ')}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Phát bởi: </span>
                  <span>{selectedDetailMsg.sentBy}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Thời gian: </span>
                  <span>{selectedDetailMsg.sentAt}</span>
                </div>
                {selectedDetailMsg.scheduledAt && (
                  <div>
                    <span className="font-semibold text-amber-700">Lịch hẹn: </span>
                    <span className="font-medium text-amber-800">{selectedDetailMsg.scheduledAt}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {onOpenChat && selectedDetailMsg.senderId && selectedDetailMsg.senderId !== currentUser.id ? (
                <button
                  type="button"
                  onClick={() => {
                    const partnerId = selectedDetailMsg.senderId;
                    setSelectedDetailMsg(null);
                    onOpenChat(partnerId);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 border border-indigo-200"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Trả lời qua Chat</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {selectedDetailMsg.status === 'SCHEDULED' && onSendScheduledNow && (
                  <button
                    onClick={() => {
                      onSendScheduledNow(selectedDetailMsg.id);
                      setSelectedDetailMsg(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Phát ngay</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedDetailMsg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
