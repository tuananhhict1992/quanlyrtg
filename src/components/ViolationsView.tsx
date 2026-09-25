import {api} from '../services/supabase';
import {GoogleReportDialog} from './GoogleReportActions';
import {parseWorkbook} from '../services/excelProcessing';
import {GoogleSyncPanel} from './GoogleSyncPanel';
import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Download,
  Search,
  Users,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Trash2,
  Eye,
  UserCheck,
  ShieldCheck,
  Building2,
  ExternalLink,
  Layers,
  Info,
  Lock,
  Shield,
  Filter,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IncidentViolation, IncidentAnalysisReport, Employee, AppSettings } from '../types';
import {
  parseExcelViolationsFile,
  parseRawTextViolations,
  generateMarkdownTable,
  generateExcelTsvTable,
  generateSamplePortIncidents,
  buildAnalysisReport,
  exportViolationsToExcel,
  removeVietnameseTones,
} from '../services/violationParserService';
import {
  syncAllViolationsToSheet,
  syncViolationsToDataRtgGoogleSheet,
  fetchViolationsFromDataRtgGoogleSheet,
  exportDataRtgExcelTemplate,
  THEO_DOI_VI_PHAM_TAB,
} from '../services/googleSheetSyncService';
import { signInWithGoogleDrive, getCachedToken } from '../services/googleDriveAuth';

interface ViolationsViewProps {
  currentUser: Employee;
  employees: Employee[];
  incidents?: IncidentViolation[];
  onUpdateIncidents?: (updated: IncidentViolation[]) => void;
  onUpdateEmployee: (updated: Employee) => void;
  onBatchUpdateEmployees?: (updatedList: Employee[]) => void;
  onAddEmployee?: (newEmp: Employee) => void;
  onBackToDashboard: () => void;
  appSettings?: AppSettings | null;
  onSaveAppSettings?: (settings: Partial<AppSettings>) => void;
  onNavigateToPermissions?: () => void;
}

export const ViolationsView: React.FC<ViolationsViewProps> = ({
  currentUser,
  employees,
  incidents: propIncidents,
  onUpdateIncidents,
  onUpdateEmployee,
  onBatchUpdateEmployees,
  onAddEmployee,
  onBackToDashboard,
  appSettings,
  onSaveAppSettings,
  onNavigateToPermissions,
}) => {
  // Trạng thái danh sách sự cố đã đối soát & trích xuất (Tổ RTG)
  const [incidents,setIncidents]=useState<IncidentViolation[]>(propIncidents||[]);

  // Đồng bộ với propIncidents khi component cha cập nhật
  React.useEffect(() => {
    if (propIncidents) {
      setIncidents(propIncidents);
    }
  }, [propIncidents]);

  // Hàm cập nhật danh sách sự cố đồng thời lưu localStorage và báo lên App.tsx (sử dụng setTimeout để tránh cập nhật state trong render)
  const updateIncidentsState = (
    updater: IncidentViolation[] | ((prev: IncidentViolation[]) => IncidentViolation[])
  ) => {
    setIncidents((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setTimeout(() => {
        onUpdateIncidents?.(next);
      }, 0);
      return next;
    });
  };

  const [inputTab, setInputTab] = useState<'EXCEL' | 'TEXT'>('EXCEL');
  const [rawTextInput, setRawTextInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'THAP' | 'TRUNG_BINH' | 'NGHIEM_TRONG'>('ALL');
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [copiedExcel, setCopiedExcel] = useState<boolean>(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState<boolean>(false);
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState<IncidentViolation | null>(null);
  const [syncSuccessModal, setSyncSuccessModal] = useState<{ count: number; updatedNames: string[] } | null>(null);
  const [isActionHubOpen, setIsActionHubOpen] = useState<boolean>(false);
  
  // Trạng thái đồng bộ Google Sheet (Webhook)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSyncResult, setSheetSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfigSheetModal, setShowConfigSheetModal] = useState(false);
  // Dành riêng cho tài khoản chỉ xem (Viewer Mode)
  const [viewerFilterTab, setViewerFilterTab] = useState<'ALL' | 'MINE' | 'SEVERE' | 'SHIFT'>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'ALL' | 'PHU_LUC_1' | 'PHU_LUC_2'>('ALL');

  // Trạng thái đồng bộ với file Data_RTG (sheet TheoDoiViPham)
  const [isSyncingDataRtg, setIsSyncingDataRtg] = useState<boolean>(false);
  const [dataRtgSyncMessage, setDataRtgSyncMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    detail?: string;
  } | null>(null);
  const [showConfigDataRtgModal, setShowConfigDataRtgModal] = useState<boolean>(false);
  const [dataRtgSpreadsheetUrlInput, setDataRtgSpreadsheetUrlInput] = useState<string>(
    appSettings?.dataRtgSpreadsheetUrl || appSettings?.dataRtgSpreadsheetId || ''
  );

  // Phân quyền quản trị vi phạm
  const canManageViolations =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.role === 'MANAGER_L2' ||
    currentUser.assignedPermissions.includes('MANAGE_VIOLATIONS') ||
    currentUser.assignedPermissions.includes('MANAGE_VIOLATIONS') ||
    currentUser.assignedPermissions.includes('MANAGE_HR');

  // Danh sách các vụ việc liên quan đến tài khoản người dùng hiện tại
  const myIncidents = useMemo(() => {
    const myName = (currentUser.fullName || '').trim().toLowerCase();
    const myNoTone = removeVietnameseTones(myName).trim();
    const myCode = (currentUser.employeeCode || '').trim().toLowerCase();
    const myUsername = (currentUser.username || '').trim().toLowerCase();

    return incidents.filter((item) => {
      if (!item.isRtgRelated) return false;
      const itemViolator = (item.normalizedName || item.violatorName || '').trim().toLowerCase();
      const itemViolatorNoTone = removeVietnameseTones(itemViolator).trim();
      const itemCode = (item.matchedEmployeeCode || '').trim().toLowerCase();

      const isMatchName =
        (itemViolator && itemViolator === myName) ||
        (itemViolatorNoTone && itemViolatorNoTone === myNoTone) ||
        (myName.length >= 6 && (itemViolator.includes(myName) || myName.includes(itemViolator))) ||
        (myNoTone.length >= 6 && (itemViolatorNoTone.includes(myNoTone) || myNoTone.includes(itemViolatorNoTone)));

      const isMatchCode = myCode && itemCode && itemCode === myCode;
      const isMatchUser = myUsername && itemCode && itemCode === myUsername;

      return Boolean(isMatchName || isMatchCode || isMatchUser);
    });
  }, [incidents, currentUser]);

  // Đồng bộ lên file Data_RTG (sheet TheoDoiViPham)
  const handleSyncToDataRtgSheet = async () => {
    if (!confirm('Xếp hàng báo cáo vi phạm đã lưu?')) return;
    setIsSyncingDataRtg(true); setDataRtgSyncMessage(null);
    try { const result = await api('/google/sync',{method:'POST',body:JSON.stringify({module:'incidents'})}); setDataRtgSyncMessage({type:'success',text:result.message}); }
    catch(err:any) { setDataRtgSyncMessage({type:'error',text:err.message}); }
    finally { setIsSyncingDataRtg(false); }
  };

  // Đọc / Làm mới dữ liệu từ file Data_RTG (sheet TheoDoiViPham)
  const handleFetchFromDataRtgSheet = () => { setShowConfigDataRtgModal(true); };

  // Xuất file bảng tính Data_RTG gồm cả 2 sheet ThongTinNhanSu & TheoDoiViPham
  const handleExportDataRtgFullFile = () => {
    exportDataRtgExcelTemplate(employees, incidents);
  };

  const handleSyncToGoogleSheet = async () => {
    if (!confirm('Xếp hàng báo cáo vi phạm đã lưu?')) return;
    setIsSyncingSheet(true); setSheetSyncResult(null);
    try { const result = await api('/google/sync',{method:'POST',body:JSON.stringify({module:'incidents'})}); setSheetSyncResult({success:true,message:result.message}); }
    catch(err:any) { setSheetSyncResult({success:false,message:err.message}); }
    finally { setIsSyncingSheet(false); }
  };

  
  
  // Thông tin đối soát lần gần nhất
  const [lastReconciliationStats, setLastReconciliationStats] = useState<{
    totalScanned: number;
    matchedCount: number;
    ignoredCount: number;
    fileName?: string;
  }>({
    totalScanned: 6,
    matchedCount: 4,
    ignoredCount: 2,
    fileName: 'Dữ liệu mẫu chuẩn hóa đối soát Tổ RTG',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Báo cáo hiện tại
  const currentReport: IncidentAnalysisReport = useMemo(() => {
    return buildAnalysisReport(
      incidents,
      lastReconciliationStats.ignoredCount,
      lastReconciliationStats.totalScanned,
      'Báo cáo Sự cố & Vi phạm Tổ RTG'
    );
  }, [incidents, lastReconciliationStats]);

  // Lọc tìm kiếm & mức độ & bộ lọc cho người xem
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      // Bắt buộc chỉ hiển thị Tổ RTG
      if (!item.isRtgRelated) return false;

      // Xử lý bộ lọc chuyên dụng cho tài khoản chỉ xem (Viewer)
      if (!canManageViolations) {
        if (viewerFilterTab === 'MINE') {
          const myName = (currentUser.fullName || '').trim().toLowerCase();
          const myNoTone = removeVietnameseTones(myName).trim();
          const myCode = (currentUser.employeeCode || '').trim().toLowerCase();
          const myUsername = (currentUser.username || '').trim().toLowerCase();

          const itemViolator = (item.normalizedName || item.violatorName || '').trim().toLowerCase();
          const itemViolatorNoTone = removeVietnameseTones(itemViolator).trim();
          const itemCode = (item.matchedEmployeeCode || '').trim().toLowerCase();

          const isMatchName =
            (itemViolator && itemViolator === myName) ||
            (itemViolatorNoTone && itemViolatorNoTone === myNoTone) ||
            (myName.length >= 6 && (itemViolator.includes(myName) || myName.includes(itemViolator))) ||
            (myNoTone.length >= 6 && (itemViolatorNoTone.includes(myNoTone) || myNoTone.includes(itemViolatorNoTone)));

          const isMatchCode = myCode && itemCode && itemCode === myCode;
          const isMatchUser = myUsername && itemCode && itemCode === myUsername;

          if (!isMatchName && !isMatchCode && !isMatchUser) return false;
        } else if (viewerFilterTab === 'SEVERE') {
          if (item.severity !== 'NGHIEM_TRONG') return false;
        } else if (viewerFilterTab === 'SHIFT') {
          const myDept = (currentUser.department || '').toLowerCase();
          const itemDept = (item.matchedDepartment || item.department || '').toLowerCase();
          if (!itemDept.includes(myDept) && !myDept.includes(itemDept)) return false;
        }

        // Lọc theo ca trực cụ thể nếu chọn
        if (selectedShiftFilter !== 'ALL') {
          const itemDept = (item.matchedDepartment || item.department || '').toLowerCase();
          if (!itemDept.includes(selectedShiftFilter.toLowerCase())) return false;
        }

        // Lọc theo phân loại phụ lục
        if (selectedCategoryFilter !== 'ALL') {
          if (item.sourceAppendix !== selectedCategoryFilter) return false;
        }
      }

      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.violatorName.toLowerCase().includes(query);
        const matchOrig = item.originalName?.toLowerCase().includes(query);
        const matchCode = item.code.toLowerCase().includes(query);
        const matchEmpCode = item.matchedEmployeeCode?.toLowerCase().includes(query);
        const matchEquip = item.equipment?.toLowerCase().includes(query);
        const matchLoc = item.location.toLowerCase().includes(query);
        const matchWhat = item.what.toLowerCase().includes(query);
        const matchWhy = item.why.toLowerCase().includes(query);
        const matchHow = item.how.toLowerCase().includes(query);
        const matchDept = item.matchedDepartment?.toLowerCase().includes(query);
        return (
          matchName ||
          matchOrig ||
          matchCode ||
          matchEmpCode ||
          matchEquip ||
          matchLoc ||
          matchWhat ||
          matchWhy ||
          matchHow ||
          matchDept
        );
      }

      return true;
    });
  }, [
    incidents,
    severityFilter,
    searchQuery,
    canManageViolations,
    viewerFilterTab,
    selectedShiftFilter,
    selectedCategoryFilter,
    currentUser,
  ]);

  // Xử lý tải file Excel & đối soát với nhân sự hệ thống
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = await parseWorkbook(file,'incidents');

        // ĐỐI SOÁT VỚI DANH SÁCH NHÂN VIÊN HỆ THỐNG VÀ LỌC ĐỘC QUYỀN TỔ RTG
        const report = parseExcelViolationsFile(workbook, employees);

        setLastReconciliationStats({
          totalScanned: report.totalFileRows,
          matchedCount: report.matchedCount,
          ignoredCount: report.unmatchedOrNonRtgCount,
          fileName: file.name,
        });

        if (report.items.length > 0) {
          updateIncidentsState(report.items);
        } else {
          alert(
            `Đã quét ${report.totalFileRows} dòng trong file: Không tìm thấy sự cố nào thuộc Tổ RTG khớp với danh sách nhân sự của hệ thống. Các nội dung ngoài Tổ RTG (Đầu kéo, Xe nâng...) đã được tự động loại bỏ.`
          );
        }
      } catch (err: any) {
        console.error('Lỗi đọc file Excel:', err);
        alert('Đã xảy ra lỗi khi đọc file Excel: ' + (err.message || 'Lỗi định dạng'));
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      alert('Không thể đọc tệp tin tải lên.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  // Phân tích văn bản & đối soát nhân viên
  const handleAnalyzeText = () => {
    if (!rawTextInput.trim()) {
      alert('Vui lòng dán nội dung diễn biến hoặc bảng báo cáo sự cố.');
      return;
    }

    setIsProcessing(true);
    try {
      const report = parseRawTextViolations(rawTextInput, employees);

      setLastReconciliationStats({
        totalScanned: report.totalFileRows,
        matchedCount: report.matchedCount,
        ignoredCount: report.unmatchedOrNonRtgCount,
        fileName: 'Văn bản nhập trực tiếp',
      });

      if (report.items.length > 0) {
        updateIncidentsState(report.items);
        setRawTextInput('');
      } else {
        alert(
          'Không có vụ việc nào thuộc Tổ RTG khớp với nhân viên hệ thống. Các dòng thuộc tổ khác đã tự động được loại bỏ theo quy tắc.'
        );
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi phân tích văn bản.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Nạp dữ liệu mẫu
  const handleLoadSample = () => {
    const sample = generateSamplePortIncidents(employees);
    updateIncidentsState(sample);
    setLastReconciliationStats({
      totalScanned: 6,
      matchedCount: sample.length,
      ignoredCount: 2,
      fileName: 'Dữ liệu mẫu kiểm thử đối soát Tổ RTG',
    });
  };

  // Xóa trắng dữ liệu danh sách để tải báo cáo mới
  const handleClearIncidents = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách sự cố/vi phạm hiện tại để tải báo cáo mới?')) {
      updateIncidentsState([]);
      setLastReconciliationStats(null);
    }
  };

  // Sao chép Markdown Table (8 cột chuẩn)
  const handleCopyMarkdown = () => {
    const md = generateMarkdownTable(currentReport);
    navigator.clipboard.writeText(md).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2500);
    });
  };

  // Sao chép định dạng Excel (TSV) để paste trực tiếp vào bảng tính Excel
  const handleCopyExcel = () => {
    const tsv = generateExcelTsvTable(currentReport);
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedExcel(true);
      setTimeout(() => setCopiedExcel(false), 2500);
    });
  };

  // Xuất Excel
  const handleExportExcel = () => {
    exportViolationsToExcel(currentReport);
  };

  // Đồng bộ tất cả vào Hồ sơ Nhân sự
  const handleSyncToEmployeeProfiles = () => {
    const rtgItems = incidents.filter((i) => i.isRtgRelated);
    if (rtgItems.length === 0) {
      alert('Không có vụ việc nào của Tổ RTG để đồng bộ.');
      return;
    }

    const updatedEmployeesMap = new Map<string, Employee>();
    const updatedNames: string[] = [];
    let syncedIncidentCount = 0;

    rtgItems.forEach((inc) => {
      // Tìm nhân viên theo matchedEmployeeId trước, nếu không có thì tìm theo tên
      let foundEmp = inc.matchedEmployeeId
        ? employees.find((e) => e.id === inc.matchedEmployeeId)
        : null;

      if (!foundEmp) {
        const targetName = (inc.normalizedName || inc.violatorName).trim().toLowerCase();
        const targetNoTone = removeVietnameseTones(targetName).trim();
        foundEmp = employees.find((e) => {
          const empName = e.fullName.trim().toLowerCase();
          const empNoTone = removeVietnameseTones(e.fullName).trim();
          return (
            empName === targetName ||
            empNoTone === targetNoTone ||
            (targetName.length >= 6 && (empName.includes(targetName) || targetName.includes(empName))) ||
            (targetNoTone.length >= 6 && (empNoTone.includes(targetNoTone) || targetNoTone.includes(empNoTone)))
          );
        }) || null;

        // Tìm thêm trong INITIAL_EMPLOYEES nếu state chưa cập nhật
        if (!foundEmp) {
          foundEmp = employees.find((e) => {
            const empName = e.fullName.trim().toLowerCase();
            const empNoTone = removeVietnameseTones(e.fullName).trim();
            return (
              empName === targetName ||
              empNoTone === targetNoTone ||
              (targetName.length >= 6 && (empName.includes(targetName) || targetName.includes(empName))) ||
              (targetNoTone.length >= 6 && (empNoTone.includes(targetNoTone) || targetNoTone.includes(empNoTone)))
            );
          }) || null;
        }

        // Tự động tạo mới hồ sơ nếu là nhân sự mới được nhận diện từ biên bản
        if (!foundEmp && inc.violatorName && !inc.violatorName.includes('Chưa chỉ đích danh') && !inc.violatorName.includes('Tập thể')) {
          const newCode = `NV-${String(employees.length + updatedEmployeesMap.size + 1).padStart(3, '0')}`;
          const newId = `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          foundEmp = {
            id: newId,
            username: removeVietnameseTones(inc.violatorName).replace(/\s+/g, ''),
            employeeCode: newCode,
            fullName: inc.violatorName,
            department: inc.matchedDepartment || 'RTG ca 2',
            position: 'Lái cẩu RTG',
            role: 'USER',
            status: 'ACTIVE',
            competencyScore: 85,
            quizzesCompleted: 0,
            violationCount: 0,
            proposalsCount: 0,
            joinDate: new Date().toISOString().split('T')[0],
            assignedPermissions: [],
            violationRecords: [], email: '', phone: '', zaloPhone: '', zaloSynced: false, avatar: '',
          };
          if (onAddEmployee) onAddEmployee(foundEmp);
        }
      }

      if (foundEmp) {
        const currentEmp = updatedEmployeesMap.get(foundEmp.id) || { ...foundEmp };
        const currentRecords = currentEmp.violationRecords || [];

        const alreadyRecorded = currentRecords.some((r) => r.incidentCode === inc.code);
        if (!alreadyRecorded) {
          const pointsDeduct = inc.severity === 'NGHIEM_TRONG' ? 15 : inc.severity === 'TRUNG_BINH' ? 10 : 5;
          const newRecord = {
            id: `vr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            incidentCode: inc.code,
            time: inc.time,
            location: inc.location,
            what: inc.what,
            why: inc.why,
            how: inc.how,
            equipment: inc.equipment,
            severity: (inc.severity === 'NGHIEM_TRONG' ? 'HIGH' : inc.severity === 'TRUNG_BINH' ? 'MEDIUM' : 'LOW') as
              | 'LOW'
              | 'MEDIUM'
              | 'HIGH',
            pointsDeducted: pointsDeduct,
            recordedAt: new Date().toISOString(),
          };

          currentEmp.violationRecords = [newRecord, ...currentRecords];
          currentEmp.violationCount = (currentEmp.violationCount || 0) + 1;
          currentEmp.competencyScore = Math.max(0, (currentEmp.competencyScore || 100) - pointsDeduct);

          updatedEmployeesMap.set(currentEmp.id, currentEmp);
          syncedIncidentCount++;
          if (!updatedNames.includes(currentEmp.fullName)) {
            updatedNames.push(currentEmp.fullName);
          }
        }
      }
    });

    // Cập nhật lên hệ thống
    if (onBatchUpdateEmployees && updatedEmployeesMap.size > 0) {
      onBatchUpdateEmployees(Array.from(updatedEmployeesMap.values()));
    } else {
      updatedEmployeesMap.forEach((emp) => {
        onUpdateEmployee(emp);
      });
    }

    // Đánh dấu đã đồng bộ
    updateIncidentsState((prev) =>
      prev.map((i) => (i.isRtgRelated ? { ...i, isSyncedToProfile: true } : i))
    );

    setSyncSuccessModal({
      count: syncedIncidentCount,
      updatedNames,
    });
  };

  // Đồng bộ riêng 1 vụ việc
  const handleSyncSingleIncident = (inc: IncidentViolation) => {
    let foundEmp = inc.matchedEmployeeId
      ? employees.find((e) => e.id === inc.matchedEmployeeId)
      : null;

    if (!foundEmp) {
      const targetName = (inc.normalizedName || inc.violatorName).trim().toLowerCase();
      const targetNoTone = removeVietnameseTones(targetName).trim();
      foundEmp = employees.find((e) => {
        const empName = e.fullName.trim().toLowerCase();
        const empNoTone = removeVietnameseTones(e.fullName).trim();
        return (
          empName === targetName ||
          empNoTone === targetNoTone ||
          (targetName.length >= 6 && (empName.includes(targetName) || targetName.includes(empName))) ||
          (targetNoTone.length >= 6 && (empNoTone.includes(targetNoTone) || targetNoTone.includes(empNoTone)))
        );
      }) || null;

      if (!foundEmp) {
        foundEmp = employees.find((e) => {
          const empName = e.fullName.trim().toLowerCase();
          const empNoTone = removeVietnameseTones(e.fullName).trim();
          return (
            empName === targetName ||
            empNoTone === targetNoTone ||
            (targetName.length >= 6 && (empName.includes(targetName) || targetName.includes(empName))) ||
            (targetNoTone.length >= 6 && (empNoTone.includes(targetNoTone) || targetNoTone.includes(empNoTone)))
          );
        }) || null;
      }

      // Tự động tạo hồ sơ nhân sự mới nếu chưa có trong hệ thống
      if (!foundEmp && inc.violatorName && !inc.violatorName.includes('Chưa chỉ đích danh') && !inc.violatorName.includes('Tập thể')) {
        const newCode = `NV-${String(employees.length + 1).padStart(3, '0')}`;
        const newId = `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        foundEmp = {
          id: newId,
          username: removeVietnameseTones(inc.violatorName).replace(/\s+/g, ''),
          employeeCode: newCode,
          fullName: inc.violatorName,
          department: inc.matchedDepartment || 'RTG ca 2',
          position: 'Lái cẩu RTG',
          role: 'USER',
          status: 'ACTIVE',
          competencyScore: 85,
          quizzesCompleted: 0,
          violationCount: 0,
          proposalsCount: 0,
          joinDate: new Date().toISOString().split('T')[0],
          assignedPermissions: [],
          violationRecords: [], email: '', phone: '', zaloPhone: '', zaloSynced: false, avatar: '',
        };
        if (onAddEmployee) onAddEmployee(foundEmp);
      }
    }

    if (!foundEmp) {
      alert(`Không thể xác định nhân viên "${inc.violatorName}" để đồng bộ hồ sơ.`);
      return;
    }

    const currentRecords = foundEmp.violationRecords || [];
    const alreadyRecorded = currentRecords.some((r) => r.incidentCode === inc.code);
    if (alreadyRecorded) {
      alert(`Vụ việc ${inc.code} đã được đồng bộ vào hồ sơ của ${foundEmp.fullName} trước đó.`);
      updateIncidentsState((prev) => prev.map((item) => (item.id === inc.id ? { ...item, isSyncedToProfile: true } : item)));
      return;
    }

    const pointsDeduct = inc.severity === 'NGHIEM_TRONG' ? 15 : inc.severity === 'TRUNG_BINH' ? 10 : 5;
    const newRecord = {
      id: `vr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      incidentCode: inc.code,
      time: inc.time,
      location: inc.location,
      what: inc.what,
      why: inc.why,
      how: inc.how,
      equipment: inc.equipment,
      severity: (inc.severity === 'NGHIEM_TRONG' ? 'HIGH' : inc.severity === 'TRUNG_BINH' ? 'MEDIUM' : 'LOW') as
        | 'LOW'
        | 'MEDIUM'
        | 'HIGH',
      pointsDeducted: pointsDeduct,
      recordedAt: new Date().toISOString(),
    };

    const updatedEmp: Employee = {
      ...foundEmp,
      violationRecords: [newRecord, ...currentRecords],
      violationCount: (foundEmp.violationCount || 0) + 1,
      competencyScore: Math.max(0, (foundEmp.competencyScore || 100) - pointsDeduct),
    };

    onUpdateEmployee(updatedEmp);

    updateIncidentsState((prev) =>
      prev.map((item) => (item.id === inc.id ? { ...item, isSyncedToProfile: true } : item))
    );

    setSyncSuccessModal({
      count: 1,
      updatedNames: [foundEmp.fullName],
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Quy chuẩn */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {canManageViolations ? 'Đối soát Nhân sự Hệ thống' : 'Dữ liệu Đã Đồng Bộ & Cập Nhật Hệ Thống'}
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                Độc quyền Tổ RTG
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {canManageViolations
                ? 'Phân tích Sự cố & Vi phạm Lao động'
                : 'Thông tin Nhân viên Tổ RTG Vi phạm Đã Cập Nhật'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl leading-relaxed">
              {canManageViolations
                ? 'Tự động đối soát tên nhân viên trong hệ thống với file báo cáo Excel (Phụ lục 1 & 2), trích xuất chi tiết diễn biến, nguyên nhân và hiển thị đồng bộ hồ sơ nhân sự. Tuyệt đối không hiển thị các nội dung ngoài Tổ RTG (Cẩu khung).'
                : 'Cửa sổ theo dõi các sự cố, vi phạm quy trình vận hành và an toàn lao động của nhân viên Tổ RTG đã được thẩm định, phê duyệt và đồng bộ chính thức vào hệ thống hồ sơ năng lực cá nhân.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canManageViolations ? (
              <button
                id="btn-violations-action-hub"
                type="button"
                onClick={() => setIsActionHubOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-200" />
                <span>Tiện ích & Tác vụ</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold tracking-wide">
                  8
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFetchFromDataRtgSheet}
                disabled={isSyncingDataRtg}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                title="Tải lại dữ liệu mới nhất từ file Data_RTG (sheet TheoDoiViPham)"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingDataRtg ? 'animate-spin' : ''}`} />
                <span>{isSyncingDataRtg ? 'Đang đọc Data_RTG...' : 'Làm mới từ Data_RTG'}</span>
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
              title="Xuất bảng sự cố vi phạm ra file Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span>Xuất file Excel</span>
            </button>
          </div>
        </div>

        {/* Banner Đối soát thời gian thực - Dành cho Quản lý */}
        {canManageViolations ? (
          <div className="mt-6 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Bộ lọc Độc quyền Tổ RTG:</span>
                Loại bỏ 100% dòng dữ liệu của Tổ Đầu kéo, Xe nâng, Giao nhận, Kho... Chỉ giữ lại sự cố, vi phạm thuộc cẩu khung RTG.
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <UserCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Đối soát Nhân sự Tự động:</span>
                Đối soát theo Họ và tên nhân viên trong hệ thống (thông tin Tổ RTG / Cẩu khung hỗ trợ tăng độ chính xác).
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Đồng bộ Sheet TheoDoiViPham:</span>
                Tự động đồng bộ và tra cứu tức thì từ sheet TheoDoiViPham thuộc file Data_RTG.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <BookOpen className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Nguồn dữ liệu Chuẩn hóa:</span>
                Trích xuất trực tiếp từ file <strong className="text-white font-mono">Data_RTG</strong> (mục sheet <strong className="text-emerald-300">TheoDoiViPham</strong>).
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Mục đích Theo dõi:</span>
                Công khai, minh bạch các sự cố, vi phạm quy trình cẩu nhằm phổ biến kinh nghiệm và nâng cao an toàn bãi cảng.
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-100 block">Cập nhật Hồ sơ Năng lực:</span>
                Các vi phạm sau khi xử lý được liên kết vào hồ sơ năng lực cá nhân để phục vụ đánh giá KPI định kỳ.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data_RTG Sync Feedback Banner */}
      {dataRtgSyncMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold shadow-xs ${
            dataRtgSyncMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : dataRtgSyncMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={`w-5 h-5 shrink-0 ${
                dataRtgSyncMessage.type === 'success'
                  ? 'text-emerald-600'
                  : dataRtgSyncMessage.type === 'error'
                  ? 'text-rose-600'
                  : 'text-indigo-600'
              }`}
            />
            <div>
              <span>{dataRtgSyncMessage.text}</span>
              {dataRtgSyncMessage.detail && (
                <a
                  href={dataRtgSyncMessage.detail}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 underline text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 font-bold"
                >
                  <span>Mở Google Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setDataRtgSyncMessage(null)}
            className="text-xs opacity-60 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sheet Sync Feedback Banner (Webhook) */}
      {canManageViolations && sheetSyncResult && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold shadow-xs ${
            sheetSyncResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={`w-5 h-5 shrink-0 ${sheetSyncResult.success ? 'text-emerald-600' : 'text-rose-600'}`}
            />
            <span>{sheetSyncResult.message}</span>
          </div>
          <button
            onClick={() => setSheetSyncResult(null)}
            className="text-xs opacity-60 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Thẻ Trạng thái Đối soát & Thống kê */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Số vụ việc đối soát khớp / Tổng vụ việc Tổ RTG */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {canManageViolations ? 'Đã đối soát khớp RTG' : 'Tổng vụ việc Tổ RTG'}
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {incidents.filter((i) => i.isRtgRelated).length}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span>✓ {canManageViolations ? 'Khớp nhân sự hệ thống' : 'Ghi nhận trên Data_RTG'}</span>
          </div>
        </div>

        {/* Số dòng ngoài RTG (Quản lý) HOẶC Vụ việc của cá nhân tôi (Người xem) */}
        {canManageViolations ? (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã loại trừ (Ngoài RTG)</span>
              <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <Building2 className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-700 mt-2">
              {lastReconciliationStats.ignoredCount}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              Tổ Đầu kéo, Xe nâng, tổ khác...
            </div>
          </div>
        ) : (
          <div
            className={`p-5 rounded-2xl border shadow-xs transition-all ${
              myIncidents.length > 0
                ? 'bg-amber-50/50 border-amber-300'
                : 'bg-emerald-50/40 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Vụ việc của bạn ({currentUser.fullName.split(' ').pop()})
              </span>
              <span
                className={`p-2 rounded-xl ${
                  myIncidents.length > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <Users className="w-5 h-5" />
              </span>
            </div>
            <div
              className={`text-3xl font-extrabold mt-2 ${
                myIncidents.length > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {myIncidents.length}
            </div>
            <div className="text-xs mt-1 flex items-center justify-between">
              <span
                className={`font-semibold ${
                  myIncidents.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {myIncidents.length > 0 ? 'Cần chú ý an toàn' : '✓ Tuyệt đối an toàn'}
              </span>
              {myIncidents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setViewerFilterTab('MINE')}
                  className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer"
                >
                  Xem ngay
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sự cố nghiêm trọng */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sự cố nghiêm trọng</span>
            <span className="p-2 rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-red-600 mt-2">
            {incidents.filter((i) => i.isRtgRelated && i.severity === 'NGHIEM_TRONG').length}
          </div>
          <div className="text-xs text-red-500 font-medium mt-1">
            Va quẹt gầu cẩu / Lệch chốt twistlock
          </div>
        </div>

        {/* Nút hành động Đồng bộ tất cả (Dành cho Quản lý) hoặc Trạng thái Sheet Data_RTG (Dành cho Nhân viên) */}
        {canManageViolations ? (
          <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-indigo-50/30 to-white">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Hồ sơ Nhân sự</span>
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Sparkles className="w-5 h-5" />
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-2">
                Đồng bộ vi phạm vào hồ sơ nhân sự nội bộ hệ thống để tính điểm năng lực tháng & năm.
              </div>
            </div>
            <button
              onClick={handleSyncToEmployeeProfiles}
              className="w-full py-2.5 px-3 mt-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Đồng bộ vào Hồ sơ Nhân sự (Nội bộ)
            </button>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-emerald-50/30 to-white">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Nguồn Data_RTG</span>
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
              </div>
              <div className="text-xs text-slate-700 font-semibold mt-2">
                Sheet: <span className="font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">TheoDoiViPham</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Xem trước khi nhập báo cáo Google; xếp hàng khi xuất dữ liệu đã lưu.
              </div>
            </div>
            <button
              type="button"
              onClick={handleFetchFromDataRtgSheet}
              disabled={isSyncingDataRtg}
              className="w-full py-2 px-3 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDataRtg ? 'animate-spin' : ''}`} />
              <span>{isSyncingDataRtg ? 'Đang đọc...' : 'Tải lại dữ liệu mới'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Thông báo kết quả đối soát nếu có file - chỉ cho Quản lý */}
      {canManageViolations && lastReconciliationStats.totalScanned > 0 && (
        <div className="bg-indigo-50/80 border border-indigo-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-indigo-950 text-sm block">
                Kết quả đối soát nhân sự: {lastReconciliationStats.fileName}
              </span>
              <span className="text-indigo-800">
                Đã quét <strong>{lastReconciliationStats.totalScanned}</strong> dòng dữ liệu ➔ Trích xuất thành công <strong>{filteredIncidents.length}</strong> vụ việc thuộc Tổ RTG khớp nhân sự hệ thống. Tự động loại bỏ <strong>{lastReconciliationStats.ignoredCount}</strong> dòng ngoài Tổ RTG (Đầu kéo, Xe nâng...).
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              ✓ Sẵn sàng đồng bộ hồ sơ
            </span>
          </div>
        </div>
      )}

      {/* 3. Khu vực Tải file Excel hoặc Dán văn bản - CHỈ DÀNH CHO QUẢN LÝ */}
      {canManageViolations && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInputTab('EXCEL')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  inputTab === 'EXCEL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-200/70 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Tải file Excel báo cáo (Phụ lục 1 & 2)
              </button>
              <button
                onClick={() => setInputTab('TEXT')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  inputTab === 'TEXT'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-200/70 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Dán nội dung / Báo cáo văn bản
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              Tự động đối soát với danh sách {employees.length} nhân viên trong hệ thống
            </div>
          </div>

          <div className="p-6">
            {inputTab === 'EXCEL' ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-upload-input"
                />
                <label
                  htmlFor="excel-file-upload-input"
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-indigo-50/30 group"
                >
                  <div className="p-4 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 transition-colors">
                    <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">
                      Nhấp để chọn hoặc kéo thả file Excel báo cáo sự cố & vi phạm
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto">
                      Hệ thống sẽ tự động quét Phụ lục 1 (Sự cố) và Phụ lục 2 (Vi phạm nội quy), đối soát tên nhân sự hệ thống, lọc bỏ toàn bộ các tổ ngoài RTG và hiển thị kết quả đồng bộ.
                    </p>
                  </div>
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mt-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang đối soát nhân sự hệ thống và trích xuất dữ liệu...
                    </div>
                  )}
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                  placeholder="Dán nội dung báo cáo sự cố, bảng kiểm tra hoặc biên bản vi phạm tại đây... (Ví dụ: '08:30 ngày 05/03/2026 tại Block B04 cẩu RTG 02 do lái cẩu Phạm Ngọc Tuấn điều khiển va quẹt rơ moóc xe đầu kéo số 15 do thiếu quan sát...')"
                  rows={4}
                  className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none font-mono"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAnalyzeText}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isProcessing ? 'Đang đối soát...' : 'Đối soát & Trích xuất Dữ liệu'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Bộ lọc & Tìm kiếm Vụ việc */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Thanh tab nhanh dành cho Người xem (Viewer) */}
        {!canManageViolations && (
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Lọc nhanh:
            </span>
            <button
              type="button"
              onClick={() => setViewerFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewerFilterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Tất cả vụ việc ({incidents.filter((i) => i.isRtgRelated).length})
            </button>
            <button
              type="button"
              onClick={() => setViewerFilterTab('MINE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewerFilterTab === 'MINE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : myIncidents.length > 0
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Vụ việc của tôi</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  viewerFilterTab === 'MINE'
                    ? 'bg-white text-amber-700'
                    : myIncidents.length > 0
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {myIncidents.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewerFilterTab('SEVERE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewerFilterTab === 'SEVERE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Sự cố nghiêm trọng</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                {incidents.filter((i) => i.isRtgRelated && i.severity === 'NGHIEM_TRONG').length}
              </span>
            </button>
            {currentUser.department && (
              <button
                type="button"
                onClick={() => setViewerFilterTab('SHIFT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewerFilterTab === 'SHIFT'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Ca trực của tôi ({currentUser.department})
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên nhân viên, mã NV (NV-008), số cẩu (RTG 02), địa điểm, nội dung..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>

            {/* Bộ lọc Ca trực */}
            {!canManageViolations && (
              <select
                value={selectedShiftFilter}
                onChange={(e) => setSelectedShiftFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none bg-white cursor-pointer"
              >
                <option value="ALL">Tất cả ca trực</option>
                <option value="RTG ca 1">RTG ca 1</option>
                <option value="RTG ca 2">RTG ca 2</option>
                <option value="RTG ca 3">RTG ca 3</option>
              </select>
            )}

            {/* Bộ lọc Phụ lục nguồn */}
            {!canManageViolations && (
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none bg-white cursor-pointer hidden sm:block"
              >
                <option value="ALL">Mọi loại vụ việc</option>
                <option value="PHU_LUC_1">Phụ lục 1: Sự cố / Tai nạn</option>
                <option value="PHU_LUC_2">Phụ lục 2: Vi phạm nội quy</option>
              </select>
            )}

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 outline-none bg-white cursor-pointer"
            >
              <option value="ALL">Mọi mức độ</option>
              <option value="NGHIEM_TRONG">Nghiêm trọng (Va chạm)</option>
              <option value="TRUNG_BINH">Trung bình (Sai quy trình)</option>
              <option value="THAP">Thấp (Cảnh báo / Nhắc nhở)</option>
            </select>
          </div>

          {canManageViolations && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                {showRawMarkdown ? 'Ẩn xem trước Markdown' : 'Xem trước Bảng Markdown 8 cột'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Xem trước Markdown nếu bật (Chỉ quản trị viên) */}
      {canManageViolations && showRawMarkdown && (
        <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-slate-400 font-bold uppercase tracking-wider">
              Định dạng Bảng Markdown Đầu ra (Output 8 cột chuẩn):
            </span>
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              {copiedMd ? 'Đã sao chép!' : 'Sao chép nhanh'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{generateMarkdownTable(currentReport)}</pre>
        </div>
      )}

      {/* 5. Bảng Kết Quả Đối Soát & Đồng Bộ Hồ Sơ / Bảng Tra Cứu Vi Phạm */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              {canManageViolations
                ? `Bảng Đối Soát & Đồng Bộ Hồ Sơ Tổ RTG (${filteredIncidents.length} vụ việc)`
                : `Bảng Thông Tin Vi Phạm & Sự Cố Tổ RTG (Sheet TheoDoiViPham: ${filteredIncidents.length} vụ việc)`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canManageViolations
                ? 'Chỉ hiển thị các sự cố liên quan trực tiếp đến Tổ RTG (Cẩu khung) đã khớp với nhân sự hệ thống.'
                : 'Dữ liệu được trích xuất và đồng bộ từ file Data_RTG (mục sheet TheoDoiViPham) để phổ biến kinh nghiệm an toàn.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManageViolations ? (
              <button
                type="button"
                onClick={() => setIsActionHubOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Layers className="w-4 h-4 text-indigo-200" />
                <span>Tiện ích & Tác vụ</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đồng bộ Data_RTG
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-3.5 whitespace-nowrap">Mã vụ việc</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Địa điểm</th>
                <th className="py-3 px-3.5 min-w-[200px]">Nhân viên vi phạm</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Đơn vị / Chức danh</th>
                <th className="py-3 px-4 min-w-[220px]">Mô tả Vi phạm / Hậu quả</th>
                <th className="py-3 px-4 min-w-[180px]">Nguyên nhân</th>
                <th className="py-3 px-4 min-w-[180px]">Biện pháp xử lý</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">
                  {canManageViolations ? 'Đồng bộ hồ sơ' : 'Mức độ'}
                </th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Không tìm thấy sự cố hoặc vi phạm nào thuộc Tổ RTG khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((item, idx) => {
                  const isMine = myIncidents.some((m) => m.id === item.id);
                  return (
                    <tr
                      key={item.id || idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isMine
                          ? 'bg-amber-50/40 border-l-4 border-l-amber-500 ring-1 ring-amber-300/40'
                          : item.severity === 'NGHIEM_TRONG'
                          ? 'bg-red-50/20'
                          : ''
                      }`}
                    >
                      {/* Mã vụ việc */}
                      <td className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                          {item.code}
                        </span>
                      </td>

                      {/* Thời gian (When) */}
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                        {item.time}
                      </td>

                      {/* Địa điểm (Where) */}
                      <td className="py-3 px-3.5 text-slate-700 font-medium">
                        {item.location}
                      </td>

                      {/* Nhân viên vi phạm (Who) - ĐỐI SOÁT HỆ THỐNG */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          {item.matchedAvatar ? (
                            <img
                              src={item.matchedAvatar}
                              alt={item.violatorName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-indigo-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {item.violatorName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{item.violatorName}</span>
                              {isMine && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] tracking-wide inline-flex items-center gap-1 shadow-xs">
                                  Bạn
                                </span>
                              )}
                              {item.equipment && (
                                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                                  {item.equipment}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.matchedEmployeeCode && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                                  {item.matchedEmployeeCode}
                                </span>
                              )}
                              {item.isMatchedWithSystem ? (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/60">
                                  ✓ Khớp hệ thống
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/60">
                                  ⚠ Nhận diện từ diễn biến
                                </span>
                              )}
                            </div>

                            {item.originalName && item.originalName !== item.violatorName && (
                              <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                (Tên trong file: {item.originalName} ➔ Chuẩn hóa)
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Đơn vị / Chức danh */}
                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.matchedDepartment || item.department}
                        </span>
                      </td>

                      {/* Mô tả Vi phạm/Hậu quả (What) */}
                      <td className="py-3 px-4 text-slate-800">
                        <div className="line-clamp-2 font-medium" title={item.what}>
                          {item.what}
                        </div>
                        {item.severity === 'NGHIEM_TRONG' && (
                          <span className="inline-block mt-1 px-1.5 py-0.2 rounded-sm bg-red-100 text-red-700 text-[10px] font-bold">
                            Sự cố nghiêm trọng
                          </span>
                        )}
                      </td>

                      {/* Nguyên nhân (Why) */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="line-clamp-2" title={item.why}>
                          {item.why}
                        </div>
                      </td>

                      {/* Biện pháp xử lý (How) */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        <div className="line-clamp-2" title={item.how}>
                          {item.how}
                        </div>
                      </td>

                      {/* Trạng thái Đồng bộ hồ sơ (Quản lý) HOẶC Mức độ (Người xem) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {canManageViolations ? (
                          item.isSyncedToProfile ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Đã lưu hồ sơ
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncSingleIncident(item)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Đồng bộ vụ việc này vào hồ sơ nhân sự"
                            >
                              Đồng bộ ngay
                            </button>
                          )
                        ) : (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              item.severity === 'NGHIEM_TRONG'
                                ? 'bg-red-100 text-red-800'
                                : item.severity === 'TRUNG_BINH'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.severity === 'NGHIEM_TRONG'
                              ? 'Nghiêm trọng'
                              : item.severity === 'TRUNG_BINH'
                              ? 'Trung bình'
                              : 'Nhắc nhở'}
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedIncidentForDetail(item)}
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="Xem chi tiết vụ việc (5W1H)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManageViolations && (
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa vụ việc ${item.code}?`)) {
                                updateIncidentsState((prev) => prev.filter((p) => p.id !== item.id));
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer ml-1"
                            title="Xóa vụ việc"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Phổ biến Quy định An toàn & Tóm tắt sau bảng */}
      {!canManageViolations && (
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-md border border-indigo-900/50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/60 text-indigo-200">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">
                  Phổ Biến An Toàn Vận Hành & Đồng Bộ File Data_RTG (Sheet TheoDoiViPham)
                </h4>
                <p className="text-xs text-indigo-200/80">
                  Dữ liệu vi phạm và sự cố được trích xuất minh bạch để toàn bộ nhân viên Tổ RTG rút kinh nghiệm
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFetchFromDataRtgSheet}
              disabled={isSyncingDataRtg}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDataRtg ? 'animate-spin' : ''}`} />
              <span>{isSyncingDataRtg ? 'Đang đồng bộ...' : 'Đồng bộ từ Data_RTG'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <span className="font-bold text-amber-300 block flex items-center gap-1.5">
                <span>1. Tín hiệu Chốt Twistlock</span>
              </span>
              <p className="text-slate-300 leading-relaxed">
                Tuyệt đối không nhấc container khi đèn tín hiệu spreader chưa hiển thị xanh đủ 4 góc. Luôn kiểm tra khóa cơ và tải trọng trước khi di chuyển xe con.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <span className="font-bold text-emerald-300 block flex items-center gap-1.5">
                <span>2. Cự ly An toàn Đầu kéo</span>
              </span>
              <p className="text-slate-300 leading-relaxed">
                Duy trì cự ly tối thiểu 3m với cabin xe đầu kéo. Chỉ hạ container khi tài xế xe đã rời khỏi cabin hoặc đã dừng xe hoàn toàn tại vị trí an toàn.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <span className="font-bold text-indigo-300 block flex items-center gap-1.5">
                <span>3. Dừng đỗ & Rời Cabin Cẩu</span>
              </span>
              <p className="text-slate-300 leading-relaxed">
                Khi dừng ca hoặc tạm rời buồng lái: hạ spreader xuống sàn/dầm an toàn, kéo phanh tay, cài chốt chống bão/chêm bánh và ngắt attomat tổng.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 border-t border-white/10">
            <span>
              ℹ Nhân viên có thắc mắc hoặc yêu cầu phúc tra thông tin vi phạm vui lòng liên hệ Ban Quản đốc hoặc Tổ trưởng Ca trực RTG.
            </span>
            <span className="font-mono text-indigo-300">
              Nguồn: Data_RTG.xlsx ➔ Sheet: TheoDoiViPham
            </span>
          </div>
        </div>
      )}

      {/* Tóm tắt sau bảng: Danh sách nhân viên Tổ RTG vi phạm nhiều lần hoặc Sự cố nghiêm trọng */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Danh sách Nhân viên Tổ RTG Vi phạm nhiều lần hoặc Sự cố nghiêm trọng
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            (Căn cứ đối soát và quản lý nhân sự Tổ RTG)
          </span>
        </div>

        <div className="mt-4">
          {currentReport.repeatViolators.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Không ghi nhận nhân viên Tổ RTG nào vi phạm từ 2 lần trở lên hoặc gây sự cố nghiêm trọng trong kỳ.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentReport.repeatViolators.map((v, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{v.name}</span>
                      {v.employeeCode && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
                          {v.employeeCode}
                        </span>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold text-xs">
                      {v.count} vụ việc
                    </span>
                  </div>

                  {v.department && (
                    <div className="text-xs text-slate-500">
                      Đơn vị: <span className="font-semibold text-slate-700">{v.department}</span>
                    </div>
                  )}

                  {v.equipment && (
                    <div className="text-xs text-slate-500">
                      Thiết bị cẩu: <span className="font-mono font-bold text-indigo-700">{v.equipment}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Chi tiết Vụ việc */}
      {selectedIncidentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs font-mono">
                  {selectedIncidentForDetail.code}
                </span>
                <h3 className="font-bold text-slate-900 text-base">Chi tiết Sự cố / Vi phạm Lao động</h3>
              </div>
              <button
                onClick={() => setSelectedIncidentForDetail(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block mb-0.5 font-medium">Thời gian:</span>
                  <span className="font-bold text-slate-800">{selectedIncidentForDetail.time}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block mb-0.5 font-medium">Địa điểm:</span>
                  <span className="font-bold text-slate-800">{selectedIncidentForDetail.location}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5 font-medium">Nhân viên vi phạm - Hồ sơ hệ thống:</span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{selectedIncidentForDetail.violatorName}</span>
                  {selectedIncidentForDetail.matchedEmployeeCode && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono text-xs">
                      {selectedIncidentForDetail.matchedEmployeeCode}
                    </span>
                  )}
                  {selectedIncidentForDetail.equipment && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-mono">
                      {selectedIncidentForDetail.equipment}
                    </span>
                  )}
                </div>
                {selectedIncidentForDetail.originalName && selectedIncidentForDetail.originalName !== selectedIncidentForDetail.violatorName && (
                  <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
                    (Tên trong file gốc: {selectedIncidentForDetail.originalName})
                  </span>
                )}
                {selectedIncidentForDetail.matchedDepartment && (
                  <span className="text-slate-600 text-xs block mt-1">
                    Đơn vị: {selectedIncidentForDetail.matchedDepartment}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5 font-medium">Mô tả Vi phạm / Hậu quả:</span>
                <p className="text-slate-800 font-medium leading-relaxed">{selectedIncidentForDetail.what}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5 font-medium">Nguyên nhân cốt lõi:</span>
                <p className="text-slate-800 leading-relaxed">{selectedIncidentForDetail.why}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5 font-medium">Biện pháp xử lý / Trách nhiệm:</span>
                <p className="text-slate-800 font-semibold text-rose-700 leading-relaxed">{selectedIncidentForDetail.how}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                {canManageViolations && !selectedIncidentForDetail.isSyncedToProfile ? (
                  <button
                    onClick={() => {
                      handleSyncSingleIncident(selectedIncidentForDetail);
                      setSelectedIncidentForDetail(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Đồng bộ vào Hồ sơ Nhân sự
                  </button>
                ) : (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Đã đồng bộ & cập nhật vào hồ sơ năng lực nhân sự
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedIncidentForDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thông báo Đồng bộ Thành công */}
      {syncSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Đồng bộ Hồ sơ Thành công!</h3>
              <p className="text-xs text-slate-600 mt-1">
                Đã ghi nhận <strong>{syncSuccessModal.count}</strong> lỗi vi phạm và cập nhật điểm hồ sơ năng lực cho:
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-36 overflow-y-auto text-xs text-left font-medium text-slate-800 space-y-1">
              {syncSuccessModal.updatedNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{name}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSyncSuccessModal(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}

      {/* Modal Cấu hình Webhook Google Sheet - Chỉ dành cho Quản lý */}
      {canManageViolations && showConfigDataRtgModal && <GoogleReportDialog module="incidents" onClose={() => setShowConfigDataRtgModal(false)} />}{canManageViolations && showConfigSheetModal && <GoogleReportDialog module="incidents" onClose={() => setShowConfigSheetModal(false)} />}

      {/* MODAL TRUNG TÂM TIỆN ÍCH & TÁC VỤ DỮ LIỆU SỰ CỐ / VI PHẠM TỔ RTG */}
      {isActionHubOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    Tiện Ích & Tác Vụ Dữ Liệu Sự Cố
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trung tâm điều phối nạp, đồng bộ, đối soát và xuất dữ liệu Tổ RTG
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActionHubOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Danh sách các tác vụ tiện ích */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
              {/* 1. Đồng Bộ Data_RTG (Sheet TheoDoiViPham) */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleSyncToDataRtgSheet();
                }}
                disabled={isSyncingDataRtg}
                className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-500 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className={`w-4 h-4 ${isSyncingDataRtg ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-800">
                      1. Gửi Lên Sheet TheoDoiViPham
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-mono">
                      Data_RTG
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Gửi toàn bộ danh sách vụ việc Tổ RTG lên sheet TheoDoiViPham của file Data_RTG.
                  </p>
                </div>
              </button>

              {/* 2. Đọc lại từ Sheet TheoDoiViPham */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleFetchFromDataRtgSheet();
                }}
                disabled={isSyncingDataRtg}
                className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 hover:border-indigo-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <RefreshCw className={`w-4 h-4 ${isSyncingDataRtg ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-800">
                      2. Đọc Từ Sheet TheoDoiViPham
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 font-mono">
                      Data_RTG
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Xem trước báo cáo VIOLATIONS và xác nhận trước khi nhập dữ liệu.
                  </p>
                </div>
              </button>

              {/* 3. Đồng Bộ Vào Hồ Sơ Nhân Sự */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleSyncToEmployeeProfiles();
                }}
                className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 hover:border-indigo-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-800">
                      3. Đồng Bộ Vào Hồ Sơ
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-200/80 text-indigo-900">
                      KPI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Ghi nhận vi phạm trực tiếp vào hồ sơ nhân sự Tổ RTG và khấu trừ điểm năng lực.
                  </p>
                </div>
              </button>

              {/* 4. Nạp Dữ Liệu Mẫu RTG */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleLoadSample();
                }}
                className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-amber-200 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-amber-800">
                      4. Nạp Dữ Liệu Mẫu RTG
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                      Demo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Nạp dữ liệu mẫu gồm cả vụ việc Tổ RTG và tổ khác để kiểm tra tính năng lọc đối soát.
                  </p>
                </div>
              </button>

              {/* 5. Sao Chép Bảng Markdown (8 cột) */}
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 hover:border-blue-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-blue-200 group-hover:scale-105 transition-transform">
                  {copiedMd ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-800">
                      5. Sao Chép Markdown
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200/80 text-blue-900 font-mono">
                      8 Cột
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {copiedMd ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép bảng Markdown 8 cột chuẩn 5W1H để gửi báo cáo.'}
                  </p>
                </div>
              </button>

              {/* 6. Sao Chép Cho Excel (TSV) */}
              <button
                type="button"
                onClick={handleCopyExcel}
                className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/70 hover:border-teal-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-teal-200 group-hover:scale-105 transition-transform">
                  {copiedExcel ? <Check className="w-4 h-4 text-emerald-300" /> : <FileSpreadsheet className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-teal-800">
                      6. Sao Chép Cho Excel
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-200/80 text-teal-900 font-mono">
                      TSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {copiedExcel ? 'Đã sao chép! Bạn có thể dán vào Excel.' : 'Sao chép dữ liệu dạng bảng để dán trực tiếp vào file Excel.'}
                  </p>
                </div>
              </button>

              {/* 7. Xuất Báo Cáo Excel (.xlsx) */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleExportExcel();
                }}
                className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-800">
                      7. Xuất File Excel (.xlsx)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-mono">
                      .xlsx
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Tải về file bảng tính Excel đầy đủ 8 cột đối soát sự cố và phân loại vi phạm.
                  </p>
                </div>
              </button>

              {/* 8. Webhook Google Apps Script */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleSyncToGoogleSheet();
                }}
                disabled={isSyncingSheet}
                className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-slate-800">
                      8. Xếp hàng báo cáo Google
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono">
                      Queue
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Đưa dữ liệu vi phạm đã lưu vào hàng đợi báo cáo; theo dõi kết quả tại Google Sync.
                  </p>
                </div>
              </button>

              {/* 7. Xóa Toàn Bộ Danh Sách Vụ Việc */}
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  handleClearIncidents();
                }}
                className="sm:col-span-2 p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 hover:border-rose-400 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-rose-200 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-rose-800">
                      7. Xóa Toàn Bộ Danh Sách Vụ Việc
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900">
                      Làm mới
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Xóa sạch dữ liệu các vụ việc hiện tại để sẵn sàng tải lên file báo cáo kỳ mới.
                  </p>
                </div>
              </button>
            </div>

            {/* Footer Modal */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setIsActionHubOpen(false);
                  setShowConfigSheetModal(true);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Nhập & xuất báo cáo Google</span>
              </button>
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
    </div>
  );
};


