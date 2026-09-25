import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Award,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Search,
  Users,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Info,
  Scale,
  Sparkles,
  Printer,
  FileSpreadsheet,
  Calendar,
  Flag,
  AlertOctagon,
  Lightbulb,
  FileText,
  Check,
  X,
  Eye,
  Download,
  Filter,
} from 'lucide-react';
import {
  Employee,
  AppSettings,
  CompetencyScoringRules,
  BxxlRecord,
  QuizSubmission,
  FeedbackProposal,
  IncidentViolation,
  MonthlyScoreDetail,
  AnnualScoreDetail,
} from '../types';
import { DEFAULT_COMPETENCY_RULES } from '../mockData';
import {
  calculateEmployeeMonthlyScore,
  calculateEmployeeAnnualScore,
} from '../services/evaluationScoringService';

interface CompetencyStandardsViewProps {
  currentUser: Employee;
  employees: Employee[];
  appSettings?: AppSettings;
  onSaveAppSettings?: (newSettings: Partial<AppSettings>) => void;
  onBackToDashboard?: () => void;
  allSubmissions?: QuizSubmission[];
  allFeedbacks?: FeedbackProposal[];
  allBxxlRecords?: BxxlRecord[];
  allViolations?: IncidentViolation[];
  onUpdateEmployee?: (emp: Employee) => void;
}

type MainTab = 'MONTHLY_RULES' | 'ANNUAL_RULES' | 'MONTHLY_SIMULATOR' | 'ANNUAL_MATRIX';

export const CompetencyStandardsView: React.FC<CompetencyStandardsViewProps> = ({
  currentUser,
  employees,
  appSettings,
  onSaveAppSettings,
  onBackToDashboard,
  allSubmissions = [],
  allFeedbacks = [],
  allBxxlRecords = [],
  allViolations = [],
  onUpdateEmployee,
}) => {
  // Main tab mode
  const [activeTab, setActiveTab] = useState<MainTab>('MONTHLY_RULES');

  // Lấy cấu hình quy chuẩn hệ số hiện tại từ appSettings hoặc mặc định
  const [scoringRules, setScoringRules] = useState<CompetencyScoringRules>(() => {
    return {
      ...DEFAULT_COMPETENCY_RULES,
      ...(appSettings?.competencyRules || {}),
    };
  });

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Month selector for Monthly Simulator
  const [selectedMonth, setSelectedMonth] = useState<string>('03/2026');
  // Year selector for Annual Matrix
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Filters for employee tables
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Selected employee detail scorecard modal
  const [scorecardModalEmp, setScorecardModalEmp] = useState<{
    emp: Employee;
    monthlyDetail: MonthlyScoreDetail;
    annualDetail?: AnnualScoreDetail;
  } | null>(null);

  // Annual overrides (year-end exam & reward/discipline)
  const [annualOverrides, setAnnualOverrides] = useState<
    Record<
      string,
      {
        yearEndExamScore?: number;
        rewardDisciplineScore?: number;
        hasDiscipline?: boolean;
        hasAward?: boolean;
      }
    >
  >({});

  const canEdit =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.role === 'MANAGER';

  // Danh sách các bộ phận
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Context for scoring calculation
  const evalContext = useMemo(() => {
    return {
      bxxlRecords: allBxxlRecords,
      submissions: allSubmissions,
      feedbacks: allFeedbacks,
      violations: allViolations,
      annualOverrides,
    };
  }, [allBxxlRecords, allSubmissions, allFeedbacks, allViolations, annualOverrides]);

  // Tính toán bảng điểm tháng cho toàn bộ nhân sự
  const monthlyEvaluations = useMemo(() => {
    return employees.map((emp) => {
      const detail = calculateEmployeeMonthlyScore(emp, selectedMonth, scoringRules, evalContext);
      return {
        emp,
        detail,
      };
    });
  }, [employees, selectedMonth, scoringRules, evalContext]);

  // Thống kê phân bố Tháng
  const monthlyStats = useMemo(() => {
    let excellent = 0; // >= 95
    let good = 0; // 80 - 94
    let fair = 0; // 65 - 79
    let average = 0; // 50 - 64
    let poor = 0; // < 50
    let flagRetraining = 0;
    let severeIncidents = 0;

    monthlyEvaluations.forEach(({ detail }) => {
      if (detail.tier === 'EXCELLENT') excellent++;
      else if (detail.tier === 'GOOD') good++;
      else if (detail.tier === 'FAIR') fair++;
      else if (detail.tier === 'AVERAGE') average++;
      else poor++;

      if (detail.needsRetraining) flagRetraining++;
      if (detail.hasSevereIncident) severeIncidents++;
    });

    const total = employees.length || 1;
    return {
      total: employees.length,
      excellent,
      good,
      fair,
      average,
      poor,
      flagRetraining,
      severeIncidents,
      pctExcellent: Math.round((excellent / total) * 100),
      pctGood: Math.round((good / total) * 100),
      pctFair: Math.round((fair / total) * 100),
      pctAverage: Math.round((average / total) * 100),
      pctPoor: Math.round((poor / total) * 100),
    };
  }, [monthlyEvaluations, employees.length]);

  // Lọc bảng điểm tháng
  const filteredMonthlyEvaluations = useMemo(() => {
    return monthlyEvaluations.filter(({ emp, detail }) => {
      if (deptFilter !== 'ALL' && emp.department !== deptFilter) return false;
      if (tierFilter !== 'ALL' && detail.tier !== tierFilter) return false;

      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.employeeCode.toLowerCase().includes(q);
        const matchPos = (emp.position || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPos) return false;
      }
      return true;
    });
  }, [monthlyEvaluations, deptFilter, tierFilter, searchKeyword]);

  // Tính toán bảng điểm Năm cho toàn bộ nhân sự
  const annualEvaluations = useMemo(() => {
    return employees.map((emp) => {
      const detail = calculateEmployeeAnnualScore(emp, selectedYear, scoringRules, evalContext);
      return {
        emp,
        detail,
      };
    });
  }, [employees, selectedYear, scoringRules, evalContext]);

  // Thống kê phân bố Năm
  const annualStats = useMemo(() => {
    let excellent = 0; // >= 90
    let good = 0; // 75 - 89
    let pass = 0; // 60 - 74
    let fail = 0; // < 60

    annualEvaluations.forEach(({ detail }) => {
      if (detail.annualRank === 'EXCELLENT') excellent++;
      else if (detail.annualRank === 'GOOD') good++;
      else if (detail.annualRank === 'PASS') pass++;
      else fail++;
    });

    const total = employees.length || 1;
    return {
      total: employees.length,
      excellent,
      good,
      pass,
      fail,
      pctExcellent: Math.round((excellent / total) * 100),
      pctGood: Math.round((good / total) * 100),
      pctPass: Math.round((pass / total) * 100),
      pctFail: Math.round((fail / total) * 100),
    };
  }, [annualEvaluations, employees.length]);

  // Lọc bảng điểm năm
  const filteredAnnualEvaluations = useMemo(() => {
    return annualEvaluations.filter(({ emp, detail }) => {
      if (deptFilter !== 'ALL' && emp.department !== deptFilter) return false;
      if (tierFilter !== 'ALL' && detail.annualRank !== tierFilter) return false;

      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.employeeCode.toLowerCase().includes(q);
        const matchPos = (emp.position || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPos) return false;
      }
      return true;
    });
  }, [annualEvaluations, deptFilter, tierFilter, searchKeyword]);

  // Lưu cấu hình quy chuẩn toàn đơn vị
  const handleSaveStandards = () => {
    setIsSaving(true);
    if (onSaveAppSettings) {
      onSaveAppSettings({
        competencyRules: scoringRules,
      });
    }
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess('Đã lưu và cập nhật bộ quy chuẩn tiêu chí & thang điểm đánh giá năng lực!');
      setTimeout(() => setSaveSuccess(null), 4000);
    }, 400);
  };

  // Khôi phục mặc định theo tiêu chuẩn
  const handleResetDefaults = () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn khôi phục bảng tiêu chí và thang điểm về giá trị chuẩn của hệ thống?'
      )
    ) {
      return;
    }
    setScoringRules(DEFAULT_COMPETENCY_RULES);
    setSaveSuccess('Đã khôi phục các mức điểm quy chuẩn mặc định. Bấm "Lưu Quy Chuẩn" để áp dụng.');
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Top Banner & Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Tiêu Chí & Thang Điểm Đánh Giá Năng Lực
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Tổ RTG Cảng
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                  Mã: QC-KPI/2026
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 max-w-4xl leading-relaxed">
                Hệ thống đánh giá năng lực đa chiều: <b>Đánh giá Hàng tháng</b> (Tối đa 100đ cấu thành từ Năng suất 50đ + Kiểm tra 30đ + Tuân thủ 20đ + Điểm thưởng) và <b>Đánh giá Hàng năm</b> (Trọng số 70% TB 12 tháng + 20% Thi sát hạch + 10% Khen thưởng/Kỷ luật).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              title="In báo cáo"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">In Bảng Điểm</span>
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Mặc Định Chuẩn</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveStandards}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu Quy Chuẩn'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Thông báo lưu thành công */}
        {saveSuccess && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* 4 Chế độ làm việc / Tab chuyển đổi */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveTab('MONTHLY_RULES');
              setTierFilter('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'MONTHLY_RULES'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>1. Thang Điểm Đánh Giá Hàng Tháng (100đ)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ANNUAL_RULES');
              setTierFilter('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'ANNUAL_RULES'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>2. Bảng Thiết Lập Đánh Giá Hàng Năm (70% - 20% - 10%)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('MONTHLY_SIMULATOR');
              setTierFilter('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'MONTHLY_SIMULATOR'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Bảng Điểm Tháng Thực Tế ({selectedMonth})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ANNUAL_MATRIX');
              setTierFilter('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'ANNUAL_MATRIX'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>4. Bảng Tổng Hợp Đánh Giá Năm ({selectedYear})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BẢNG THIẾT LẬP TIÊU CHÍ & THANG ĐIỂM ĐÁNH GIÁ HÀNG THÁNG           */}
      {/* ========================================================================= */}
      {activeTab === 'MONTHLY_RULES' && (
        <div className="space-y-6">
          {/* Header Description & Overview */}
          <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-3xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                100đ
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-indigo-950">
                  Thang Điểm Đánh Giá Hàng Tháng (Tổng tối đa 100 điểm, chưa tính điểm thưởng)
                </h3>
                <p className="text-xs text-indigo-800/80">
                  Cấu thành từ <b>3 nhóm dữ liệu lõi</b> (50đ + 30đ + 20đ = 100đ) và <b>1 nhóm điểm cộng sáng kiến</b> (+5đ / +10đ).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-200 w-fit">
              <span>Hệ thống chấm tự động theo chu kỳ hàng tháng</span>
            </div>
          </div>

          {/* 4 Nhóm Tiêu Chí Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Nhóm 1: Kết quả bình xét năng suất (Tối đa 50đ) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Bình Xét Năng Suất
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-700">
                      Tối đa 50đ • Dữ liệu nền tảng
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Dựa trên kết quả KPI/khối lượng công việc đã hoàn thành trực tiếp tại hiện trường cảng.
                </p>

                <div className="space-y-2 mt-4">
                  {/* Loại A */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <div>
                      <span className="font-bold text-xs text-emerald-900 block">Cá nhân xếp loại A:</span>
                      <span className="text-[10px] text-emerald-700">Xuất sắc, vượt tiến độ</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyProductivityA}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyProductivityA: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-emerald-300 text-xs font-black text-emerald-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-emerald-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* Loại a (Mặc định) */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-teal-50/50 border border-teal-100">
                    <div>
                      <span className="font-bold text-xs text-teal-900 block">Cá nhân xếp loại a:</span>
                      <span className="text-[10px] text-teal-700">Hoàn thành tốt (Mặc định)</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyProductivitySmallA}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyProductivitySmallA: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-teal-300 text-xs font-black text-teal-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-teal-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* Loại B */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-blue-50/50 border border-blue-100">
                    <div>
                      <span className="font-bold text-xs text-blue-900 block">Cá nhân xếp loại B:</span>
                      <span className="text-[10px] text-blue-700">Đạt yêu cầu tiêu chuẩn</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyProductivityB}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyProductivityB: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-blue-300 text-xs font-black text-blue-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-blue-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* Loại b */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50/50 border border-amber-100">
                    <div>
                      <span className="font-bold text-xs text-amber-900 block">Cá nhân xếp loại b:</span>
                      <span className="text-[10px] text-amber-700">Cần cố gắng, năng suất thấp</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyProductivitySmallB}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyProductivitySmallB: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-amber-300 text-xs font-black text-amber-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-amber-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* Loại C */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50/50 border border-rose-100">
                    <div>
                      <span className="font-bold text-xs text-rose-900 block">Cá nhân xếp loại C:</span>
                      <span className="text-[10px] text-rose-700">Không đạt yêu cầu</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyProductivityC}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyProductivityC: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-rose-300 text-xs font-black text-rose-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-rose-700 font-bold">đ</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
                * Dữ liệu tự động lấy từ Biên bản BXXL của tháng. Nhân sự không xếp A, B, b, C tự động được a.
              </div>
            </div>

            {/* Nhóm 2: Kết quả bài kiểm tra (Tối đa 30đ) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Kết Quả Bài Kiểm Tra
                    </h3>
                    <span className="text-[11px] font-bold text-indigo-700">
                      Tối đa 30đ • Dữ liệu năng lực
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Trích xuất từ kết quả các bài trắc nghiệm chuyên môn, an toàn định kỳ trong tháng.
                </p>

                <div className="space-y-2 mt-4">
                  {/* 90 - 100 */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-indigo-50/50 border border-indigo-100">
                    <div>
                      <span className="font-bold text-xs text-indigo-900 block">Điểm thi đạt 90 - 100:</span>
                      <span className="text-[10px] text-indigo-700">(hoặc % đúng)</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyQuiz90_100}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyQuiz90_100: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-indigo-300 text-xs font-black text-indigo-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-indigo-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* 70 - 89 */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">Điểm thi đạt 70 - 89:</span>
                      <span className="text-[10px] text-slate-500">Mức khá, đạt chuẩn</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyQuiz70_89}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyQuiz70_89: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-black text-slate-800 text-right bg-white"
                      />
                      <span className="text-[11px] text-slate-600 font-bold">đ</span>
                    </div>
                  </div>

                  {/* 50 - 69 */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50/50 border border-amber-100">
                    <div>
                      <span className="font-bold text-xs text-amber-900 block">Điểm thi đạt 50 - 69:</span>
                      <span className="text-[10px] text-amber-700">Mức trung bình</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyQuiz50_69}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyQuiz50_69: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-amber-300 text-xs font-black text-amber-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-amber-700 font-bold">đ</span>
                    </div>
                  </div>

                  {/* Dưới 50 */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200">
                    <div>
                      <span className="font-bold text-xs text-rose-900 block">Điểm thi dưới 50:</span>
                      <span className="text-[10px] text-rose-700 font-bold flex items-center gap-1">
                        <Flag className="w-3 h-3 text-rose-600 inline" />
                        Gắn cờ yêu cầu đào tạo lại
                      </span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyQuizUnder50}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyQuizUnder50: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-rose-300 text-xs font-black text-rose-900 text-right bg-white"
                      />
                      <span className="text-[11px] text-rose-700 font-bold">đ</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
                * Tự động đồng bộ từ module Trắc Nghiệm Chuyên Môn định kỳ.
              </div>
            </div>

            {/* Nhóm 3: Tuân thủ & Vi phạm sự cố (Khởi điểm 20đ) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-black text-sm shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Tuân Thủ & Vi Phạm Sự Cố
                    </h3>
                    <span className="text-[11px] font-bold text-rose-700">
                      Khởi điểm 20đ • Dữ liệu rủi ro
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Nhân sự tự động có 20 điểm này đầu tháng. Trừ dần nếu có lỗi phát sinh (tối đa về 0đ).
                </p>

                <div className="space-y-2 mt-3">
                  {/* Không vi phạm */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-950">Không vi phạm / sự cố:</span>
                    <span className="font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      Giữ nguyên 20đ
                    </span>
                  </div>

                  {/* Lỗi hành chính */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">Lỗi hành chính, tác phong:</span>
                      <span className="text-[10px] text-slate-500">Đi muộn, quên thẻ, đồng phục</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-xs text-rose-600 font-bold">-</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyComplianceAdminDeduct}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyComplianceAdminDeduct: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-black text-rose-700 text-right bg-white"
                      />
                      <span className="text-[10px] text-slate-500">đ/lần</span>
                    </div>
                  </div>

                  {/* Không tuân thủ điều hành */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">Không chấp hành điều hành:</span>
                      <span className="text-[10px] text-slate-500">Phân ca, điều động bãi</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-xs text-rose-600 font-bold">-</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyComplianceDispatchDeduct}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyComplianceDispatchDeduct: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-black text-rose-700 text-right bg-white"
                      />
                      <span className="text-[10px] text-slate-500">đ/lần</span>
                    </div>
                  </div>

                  {/* Sự cố nhẹ */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50/50 border border-rose-200">
                    <div>
                      <span className="font-bold text-xs text-rose-900 block">Sự cố vận hành/an toàn nhẹ:</span>
                      <span className="text-[10px] text-rose-700">Mất toàn bộ điểm tuân thủ</span>
                    </div>
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-xs text-rose-600 font-bold">-</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={scoringRules.monthlyComplianceMinorIncidentDeduct}
                        onChange={(e) =>
                          setScoringRules((prev) => ({
                            ...prev,
                            monthlyComplianceMinorIncidentDeduct: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg border border-rose-300 text-xs font-black text-rose-700 text-right bg-white"
                      />
                      <span className="text-[10px] text-slate-500">đ/lần</span>
                    </div>
                  </div>

                  {/* Sự cố nghiêm trọng dây chuyền */}
                  <div className="p-2 rounded-xl bg-red-600 text-white text-[11px] space-y-0.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                      <span>Sự cố nghiêm trọng dây chuyền:</span>
                    </div>
                    <p className="text-[10px] text-red-100 font-medium leading-tight">
                      Tự động <b>0 điểm toàn tháng</b>, hủy toàn bộ điểm thi đua, xếp loại tháng là <b>Kém (C)</b>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
                * Dữ liệu đối soát từ file Báo cáo sự cố cảng & Vi phạm nội quy.
              </div>
            </div>

            {/* Nhóm 4: Góp ý & Đề xuất (Điểm thưởng) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Góp Ý & Đề Xuất Sáng Kiến
                    </h3>
                    <span className="text-[11px] font-bold text-amber-700">
                      Điểm thưởng • Dữ liệu sáng kiến
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Khuyến khích cải tiến hiện trường và quy trình làm việc. Điểm thưởng cộng thẳng vào Tổng điểm tháng (có thể &gt; 100đ).
                </p>

                <div className="space-y-3 mt-4">
                  {/* Đề xuất hợp lệ được ghi nhận */}
                  <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">Đề xuất hợp lệ:</span>
                      <div className="flex items-center gap-1 w-20">
                        <span className="text-xs text-amber-700 font-bold">+</span>
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={scoringRules.monthlyBonusValidSuggestion}
                          onChange={(e) =>
                            setScoringRules((prev) => ({
                              ...prev,
                              monthlyBonusValidSuggestion: Number(e.target.value),
                            }))
                          }
                          className="w-full px-2 py-1 rounded-lg border border-amber-300 text-xs font-black text-amber-900 text-right bg-white"
                        />
                        <span className="text-[10px] text-amber-700 font-bold">đ/lần</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-800/80 leading-tight">
                      Được cán bộ quản lý phê duyệt ghi nhận vào sổ theo dõi cải tiến.
                    </p>
                  </div>

                  {/* Đề xuất áp dụng hiệu quả thực tế */}
                  <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950">Đề xuất áp dụng thực tế:</span>
                      <div className="flex items-center gap-1 w-20">
                        <span className="text-xs text-emerald-700 font-bold">+</span>
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={scoringRules.monthlyBonusEffectiveSuggestion}
                          onChange={(e) =>
                            setScoringRules((prev) => ({
                              ...prev,
                              monthlyBonusEffectiveSuggestion: Number(e.target.value),
                            }))
                          }
                          className="w-full px-2 py-1 rounded-lg border border-emerald-300 text-xs font-black text-emerald-900 text-right bg-white"
                        />
                        <span className="text-[10px] text-emerald-700 font-bold">đ/lần</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-emerald-800/80 leading-tight">
                      Mang lại hiệu quả kinh tế hoặc tăng tốc độ giải phóng tàu thực tế.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                💡 <b>Nguyên tắc:</b> Không giới hạn điểm thưởng tối đa. Cá nhân tích cực có thể vượt mốc 100đ.
              </div>
            </div>
          </div>

          {/* Khung Phân Hạng Đánh Giá Tháng (Thang 100đ) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <span>Khung Phân Hạng Đánh Giá Tháng Dựa Trên Tổng Điểm</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Căn cứ xếp loại thi đua, danh hiệu cá nhân tiêu biểu và chế độ khen thưởng/giám sát hàng tháng.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('MONTHLY_SIMULATOR')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center gap-1.5 w-fit"
              >
                <span>Xem Bảng Điểm Tháng Thực Tế</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 5 Cấp độ phân hạng tháng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Xuất sắc */}
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-200 text-purple-950 inline-block font-mono">
                  ≥ 95 điểm
                </span>
                <h4 className="font-bold text-purple-950 text-sm">🌟 Xuất Sắc</h4>
                <p className="text-xs font-semibold text-purple-800">Cá nhân tiêu biểu</p>
                <p className="text-[11px] text-purple-700/80 leading-relaxed">
                  Đạt năng suất tối đa, điểm kiểm tra cao, kỷ luật tuyệt đối và có sáng kiến đóng góp.
                </p>
              </div>

              {/* Tốt */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-200 text-emerald-950 inline-block font-mono">
                  80 - 94 điểm
                </span>
                <h4 className="font-bold text-emerald-950 text-sm">🟢 Tốt</h4>
                <p className="text-xs font-semibold text-emerald-800">Đạt kỳ vọng</p>
                <p className="text-[11px] text-emerald-700/80 leading-relaxed">
                  Hoàn thành trọn vẹn yêu cầu chức danh, an toàn ca trực, chuyên môn vững vàng.
                </p>
              </div>

              {/* Khá */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-200 text-blue-950 inline-block font-mono">
                  65 - 79 điểm
                </span>
                <h4 className="font-bold text-blue-950 text-sm">🔵 Khá</h4>
                <p className="text-xs font-semibold text-blue-800">Cần cải thiện một số kỹ năng</p>
                <p className="text-[11px] text-blue-700/80 leading-relaxed">
                  Năng suất đạt mức trung bình khá, điểm thi đạt yêu cầu nhưng còn phát sinh trừ điểm.
                </p>
              </div>

              {/* Trung bình */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-200 text-amber-950 inline-block font-mono">
                  50 - 64 điểm
                </span>
                <h4 className="font-bold text-amber-950 text-sm">🟡 Trung Bình</h4>
                <p className="text-xs font-semibold text-amber-800">Nguy cơ không đáp ứng vị trí</p>
                <p className="text-[11px] text-amber-700/80 leading-relaxed">
                  Xếp loại BXXL thấp hoặc vi phạm tác phong. Cần cán bộ quản lý nhắc nhở và đôn đốc.
                </p>
              </div>

              {/* Kém */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-200 text-rose-950 inline-block font-mono">
                  &lt; 50 điểm
                </span>
                <h4 className="font-bold text-rose-950 text-sm">🔴 Kém</h4>
                <p className="text-xs font-semibold text-rose-800">Đưa vào diện giám sát đặc biệt</p>
                <p className="text-[11px] text-rose-700/80 leading-relaxed">
                  Điểm dưới 50 hoặc xảy ra sự cố nghiêm trọng. Đưa vào diện kèm cặp hoặc đào tạo lại.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BẢNG THIẾT LẬP ĐÁNH GIÁ HÀNG NĂM (70% - 20% - 10%)                 */}
      {/* ========================================================================= */}
      {activeTab === 'ANNUAL_RULES' && (
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-3xl border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                100%
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-purple-950">
                  Bảng Thiết Lập Đánh Giá Hàng Năm (Thang 100 điểm có trọng số)
                </h3>
                <p className="text-xs text-purple-800/80">
                  Đánh giá năm không chỉ là trung bình cộng của 12 tháng mà cần có trọng số để đánh giá sự ổn định và các kỳ thi nâng bậc/tay nghề cuối năm.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('ANNUAL_MATRIX')}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-colors shrink-0 shadow-2xs"
            >
              Mở Bảng Tổng Hợp Năm {selectedYear}
            </button>
          </div>

          {/* Bảng 3 Tiêu Chí Tổng Hợp Năm */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base">
              3 Tiêu Chí Tổng Hợp & Trọng Số Đánh Giá Năm
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-4">Tiêu chí tổng hợp Năm</th>
                    <th className="py-3 px-4 text-center w-28">Tỷ trọng</th>
                    <th className="py-3 px-4">Công thức / Cách tính</th>
                    <th className="py-3 px-4">Mục đích đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Tiêu chí 1: TB 12 tháng */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-500 text-center">1</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          M
                        </div>
                        <span>Trung bình điểm 12 tháng</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-900 font-black text-xs">
                        70%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-950 bg-indigo-50/40">
                      (Tổng điểm Tháng 1 + ... + Tháng 12) / 12
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">
                      Đánh giá sự bền bỉ, tính ổn định và kỷ luật xuyên suốt năm của nhân sự.
                    </td>
                  </tr>

                  {/* Tiêu chí 2: Bài kiểm tra tổng hợp cuối năm */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-500 text-center">2</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          E
                        </div>
                        <span>Bài kiểm tra tổng hợp cuối năm</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs">
                        20%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-950 bg-emerald-50/40">
                      Căn cứ trên thang điểm 100 của bài thi sát hạch năm (nhân hệ số 0.2)
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">
                      Đánh giá lại tay nghề, chứng chỉ an toàn lao động và kiến thức vận hành thiết bị quy mô toàn đội/tổ.
                    </td>
                  </tr>

                  {/* Tiêu chí 3: Tổng kết Khen thưởng/Kỷ luật năm */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-500 text-center">3</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                          R
                        </div>
                        <span>Tổng kết Khen thưởng / Kỷ luật năm</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-xs">
                        10%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-amber-950 bg-amber-50/40">
                      Dựa trên dữ liệu nhân sự cấp Đội/Công ty (nhân hệ số 0.1)
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">
                      Nếu đạt danh hiệu hoặc có sáng kiến cấp công ty: <b>Điểm tối đa (100đ × 0.1 = 10đ)</b>. Có án kỷ luật bằng văn bản: <b>0 điểm</b>.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Khung Phân Hạng Đánh Giá Năm (Thang 100 điểm) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base">
              Phân Hạng Đánh Giá Năm (Thang 100 điểm)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* >= 90: Xuất sắc */}
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-200 text-purple-900 font-mono">
                    ≥ 90 điểm
                  </span>
                  <span className="text-xs font-bold text-purple-700">🌟 Xuất Sắc</span>
                </div>
                <h4 className="font-black text-purple-950 text-sm">
                  Hoàn thành Xuất sắc nhiệm vụ
                </h4>
                <p className="text-xs text-purple-900/80 leading-relaxed">
                  Cá nhân tiêu biểu toàn năm. Ưu tiên xét khen thưởng cấp Công ty, nâng bậc lương trước hạn hoặc bổ nhiệm cán bộ kỹ thuật.
                </p>
              </div>

              {/* 75 - 89: Tốt */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-200 text-emerald-900 font-mono">
                    75 - 89 điểm
                  </span>
                  <span className="text-xs font-bold text-emerald-700">🟢 Tốt</span>
                </div>
                <h4 className="font-black text-emerald-950 text-sm">
                  Hoàn thành Tốt nhiệm vụ
                </h4>
                <p className="text-xs text-emerald-900/80 leading-relaxed">
                  Đạt kỳ vọng tổ chức. Đạt danh hiệu Lao động Tiên tiến, xét nâng bậc lương theo niên hạn quy định.
                </p>
              </div>

              {/* 60 - 74: Hoàn thành nhiệm vụ */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-200 text-amber-900 font-mono">
                    60 - 74 điểm
                  </span>
                  <span className="text-xs font-bold text-amber-700">🟡 Đạt</span>
                </div>
                <h4 className="font-black text-amber-950 text-sm">
                  Hoàn thành nhiệm vụ
                </h4>
                <p className="text-xs text-amber-900/80 leading-relaxed">
                  <b>Xét giữ nguyên bậc lương.</b> Cần tăng cường bồi dưỡng chuyên môn, rút kinh nghiệm các hạn chế trong năm.
                </p>
              </div>

              {/* < 60: Không hoàn thành */}
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-200 text-rose-900 font-mono">
                    &lt; 60 điểm
                  </span>
                  <span className="text-xs font-bold text-rose-700">🔴 Không Đạt</span>
                </div>
                <h4 className="font-black text-rose-950 text-sm">
                  Không hoàn thành nhiệm vụ
                </h4>
                <p className="text-xs text-rose-900/80 leading-relaxed">
                  <b>Xem xét luân chuyển vị trí hoặc đào tạo lại.</b> Kéo dài thời hạn nâng lương và lập biên bản theo dõi năng lực đặc biệt.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BẢNG ĐIỂM THÁNG THỰC TẾ (SIMULATOR / AUDIT MATRIX)                 */}
      {/* ========================================================================= */}
      {activeTab === 'MONTHLY_SIMULATOR' && (
        <div className="space-y-6">
          {/* Controls Bar: Chọn tháng & Bộ lọc */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Tháng đánh giá:</span>
              </div>
              <input
                type="text"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                placeholder="MM/YYYY (ví dụ: 03/2026)"
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 w-32 focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-[11px] text-slate-400">
                (Tự động đối chiếu BXXL, Bài thi trắc nghiệm, Vi phạm và Sáng kiến của tháng)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Lọc phòng ban */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả bộ phận ({employees.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Lọc phân hạng */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả xếp loại</option>
                <option value="EXCELLENT">🌟 Xuất sắc (≥95đ)</option>
                <option value="GOOD">🟢 Tốt (80-94đ)</option>
                <option value="FAIR">🔵 Khá (65-79đ)</option>
                <option value="AVERAGE">🟡 Trung bình (50-64đ)</option>
                <option value="POOR">🔴 Kém (&lt;50đ / Sự cố)</option>
              </select>

              {/* Tìm kiếm */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm nhân viên..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          {/* Thống kê tỷ lệ phân bố Tháng Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Tổng Nhân Sự</span>
              <span className="text-lg font-black text-slate-900">{monthlyStats.total}</span>
            </div>
            <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200 text-center">
              <span className="text-[10px] font-bold text-purple-700 block uppercase">Xuất Sắc (≥95đ)</span>
              <span className="text-lg font-black text-purple-900">
                {monthlyStats.excellent} <span className="text-xs font-normal">({monthlyStats.pctExcellent}%)</span>
              </span>
            </div>
            <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">Tốt (80-94đ)</span>
              <span className="text-lg font-black text-emerald-900">
                {monthlyStats.good} <span className="text-xs font-normal">({monthlyStats.pctGood}%)</span>
              </span>
            </div>
            <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-blue-700 block uppercase">Khá (65-79đ)</span>
              <span className="text-lg font-black text-blue-900">
                {monthlyStats.fair} <span className="text-xs font-normal">({monthlyStats.pctFair}%)</span>
              </span>
            </div>
            <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-700 block uppercase">Trung Bình (50-64đ)</span>
              <span className="text-lg font-black text-amber-900">
                {monthlyStats.average} <span className="text-xs font-normal">({monthlyStats.pctAverage}%)</span>
              </span>
            </div>
            <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200 text-center">
              <span className="text-[10px] font-bold text-rose-700 block uppercase">Kém (&lt;50đ)</span>
              <span className="text-lg font-black text-rose-900">
                {monthlyStats.poor} <span className="text-xs font-normal">({monthlyStats.pctPoor}%)</span>
              </span>
            </div>
            <div className="bg-red-50 p-3 rounded-2xl border border-red-200 text-center">
              <span className="text-[10px] font-bold text-red-700 block uppercase">Cờ Đào Tạo Lại</span>
              <span className="text-lg font-black text-red-900">
                {monthlyStats.flagRetraining} <span className="text-xs">NV</span>
              </span>
            </div>
          </div>

          {/* Table: Danh Sách Bảng Điểm Tháng */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">
                Bảng Điểm Đánh Giá Năng Lực Chi Tiết Tháng {selectedMonth}
              </h3>
              <span className="text-xs text-slate-400">
                Hiển thị {filteredMonthlyEvaluations.length} / {employees.length} nhân viên
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-3.5">Nhân viên</th>
                    <th className="py-3 px-3">Bộ phận</th>
                    <th className="py-3 px-3 text-center">1. Năng Suất (50đ)</th>
                    <th className="py-3 px-3 text-center">2. Kiểm Tra (30đ)</th>
                    <th className="py-3 px-3 text-center">3. Tuân Thủ (20đ)</th>
                    <th className="py-3 px-3 text-center">4. Thưởng (+)</th>
                    <th className="py-3 px-3.5 text-center font-black">Tổng Điểm</th>
                    <th className="py-3 px-3.5 text-center">Xếp Loại Tháng</th>
                    <th className="py-3 px-3 text-center w-16">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMonthlyEvaluations.length > 0 ? (
                    filteredMonthlyEvaluations.map(({ emp, detail }, idx) => {
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={emp.avatar}
                                alt={emp.fullName}
                                className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-900">{emp.fullName}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{emp.employeeCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {emp.department || 'Tổ RTG'}
                          </td>

                          {/* 1. Năng suất */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                                detail.productivityRating === 'A'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : detail.productivityRating === 'a'
                                  ? 'bg-teal-100 text-teal-800'
                                  : detail.productivityRating === 'B'
                                  ? 'bg-blue-100 text-blue-800'
                                  : detail.productivityRating === 'b'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              Loại {detail.productivityRating}: +{detail.productivityScore}đ
                            </span>
                          </td>

                          {/* 2. Kiểm tra */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-800">
                                +{detail.quizScore}đ <span className="text-[10px] text-slate-400">({detail.rawQuizScore}đ thi)</span>
                              </span>
                              {detail.needsRetraining && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mt-0.5">
                                  <Flag className="w-2.5 h-2.5" />
                                  Đào tạo lại
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Tuân thủ */}
                          <td className="py-3 px-3 text-center">
                            {detail.hasSevereIncident ? (
                              <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-600 text-white">
                                Sự cố dây chuyền (0đ)
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span
                                  className={`font-bold ${
                                    detail.complianceScore === 20 ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {detail.complianceScore} / 20đ
                                </span>
                                {detail.complianceDeductions > 0 && (
                                  <span className="text-[9px] text-rose-600 font-semibold">
                                    - {detail.complianceDeductions}đ vi phạm
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 4. Thưởng */}
                          <td className="py-3 px-3 text-center">
                            {detail.bonusScore > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                                +{detail.bonusScore}đ
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">0đ</span>
                            )}
                          </td>

                          {/* Tổng điểm */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`text-sm font-black px-2.5 py-1 rounded-xl ${
                                detail.totalScore >= 95
                                  ? 'bg-purple-100 text-purple-900'
                                  : detail.totalScore >= 80
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : detail.totalScore >= 65
                                  ? 'bg-blue-100 text-blue-900'
                                  : detail.totalScore >= 50
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {detail.totalScore} đ
                            </span>
                          </td>

                          {/* Xếp loại tháng */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                detail.tier === 'EXCELLENT'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : detail.tier === 'GOOD'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : detail.tier === 'FAIR'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : detail.tier === 'AVERAGE'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {detail.tierLabel}
                            </span>
                          </td>

                          {/* Chi tiết modal */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setScorecardModalEmp({
                                  emp,
                                  monthlyDetail: detail,
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors"
                              title="Xem phiếu điểm chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Không tìm thấy dữ liệu nhân viên phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BẢNG TỔNG HỢP ĐÁNH GIÁ NĂM (70% / 20% / 10%)                        */}
      {/* ========================================================================= */}
      {activeTab === 'ANNUAL_MATRIX' && (
        <div className="space-y-6">
          {/* Controls Bar: Chọn năm & Bộ lọc */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-700">Năm đánh giá tổng hợp:</span>
              </div>
              <input
                type="text"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                placeholder="YYYY (ví dụ: 2026)"
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 w-28 focus:ring-2 focus:ring-purple-500/20"
              />
              <span className="text-[11px] text-slate-400">
                (Trọng số: 70% TB 12 tháng + 20% Bài thi sát hạch cuối năm + 10% Khen thưởng/Kỷ luật)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả bộ phận ({employees.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả xếp loại năm</option>
                <option value="EXCELLENT">🌟 Hoàn thành Xuất sắc (≥90đ)</option>
                <option value="GOOD">🟢 Hoàn thành Tốt (75-89đ)</option>
                <option value="PASS">🟡 Hoàn thành nhiệm vụ (60-74đ)</option>
                <option value="FAIL">🔴 Không hoàn thành (&lt;60đ)</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm nhân viên..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          {/* Thống kê phân bố Năm Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Tổng Nhân Sự</span>
              <span className="text-lg font-black text-slate-900">{annualStats.total}</span>
            </div>
            <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200 text-center">
              <span className="text-[10px] font-bold text-purple-700 block uppercase">Xuất Sắc (≥90đ)</span>
              <span className="text-lg font-black text-purple-900">
                {annualStats.excellent} <span className="text-xs font-normal">({annualStats.pctExcellent}%)</span>
              </span>
            </div>
            <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">Tốt (75-89đ)</span>
              <span className="text-lg font-black text-emerald-900">
                {annualStats.good} <span className="text-xs font-normal">({annualStats.pctGood}%)</span>
              </span>
            </div>
            <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-700 block uppercase">Hoàn Thành (60-74đ)</span>
              <span className="text-lg font-black text-amber-900">
                {annualStats.pass} <span className="text-xs font-normal">({annualStats.pctPass}%)</span>
              </span>
            </div>
            <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200 text-center">
              <span className="text-[10px] font-bold text-rose-700 block uppercase">Không Đạt (&lt;60đ)</span>
              <span className="text-lg font-black text-rose-900">
                {annualStats.fail} <span className="text-xs font-normal">({annualStats.pctFail}%)</span>
              </span>
            </div>
          </div>

          {/* Table: Danh Sách Tổng Hợp Năm */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">
                Bảng Tổng Hợp Đánh Giá Năng Lực & Thi Đua Năm {selectedYear}
              </h3>
              <span className="text-xs text-slate-400">
                Hiển thị {filteredAnnualEvaluations.length} / {employees.length} nhân viên
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-3.5">Nhân viên</th>
                    <th className="py-3 px-3">Bộ phận</th>
                    <th className="py-3 px-3 text-center">1. TB 12 Tháng (70%)</th>
                    <th className="py-3 px-3 text-center">2. Thi Sát Hạch (20%)</th>
                    <th className="py-3 px-3 text-center">3. Khen Thưởng/KL (10%)</th>
                    <th className="py-3 px-3.5 text-center font-black">Điểm Năm (100đ)</th>
                    <th className="py-3 px-3.5 text-center">Xếp Hạng Năm</th>
                    <th className="py-3 px-3.5">Đề xuất Chế độ / Lương</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAnnualEvaluations.length > 0 ? (
                    filteredAnnualEvaluations.map(({ emp, detail }, idx) => {
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={emp.avatar}
                                alt={emp.fullName}
                                className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-900">{emp.fullName}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{emp.employeeCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {emp.department || 'Tổ RTG'}
                          </td>

                          {/* 1. TB 12 tháng (70%) */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-indigo-900">
                                {detail.weightedMonthlyScore} đ
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                (TB: {detail.monthlyAverage}đ)
                              </span>
                            </div>
                          </td>

                          {/* 2. Thi cuối năm (20%) */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-emerald-900">
                                {detail.weightedExamScore} đ
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                (Bài thi: {detail.yearEndExamRawScore}đ)
                              </span>
                            </div>
                          </td>

                          {/* 3. Khen thưởng / Kỷ luật (10%) */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`font-bold ${
                                  detail.hasDisciplineRecord
                                    ? 'text-rose-700'
                                    : detail.hasCompanyAward
                                    ? 'text-purple-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {detail.weightedRewardScore} đ
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {detail.hasDisciplineRecord
                                  ? 'Bị kỷ luật'
                                  : detail.hasCompanyAward
                                  ? 'Sáng kiến cấp Cty'
                                  : 'Hoàn thành tốt'}
                              </span>
                            </div>
                          </td>

                          {/* Tổng điểm năm */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`text-sm font-black px-2.5 py-1 rounded-xl ${
                                detail.totalAnnualScore >= 90
                                  ? 'bg-purple-100 text-purple-900'
                                  : detail.totalAnnualScore >= 75
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : detail.totalAnnualScore >= 60
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {detail.totalAnnualScore} đ
                            </span>
                          </td>

                          {/* Xếp hạng năm */}
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                detail.annualRank === 'EXCELLENT'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : detail.annualRank === 'GOOD'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : detail.annualRank === 'PASS'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {detail.annualRankLabel}
                            </span>
                          </td>

                          {/* Đề xuất chế độ */}
                          <td className="py-3 px-3.5 text-slate-700 font-medium leading-tight">
                            {detail.recommendation}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Không tìm thấy dữ liệu nhân viên phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PHIẾU ĐIỂM ĐÁNH GIÁ CHI TIẾT CỦA TỪNG NHÂN SỰ                      */}
      {/* ========================================================================= */}
      {scorecardModalEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-scaleUp my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <img
                  src={scorecardModalEmp.emp.avatar}
                  alt={scorecardModalEmp.emp.fullName}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-100"
                />
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Phiếu Điểm Đánh Giá Năng Lực Chi Tiết
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>{scorecardModalEmp.emp.fullName}</span>
                    <span>•</span>
                    <span className="font-mono">{scorecardModalEmp.emp.employeeCode}</span>
                    <span>•</span>
                    <span>{scorecardModalEmp.emp.department || 'Tổ RTG'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScorecardModalEmp(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Score & Tier Badge */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-700 block uppercase">
                  Tổng Điểm Tháng {scorecardModalEmp.monthlyDetail.month}
                </span>
                <span className="text-2xl font-black text-indigo-950">
                  {scorecardModalEmp.monthlyDetail.totalScore} / 100 điểm
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 block uppercase">Xếp Loại</span>
                <span className="inline-block px-3 py-1 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-2xs">
                  {scorecardModalEmp.monthlyDetail.tierLabel}
                </span>
              </div>
            </div>

            {/* Detailed Breakdown: 4 Core Groups */}
            <div className="space-y-3">
              {/* Nhóm 1 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    1. Kết quả bình xét năng suất (Tối đa 50đ):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scorecardModalEmp.monthlyDetail.productivityNote}
                  </span>
                </div>
                <span className="text-sm font-black text-emerald-700">
                  +{scorecardModalEmp.monthlyDetail.productivityScore} đ
                </span>
              </div>

              {/* Nhóm 2 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    2. Kết quả bài kiểm tra (Tối đa 30đ):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Điểm thi sát hạch: {scorecardModalEmp.monthlyDetail.rawQuizScore}đ / 100
                    {scorecardModalEmp.monthlyDetail.needsRetraining && (
                      <span className="text-rose-600 font-bold ml-1.5">(Yêu cầu đào tạo lại)</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-black text-indigo-700">
                  +{scorecardModalEmp.monthlyDetail.quizScore} đ
                </span>
              </div>

              {/* Nhóm 3 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    3. Tuân thủ & Vi phạm sự cố (Khởi điểm 20đ):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scorecardModalEmp.monthlyDetail.hasSevereIncident
                      ? 'Vi phạm sự cố nghiêm trọng dây chuyền: Hủy toàn bộ điểm'
                      : `Trừ vi phạm: -${scorecardModalEmp.monthlyDetail.complianceDeductions}đ (Hành chính: ${scorecardModalEmp.monthlyDetail.adminViolationsCount}, Điều hành: ${scorecardModalEmp.monthlyDetail.dispatchViolationsCount}, Sự cố nhẹ: ${scorecardModalEmp.monthlyDetail.minorIncidentsCount})`}
                  </span>
                </div>
                <span className="text-sm font-black text-rose-700">
                  {scorecardModalEmp.monthlyDetail.complianceScore} / 20 đ
                </span>
              </div>

              {/* Nhóm 4 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    4. Góp ý & Đề xuất sáng kiến (Điểm thưởng):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scorecardModalEmp.monthlyDetail.validSuggestionsCount} đề xuất hợp lệ (+5đ),{' '}
                    {scorecardModalEmp.monthlyDetail.effectiveSuggestionsCount} sáng kiến áp dụng thực tế (+10đ)
                  </span>
                </div>
                <span className="text-sm font-black text-amber-700">
                  +{scorecardModalEmp.monthlyDetail.bonusScore} đ
                </span>
              </div>
            </div>

            {/* Note & Action */}
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900">
              📌 <b>Nhận xét hệ thống:</b> {scorecardModalEmp.monthlyDetail.statusNote}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setScorecardModalEmp(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Đóng Phiếu Điểm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
