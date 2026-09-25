import {GoogleReportActions} from './GoogleReportActions';
import {parseWorkbook} from '../services/excelProcessing';
import {apiFetch,api} from '../services/supabase';
import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Smartphone,
  CheckCircle2,
  XCircle,
  Award,
  AlertTriangle,
  Lightbulb,
  Edit2,
  Trash2,
  ExternalLink,
  Download,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Shield,
  Eye,
  ArrowLeft,
  Sliders,
  CloudCog,
  BellRing,
  Layers,
  FileSpreadsheet,
  UserPlus,
  UserX,
  CheckSquare,
  Square,
  X,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Check,
  Upload,
  Link2,
  Table,
  LayoutGrid,
  PhoneCall,
  User,
  EyeOff,
} from 'lucide-react';
import { Employee, UserRole, PermissionKey, AppSettings } from '../types';
import { ROLE_CONFIGS } from '../mockData';
import * as XLSX from 'xlsx';
import {
  signInWithGoogleDrive,
  getCachedToken,
  fetchSpreadsheetData,
  findDriveSpreadsheetByName,
} from '../services/googleDriveAuth';
import {
  DATA_RTG_TITLE,
  THONG_TIN_NHAN_SU_TAB,
  normalizeEmployeeName,
  normalizeRtgDepartment,
  cleanRtgPosition,
  parseThongTinNhanSuRows,
  fetchThongTinNhanSuFromGoogleSheets,
  syncEmployeesToDataRtgGoogleSheet,
  exportDataRtgExcelTemplate,
  ParsedThongTinNhanSuResult,
} from '../services/googleSheetSyncService';
import { cleanZaloPhone, getZaloDirectUrl } from '../utils/zaloHelper';

interface HrManagementViewProps {
  employees: Employee[];
  currentUser: Employee;
  appSettings?: AppSettings | null;
  onSaveAppSettings?: (settings: Partial<AppSettings>) => Promise<void> | void;
  onAddEmployee: (emp: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onBatchDeleteEmployees?: (ids: string[]) => void;
  onBatchUpsertEmployees?: (employeesToUpsert: Partial<Employee>[]) => Promise<void> | void;
  onSendZaloToEmployee: (emp: Employee) => void;
  onNavigateToPermissions?: (empId: string) => void;
  onBackToDashboard?: () => void;
}

export const HrManagementView: React.FC<HrManagementViewProps> = ({
  employees,
  currentUser,
  appSettings,
  onSaveAppSettings,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onBatchDeleteEmployees,
  onBatchUpsertEmployees,
  onSendZaloToEmployee,
  onNavigateToPermissions,
  onBackToDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<Employee | null>(null);
  // Chế độ hiển thị: 'responsive' (Tự động Thẻ trên Mobile/Cốc Cốc, Bảng trên Desktop), 'cards' (Thẻ), 'table' (Bảng)
  const [viewLayout, setViewLayout] = useState<'responsive' | 'cards' | 'table'>('responsive');
  const [showDetailPassword, setShowDetailPassword] = useState(false);

  // Modal Trung tâm Tác vụ Quản lý Nhân sự (6 chức năng)
  const [isActionHubOpen, setIsActionHubOpen] = useState(false);

  // Chế độ Xóa Nhiều Nhân Sự Cùng Lúc (Batch Delete)
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchDeleteConfirmModal, setShowBatchDeleteConfirmModal] = useState(false);

  // Form State for Add / Edit
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    phone: '',
    zaloPhone: '',
    department: 'RTG ca 1',
    position: 'Nhân viên',
    status: 'ACTIVE' as Employee['status'],
    role: 'USER' as UserRole,
    username: '',
    dateOfBirth: '',
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // =========================================================================
  // STATE & XỬ LÝ LIÊN KẾT FILE DATA_RTG (SHEET THONGTINNHANSU)
  // =========================================================================
  const [showDataRtgModal, setShowDataRtgModal] = useState(false);
  const [dataRtgSpreadsheetUrl, setDataRtgSpreadsheetUrl] = useState(
    appSettings?.dataRtgSpreadsheetUrl ||
      appSettings?.googleSheetSpreadsheetUrl ||
      appSettings?.feedbackGoogleSheetUrl ||
      ''
  );
  const [dataRtgTabName, setDataRtgTabName] = useState(
    appSettings?.dataRtgSheetTabName || THONG_TIN_NHAN_SU_TAB
  );
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [isReadingDataRtg, setIsReadingDataRtg] = useState(false);
  const [isWritingDataRtg, setIsWritingDataRtg] = useState(false);
  const [isApplyingDataRtg, setIsApplyingDataRtg] = useState(false);
  const [parsedDataRtgResult, setParsedDataRtgResult] = useState<ParsedThongTinNhanSuResult | null>(null);
  const [dataRtgStatusMsg, setDataRtgStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    detail?: string;
  } | null>(null);
  const [dataRtgActiveTab, setDataRtgActiveTab] = useState<'SHEETS' | 'EXCEL'>('SHEETS');
  const [loadedExcelWorkbook, setLoadedExcelWorkbook] = useState<any>(null);
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const excelDataRtgInputRef = React.useRef<HTMLInputElement>(null);

  // Tìm file Data_RTG trên Google Drive
  

  // Đọc dữ liệu từ Google Sheets
  

  // Đọc dữ liệu từ file Excel tải lên
  const handleUploadExcelDataRtg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDataRtgStatusMsg(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = await parseWorkbook(file,'employees');
        setLoadedExcelWorkbook(wb);
        setAvailableSheetNames(wb.SheetNames || []);

        // 1. Tìm các sheet tab ưu tiên
        const isTargetSheet = (s: string) => {
          const norm = s.toLowerCase().replace(/\s|_|-/g, '');
          return (
            norm === 'thongtinnhansu' ||
            norm === 'thôngtinnhânsự' ||
            norm === 'nhansu' ||
            norm === 'nhânsự' ||
            norm === 'datartg' ||
            norm === 'rtg' ||
            norm === 'tổrtg' ||
            norm === 'tortg' ||
            norm === 'dsnv' ||
            norm === 'danhsach' ||
            norm === 'danhsách'
          );
        };

        let chosenSheet = wb.SheetNames.find(isTargetSheet);

        // 2. Nếu không tìm thấy sheet theo tên, quét từng sheet để tìm sheet có nhiều nhân sự hợp lệ nhất
        if (!chosenSheet) {
          let maxCount = 0;
          for (const sName of wb.SheetNames) {
            const ws = wb.Sheets[sName];
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            const parsed = parseThongTinNhanSuRows(raw, sName, 'EXCEL_FILE');
            if (parsed.validCount > maxCount) {
              maxCount = parsed.validCount;
              chosenSheet = sName;
            }
          }
        }

        if (!chosenSheet) chosenSheet = wb.SheetNames[0];

        const ws = wb.Sheets[chosenSheet];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const result = parseThongTinNhanSuRows(rawRows, chosenSheet, 'EXCEL_FILE');
        setParsedDataRtgResult(result);
        setDataRtgTabName(chosenSheet);

        if (result.validCount > 0) {
          // Tự động lưu và cập nhật ngay vào quản lý nhân sự!
          if (onBatchUpsertEmployees) {
            onBatchUpsertEmployees(result.employees);
          } else {
            for (const item of result.employees) {
              onAddEmployee(item as any);
            }
          }
          setDataRtgStatusMsg({
            type: 'success',
            text: `Đã nạp và lưu thành công ${result.validCount} nhân sự từ sheet "${chosenSheet}" vào Quản lý nhân sự!`,
            detail: `Ánh xạ: Cột B (Họ & Tên), Cột C (Mã NV), Cột D (Tên đăng nhập), Cột E (Cột E bỏ qua), Cột G (Bộ phận), Cột I (SĐT). Tự động đổi "Phạm Ngọc Tuấn" ➔ "Phạm Ngọc Tuân". Dữ liệu đã lưu an toàn vào ứng dụng.`,
          });
        } else {
          setDataRtgStatusMsg({
            type: 'error',
            text: `Không tìm thấy dòng nhân sự hợp lệ trong sheet "${chosenSheet}" của tệp Excel.`,
            detail: `Nếu tệp có nhiều tab, bạn có thể chọn tab khác ở menu bên dưới hoặc tải file mẫu chuẩn để đối chiếu.`,
          });
        }
      } catch (err: any) {
        setDataRtgStatusMsg({
          type: 'error',
          text: `Lỗi khi đọc file Excel: ${err.message}`,
        });
      }
    };
    reader.readAsBinaryString(file);
    if (excelDataRtgInputRef.current) excelDataRtgInputRef.current.value = '';
  };

  const handleSelectExcelSheet = (sheetName: string) => {
    if (!loadedExcelWorkbook || !loadedExcelWorkbook.Sheets[sheetName]) return;
    try {
      const ws = loadedExcelWorkbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const result = parseThongTinNhanSuRows(rawRows, sheetName, 'EXCEL_FILE');
      setParsedDataRtgResult(result);
      setDataRtgTabName(sheetName);

      if (result.validCount > 0) {
        if (onBatchUpsertEmployees) {
          onBatchUpsertEmployees(result.employees);
        }
        setDataRtgStatusMsg({
          type: 'success',
          text: `Đã chuyển sang sheet "${sheetName}": lưu thành công ${result.validCount} nhân sự vào hệ thống!`,
        });
      } else {
        setDataRtgStatusMsg({
          type: 'info',
          text: `Sheet "${sheetName}" không có dòng nhân sự hợp lệ.`,
        });
      }
    } catch (err: any) {
      setDataRtgStatusMsg({
        type: 'error',
        text: `Lỗi đọc sheet ${sheetName}: ${err.message}`,
      });
    }
  };

  // Đồng bộ danh sách hiện tại lên file Data_RTG (sheet ThongTinNhanSu)
  

  // Áp dụng danh sách đối soát vào hệ thống
  const handleApplyDataRtgEmployees = async () => {
    if (!parsedDataRtgResult || parsedDataRtgResult.employees.length === 0) return;

    setIsApplyingDataRtg(true);
    try {
      if(parsedDataRtgResult.preview){
        if(!confirm('Xác nhận nhập các dòng đã xem trước từ Google Sheets?'))return;
        const preview=parsedDataRtgResult.preview;
        await api('/google/import/'+preview.job_id+'/confirm',{method:'POST',body:JSON.stringify({checksum:preview.checksum})});
        setDataRtgStatusMsg({type:'success',text:'Đã nhập bản xem trước vào PostgreSQL.'});setParsedDataRtgResult(null);return;
      }
      if (onBatchUpsertEmployees) {
        await onBatchUpsertEmployees(parsedDataRtgResult.employees);
      } else {
        // Fallback
        for (const item of parsedDataRtgResult.employees) {
          const existing = employees.find(
            (e) =>
              (item.employeeCode && e.employeeCode?.toLowerCase() === item.employeeCode.toLowerCase()) ||
              (item.username && e.username?.toLowerCase() === item.username.toLowerCase()) ||
              (item.fullName && e.fullName?.toLowerCase() === item.fullName.toLowerCase())
          );
          if (existing) {
            onUpdateEmployee({
              ...existing,
              ...item,
              id: existing.id,
            } as Employee);
          } else {
            onAddEmployee(item as any);
          }
        }
      }

      if (onSaveAppSettings && dataRtgSpreadsheetUrl) {
        await onSaveAppSettings({
          dataRtgSpreadsheetUrl,
          dataRtgSheetTabName: dataRtgTabName,
        });
      }

      setDataRtgStatusMsg({
        type: 'success',
        text: `Đã lưu thành công ${parsedDataRtgResult.employees.length} nhân sự vào hệ thống!`,
      });
      setTimeout(() => {
        setShowDataRtgModal(false);
        setParsedDataRtgResult(null);
      }, 1200);
    } catch (err: any) {
      setDataRtgStatusMsg({
        type: 'error',
        text: `Lỗi khi lưu nhân sự vào hệ thống: ${err.message}`,
      });
    } finally {
      setIsApplyingDataRtg(false);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = await parseWorkbook(file,'employees');

        // Tự động tìm tab tốt nhất (ưu tiên ThongTinNhanSu hoặc tab chứa nhân sự)
        const targetSheet = wb.SheetNames.find((s) => {
          const norm = s.toLowerCase().replace(/\s|_|-/g, '');
          return (
            norm === 'thongtinnhansu' ||
            norm === 'thôngtinnhânsự' ||
            norm === 'nhansu' ||
            norm === 'nhânsự' ||
            norm === 'datartg' ||
            norm === 'rtg' ||
            norm === 'dsnv' ||
            norm === 'danhsach' ||
            norm === 'danhsách'
          );
        }) || wb.SheetNames[0];

        const ws = wb.Sheets[targetSheet];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const result = parseThongTinNhanSuRows(rawRows, targetSheet, 'EXCEL_FILE');

        setLoadedExcelWorkbook(wb);
        setAvailableSheetNames(wb.SheetNames || []);
        setParsedDataRtgResult(result);
        setDataRtgTabName(targetSheet);

        if (result.validCount > 0) {
          // Tự động nạp và đồng bộ ngay vào danh sách quản lý nhân sự!
          if (onBatchUpsertEmployees) {
            await onBatchUpsertEmployees(result.employees);
          } else {
            for (const item of result.employees) {
              onAddEmployee(item as any);
            }
          }

          setShowDataRtgModal(true);
          setDataRtgActiveTab('EXCEL');
          setDataRtgStatusMsg({
            type: 'success',
            text: `Đã nạp thành công ${result.validCount} nhân sự từ sheet "${targetSheet}" vào Quản lý nhân sự!`,
            detail: `Chuẩn hóa: Đổi "Phạm Ngọc Tuấn" ➔ "Phạm Ngọc Tuân", lọc độc quyền Tổ RTG (ca 1, 2, 3). Dữ liệu đã được lưu trữ an toàn.`,
          });
          return;
        }

        // Thử đọc dạng json thông thường nếu tiêu đề khác
        const data = XLSX.utils.sheet_to_json(ws);
        if (data && data.length > 0) {
          const fallbackList: Partial<Employee>[] = [];
          data.forEach((row: any, index: number) => {
            const rawName = row['Họ và Tên'] || row['Họ và tên'] || row['Họ tên'] || row['Tên'] || '';
            if (!rawName) return;
            const fullName = normalizeEmployeeName(rawName);
            const employeeCode = String(row['Mã NV'] || row['Mã nhân viên'] || row['ID'] || `NV-IMP-${index + 1}`);
            const phone = String(row['SĐT'] || row['Số điện thoại'] || row['SĐT Zalo'] || '');
            const rawDept = row['Ca'] || row['Bộ phận'] || row['Phòng ban'] || '';
            const department = normalizeRtgDepartment(rawDept);
            const rawPos = row['Chức vụ'] || row['Chức danh'] || '';
            const position = cleanRtgPosition(rawPos);
            const username = String(row['Tên đăng nhập'] || row['Username'] || row['ID'] || employeeCode.toLowerCase());

            fallbackList.push({
              employeeCode,
              fullName,
              department,
              position,
              phone,
              zaloPhone: phone,
              username,
              status: 'ACTIVE',
              role: 'USER',
              onboardingCompleted: true,
              competencyScore: Number(row['Điểm kiểm tra']) || 85,
              violationCount: Number(row['Vi phạm']) || 0,
            });
          });

          if (fallbackList.length > 0) {
            if (onBatchUpsertEmployees) {
              await onBatchUpsertEmployees(fallbackList);
            }
            setShowDataRtgModal(true);
            setDataRtgActiveTab('EXCEL');
            setDataRtgStatusMsg({
              type: 'success',
              text: `Đã nạp ${fallbackList.length} nhân sự vào hệ thống Quản lý nhân sự!`,
            });
            return;
          }
        }

        setShowDataRtgModal(true);
        setDataRtgActiveTab('EXCEL');
        setDataRtgStatusMsg({
          type: 'error',
          text: `Không tìm thấy dòng nhân sự hợp lệ trong sheet "${targetSheet}".`,
          detail: `Vui lòng kiểm tra định dạng cột: Cột B (Họ & Tên), C (Mã NV), D (Tên đăng nhập), E (Cột E bỏ qua), G (Bộ phận), I (SĐT).`,
        });
      } catch (error: any) {
        console.error('Lỗi khi nạp file Excel:', error);
        setShowDataRtgModal(true);
        setDataRtgActiveTab('EXCEL');
        setDataRtgStatusMsg({
          type: 'error',
          text: `Có lỗi xảy ra khi nạp file: ${error.message || 'Lỗi định dạng'}`,
        });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportGoogleSheets = () => { setParsedDataRtgResult(null); setDataRtgStatusMsg(null); setDataRtgActiveTab('SHEETS'); setShowDataRtgModal(true); };

  const handleToggleSelectEmployee = (empId: string) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllEmployees = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((e) => e.id));
    }
  };

  const handleExecuteBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (onBatchDeleteEmployees) {
      onBatchDeleteEmployees(selectedIds);
    } else {
      selectedIds.forEach((id) => onDeleteEmployee(id));
    }
    setShowBatchDeleteConfirmModal(false);
    setIsBatchDeleteMode(false);
    setSelectedIds([]);
  };

  const handleImportReport = () => { setParsedDataRtgResult(null); setDataRtgStatusMsg(null); setDataRtgActiveTab('SHEETS'); setShowDataRtgModal(true); };

  const canManageHR =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.assignedPermissions.includes('MANAGE_HR') ||
    currentUser.assignedPermissions.includes('MANAGE_DEPARTMENT_USERS');

  const departments = [
    'ALL',
    'RTG ca 1',
    'RTG ca 2',
    'RTG ca 3',
  ];

  // Filtered employees
  const filtered = employees.map((emp) => ({
    ...emp,
    department: normalizeRtgDepartment(emp.department),
    position: cleanRtgPosition(emp.position),
  })).filter((emp) => {
    const searchLower = (searchTerm || '').trim().toLowerCase();
    const nameStr = String(emp.fullName || '').toLowerCase();
    const codeStr = String(emp.employeeCode || '').toLowerCase();
    const phoneStr = String(emp.zaloPhone || emp.phone || '').toLowerCase();
    const emailStr = String(emp.email || '').toLowerCase();
    const matchesSearch =
      !searchLower ||
      nameStr.includes(searchLower) ||
      codeStr.includes(searchLower) ||
      phoneStr.includes(searchLower) ||
      emailStr.includes(searchLower);
    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
    const matchesPosition = selectedPosition === 'ALL' || emp.position === selectedPosition;
    const matchesStatus = selectedStatus === 'ALL' || emp.status === selectedStatus;
    return matchesSearch && matchesDept && matchesPosition && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setModalError(null);
    // Tính toán mã nhân sự không bị trùng lặp
    const existingNums = employees
      .map((e) => {
        const match = (e.employeeCode || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : employees.length) + 1;
    const nextCode = `NV-${String(nextNum).padStart(3, '0')}`;

    setFormData({
      employeeCode: nextCode,
      fullName: '',
      email: '',
      phone: '',
      zaloPhone: '',
      department: 'RTG ca 1',
      position: 'Lái cẩu RTG',
      status: 'ACTIVE',
      role: 'USER',
      username: '',
      dateOfBirth: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setModalError(null);
    setFormData({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      zaloPhone: emp.zaloPhone,
      department: normalizeRtgDepartment(emp.department),
      position: cleanRtgPosition(emp.position),
      status: emp.status,
      role: emp.role,
      username: emp.username || '',
      dateOfBirth: emp.dateOfBirth || (emp as any).dob || '',
    });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedFullName = (formData.fullName || '').trim();
    if (!trimmedFullName) {
      setModalError('Vui lòng nhập đầy đủ Họ và Tên nhân sự.');
      return;
    }

    const fallbackCode = formData.employeeCode?.trim() || (editingEmployee ? editingEmployee.employeeCode : `NV-${Date.now().toString().slice(-4)}`);

    if (!editingEmployee && employees.some((e) => (e.employeeCode || '').toLowerCase() === fallbackCode.toLowerCase())) {
      setModalError(`Mã nhân sự "${fallbackCode}" đã tồn tại. Vui lòng nhập mã khác.`);
      return;
    }

    const fallbackUsername = (formData.username?.trim() || (editingEmployee ? editingEmployee.username : '') || fallbackCode.toLowerCase() || 'user');
    const fallbackPhone = (formData.phone?.trim() || formData.zaloPhone?.trim() || (editingEmployee ? editingEmployee.phone : '') || '0900000000');
    const fallbackEmail = (formData.email?.trim() || (editingEmployee ? editingEmployee.email : '') || `${fallbackUsername}@doanhnghiep.vn`);
    const cleanDept = normalizeRtgDepartment(formData.department);
    const cleanPos = cleanRtgPosition(formData.position) || 'Lái cẩu RTG';
    const cleanRole: UserRole = formData.role || (editingEmployee ? editingEmployee.role : 'USER');
    const perms = ROLE_CONFIGS[cleanRole]?.defaultPermissions || ROLE_CONFIGS.USER.defaultPermissions;

    try {
      if (editingEmployee) {
        await onUpdateEmployee({
          ...editingEmployee,
          employeeCode: fallbackCode,
          fullName: trimmedFullName,
          email: fallbackEmail,
          phone: fallbackPhone,
          zaloPhone: formData.zaloPhone?.trim() || fallbackPhone,
          zaloSynced: true,
          username: fallbackUsername,
          department: cleanDept,
          position: cleanPos,
          status: formData.status,
          role: cleanRole,
          dateOfBirth: formData.dateOfBirth?.trim() || editingEmployee.dateOfBirth || '',
        });
      } else {
        await onAddEmployee({
          employeeCode: fallbackCode,
          fullName: trimmedFullName,
          email: fallbackEmail,
          phone: fallbackPhone,
          zaloPhone: formData.zaloPhone?.trim() || fallbackPhone,
          zaloSynced: true,
          username: fallbackUsername,
          avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 90000000)}?w=150&auto=format&fit=crop&q=80`,
          department: cleanDept,
          position: cleanPos,
          joinDate: new Date().toISOString().split('T')[0],
          status: formData.status,
          role: cleanRole,
          assignedPermissions: perms,
          competencyScore: 85,
          quizzesCompleted: 0,
          violationCount: 0,
          proposalsCount: 0,
          dateOfBirth: formData.dateOfBirth?.trim() || '',
        });
      }
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Lỗi khi lưu nhân sự:', err);
      setModalError(`Không thể lưu nhân sự: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const exportExcel = () => {
    try {
      const headers = [
        'STT',                   // Cột A (0)
        'Họ và Tên',            // Cột B (1)
        'Mã nhân sự',           // Cột C (2)
        'Tên đăng nhập',        // Cột D (3)
        'Cột E bỏ qua',             // Cột E (4)
        'Chức danh',            // Cột F (5)
        'Bộ phận (Ca trực)',     // Cột G (6) - CHUẨN XÁC CỘT G
        'Vai trò',              // Cột H (7)
        'Số điện thoại',        // Cột I (8)
        'Điểm năng lực',        // Cột J (9)
        'Bài thi đạt',          // Cột K (10)
        'Số lần vi phạm',       // Cột L (11)
        'Số sáng kiến',         // Cột M (12)
        'Năm sinh',             // Cột N (13)
        'Trạng thái',           // Cột O (14)
      ];
      const rows = filtered.map((e, index) => [
        index + 1,
        normalizeEmployeeName(e.fullName),
        e.employeeCode || '',
        e.username || (e.employeeCode ? e.employeeCode.toLowerCase() : ''),
        '',
        cleanRtgPosition(e.position),
        normalizeRtgDepartment(e.department),
        e.role || 'USER',
        e.phone || e.zaloPhone || '',
        e.competencyScore ?? 85,
        e.quizzesCompleted ?? 0,
        e.violationCount ?? 0,
        e.proposalsCount ?? 0,
        e.dateOfBirth || '',
        e.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 6 },  // A: STT
        { wch: 24 }, // B: Họ và Tên
        { wch: 14 }, // C: Mã nhân sự
        { wch: 16 }, // D: Tên đăng nhập
        { wch: 14 }, // E: Cột E bỏ qua
        { wch: 16 }, // F: Chức danh
        { wch: 18 }, // G: Bộ phận (Ca trực)
        { wch: 12 }, // H: Vai trò
        { wch: 16 }, // I: Số điện thoại
        { wch: 14 }, // J: Điểm năng lực
        { wch: 12 }, // K: Bài thi đạt
        { wch: 14 }, // L: Số lần vi phạm
        { wch: 12 }, // M: Số sáng kiến
        { wch: 12 }, // N: Năm sinh
        { wch: 14 }, // O: Trạng thái
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ThongTinNhanSu');
      XLSX.writeFile(wb, `Data_RTG_NhanSu_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      exportCSV();
    }
  };

  const exportCSV = () => {
    const headers = [
      'STT',
      'Họ và Tên',
      'Mã nhân sự',
      'Tên đăng nhập',
      'Cột E bỏ qua',
      'Chức danh',
      'Bộ phận (Ca trực)',
      'Vai trò',
      'Số điện thoại',
      'Điểm năng lực',
      'Bài thi đạt',
      'Số lần vi phạm',
      'Số sáng kiến',
      'Năm sinh',
      'Trạng thái'
    ];
    const rows = filtered.map((e, index) => [
      index + 1,
      `"${normalizeEmployeeName(e.fullName)}"`,
      `"${e.employeeCode || ''}"`,
      `"${e.username || (e.employeeCode ? e.employeeCode.toLowerCase() : '')}"`,
      `"${''}"`,
      `"${cleanRtgPosition(e.position)}"`,
      `"${normalizeRtgDepartment(e.department)}"`,
      `"${e.role || 'USER'}"`,
      `"${e.phone || e.zaloPhone || ''}"`,
      e.competencyScore ?? 85,
      e.quizzesCompleted ?? 0,
      e.violationCount ?? 0,
      e.proposalsCount ?? 0,
      `"${e.dateOfBirth || ''}"`,
      `"${e.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Data_RTG_NhanSu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Mobile Back to Dashboard Button */}
      {onBackToDashboard && (
        <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-200">
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
            <span>Quay lại Tổng quan</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500">Quản lý nhân sự</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Thông Tin Nhân Sự
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {employees.length} Nhân sự
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hồ sơ lý lịch, số Zalo đồng bộ, lịch sử thi năng lực và phân quyền vị trí
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {canManageHR && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
          )}

          {canManageHR && (
            <button
              id="btn-open-action-hub"
              onClick={() => setIsActionHubOpen(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-indigo-200" />
              <span>Tiện ích & Tác vụ</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold tracking-wide">
                6
              </span>
            </button>
          )}

          {canManageHR && (
            <button
              id="btn-link-data-rtg"
              onClick={() => {
                setDataRtgStatusMsg(null);
                setShowDataRtgModal(true);
              }}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-200 hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Liên kết dữ liệu với file Data_RTG (sheet ThongTinNhanSu)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Liên kết Data_RTG</span>
            </button>
          )}

          {canManageHR && (
            <button
              id="btn-add-employee-quick"
              onClick={handleOpenAdd}
              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Thêm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV, email hoặc số Zalo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filters and View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'Tất cả ca trực (RTG ca 1, 2, 3)' : d}
                </option>
              ))}
            </select>

            {/* Position Filter */}
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
            >
              <option value="ALL">Tất cả chức vụ</option>
              <option value="Lái cẩu RTG">Lái cẩu RTG</option>
              <option value="Tổ trưởng">Tổ trưởng</option>
              <option value="Tổ phó">Tổ phó</option>
              <option value="Ca trưởng">Ca trưởng</option>
              <option value="Ca phó">Ca phó</option>
              <option value="Nhân viên">Nhân viên</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Chính thức</option>
              <option value="PROBATION">Thử việc</option>
              <option value="LEAVE">Nghỉ phép</option>
              <option value="TERMINATED">Thôi việc</option>
            </select>
          </div>

          {/* Toggle View: Thẻ (Mobile) vs Bảng (Desktop) */}
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 px-1.5 sm:hidden">Hiển thị:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Chế độ xem Thẻ (Tối ưu cho Cốc Cốc & Điện thoại)"
                onClick={() => setViewLayout('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === 'cards' || (viewLayout === 'responsive')
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thẻ</span>
              </button>
              <button
                type="button"
                title="Chế độ xem Bảng (Đầy đủ các cột)"
                onClick={() => setViewLayout('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === 'table'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Bảng</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Delete Mode Banner */}
      {isBatchDeleteMode && (
        <div className="bg-rose-50/90 border-2 border-rose-300 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-rose-950 text-sm flex items-center gap-2">
                <span>Chế độ xóa nhiều nhân sự cùng lúc</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-xs font-extrabold">
                  Đã chọn {selectedIds.length} / {filtered.length} nhân sự
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                Đánh dấu các nhân sự cần xóa bên dưới rồi nhấn "Thực hiện xóa", hoặc nhấn "Thoát" để hủy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSelectAllEmployees}
              className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer"
            >
              {selectedIds.length === filtered.length && filtered.length > 0
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBatchDeleteConfirmModal(true)}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Thực hiện xóa ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBatchDeleteMode(false);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Thoát
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. GIAO DIỆN HIỂN THỊ DẠNG THẺ (CARD VIEW CHO MOBILE & CỐC CỐC ANDROID)  */}
      {/* ========================================================================= */}
      <div
        className={`space-y-3.5 ${
          viewLayout === 'table'
            ? 'hidden'
            : viewLayout === 'cards'
            ? 'block'
            : 'block md:hidden'
        }`}
      >
        {filtered.map((emp) => {
          const roleConfig =
            ROLE_CONFIGS[emp.role] || {
              label: emp.role,
              badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
            };
          const isSelected = selectedIds.includes(emp.id);
          const dept = normalizeRtgDepartment(emp.department);
          const pos = cleanRtgPosition(emp.position);
          const rawPhone = emp.zaloPhone || emp.phone || '';
          const cleanPhone = cleanZaloPhone(rawPhone);
          const directZalo = getZaloDirectUrl(cleanPhone);

          return (
            <div
              key={`card-${emp.id}`}
              className={`p-4 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400'
                  : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              {/* Row 1: Checkbox (nếu ở chế độ xóa) + Avatar + Họ tên + Role + Mã NV */}
              <div className="flex items-start gap-3">
                {isBatchDeleteMode && (
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectEmployee(emp.id)}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                    />
                  </div>
                )}

                <div
                  onClick={() => setSelectedEmployeeDetail(emp)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  <img
                    src={emp.avatar}
                    alt={emp.fullName}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 justify-between">
                      <span className="font-extrabold text-slate-900 text-base leading-tight truncate hover:text-indigo-600 transition-colors">
                        {emp.fullName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${roleConfig.badgeColor}`}
                      >
                        {emp.role}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                        {emp.employeeCode}
                      </span>
                      {emp.status === 'ACTIVE' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Chính thức
                        </span>
                      )}
                      {emp.status === 'PROBATION' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Thử việc
                        </span>
                      )}
                      {emp.status === 'LEAVE' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Nghỉ phép
                        </span>
                      )}
                      {emp.status === 'TERMINATED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Thôi việc
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Bộ phận / Ca trực (Cột G) & Chức danh (Cột F) */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">Ca trực:</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      dept === 'RTG ca 1'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : dept === 'RTG ca 2'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {dept}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>{pos}</span>
                </div>
              </div>

              {/* Row 2.5: Thông tin Nhân sự Chi tiết (Tên đăng nhập, Năm sinh, Email) */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Tên đăng nhập:</span>
                  <span className="font-mono font-bold text-slate-800 truncate block">
                    {emp.username || emp.employeeCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Năm sinh:</span>
                  <span className="font-semibold text-slate-800 block">
                    {emp.dateOfBirth || (emp as any).dob || 'Chưa cập nhật'}
                  </span>
                </div>
                {emp.email && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/50 flex items-center gap-1 text-[11px] text-slate-600 truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                )}
              </div>

              {/* Row 3: Số điện thoại / Zalo (Cột I) & Đồng bộ */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {cleanPhone || 'Chưa có SĐT'}
                  </span>
                  {emp.zaloSynced ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã kết nối Zalo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                      <XCircle className="w-3 h-3 text-slate-400" /> Chưa đồng bộ
                    </span>
                  )}
                </div>

                {cleanPhone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${cleanPhone}`}
                      title="Gọi điện trực tiếp"
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-600 text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                    >
                      <PhoneCall className="w-3 h-3 text-emerald-600" />
                      <span>Gọi</span>
                    </a>
                    <a
                      href={directZalo}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở trò chuyện Zalo"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span>Zalo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Row 4: Chỉ số đánh giá Năng lực (Pillars & KPI) */}
              <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-100">
                  <div className="text-[10px] text-amber-700 font-semibold">Điểm NL</div>
                  <div className="text-sm font-extrabold text-amber-950 mt-0.5">
                    {emp.competencyScore ?? 85}đ
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-100">
                  <div className="text-[10px] text-indigo-700 font-semibold">Bài thi</div>
                  <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
                    {emp.quizzesCompleted ?? 0}
                  </div>
                </div>
                <div
                  className={`p-2 rounded-xl border ${
                    (emp.violationCount ?? 0) > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div
                    className={`text-[10px] font-semibold ${
                      (emp.violationCount ?? 0) > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Vi phạm
                  </div>
                  <div
                    className={`text-sm font-extrabold mt-0.5 ${
                      (emp.violationCount ?? 0) > 0 ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    {emp.violationCount ?? 0}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-100">
                  <div className="text-[10px] text-emerald-700 font-semibold">Sáng kiến</div>
                  <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                    {emp.proposalsCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Row 5: Hàng nút thao tác cảm ứng nhanh (Tối ưu cho Cốc Cốc Mobile) */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeDetail(emp)}
                  className="flex-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Hồ sơ 360°</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSendZaloToEmployee(emp)}
                  title="Gửi thông báo / Nhắn Zalo"
                  className="py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Thông báo</span>
                </button>

                {onNavigateToPermissions && canManageHR && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPermissions(emp.id)}
                    title="Cấp quyền & Hiển thị"
                    className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors inline-flex items-center justify-center cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}

                {canManageHR && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(emp)}
                    title="Sửa hồ sơ"
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors inline-flex items-center justify-center cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {canManageHR && emp.role !== 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Bạn có chắc chắn muốn xóa nhân sự ${emp.fullName}?`)) {
                        onDeleteEmployee(emp.id);
                      }
                    }}
                    title="Xóa nhân sự"
                    className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors inline-flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-sm text-slate-700">Không tìm thấy nhân sự phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc ca trực</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. GIAO DIỆN HIỂN THỊ DẠNG BẢNG (TABLE VIEW CHO DESKTOP HOẶC KHI CHỌN)     */}
      {/* ========================================================================= */}
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${
          viewLayout === 'cards'
            ? 'hidden'
            : viewLayout === 'table'
            ? 'block'
            : 'hidden md:block'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                {isBatchDeleteMode && (
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAllEmployees}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">Nhân sự</th>
                <th className="py-3.5 px-4">Bộ phận (Ca trực)</th>
                <th className="py-3.5 px-4">Đồng bộ Zalo</th>
                <th className="py-3.5 px-4">Đánh giá Năng lực</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const roleConfig = (emp.role && ROLE_CONFIGS[emp.role]) || ROLE_CONFIGS.USER;
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <tr
                    key={emp.id}
                    className={`transition-colors group ${
                      isSelected
                        ? 'bg-rose-50/50 hover:bg-rose-50/80'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {isBatchDeleteMode && (
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectEmployee(emp.id)}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                        />
                      </td>
                    )}
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => setSelectedEmployeeDetail(emp)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <img
                          src={emp.avatar}
                          alt={emp.fullName}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                            <span>{emp.fullName}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleConfig.badgeColor}`}
                            >
                              {emp.role}
                            </span>
                          </div>
                          <div className="text-slate-400 text-xs flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-mono text-slate-500 font-semibold">{emp.employeeCode}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-600">ID: {emp.username || emp.employeeCode}</span>
                            {emp.dateOfBirth && (
                              <>
                                <span>•</span>
                                <span>{emp.dateOfBirth}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Bộ phận / Ca trực: Chỉ hiển thị thông tin RTG ca 1, RTG ca 2 hoặc RTG ca 3 */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            emp.department === 'RTG ca 1'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : emp.department === 'RTG ca 2'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {emp.department}
                        </span>
                        {['Ca trưởng', 'Ca phó', 'Tổ trưởng', 'Tổ phó'].includes(emp.position) && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            {emp.position}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Zalo Sync */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {emp.zaloPhone}
                        </span>
                      </div>
                      <div className="mt-1">
                        {emp.zaloSynced ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> Đã kết nối Zalo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            <XCircle className="w-3 h-3" /> Chưa đồng bộ
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Competency & Tests */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-slate-900">{emp.competencyScore}đ</span>
                        <span className="text-xs text-slate-400">({emp.quizzesCompleted} bài)</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className={emp.violationCount > 0 ? 'text-rose-600 font-semibold' : ''}>
                          {emp.violationCount} vi phạm
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium">{emp.proposalsCount} đề xuất</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {emp.status === 'ACTIVE' && (
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Chính thức
                        </span>
                      )}
                      {emp.status === 'PROBATION' && (
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Thử việc
                        </span>
                      )}
                      {emp.status === 'LEAVE' && (
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Nghỉ phép
                        </span>
                      )}
                      {emp.status === 'TERMINATED' && (
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          Thôi việc
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Internal Notification Message */}
                        <button
                          title="Gửi thông báo nội bộ"
                          onClick={() => onSendZaloToEmployee(emp)}
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                        >
                          <BellRing className="w-4 h-4" />
                        </button>

                        {/* View 360 profile */}
                        <button
                          title="Xem hồ sơ chi tiết"
                          onClick={() => setSelectedEmployeeDetail(emp)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Direct Jump to Permissions & Visibility */}
                        {onNavigateToPermissions && canManageHR && (
                          <button
                            title="Cấp quyền & Hiển thị"
                            onClick={() => onNavigateToPermissions(emp.id)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit */}
                        {canManageHR && (
                          <button
                            title="Sửa thông tin"
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {canManageHR && emp.role !== 'ADMIN' && (
                          <button
                            title="Xóa nhân sự"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa nhân sự ${emp.fullName}?`)) {
                                onDeleteEmployee(emp.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-sm">Không tìm thấy nhân sự phù hợp</p>
            <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc</p>
          </div>
        )}
      </div>

      {/* Modal: View 360 Employee Profile */}
      {selectedEmployeeDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Top Back Header for Mobile & Desktop */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setSelectedEmployeeDetail(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Quay lại danh sách nhân sự</span>
              </button>
              <button
                onClick={() => setSelectedEmployeeDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={selectedEmployeeDetail.avatar}
                alt={selectedEmployeeDetail.fullName}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/20"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">{selectedEmployeeDetail.fullName}</h3>
                <p className="text-xs text-slate-500 truncate">
                  {cleanRtgPosition(selectedEmployeeDetail.position)} • {normalizeRtgDepartment(selectedEmployeeDetail.department)}
                </p>
                <span className="inline-block mt-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Mã NV: {selectedEmployeeDetail.employeeCode}
                </span>
              </div>
            </div>

            {/* Profile Metrics - 4 pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                <Award className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <span className="text-xl font-extrabold text-indigo-950 block">
                  {selectedEmployeeDetail.competencyScore}đ
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold">Điểm Năng Lực</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <BookOpen className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-xl font-extrabold text-amber-950 block">
                  {selectedEmployeeDetail.quizzesCompleted || 0}
                </span>
                <span className="text-[11px] text-amber-600 font-semibold">Bài Thi Đạt</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                <Lightbulb className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <span className="text-xl font-extrabold text-emerald-950 block">
                  {selectedEmployeeDetail.proposalsCount || 0}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">Đề Xuất Đã Gửi</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                <AlertTriangle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                <span className="text-xl font-extrabold text-rose-950 block">
                  {selectedEmployeeDetail.violationRecords?.length || selectedEmployeeDetail.violationCount || 0}
                </span>
                <span className="text-[11px] text-rose-600 font-semibold">Lần Vi Phạm</span>
              </div>
            </div>

            {/* Monthly Evaluation History (BXXL) */}
            {selectedEmployeeDetail.monthlyEvaluations && selectedEmployeeDetail.monthlyEvaluations.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Xếp loại thi đua hàng tháng (BXXL)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {selectedEmployeeDetail.monthlyEvaluations.length} đợt đánh giá
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedEmployeeDetail.monthlyEvaluations.slice(0, 5).map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-100/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                            ev.rating === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ev.rating === 'a'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : ev.rating === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : ev.rating === 'b'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ev.rating}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800">Tháng {ev.month}</span>
                          {ev.isGpt && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                              ⭐ Đề xuất GPT
                            </span>
                          )}
                          {ev.reason && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              Lý do: {ev.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{ev.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lịch sử Vi phạm & Trừ điểm Năng lực */}
            {selectedEmployeeDetail.violationRecords && selectedEmployeeDetail.violationRecords.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Lịch sử vi phạm & trừ điểm hồ sơ năng lực</span>
                  </span>
                  <span className="text-[11px] font-bold text-rose-700">
                    {selectedEmployeeDetail.violationRecords.length} sự cố / vi phạm
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedEmployeeDetail.violationRecords.map((vr, i) => {
                    const whatText = vr.what || (vr as any).description || (vr as any).incidentName || 'Vi phạm quy trình vận hành';
                    const codeText = vr.incidentCode ? `[${vr.incidentCode}] ` : '';
                    const timeText = vr.time || (vr as any).date || (vr.recordedAt ? vr.recordedAt.slice(0, 10) : '');
                    const whyText = vr.why || (vr as any).reason || 'Sai quy trình/thiếu quan sát';
                    const howText = vr.how;
                    const pts = vr.pointsDeducted ?? (vr as any).penaltyPoints ?? 5;
                    return (
                      <div
                        key={vr.id || i}
                        className="p-2.5 rounded-xl bg-white border border-rose-100 text-xs flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="font-bold text-slate-900 leading-snug">
                            <span className="text-rose-700 font-mono">{codeText}</span>
                            {whatText}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {timeText && <span>Thời gian: {timeText} • </span>}
                            {vr.equipment && <span>Thiết bị: {vr.equipment} • </span>}
                            {vr.location && <span>Vị trí: {vr.location}</span>}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">Nguyên nhân:</span> {whyText}
                          </div>
                          {howText && (
                            <div className="text-[11px] text-indigo-700 italic">
                              <span className="font-semibold text-slate-700 not-italic">Xử lý:</span> {howText}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[11px]">
                          -{pts}đ
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Điều chỉnh điểm thi đua & thưởng/phạt trực tiếp */}
            {selectedEmployeeDetail.customScoreAdjustments && selectedEmployeeDetail.customScoreAdjustments.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Lịch sử thưởng/phạt & điều chỉnh điểm thi đua</span>
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700">
                    {selectedEmployeeDetail.customScoreAdjustments.length} lần điều chỉnh
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedEmployeeDetail.customScoreAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{adj.reason}</div>
                        <div className="text-[10px] text-slate-500">
                          {adj.date} {adj.adjustedByName ? `• Người ký: ${adj.adjustedByName}` : ''}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                        adj.points >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {adj.points >= 0 ? `+${adj.points}` : `${adj.points}`}đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lịch sử Nghỉ phép đã duyệt */}
            {selectedEmployeeDetail.approvedLeaves && selectedEmployeeDetail.approvedLeaves.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Lịch sử nghỉ phép đã phê duyệt</span>
                  </span>
                  <span className="text-[11px] font-bold text-blue-700">
                    {selectedEmployeeDetail.approvedLeaves.length} đợt nghỉ
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedEmployeeDetail.approvedLeaves.map((lv, i) => {
                    const leaveTypeLabel =
                      lv.leaveType === 'ANNUAL' ? 'Phép năm' :
                      lv.leaveType === 'POLICY' ? 'Theo chế độ' :
                      lv.leaveType === 'REASONABLE' ? 'Lý do chính đáng' :
                      lv.leaveType === 'PERSONAL' ? 'Việc riêng' :
                      lv.leaveType === 'COMPENSATORY' ? 'Nghỉ bù' :
                      lv.leaveType === 'SICK' ? 'Nghỉ ốm' :
                      lv.leaveType === 'MATERNITY' ? 'Thai sản' :
                      (lv as any).type || 'Nghỉ phép';
                    return (
                      <div
                        key={lv.requestId || (lv as any).id || i}
                        className="p-2.5 rounded-xl bg-white border border-blue-100 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{leaveTypeLabel}</span>
                            {lv.reason && <span className="text-[11px] text-slate-500">({lv.reason})</span>}
                          </div>
                          {lv.approvedBy && (
                            <div className="text-[10px] text-slate-400">Duyệt bởi: {lv.approvedBy} {lv.approvedAt ? `(${lv.approvedAt})` : ''}</div>
                          )}
                        </div>
                        <span className="text-[10px] text-blue-700 font-mono font-semibold">
                          {lv.startDate === lv.endDate ? lv.startDate : `${lv.startDate} → ${lv.endDate}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hồ sơ Chi tiết Nhân sự */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Thông tin Hồ sơ & Tài khoản</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  {selectedEmployeeDetail.role === 'ADMIN'
                    ? 'Quản trị viên'
                    : selectedEmployeeDetail.role === 'MANAGER_L1'
                    ? 'Quản lý Cấp 1'
                    : selectedEmployeeDetail.role === 'MANAGER_L2'
                    ? 'Quản lý Cấp 2'
                    : 'Nhân viên'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Mã NV */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Mã nhân sự:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedEmployeeDetail.employeeCode}</span>
                </div>

                {/* Họ và tên */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-900">{selectedEmployeeDetail.fullName}</span>
                </div>

                {/* Bộ phận / Ca trực */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Bộ phận (Ca trực):</span>
                  <span className="font-bold text-indigo-700">{normalizeRtgDepartment(selectedEmployeeDetail.department)}</span>
                </div>

                {/* Chức danh */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Chức danh:</span>
                  <span className="font-bold text-slate-900">{cleanRtgPosition(selectedEmployeeDetail.position)}</span>
                </div>

                {/* Tên đăng nhập */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Tên đăng nhập:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedEmployeeDetail.username || selectedEmployeeDetail.employeeCode}
                  </span>
                </div>

                {/* Ngày sinh / Năm sinh */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Ngày / Năm sinh:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedEmployeeDetail.dateOfBirth || (selectedEmployeeDetail as any).dob || 'Chưa cập nhật'}
                  </span>
                </div>

                {/* Trạng thái công tác */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-slate-500">Trạng thái công tác:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedEmployeeDetail.status === 'ACTIVE'
                      ? 'Chính thức (Đang hoạt động)'
                      : selectedEmployeeDetail.status === 'PROBATION'
                      ? 'Thử việc'
                      : selectedEmployeeDetail.status === 'LEAVE'
                      ? 'Nghỉ phép'
                      : 'Thôi việc'}
                  </span>
                </div>

                {/* Số Zalo & Điện thoại */}
                <div className="col-span-1 sm:col-span-2 flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-slate-500">SĐT / Zalo:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {cleanZaloPhone(selectedEmployeeDetail.zaloPhone || selectedEmployeeDetail.phone) || 'Chưa cập nhật'}
                    </span>
                    {selectedEmployeeDetail.zaloSynced ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Đã đồng bộ
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                        Chưa đồng bộ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cleanZaloPhone(selectedEmployeeDetail.zaloPhone || selectedEmployeeDetail.phone) && (
                      <>
                        <a
                          href={`tel:${cleanZaloPhone(selectedEmployeeDetail.zaloPhone || selectedEmployeeDetail.phone)}`}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                        >
                          Gọi
                        </a>
                        <a
                          href={getZaloDirectUrl(selectedEmployeeDetail.zaloPhone || selectedEmployeeDetail.phone)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1"
                        >
                          <span>Zalo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Email Doanh nghiệp */}
                <div className="col-span-1 sm:col-span-2 flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Email:</span>
                  </div>
                  <span className="font-semibold text-slate-900 truncate">
                    {selectedEmployeeDetail.email || 'Chưa cập nhật'}
                  </span>
                </div>

                {/* Ngày tham gia */}
                <div className="col-span-1 sm:col-span-2 flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Ngày tham gia công tác:</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {selectedEmployeeDetail.joinDate || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {onNavigateToPermissions && canManageHR && (
                <button
                  onClick={() => {
                    const empId = selectedEmployeeDetail.id;
                    setSelectedEmployeeDetail(null);
                    onNavigateToPermissions(empId);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Cấp quyền & Hiển thị</span>
                </button>
              )}
              <button
                onClick={() => {
                  onSendZaloToEmployee(selectedEmployeeDetail);
                  setSelectedEmployeeDetail(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <BellRing className="w-4 h-4" />
                <span>Gửi Thông Báo Nội Bộ</span>
              </button>
              <button
                onClick={() => setSelectedEmployeeDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Đóng
              </button>
              {canManageHR && selectedEmployeeDetail.role !== 'ADMIN' && (
                <button
                  type="button"
                  title="Xóa nhân sự này khỏi hệ thống"
                  onClick={() => {
                    if (
                      confirm(
                        `Bạn có chắc chắn muốn xóa nhân sự ${selectedEmployeeDetail.fullName} (${selectedEmployeeDetail.employeeCode}) khỏi hệ thống? Dữ liệu nhân sự sẽ được gỡ bỏ hoàn toàn.`
                      )
                    ) {
                      onDeleteEmployee(selectedEmployeeDetail.id);
                      setSelectedEmployeeDetail(null);
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Xóa hồ sơ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Quay lại</span>
              </button>
              <h3 className="font-bold text-slate-900 text-base">
                {editingEmployee ? 'Chỉnh Sửa Hồ Sơ Nhân Sự' : 'Thêm Nhân Sự Mới'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {modalError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Mã nhân sự</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="nhanvien@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Số điện thoại / Zalo</label>
                  <input
                    type="tel"
                    placeholder="Nhập số điện thoại nhân viên"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value, zaloPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    placeholder="user1"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
<div className="text-sm text-slate-500">Cột E bỏ qua do Supabase Auth quản lý. Cấp tài khoản và gửi email đặt lại mật khẩu từ trang quản trị.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Bộ phận</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {departments
                      .filter((d) => d !== 'ALL')
                      .map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Chức danh</label>
                  <select
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Chọn chức danh --</option>
                    <option value="Lái cẩu RTG">Lái cẩu RTG</option>
                    <option value="Tổ trưởng">Tổ trưởng</option>
                    <option value="Tổ phó">Tổ phó</option>
                    <option value="Ca trưởng">Ca trưởng</option>
                    <option value="Ca phó">Ca phó</option>
                    <option value="Nhân viên">Nhân viên</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Vai trò hệ thống</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER_L1">Quản lý cấp 1</option>
                    <option value="MANAGER_L2">Quản lý cấp 2</option>
                    <option value="USER">Người dùng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Trạng thái làm việc</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ACTIVE">Chính thức</option>
                    <option value="PROBATION">Thử việc</option>
                    <option value="LEAVE">Nghỉ phép</option>
                    <option value="TERMINATED">Thôi việc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Ngày sinh / Năm sinh</label>
                <input
                  type="text"
                  placeholder="VD: 1985 hoặc 15/08/1985"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-200 cursor-pointer"
                >
                  {editingEmployee ? 'Lưu cập nhật' : 'Thêm nhân sự'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CỬA SỔ TRUNG TÂM TÁC VỤ QUẢN TRỊ NHÂN SỰ (6 CHỨC NĂNG) */}
      {isActionHubOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Tiện Ích & Tác Vụ Quản Lý Nhân Sự
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chọn 1 trong 6 tác vụ nghiệp vụ bên dưới để thao tác nhanh chóng và trực quan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActionHubOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 6-Button Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6">
              {/* Nút 1: Thêm Nhân sự mới */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleOpenAdd();
                }}
                className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 text-left transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-700">
                      1. Thêm Nhân Sự Mới
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                      Thủ công
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    Nhập tay hồ sơ nhân viên, chọn ca RTG, cấp quyền vị trí và kết nối Zalo.
                  </p>
                </div>
              </button>

              {/* Nút 2: Nhập từ Excel */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  fileInputRef.current?.click();
                }}
                className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-emerald-700">
                      2. Nhập từ Excel
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                      .xlsx / .csv
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    Tải lên file bảng tính Excel để nạp hàng loạt danh sách nhân viên vào hệ thống.
                  </p>
                </div>
              </button>

              {/* Nút 3: Liên Kết File Data_RTG (sheet ThongTinNhanSu) */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  setDataRtgStatusMsg(null);
                  setShowDataRtgModal(true);
                }}
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 text-left transition-all group flex items-start gap-3.5 cursor-pointer shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">
                      3. Liên Kết Data_RTG
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-mono">
                      ThongTinNhanSu
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    Liên kết tệp Data_RTG: Cột B (Họ tên), C (Mã NV), D (Username), E (Cột E bỏ qua), G (Bộ phận), I (SĐT).
                  </p>
                </div>
              </button>

              {/* Nút 4: Nhập báo cáo Google */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleImportReport();
                }}
                className="p-4 rounded-2xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-left transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-200 group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-amber-700">
                      4. Nhập Báo Cáo Google
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                      Preview
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    Xem trước bản báo cáo nhân sự và xác nhận trước khi nhập vào PostgreSQL.
                  </p>
                </div>
              </button>

              {/* Nút 5: Xuất Báo Cáo Excel (.xlsx) chuẩn Data_RTG */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  exportExcel();
                }}
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-emerald-700">
                      5. Xuất Excel (.xlsx) Data_RTG
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      Sheet ThongTinNhanSu
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    Tải về file Excel chuẩn Data_RTG có đầy đủ Họ tên, Mã NV, Tên đăng nhập, Cột E bỏ qua, Ca kíp và Điểm năng lực.
                  </p>
                </div>
              </button>

              {/* Nút 6: Xóa Nhiều Nhân Sự Cùng Lúc */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  setIsBatchDeleteMode(true);
                  setSelectedIds([]);
                }}
                className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 hover:border-rose-300 text-left transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-200 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-rose-700">
                      6. Xóa Nhiều Nhân Sự
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold">
                      Hàng loạt
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    Mở chế độ đánh dấu hộp kiểm để chọn và xóa cùng lúc nhiều hồ sơ nhân sự an toàn.
                  </p>
                </div>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Hệ thống quản trị dữ liệu nhân sự Tổ RTG - Cảng HICT</span>
              <button
                type="button"
                onClick={() => setIsActionHubOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA NHIỀU NHÂN SỰ CÙNG LÚC */}
      {showBatchDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Xác nhận xóa {selectedIds.length} nhân sự?
                </h3>
                <p className="text-xs text-rose-600 font-medium mt-0.5">
                  Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto mb-5 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Danh sách nhân sự được chọn ({selectedIds.length}):
              </div>
              {employees
                .filter((e) => selectedIds.includes(e.id))
                .slice(0, 10)
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-100"
                  >
                    <div className="font-bold text-slate-800">{e.fullName}</div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      {e.employeeCode} • {e.department}
                    </div>
                  </div>
                ))}
              {selectedIds.length > 10 && (
                <div className="text-center text-[11px] text-slate-400 pt-1">
                  ... và {selectedIds.length - 10} nhân sự khác
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm shadow-rose-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận xóa vĩnh viễn ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CỬA SỔ MODAL LIÊN KẾT FILE DATA_RTG (SHEET THONGTINNHANSU)                */}
      {/* ========================================================================= */}
      {showDataRtgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88dvh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      Liên Kết Dữ Liệu: File Data_RTG
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                      sheet: ThongTinNhanSu
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đồng bộ 2 chiều dữ liệu Quản lý nhân sự Tổ RTG với Google Trang tính & Tệp Excel theo mô hình 5W1H
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDataRtgModal(false);
                  setDataRtgStatusMsg(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quy Tắc Ánh Xạ Cột Cố Định (User Mandatory Rules) */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 border border-emerald-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Quy tắc Ánh Xạ Cột Chuẩn (Data_RTG ➔ ThongTinNhanSu)
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded font-medium">
                  Đã kích hoạt tự động chuẩn hóa: "Phạm Ngọc Tuấn" ➔ "Phạm Ngọc Tuân"
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT B</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Họ và Tên</div>
                  <div className="text-[10px] text-slate-400">Chuẩn hóa tên</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT C</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Mã nhân sự</div>
                  <div className="text-[10px] text-slate-400">Mã định danh NV</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT D</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Tên đăng nhập</div>
                  <div className="text-[10px] text-slate-400">Tài khoản hệ thống</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT E</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Cột E bỏ qua</div>
                  <div className="text-[10px] text-slate-400">Cột E bỏ qua đăng nhập</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT G</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Bộ phận</div>
                  <div className="text-[10px] text-slate-400">RTG ca 1, 2, 3...</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-600 font-mono">CỘT I</div>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">Số điện thoại</div>
                  <div className="text-[10px] text-slate-400">Đồng bộ Zalo</div>
                </div>
              </div>
            </div>

            {/* Thông báo trạng thái nếu có */}
            {dataRtgStatusMsg && (
              <div
                className={`mt-4 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 border ${
                  dataRtgStatusMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : dataRtgStatusMsg.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {dataRtgStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : dataRtgStatusMsg.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">{dataRtgStatusMsg.text}</div>
                  {dataRtgStatusMsg.detail && (
                    <div className="text-[11px] mt-0.5 opacity-90">{dataRtgStatusMsg.detail}</div>
                  )}
                </div>
              </div>
            )}

            {/* Tabs Chọn Phương Thức: Google Sheets vs Excel File */}
            <div className="flex items-center gap-2 mt-4 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setDataRtgActiveTab('SHEETS')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  dataRtgActiveTab === 'SHEETS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <CloudCog className="w-4 h-4" />
                <span>1. Google Sheets (Trực Tuyến)</span>
              </button>
              <button
                type="button"
                onClick={() => setDataRtgActiveTab('EXCEL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  dataRtgActiveTab === 'EXCEL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>2. Tệp Excel Data_RTG.xlsx (Ngoại Tuyến)</span>
              </button>
            </div>

            {/* Tab 1: Google Sheets trực tuyến */}
            {dataRtgActiveTab === 'SHEETS' && <GoogleReportActions module="employees" />}

            {/* Tab 2: Tệp Excel Data_RTG.xlsx ngoại tuyến */}
            {dataRtgActiveTab === 'EXCEL' && (
              <div className="mt-4 space-y-4">
                <input
                  type="file"
                  ref={excelDataRtgInputRef}
                  onChange={handleUploadExcelDataRtg}
                  accept=".xlsx, .xls"
                  className="hidden"
                />

                <div className="p-6 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    Tải lên file Data_RTG.xlsx hoặc bảng tính có sheet "ThongTinNhanSu"
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                    Hệ thống sẽ tự động quét sheet ThongTinNhanSu và trích xuất đúng các cột B (Họ tên), C (Mã NV), D (Username), E (Cột E bỏ qua), G (Bộ phận), I (SĐT). Tự động chuẩn hóa "Phạm Ngọc Tuấn" thành "Phạm Ngọc Tuân".
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => excelDataRtgInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Chọn file Data_RTG.xlsx</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDataRtgExcelTemplate(employees)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-2"
                      title="Tải về file Excel mẫu đã chuẩn bị sẵn định dạng cột B, C, D, E, G, I"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Tải file mẫu Data_RTG chuẩn</span>
                    </button>
                  </div>
                </div>

                {availableSheetNames.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <span className="font-bold text-slate-700">Các tab sheet trong tệp:</span>
                    {availableSheetNames.map((sName) => (
                      <button
                        key={sName}
                        type="button"
                        onClick={() => handleSelectExcelSheet(sName)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          dataRtgTabName === sName
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {sName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bảng Đối Soát Dữ Liệu Sau Khi Trích Xuất */}
            {parsedDataRtgResult && parsedDataRtgResult.employees.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-sm text-slate-900">
                      Bảng Đối Soát Nhân Sự ({parsedDataRtgResult.validCount} dòng)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      Nguồn: {parsedDataRtgResult.sourceType === 'GOOGLE_SHEETS' ? 'Google Sheets' : 'File Excel'} • Sheet: {parsedDataRtgResult.detectedSheetName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyDataRtgEmployees}
                      disabled={isApplyingDataRtg}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-200 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isApplyingDataRtg
                          ? 'Đang lưu vào hệ thống...'
                          : `Xác nhận Đồng bộ ${parsedDataRtgResult.validCount} Nhân sự`}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">STT</th>
                        <th className="py-2.5 px-3">Họ và Tên (Cột B)</th>
                        <th className="py-2.5 px-3">Mã NV (Cột C)</th>
                        <th className="py-2.5 px-3">Tên đăng nhập (Cột D)</th>
                        <th className="py-2.5 px-3">Cột E bỏ qua</th>
                        <th className="py-2.5 px-3">Bộ phận (Cột G)</th>
                        <th className="py-2.5 px-3">SĐT (Cột I)</th>
                        <th className="py-2.5 px-3 text-center">Tình trạng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedDataRtgResult.employees.map((emp, idx) => {
                        const isExisting = employees.some(
                          (e) =>
                            (emp.employeeCode && e.employeeCode?.toLowerCase() === emp.employeeCode.toLowerCase()) ||
                            (emp.username && e.username?.toLowerCase() === emp.username.toLowerCase()) ||
                            (emp.fullName && e.fullName?.toLowerCase() === emp.fullName.toLowerCase())
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{emp.fullName}</span>
                                {emp.fullName === 'Phạm Ngọc Tuân' && (
                                  <span
                                    className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold"
                                    title="Đã tự động chuẩn hóa từ 'Phạm Ngọc Tuấn'"
                                  >
                                    Đã chuẩn hóa
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                              {emp.employeeCode || '-'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {emp.username || '-'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">
                              —
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                  normalizeRtgDepartment(emp.department) === 'RTG ca 1'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : normalizeRtgDepartment(emp.department) === 'RTG ca 2'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {normalizeRtgDepartment(emp.department)}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {emp.phone || emp.zaloPhone || '-'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isExisting ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                  Cập nhật
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Thêm mới
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2">
                  <span>
                    Tổng cộng: <strong>{parsedDataRtgResult.validCount}</strong> nhân sự được nhận diện.
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyDataRtgEmployees}
                    disabled={isApplyingDataRtg}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isApplyingDataRtg ? 'Đang lưu...' : 'Lưu tất cả vào Quản Lý Nhân Sự'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

