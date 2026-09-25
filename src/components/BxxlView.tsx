import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
  Filter,
  History,
  Layers,
  Printer,
  Search,
  SlidersHorizontal,
  UserCheck,
  Users,
  AlertCircle,
  Clock,
  Sparkles,
  Eye,
  Trash2,
  ArrowRight,
  HelpCircle,
  FileSpreadsheet,
  Building,
} from 'lucide-react';
import { Employee, BxxlRecord, BxxlEmployeeItem, EmployeeMonthlyEvaluation } from '../types';
import { exportBxxlToWord, printBxxlDocument, toRomanNumeral, formatCountDoc } from '../services/bxxlWordExport';

export type BxxlStepKey = 'info' | 'A' | 'B' | 'b' | 'C' | 'GPT' | 'preview';

interface BxxlViewProps {
  employees: Employee[];
  currentUser: Employee;
  bxxlRecords: BxxlRecord[];
  onSaveBxxlRecord: (record: BxxlRecord, updatedEmployees: Employee[]) => Promise<void>;
  onDeleteBxxlRecord?: (recordId: string) => Promise<void>;
  onBackToDashboard: () => void;
}

export const BxxlView: React.FC<BxxlViewProps> = ({
  employees,
  currentUser,
  bxxlRecords,
  onSaveBxxlRecord,
  onDeleteBxxlRecord,
  onBackToDashboard,
}) => {
  // Navigation tabs: 'create' (wizard) | 'history' (view previous minutes) | 'summary' (matrix of ratings)
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'history' | 'summary'>('create');

  // STEP 1 STATE: Document metadata
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  // Previous month is usually what is being evaluated (e.g. evaluating March in April)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultEvalMonthStr = `${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}/${prevMonthDate.getFullYear()}`;

  const [companyName, setCompanyName] = useState('CÔNG TY TNHH CẢNG CONTAINER\nQUỐC TẾ TÂN CẢNG HẢI PHÒNG');
  const [departmentName, setDepartmentName] = useState('ĐỘI CƠ GIỚI');
  const [groupName, setGroupName] = useState('(Tổ RTG)');
  const [evaluationMonth, setEvaluationMonth] = useState(defaultEvalMonthStr);
  const [createdCity, setCreatedCity] = useState('Hải Phòng');
  const [createdDate, setCreatedDate] = useState(String(now.getDate()).padStart(2, '0'));
  const [createdMonth, setCreatedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [createdYear, setCreatedYear] = useState(String(now.getFullYear()));

  // Category selections in Step 1: which ratings to include in this month's evaluation
  const [selectedCategories, setSelectedCategories] = useState<('A' | 'B' | 'b' | 'C')[]>(['A', 'B', 'b', 'C']);
  const [includeGpt, setIncludeGpt] = useState<boolean>(true);
  const [showSmallAListModal, setShowSmallAListModal] = useState<boolean>(false);
  const [generalNote, setGeneralNote] = useState<string>(
    '- Các nội dung bình xét khác Tổ RTG xin nhất trí theo đánh giá của BCH Đội Cơ Giới'
  );

  // STEP 2 - 6: Lists of selected employees
  const [listA, setListA] = useState<BxxlEmployeeItem[]>([]);
  const [listB, setListB] = useState<BxxlEmployeeItem[]>([]);
  const [listSmallB, setListSmallB] = useState<BxxlEmployeeItem[]>([]);
  const [listC, setListC] = useState<BxxlEmployeeItem[]>([]);
  const [listGpt, setListGpt] = useState<BxxlEmployeeItem[]>([]);

  // QUY TẮC MẶC ĐỊNH BÌNH XÉT XẾP LOẠI (Yêu cầu hệ thống):
  // "các nhân viên không được đánh A, B, b, C (dù có lý do hay không có lý do), thì mặc định là được a"
  const listSmallA = useMemo<BxxlEmployeeItem[]>(() => {
    const evaluatedIdSet = new Set<string>();
    listA.forEach((e) => evaluatedIdSet.add(e.employeeId));
    listB.forEach((e) => evaluatedIdSet.add(e.employeeId));
    listSmallB.forEach((e) => evaluatedIdSet.add(e.employeeId));
    listC.forEach((e) => evaluatedIdSet.add(e.employeeId));

    return employees
      .filter((emp) => !evaluatedIdSet.has(emp.id))
      .map((emp) => ({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.department,
        shift: emp.shift,
        position: emp.position,
        reason: 'Mặc định xếp loại a (Hoàn thành tốt nhiệm vụ)',
      }));
  }, [employees, listA, listB, listSmallB, listC]);

  // Wizard active steps dynamically computed based on Step 1 selection:
  // "ở bước 1 khi đã chọn các mục để đánh giá, thì các mục không được chọn sẽ không cần hiển thị ở các bước sau, rút ngắn thao tác"
  const activeSteps = useMemo(() => {
    const list: {
      key: BxxlStepKey;
      title: string;
      subtitle: string;
      categoryCode?: 'A' | 'B' | 'b' | 'C' | 'GPT';
    }[] = [
      { key: 'info', title: 'Thông tin biên bản', subtitle: 'Thời gian & mục bình xét' },
    ];

    if (selectedCategories.includes('A')) {
      list.push({
        key: 'A',
        title: 'Xếp loại “A”',
        subtitle: 'Chọn những nhân viên đạt mức xếp loại A trong tháng.',
        categoryCode: 'A',
      });
    }
    if (selectedCategories.includes('B')) {
      list.push({
        key: 'B',
        title: 'Xếp loại “B”',
        subtitle: 'Chọn nhân viên xếp loại B và nhập lý do cụ thể.',
        categoryCode: 'B',
      });
    }
    if (selectedCategories.includes('b')) {
      list.push({
        key: 'b',
        title: 'Xếp loại “b”',
        subtitle: 'Chọn nhân viên xếp loại b và nhập lý do cụ thể.',
        categoryCode: 'b',
      });
    }
    if (selectedCategories.includes('C')) {
      list.push({
        key: 'C',
        title: 'Xếp loại “C”',
        subtitle: 'Chọn nhân viên xếp loại C và nhập lý do cụ thể.',
        categoryCode: 'C',
      });
    }
    if (includeGpt) {
      list.push({
        key: 'GPT',
        title: 'Đề xuất GPT',
        subtitle: 'Chọn nhân viên đề xuất GPT (Giải phóng tàu).',
        categoryCode: 'GPT',
      });
    }

    list.push({
      key: 'preview',
      title: 'Xem trước & Xuất Word',
      subtitle: 'Kiểm tra quy cách A4 hành chính và xuất file văn bản.',
    });

    return list;
  }, [selectedCategories, includeGpt]);

  const [currentStepKey, setCurrentStepKey] = useState<BxxlStepKey>('info');

  const currentStepIndex = useMemo(() => {
    const idx = activeSteps.findIndex((s) => s.key === currentStepKey);
    return idx >= 0 ? idx : 0;
  }, [activeSteps, currentStepKey]);

  // Keep currentStepKey valid when categories change
  useEffect(() => {
    if (!activeSteps.some((s) => s.key === currentStepKey)) {
      const fallback = activeSteps[Math.min(currentStepIndex, activeSteps.length - 1)]?.key || 'info';
      setCurrentStepKey(fallback);
    }
  }, [activeSteps, currentStepKey, currentStepIndex]);

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepKey(activeSteps[currentStepIndex - 1].key);
    }
  };

  const goToNextStep = () => {
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepKey(activeSteps[currentStepIndex + 1].key);
    }
  };

  // Toggle category in Step 1: clear data if unchecked
  const handleToggleCategory = (cat: 'A' | 'B' | 'b' | 'C', checked: boolean) => {
    if (checked) {
      setSelectedCategories((prev) => (prev.includes(cat) ? prev : [...prev, cat]));
    } else {
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
      if (cat === 'A') setListA([]);
      if (cat === 'B') setListB([]);
      if (cat === 'b') setListSmallB([]);
      if (cat === 'C') setListC([]);
    }
  };

  const handleToggleGpt = (checked: boolean) => {
    setIncludeGpt(checked);
    if (!checked) setListGpt([]);
  };

  // Split company lines cleanly according to user requirement:
  // "CÔNG TY TNHH CẢNG CONTAINER " ở 1 dòng. Và dòng dưới đây là "QUỐC TẾ TÂN CẢNG HẢI PHÒNG "
  const companyLines = useMemo(() => {
    const raw = companyName?.trim() || 'CÔNG TY TNHH CẢNG CONTAINER\nQUỐC TẾ TÂN CẢNG HẢI PHÒNG';
    if (raw.includes('\n')) {
      return raw.split('\n').map((l) => l.trim()).filter(Boolean);
    }
    if (raw.includes('CẢNG CONTAINER') && raw.includes('TÂN CẢNG HẢI PHÒNG')) {
      return ['CÔNG TY TNHH CẢNG CONTAINER', 'QUỐC TẾ TÂN CẢNG HẢI PHÒNG'];
    }
    return [raw];
  }, [companyName]);

  // Search and Filter per step
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');

  // History detail modal
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<BxxlRecord | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Extract all distinct shifts / departments from employees
  const shiftOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.shift) set.add(emp.shift);
      if (emp.department) {
        if (emp.department.toLowerCase().includes('ca 1')) set.add('Ca 1');
        else if (emp.department.toLowerCase().includes('ca 2')) set.add('Ca 2');
        else if (emp.department.toLowerCase().includes('ca 3')) set.add('Ca 3');
        else if (emp.department.toLowerCase().includes('ca 4')) set.add('Ca 4');
        else set.add(emp.department);
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  // Helper to determine if an employee matches selectedShift
  const matchesShift = (emp: Employee, shift: string): boolean => {
    if (shift === 'ALL') return true;
    if (emp.shift && emp.shift.toLowerCase() === shift.toLowerCase()) return true;
    if (emp.department && emp.department.toLowerCase().includes(shift.toLowerCase())) return true;
    return false;
  };

  // MUTUAL EXCLUSION RULES:
  // "Đã chọn nhân viên ở bước này thì không xuất hiện ở bước khác."
  // Step A: excluded = listB + listSmallB + listC
  // Step B: excluded = listA + listSmallB + listC
  // Step b: excluded = listA + listB + listC
  // Step C: excluded = listA + listB + listSmallB
  // Step GPT: "Riêng GPT thì không hiện các nhân viên B, b và C" -> excluded = listB + listSmallB + listC

  const excludedIdsForStep = useMemo(() => {
    const map = new Set<string>();
    if (currentStepKey === 'A') {
      listB.forEach((e) => map.add(e.employeeId));
      listSmallB.forEach((e) => map.add(e.employeeId));
      listC.forEach((e) => map.add(e.employeeId));
    } else if (currentStepKey === 'B') {
      listA.forEach((e) => map.add(e.employeeId));
      listSmallB.forEach((e) => map.add(e.employeeId));
      listC.forEach((e) => map.add(e.employeeId));
    } else if (currentStepKey === 'b') {
      listA.forEach((e) => map.add(e.employeeId));
      listB.forEach((e) => map.add(e.employeeId));
      listC.forEach((e) => map.add(e.employeeId));
    } else if (currentStepKey === 'C') {
      listA.forEach((e) => map.add(e.employeeId));
      listB.forEach((e) => map.add(e.employeeId));
      listSmallB.forEach((e) => map.add(e.employeeId));
    } else if (currentStepKey === 'GPT') {
      listB.forEach((e) => map.add(e.employeeId));
      listSmallB.forEach((e) => map.add(e.employeeId));
      listC.forEach((e) => map.add(e.employeeId));
    }
    return map;
  }, [currentStepKey, listA, listB, listSmallB, listC]);

  // Candidates for the current step (filtered by search, shift, and exclusion)
  const candidateEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Check exclusion
      if (excludedIdsForStep.has(emp.id)) return false;
      // Check shift
      if (!matchesShift(emp, selectedShift)) return false;
      // Check search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.employeeCode.toLowerCase().includes(q);
        const matchDept = emp.department.toLowerCase().includes(q);
        const matchPos = emp.position.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchPos) return false;
      }
      return true;
    });
  }, [employees, excludedIdsForStep, selectedShift, searchQuery]);

  // Handler to toggle an employee in the current step list
  const handleToggleEmployeeInCurrentStep = (emp: Employee) => {
    const baseItem: BxxlEmployeeItem = {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      department: emp.department,
      shift: emp.shift,
      position: emp.position,
      reason: '',
    };

    if (currentStepKey === 'A') {
      setListA((prev) =>
        prev.some((e) => e.employeeId === emp.id)
          ? prev.filter((e) => e.employeeId !== emp.id)
          : [...prev, baseItem]
      );
    } else if (currentStepKey === 'B') {
      setListB((prev) =>
        prev.some((e) => e.employeeId === emp.id)
          ? prev.filter((e) => e.employeeId !== emp.id)
          : [...prev, baseItem]
      );
    } else if (currentStepKey === 'b') {
      setListSmallB((prev) =>
        prev.some((e) => e.employeeId === emp.id)
          ? prev.filter((e) => e.employeeId !== emp.id)
          : [...prev, baseItem]
      );
    } else if (currentStepKey === 'C') {
      setListC((prev) =>
        prev.some((e) => e.employeeId === emp.id)
          ? prev.filter((e) => e.employeeId !== emp.id)
          : [...prev, baseItem]
      );
    } else if (currentStepKey === 'GPT') {
      setListGpt((prev) =>
        prev.some((e) => e.employeeId === emp.id)
          ? prev.filter((e) => e.employeeId !== emp.id)
          : [...prev, baseItem]
      );
    }
  };

  // Handler to update reason for B, b, C
  const handleUpdateReason = (
    stepKey: 'B' | 'b' | 'C',
    employeeId: string,
    reason: string
  ) => {
    if (stepKey === 'B') {
      setListB((prev) =>
        prev.map((item) => (item.employeeId === employeeId ? { ...item, reason } : item))
      );
    } else if (stepKey === 'b') {
      setListSmallB((prev) =>
        prev.map((item) => (item.employeeId === employeeId ? { ...item, reason } : item))
      );
    } else if (stepKey === 'C') {
      setListC((prev) =>
        prev.map((item) => (item.employeeId === employeeId ? { ...item, reason } : item))
      );
    }
  };

  // Quick select/deselect visible
  const handleSelectAllVisible = () => {
    candidateEmployees.forEach((emp) => {
      const baseItem: BxxlEmployeeItem = {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.department,
        shift: emp.shift,
        position: emp.position,
        reason: '',
      };
      if (currentStepKey === 'A') {
        setListA((prev) =>
          prev.some((e) => e.employeeId === emp.id) ? prev : [...prev, baseItem]
        );
      } else if (currentStepKey === 'GPT') {
        setListGpt((prev) =>
          prev.some((e) => e.employeeId === emp.id) ? prev : [...prev, baseItem]
        );
      }
    });
  };

  const handleClearCurrentStepList = () => {
    if (currentStepKey === 'A') setListA([]);
    if (currentStepKey === 'B') setListB([]);
    if (currentStepKey === 'b') setListSmallB([]);
    if (currentStepKey === 'C') setListC([]);
    if (currentStepKey === 'GPT') setListGpt([]);
  };

  // Compile full BxxlRecord object from current state
  const compiledCurrentRecord: BxxlRecord = useMemo(() => {
    return {
      id: `bxxl-${Date.now()}`,
      companyName,
      departmentName,
      groupName,
      evaluationMonth,
      createdCity,
      createdDate,
      createdMonth,
      createdYear,
      selectedCategories,
      includeGpt,
      includeDefaultSmallAInDoc: false,
      generalNote,
      listA,
      listSmallA,
      listB,
      listSmallB,
      listC,
      listGpt,
      totalEvaluated: employees.length,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.id || 'admin',
      creatorName: currentUser?.fullName || 'Quản trị viên',
    };
  }, [
    companyName,
    departmentName,
    groupName,
    evaluationMonth,
    createdCity,
    createdDate,
    createdMonth,
    createdYear,
    selectedCategories,
    includeGpt,
    generalNote,
    listA,
    listSmallA,
    listB,
    listSmallB,
    listC,
    listGpt,
    employees.length,
    currentUser,
  ]);

  // Save to PostgreSQL and update each employee.
  const handleSaveAndExport = async () => {
    setIsSaving(true);
    try {
      const record = compiledCurrentRecord;

      const gptIdSet = new Set(listGpt.map((g) => g.employeeId));

      const updatedEmployeesMap = new Map<string, Employee>();
      employees.forEach((e) => updatedEmployeesMap.set(e.id, { ...e }));

      const evalDate = `${createdDate}/${createdMonth}/${createdYear}`;

      // 1. Process list A
      listA.forEach((item) => {
        const emp = updatedEmployeesMap.get(item.employeeId);
        if (emp) {
          const evalItem: EmployeeMonthlyEvaluation = {
            month: evaluationMonth,
            rating: 'A',
            isGpt: gptIdSet.has(item.employeeId),
            date: evalDate,
            recordId: record.id,
            updatedAt: new Date().toISOString(),
          };
          const existingEvals = (emp.monthlyEvaluations || []).filter(
            (ev) => ev.month !== evaluationMonth
          );
          emp.monthlyEvaluations = [evalItem, ...existingEvals];
        }
      });

      // 2. Process list B - Đồng bộ vào hồ sơ nhân viên kể cả khi chưa có lý do
      listB.forEach((item) => {
        const emp = updatedEmployeesMap.get(item.employeeId);
        if (emp) {
          const evalItem: EmployeeMonthlyEvaluation = {
            month: evaluationMonth,
            rating: 'B',
            reason: item.reason?.trim() || undefined,
            isGpt: false,
            date: evalDate,
            recordId: record.id,
            updatedAt: new Date().toISOString(),
          };
          const existingEvals = (emp.monthlyEvaluations || []).filter(
            (ev) => ev.month !== evaluationMonth
          );
          emp.monthlyEvaluations = [evalItem, ...existingEvals];
        }
      });

      // 3. Process list b - Đồng bộ vào hồ sơ nhân viên kể cả khi chưa có lý do
      listSmallB.forEach((item) => {
        const emp = updatedEmployeesMap.get(item.employeeId);
        if (emp) {
          const evalItem: EmployeeMonthlyEvaluation = {
            month: evaluationMonth,
            rating: 'b',
            reason: item.reason?.trim() || undefined,
            isGpt: false,
            date: evalDate,
            recordId: record.id,
            updatedAt: new Date().toISOString(),
          };
          const existingEvals = (emp.monthlyEvaluations || []).filter(
            (ev) => ev.month !== evaluationMonth
          );
          emp.monthlyEvaluations = [evalItem, ...existingEvals];
        }
      });

      // 4. Process list C - Đồng bộ vào hồ sơ nhân viên kể cả khi chưa có lý do
      listC.forEach((item) => {
        const emp = updatedEmployeesMap.get(item.employeeId);
        if (emp) {
          const evalItem: EmployeeMonthlyEvaluation = {
            month: evaluationMonth,
            rating: 'C',
            reason: item.reason?.trim() || undefined,
            isGpt: false,
            date: evalDate,
            recordId: record.id,
            updatedAt: new Date().toISOString(),
          };
          const existingEvals = (emp.monthlyEvaluations || []).filter(
            (ev) => ev.month !== evaluationMonth
          );
          emp.monthlyEvaluations = [evalItem, ...existingEvals];
        }
      });

      // 5. QUY TẮC MẶC ĐỊNH BÌNH XÉT XẾP LOẠI (Yêu cầu hệ thống):
      // "các nhân viên không được đánh A, B, b, C (dù có lý do hay không có lý do), thì mặc định là được a"
      const evaluatedIdSet = new Set<string>();
      listA.forEach((e) => evaluatedIdSet.add(e.employeeId));
      listB.forEach((e) => evaluatedIdSet.add(e.employeeId));
      listSmallB.forEach((e) => evaluatedIdSet.add(e.employeeId));
      listC.forEach((e) => evaluatedIdSet.add(e.employeeId));

      employees.forEach((emp) => {
        if (!evaluatedIdSet.has(emp.id)) {
          const targetEmp = updatedEmployeesMap.get(emp.id) || { ...emp };
          const evalItem: EmployeeMonthlyEvaluation = {
            month: evaluationMonth,
            rating: 'a',
            reason: 'Mặc định hoàn thành tốt nhiệm vụ (loại a)',
            isGpt: gptIdSet.has(emp.id),
            date: evalDate,
            recordId: record.id,
            updatedAt: new Date().toISOString(),
          };
          const existingEvals = (targetEmp.monthlyEvaluations || []).filter(
            (ev) => ev.month !== evaluationMonth
          );
          targetEmp.monthlyEvaluations = [evalItem, ...existingEvals];
          updatedEmployeesMap.set(emp.id, targetEmp);
        }
      });

      const updatedEmployeesList = Array.from(updatedEmployeesMap.values());

      // Save record & update employees
      await onSaveBxxlRecord(record, updatedEmployeesList);

      // Trigger Word file download
      exportBxxlToWord(record);
    } catch (err) {
      console.error('Error saving and exporting BXXL record:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800">
              Đánh giá nhân sự hàng tháng
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Mẫu chuẩn hành chính A4</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Award className="w-7 h-7 text-emerald-600" />
            <span>Bình xét & Xếp loại (BXXL)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Quy trình đánh giá định kỳ nhân viên theo các mục được chọn. Tự động ẩn các mục không được chọn ở các bước tiếp theo để rút ngắn thao tác và xuất file Word đúng chuẩn hành chính.
          </p>
        </div>

        {/* Tab Navigation buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl self-start md:self-center">
          <button
            onClick={() => setActiveSubTab('create')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'create'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Tạo đợt bình xét</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Lịch sử biên bản ({bxxlRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'summary'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Bảng tổng hợp nhân sự</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: DYNAMIC WIZARD */}
      {activeSubTab === 'create' && (
        <div className="space-y-6">
          {/* Step Progress Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs overflow-x-auto">
            <div className="flex items-center justify-between min-w-[720px] gap-2">
              {activeSteps.map((step, idx) => {
                const stepNum = idx + 1;
                const isCurrent = currentStepKey === step.key;
                const isPassed = currentStepIndex > idx;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setCurrentStepKey(step.key)}
                    className="flex-1 flex items-center gap-2 group text-left transition-all"
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        isCurrent
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-xs'
                          : isPassed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : stepNum}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isCurrent ? 'text-emerald-700' : isPassed ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Bước {stepNum}
                      </p>
                      <p
                        className={`text-xs font-semibold truncate ${
                          isCurrent ? 'text-slate-900 font-bold' : isPassed ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {step.title}
                      </p>
                    </div>
                    {idx < activeSteps.length - 1 && (
                      <div className="h-0.5 w-4 bg-slate-200 shrink-0 ml-auto mr-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===================== BƯỚC 1: THIẾT LẬP & CHỌN MỤC BÌNH XÉT ===================== */}
          {currentStepKey === 'info' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Bước 1: Thiết lập thông tin biên bản & các mục bình xét
                  </h2>
                  <p className="text-xs text-slate-500">
                    Nhập thông tin cơ quan, thời gian đánh giá và chọn các mục bình xét. Các mục không được chọn sẽ tự động ẩn ở các bước sau để rút ngắn thao tác.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Organization & Date */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tên cơ quan / Công ty
                    </label>
                    <textarea
                      rows={2}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      * Dòng 1: CÔNG TY TNHH CẢNG CONTAINER, Dòng 2: QUỐC TẾ TÂN CẢNG HẢI PHÒNG
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Đội / Phòng ban
                      </label>
                      <input
                        type="text"
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Tổ / Phân xưởng
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="(Tổ RTG)"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Evaluation month */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Tháng bình xét xếp loại (Hiển thị trên tiêu đề biên bản)
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <input
                        type="text"
                        value={evaluationMonth}
                        onChange={(e) => setEvaluationMonth(e.target.value)}
                        placeholder="MM/YYYY (ví dụ: 03/2026)"
                        className="w-full px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1.5">
                      Tiêu đề sẽ hiển thị: <strong>DANH SÁCH XẾP LOẠI THÁNG {evaluationMonth}</strong>
                    </p>
                  </div>

                  {/* Creation Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ngày tháng năm lập biên bản
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Địa danh</span>
                        <input
                          type="text"
                          value={createdCity}
                          onChange={(e) => setCreatedCity(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Ngày</span>
                        <input
                          type="text"
                          value={createdDate}
                          onChange={(e) => setCreatedDate(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Tháng</span>
                        <input
                          type="text"
                          value={createdMonth}
                          onChange={(e) => setCreatedMonth(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Năm</span>
                        <input
                          type="text"
                          value={createdYear}
                          onChange={(e) => setCreatedYear(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Category Selection & Note */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Các mục bình xét của tháng để đánh giá & hiển thị trong biên bản:
                    </label>
                    <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                      {(['A', 'B', 'b', 'C'] as const).map((cat) => {
                        const isChecked = selectedCategories.includes(cat);
                        return (
                          <label
                            key={cat}
                            className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-300 cursor-pointer transition-all"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleToggleCategory(cat, e.target.checked)}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <div className="flex items-center justify-between flex-1">
                              <span className="text-xs font-bold text-slate-800">
                                Mức đề xuất xếp loại “{cat}”
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600">
                                {cat === 'A' ? 'Loại A' : cat === 'B' ? 'Loại B (Kèm lý do)' : cat === 'b' ? 'Loại b (Kèm lý do)' : 'Loại C (Kèm lý do)'}
                              </span>
                            </div>
                          </label>
                        );
                      })}

                      {/* GPT selection */}
                      <label className="flex items-center gap-3 p-2 rounded-xl bg-amber-50/80 border border-amber-200 hover:border-amber-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={includeGpt}
                          onChange={(e) => handleToggleGpt(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                        />
                        <div className="flex items-center justify-between flex-1">
                          <span className="text-xs font-bold text-amber-900">
                            Danh sách đề xuất GPT (Giải phóng tàu)
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800">
                            Độc lập
                          </span>
                        </div>
                      </label>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium mt-2 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                      * <strong>Quy trình rút ngắn:</strong> Chỉ các mục được tích chọn sẽ xuất hiện ở các bước tiếp theo. Những mục không chọn sẽ được tự động bỏ qua để tối ưu thao tác.
                    </p>

                    {/* Quy tắc mặc định xếp loại "a" */}
                    <div className="mt-3 p-3.5 rounded-2xl bg-teal-50 border border-teal-200 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-teal-900">
                              Quy tắc xếp loại mặc định: Mức xếp loại “a”
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-200/80 text-teal-900 font-mono">
                              Dự kiến loại a: {listSmallA.length} / {employees.length} NV
                            </span>
                          </div>
                          <p className="text-[11px] text-teal-700 mt-1 leading-relaxed">
                            Các nhân viên không được đánh <strong>A, B, b, C</strong> (dù có lý do hay không có lý do), thì <strong>mặc định là được a</strong> khi hệ thống lưu hồ sơ thi đua hàng tháng.
                          </p>
                        </div>
                      </div>

                      <p className="pt-2 border-t border-teal-200/80 text-xs text-teal-900 font-semibold">
                        Mức “a” chỉ ghi nhận vào hồ sơ nhân viên, không đưa vào biên bản đề xuất, bản in hoặc file Word.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ghi chú chung cuối biên bản
                    </label>
                    <textarea
                      rows={3}
                      value={generalNote}
                      onChange={(e) => setGeneralNote(e.target.value)}
                      placeholder="- Các nội dung bình xét khác Tổ RTG xin nhất trí theo đánh giá của BCH Đội Cơ Giới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Quay lại Trang chủ
                </button>
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>Tiếp tục: Bước 2 ({activeSteps[1]?.title || 'Tiếp theo'})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===================== CÁC BƯỚC ĐÁNH GIÁ NHÂN SỰ ĐÃ CHỌN ===================== */}
          {currentStepKey !== 'info' && currentStepKey !== 'preview' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              {/* Step Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      currentStepKey === 'A'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentStepKey === 'B'
                        ? 'bg-blue-100 text-blue-800'
                        : currentStepKey === 'b'
                        ? 'bg-indigo-100 text-indigo-800'
                        : currentStepKey === 'C'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentStepKey}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Bước {currentStepIndex + 1}: {activeSteps[currentStepIndex]?.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {activeSteps[currentStepIndex]?.subtitle}
                    </p>
                  </div>
                </div>

                {/* Counter of selected in this step */}
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500">Đã chọn ở bước này:</span>
                  <span className="text-sm font-black text-slate-900">
                    {currentStepKey === 'A' && `${listA.length} đ/c`}
                    {currentStepKey === 'B' && `${listB.length} đ/c (${listB.filter((b) => b.reason?.trim()).length} có lý do)`}
                    {currentStepKey === 'b' && `${listSmallB.length} đ/c (${listSmallB.filter((b) => b.reason?.trim()).length} có lý do)`}
                    {currentStepKey === 'C' && `${listC.length} đ/c (${listC.filter((c) => c.reason?.trim()).length} có lý do)`}
                    {currentStepKey === 'GPT' && `${listGpt.length} đ/c`}
                  </span>
                </div>
              </div>

              {/* Requirement reminder / guidance notice */}
              {(currentStepKey === 'B' || currentStepKey === 'b' || currentStepKey === 'C') && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Quy định hiển thị biên bản:</strong> Đối với mức xếp loại{' '}
                    <strong>“{currentStepKey}”</strong>, sau khi chọn nhân viên{' '}
                    <strong>bắt buộc phải nhập ô "Lý do"</strong>. Nếu không nhập nội dung lý do, nhân viên đó sẽ{' '}
                    <strong>không được đưa vào biên bản đề xuất ở bước cuối cùng</strong>.
                  </p>
                </div>
              )}

              {currentStepKey === 'GPT' && (
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Quy tắc loại trừ GPT:</strong> Các nhân viên đã bị xếp loại <strong>B, b, C</strong>{' '}
                    sẽ không hiển thị trong danh sách chọn GPT này. Chỉ những nhân sự được xếp loại A hoặc đạt tiêu chuẩn mới xuất hiện.
                  </p>
                </div>
              )}

              {/* Search and Filter Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm nhanh họ tên, mã NV, chức vụ..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Filter by Shift / Ca */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={selectedShift}
                      onChange={(e) => setSelectedShift(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                    >
                      <option value="ALL">Tất cả các Ca / Đơn vị</option>
                      {shiftOptions.map((sh) => (
                        <option key={sh} value={sh}>
                          {sh}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bulk Select Actions (Useful for A and GPT) */}
                <div className="flex items-center gap-2 shrink-0">
                  {(currentStepKey === 'A' || currentStepKey === 'GPT') && (
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                    >
                      Chọn tất cả ({candidateEmployees.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearCurrentStepList}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>

              {/* Employee Selection List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {candidateEmployees.length === 0 ? (
                  <div className="col-span-2 text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500">
                      Không tìm thấy nhân viên phù hợp hoặc các nhân sự đã được chọn ở bước khác.
                    </p>
                  </div>
                ) : (
                  candidateEmployees.map((emp) => {
                    const isSelected =
                      currentStepKey === 'A'
                        ? listA.some((e) => e.employeeId === emp.id)
                        : currentStepKey === 'B'
                        ? listB.some((e) => e.employeeId === emp.id)
                        : currentStepKey === 'b'
                        ? listSmallB.some((e) => e.employeeId === emp.id)
                        : currentStepKey === 'C'
                        ? listC.some((e) => e.employeeId === emp.id)
                        : listGpt.some((e) => e.employeeId === emp.id);

                    const currentItem =
                      currentStepKey === 'B'
                        ? listB.find((e) => e.employeeId === emp.id)
                        : currentStepKey === 'b'
                        ? listSmallB.find((e) => e.employeeId === emp.id)
                        : currentStepKey === 'C'
                        ? listC.find((e) => e.employeeId === emp.id)
                        : null;

                    return (
                      <div
                        key={emp.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEmployeeInCurrentStep(emp)}
                              className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-snug">
                                {emp.fullName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-600">{emp.employeeCode}</span>
                                <span>•</span>
                                <span>{emp.department}</span>
                                {emp.position && (
                                  <>
                                    <span>•</span>
                                    <span>{emp.position}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </label>

                          {/* Badge tag if already selected */}
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Đã chọn
                            </span>
                          )}
                        </div>

                        {/* REASON INPUT: Appears immediately when selected for B, b, C */}
                        {isSelected && (currentStepKey === 'B' || currentStepKey === 'b' || currentStepKey === 'C') && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">
                                Lý do xếp loại {currentStepKey}: <span className="text-rose-500">*</span>
                              </label>
                              {(!currentItem?.reason || !currentItem.reason.trim()) && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  Chưa nhập lý do (Sẽ không vào biên bản)
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={currentItem?.reason || ''}
                              onChange={(e) =>
                                handleUpdateReason(
                                  currentStepKey as 'B' | 'b' | 'C',
                                  emp.id,
                                  e.target.value
                                )
                              }
                              placeholder="Nhập lý do cụ thể (vd: Vi phạm quy trình, đi làm muộn, sự cố thiết bị...)"
                              className={`w-full px-3 py-1.5 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 ${
                                currentItem?.reason && currentItem.reason.trim()
                                  ? 'bg-white border border-slate-200 focus:ring-emerald-500/20 text-slate-800'
                                  : 'bg-rose-50/50 border border-rose-300 focus:ring-rose-500/20 text-rose-900 placeholder:text-rose-400'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Wizard Navigation Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quay lại Bước {currentStepIndex} ({activeSteps[currentStepIndex - 1]?.title})</span>
                </button>

                <button
                  type="button"
                  onClick={goToNextStep}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>
                    {currentStepIndex + 1 === activeSteps.length - 1
                      ? `Bước ${activeSteps.length}: ${activeSteps[activeSteps.length - 1].title}`
                      : `Tiếp tục: Bước ${currentStepIndex + 2} (${activeSteps[currentStepIndex + 1]?.title})`}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===================== BƯỚC XEM TRƯỚC VĂN BẢN & XUẤT WORD ===================== */}
          {currentStepKey === 'preview' && (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span>Bước {activeSteps.length}: Xem trước văn bản & Xuất file Word</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Biên bản được căn lề chuẩn văn bản hành chính Việt Nam (A4: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm, font Times New Roman 14pt).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    ← Chỉnh sửa danh sách ({activeSteps[activeSteps.length - 2]?.title || 'Bước trước'})
                  </button>

                  <button
                    type="button"
                    onClick={() => printBxxlDocument(compiledCurrentRecord)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>In / Lưu PDF</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveAndExport}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isSaving ? 'Đang lưu & đồng bộ...' : 'Sao lưu & Xuất file Word (.doc)'}</span>
                  </button>
                </div>
              </div>

              {/* Summary of Valid Included Entries */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Loại A</span>
                  <span className="text-lg font-black text-emerald-700">
                    {formatCountDoc(listA.length)}
                  </span>
                </div>
                <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-200 text-center">
                  <span className="text-[10px] font-bold text-teal-700 block uppercase">Loại a (Mặc định)</span>
                  <span className="text-lg font-black text-teal-800">
                    {formatCountDoc(listSmallA.length)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Loại B</span>
                  <span className="text-lg font-black text-blue-700">
                    {formatCountDoc(listB.filter((b) => b.reason?.trim()).length)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Loại b</span>
                  <span className="text-lg font-black text-indigo-700">
                    {formatCountDoc(listSmallB.filter((b) => b.reason?.trim()).length)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Loại C</span>
                  <span className="text-lg font-black text-rose-700">
                    {formatCountDoc(listC.filter((c) => c.reason?.trim()).length)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Đề xuất GPT</span>
                  <span className="text-lg font-black text-amber-700">
                    {formatCountDoc(listGpt.length)}
                  </span>
                </div>
              </div>

              {/* Banner nhắc quy tắc mặc định loại "a" */}
              <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-teal-900">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    <strong>Quy tắc mặc định:</strong> Nhân sự không đánh A, B, b, C (dù có lý do hay không có lý do), thì <strong>mặc định là được a</strong> ({listSmallA.length} nhân sự).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmallAListModal((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-teal-800 font-bold hover:bg-teal-100 transition-colors shadow-2xs text-[11px] shrink-0"
                >
                  {showSmallAListModal ? 'Ẩn danh sách loại a' : `Xem danh sách loại a (${listSmallA.length})`}
                </button>
              </div>

              {/* Danh sách mở rộng nhân sự mặc định xếp loại a */}
              {showSmallAListModal && (
                <div className="p-4 bg-white rounded-2xl border border-teal-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-900">
                      Danh sách {listSmallA.length} nhân viên mặc định xếp loại “a” (Hoàn thành nhiệm vụ):
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Tự động tính từ tổng {employees.length} nhân sự
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                    {listSmallA.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-teal-50/50 border border-teal-100 text-[11px] text-slate-800 flex flex-col"
                      >
                        <span className="font-bold text-teal-900 truncate">{p.fullName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{p.employeeCode}</span>
                        {p.shift && (
                          <span className="text-[9px] text-teal-700 font-semibold">{p.shift}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exact A4 Document Viewer */}
              <div className="bg-slate-300 p-4 md:p-8 rounded-3xl flex justify-center overflow-x-auto shadow-inner">
                <div
                  className="bg-white shadow-2xl text-black box-border"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '20mm 15mm 20mm 30mm',
                    fontFamily: "'Times New Roman', Times, serif",
                    fontSize: '14pt',
                    lineHeight: '1.2',
                  }}
                >
                  {/* Quốc hiệu & Tiêu đề cơ quan */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '42%', verticalAlign: 'top', textAlign: 'center', paddingRight: '6px' }}>
                          <p style={{ margin: 0, fontSize: '11.5pt', lineHeight: 1.25, textTransform: 'uppercase' }}>
                            CÔNG TY TNHH CẢNG CONTAINER
                            <br />
                            QUỐC TẾ TÂN CẢNG HẢI PHÒNG
                          </p>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase' }}>
                            {departmentName}
                          </p>
                        </td>
                        <td style={{ width: '58%', verticalAlign: 'top', textAlign: 'center', paddingLeft: '6px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', whiteSpace: 'nowrap' }}>
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                          </p>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13pt', whiteSpace: 'nowrap' }}>
                            Độc lập - Tự do - Hạnh phúc
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Địa danh, ngày tháng */}
                  <p style={{ textAlign: 'right', fontStyle: 'italic', marginTop: '10px', marginBottom: '20px', paddingRight: 0 }}>
                    {createdCity}, ngày {createdDate} tháng {createdMonth} năm {createdYear}
                  </p>

                  {/* Tiêu đề chính */}
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt' }}>
                      DANH SÁCH XẾP LOẠI THÁNG {evaluationMonth}
                    </p>
                    {groupName && (
                      <p style={{ margin: 0, fontSize: '14pt' }}>
                        {groupName}
                      </p>
                    )}
                  </div>

                  {/* Sections dynamically rendered per rules */}
                  {(() => {
                    let secIdx = 1;
                    const validA = listA;
                    const validB = listB.filter((b) => b.reason && b.reason.trim());
                    const validSmallB = listSmallB.filter((b) => b.reason && b.reason.trim());
                    const validC = listC.filter((c) => c.reason && c.reason.trim());
                    const validGpt = listGpt;

                    return (
                      <div>
                        {/* Section A */}
                        {selectedCategories.includes('A') && validA.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                              {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “A” ({formatCountDoc(validA.length)}):
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                              {validA.map((p, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  {p.fullName}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Section B */}
                        {selectedCategories.includes('B') && validB.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                              {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “B” ({formatCountDoc(validB.length)}):
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                              {validB.map((p, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  {p.fullName}: {p.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Section b */}
                        {selectedCategories.includes('b') && validSmallB.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                              {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “b” ({formatCountDoc(validSmallB.length)}):
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                              {validSmallB.map((p, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  {p.fullName}: {p.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Section C */}
                        {selectedCategories.includes('C') && validC.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                              {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “C” ({formatCountDoc(validC.length)}):
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                              {validC.map((p, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  {p.fullName}: {p.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Note text */}
                        {generalNote && generalNote.trim() && (
                          <p style={{ marginTop: '12px', marginBottom: '15px', paddingLeft: '35px' }}>
                            {generalNote.trim()}
                          </p>
                        )}

                        {/* Section GPT */}
                        {includeGpt && validGpt.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                              {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT GPT ({formatCountDoc(validGpt.length)}):
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                              {validGpt.map((p, idx) => (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  {p.fullName}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: HISTORY OF BXXL RECORDS */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Lịch sử các đợt bình xét & Biên bản đã lưu
              </h2>
              <p className="text-xs text-slate-500">
                Xem lại, in ấn hoặc tải lại file Word (.doc) của các tháng trước.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveSubTab('create');
                setCurrentStepKey('info');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Tạo đợt bình xét mới</span>
            </button>
          </div>

          {bxxlRecords.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Chưa có biên bản bình xét nào được lưu</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Bắt đầu quy trình các bước để bình xét xếp loại nhân viên và xuất biên bản Word đầu tiên.
              </p>
              <button
                onClick={() => {
                  setActiveSubTab('create');
                  setCurrentStepKey('info');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all"
              >
                Bắt đầu tạo biên bản ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bxxlRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 transition-all hover:shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        Tháng {rec.evaluationMonth}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {rec.createdDate}/{rec.createdMonth}/{rec.createdYear}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                      Danh sách xếp loại {rec.groupName || rec.departmentName}
                    </h3>

                    <div className="grid grid-cols-5 gap-1.5 my-3 text-center">
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block">Loại A</span>
                        <span className="text-xs font-bold text-emerald-700">{rec.listA?.length || 0}</span>
                      </div>
                      <div className="bg-teal-50/60 p-1.5 rounded-lg border border-teal-200">
                        <span className="text-[9px] text-teal-600 font-bold block">Loại a</span>
                        <span className="text-xs font-bold text-teal-800">{rec.listSmallA?.length || 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block">Loại B</span>
                        <span className="text-xs font-bold text-blue-700">{rec.listB?.filter(b => b.reason?.trim()).length || 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block">Loại b</span>
                        <span className="text-xs font-bold text-indigo-700">{rec.listSmallB?.filter(b => b.reason?.trim()).length || 0}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block">Loại C</span>
                        <span className="text-xs font-bold text-rose-700">{rec.listC?.filter(c => c.reason?.trim()).length || 0}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Đề xuất GPT:</span>
                      <span className="font-bold text-amber-700">{rec.listGpt?.length || 0} đ/c</span>
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryRecord(rec)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem A4</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => exportBxxlToWord(rec)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải Word</span>
                      </button>

                      {onDeleteBxxlRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa biên bản Tháng ${rec.evaluationMonth}?`)) {
                              onDeleteBxxlRecord(rec.id);
                            }
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa biên bản này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: EMPLOYEE SUMMARY MATRIX */}
      {activeSubTab === 'summary' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bảng tổng hợp xếp loại nhân viên theo các tháng
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi kết quả bình xét xếp loại và danh hiệu Giải phóng tàu (GPT) của từng nhân sự.
              </p>
            </div>

            {/* Quick Shift Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tất cả các Ca</option>
                {shiftOptions.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Mã NV</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">Phòng ban / Ca</th>
                  <th className="p-3">Chức vụ</th>
                  <th className="p-3 text-center">Xếp loại tháng gần nhất</th>
                  <th className="p-3 text-center">Danh hiệu GPT</th>
                  <th className="p-3">Lịch sử đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {employees
                  .filter((emp) => matchesShift(emp, selectedShift))
                  .map((emp) => {
                    const evals = emp.monthlyEvaluations || [];
                    const latestEval = evals[0];

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{emp.employeeCode}</td>
                        <td className="p-3 font-bold text-slate-900">{emp.fullName}</td>
                        <td className="p-3">{emp.department}</td>
                        <td className="p-3">{emp.position || 'Nhân viên'}</td>
                        <td className="p-3 text-center">
                          {latestEval ? (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs ${
                                latestEval.rating === 'A'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : latestEval.rating === 'a'
                                  ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                  : latestEval.rating === 'B'
                                  ? 'bg-blue-100 text-blue-800'
                                  : latestEval.rating === 'b'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              Loại {latestEval.rating}
                              <span className="text-[10px] block font-normal text-slate-500">
                                {latestEval.month}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa đánh giá</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {latestEval?.isGpt ? (
                            <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                              ⭐ Đề xuất GPT
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {evals.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {evals.slice(0, 3).map((ev, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                  title={ev.reason ? `Lý do: ${ev.reason}` : undefined}
                                >
                                  T.{ev.month}: <strong>{ev.rating}</strong>
                                  {ev.isGpt && ' (GPT)'}
                                </span>
                              ))}
                              {evals.length > 3 && (
                                <span className="text-[10px] text-slate-400">+{evals.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: View Historic A4 Document */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Biên bản xếp loại Tháng {selectedHistoryRecord.evaluationMonth}
                </h3>
                <p className="text-xs text-slate-500">
                  Lập ngày {selectedHistoryRecord.createdDate}/{selectedHistoryRecord.createdMonth}/{selectedHistoryRecord.createdYear} bởi {selectedHistoryRecord.creatorName || 'Admin'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printBxxlDocument(selectedHistoryRecord)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportBxxlToWord(selectedHistoryRecord)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Word (.doc)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryRecord(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable A4 Document */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-200 rounded-2xl my-4 flex justify-center shadow-inner">
              <div
                className="bg-white shadow-xl text-black box-border"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm 15mm 20mm 30mm',
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: '14pt',
                  lineHeight: '1.2',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '42%', verticalAlign: 'top', textAlign: 'center', paddingRight: '6px' }}>
                        <p style={{ margin: 0, fontSize: '11.5pt', lineHeight: 1.25, textTransform: 'uppercase' }}>
                          CÔNG TY TNHH CẢNG CONTAINER
                          <br />
                          QUỐC TẾ TÂN CẢNG HẢI PHÒNG
                        </p>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase' }}>
                          {selectedHistoryRecord.departmentName}
                        </p>
                      </td>
                      <td style={{ width: '58%', verticalAlign: 'top', textAlign: 'center', paddingLeft: '6px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', whiteSpace: 'nowrap' }}>
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </p>
                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13pt', whiteSpace: 'nowrap' }}>
                          Độc lập - Tự do - Hạnh phúc
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ textAlign: 'right', fontStyle: 'italic', marginTop: '10px', marginBottom: '20px', paddingRight: 0 }}>
                  {selectedHistoryRecord.createdCity}, ngày {selectedHistoryRecord.createdDate} tháng {selectedHistoryRecord.createdMonth} năm {selectedHistoryRecord.createdYear}
                </p>

                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt' }}>
                    DANH SÁCH XẾP LOẠI THÁNG {selectedHistoryRecord.evaluationMonth}
                  </p>
                  {selectedHistoryRecord.groupName && (
                    <p style={{ margin: 0, fontSize: '14pt' }}>
                      {selectedHistoryRecord.groupName}
                    </p>
                  )}
                </div>

                {(() => {
                  let secIdx = 1;
                  const validA = selectedHistoryRecord.listA || [];
                  const validB = (selectedHistoryRecord.listB || []).filter((b) => b.reason && b.reason.trim());
                  const validSmallB = (selectedHistoryRecord.listSmallB || []).filter((b) => b.reason && b.reason.trim());
                  const validC = (selectedHistoryRecord.listC || []).filter((c) => c.reason && c.reason.trim());
                  const validGpt = selectedHistoryRecord.listGpt || [];

                  return (
                    <div>
                      {selectedHistoryRecord.selectedCategories?.includes('A') && validA.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                            {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “A” ({formatCountDoc(validA.length)}):
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                            {validA.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>
                                {p.fullName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedHistoryRecord.selectedCategories?.includes('B') && validB.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                            {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “B” ({formatCountDoc(validB.length)}):
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                            {validB.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>
                                {p.fullName}: {p.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedHistoryRecord.selectedCategories?.includes('b') && validSmallB.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                            {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “b” ({formatCountDoc(validSmallB.length)}):
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                            {validSmallB.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>
                                {p.fullName}: {p.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedHistoryRecord.selectedCategories?.includes('C') && validC.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                            {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “C” ({formatCountDoc(validC.length)}):
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                            {validC.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>
                                {p.fullName}: {p.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedHistoryRecord.generalNote && (
                        <p style={{ marginTop: '12px', marginBottom: '15px', paddingLeft: '35px' }}>
                          {selectedHistoryRecord.generalNote}
                        </p>
                      )}

                      {selectedHistoryRecord.includeGpt && validGpt.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>
                            {toRomanNumeral(secIdx++)}/ DANH SÁCH ĐỀ XUẤT GPT ({formatCountDoc(validGpt.length)}):
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'none' }}>
                            {validGpt.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>
                                {p.fullName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
