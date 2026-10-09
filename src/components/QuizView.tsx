import {api} from '../services/supabase';
import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  Search,
  UserCheck,
  Folder,
  FolderPlus,
  Sparkles,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Plus,
  Tag,
  Filter,
  ArrowLeft,
  Calendar,
  Shuffle,
  Timer,
  CheckSquare,
  Square,
  Users,
  UserX,
  Trophy,
  Medal,
  Copy,
  Check,
  Lock,
  X,
  BarChart3,
  SlidersHorizontal,
  Layers,
  ListFilter,
  FileText,
  TrendingUp,
  Eye,
  Send,
} from 'lucide-react';
import { Quiz, QuizQuestion, QuestionFolder, QuizSubmission, Employee, AppSettings, ExamType } from '../types';
import { AiQuestionImportModal } from './AiQuestionImportModal';
import { syncAllQuizzesToSheet } from '../services/googleSheetSyncService';
import { isTestAccount, isTestSubmission } from '../utils/testAccountHelper';

export type GradeLevel = 'GIOI' | 'KHA' | 'TRUNG_BINH' | 'KHONG_DAT';

export function getScoreGrade(score: number): {
  grade: GradeLevel;
  label: string;
  badgeClass: string;
  textClass: string;
  bgLightClass: string;
} {
  if (score >= 85) {
    return {
      grade: 'GIOI',
      label: 'Giỏi',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      textClass: 'text-emerald-600',
      bgLightClass: 'bg-emerald-50 border-emerald-200',
    };
  }
  if (score >= 70) {
    return {
      grade: 'KHA',
      label: 'Khá',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      textClass: 'text-blue-600',
      bgLightClass: 'bg-blue-50 border-blue-200',
    };
  }
  if (score >= 50) {
    return {
      grade: 'TRUNG_BINH',
      label: 'Trung bình',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      textClass: 'text-amber-600',
      bgLightClass: 'bg-amber-50 border-amber-200',
    };
  }
  return {
    grade: 'KHONG_DAT',
    label: 'Không đạt',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    textClass: 'text-rose-600',
    bgLightClass: 'bg-rose-50 border-rose-200',
  };
}

export function getQuizScheduleStatus(quiz: Quiz): {
  status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
  label: string;
  badgeClass: string;
} {
  const now = Date.now();
  if (quiz.scheduledStartTime) {
    const start = new Date(quiz.scheduledStartTime).getTime();
    if (now < start) {
      return {
        status: 'UPCOMING',
        label: `Mở đề: ${new Date(quiz.scheduledStartTime).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    }
  }

  if (quiz.scheduledEndTime) {
    const end = new Date(quiz.scheduledEndTime).getTime();
    if (now > end) {
      return {
        status: 'EXPIRED',
        label: `Đã kết thúc: ${new Date(quiz.scheduledEndTime).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
      };
    }

    return {
      status: 'ACTIVE',
      label: `Đến: ${new Date(quiz.scheduledEndTime).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  return {
    status: 'ACTIVE',
    label: 'Đang mở kiểm tra',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };
}

export const isQuestionMultiSelect = (q?: QuizQuestion | Omit<QuizQuestion, 'id'> | null): boolean => {
  if (!q) return false;
  if (q.questionType === 'MULTIPLE') return true;
  if (Array.isArray(q.correctOptionIds) && q.correctOptionIds.length > 1) return true;
  if (typeof q.correctOptionId === 'string' && q.correctOptionId.includes(',')) return true;
  return false;
};

export const getQuestionCorrectOptionIds = (q?: QuizQuestion | Omit<QuizQuestion, 'id'> | null): string[] => {
  if (!q) return [];
  if (Array.isArray(q.correctOptionIds) && q.correctOptionIds.length > 0) return q.correctOptionIds;
  if (typeof q.correctOptionId === 'string' && q.correctOptionId.trim()) {
    return q.correctOptionId.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
};

export const getAnswerIds = (ans: unknown): string[] => {
  if (!ans) return [];
  if (Array.isArray(ans)) return ans.map(s => String(s).trim()).filter(Boolean);
  if (typeof ans === 'string') return ans.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  return [];
};

interface QuizViewProps {
  quizzes: Quiz[];
  submissions: QuizSubmission[];
  currentUser: Employee;
  allEmployees: Employee[];
  questionBank: QuizQuestion[];
  onSaveBankQuestion: (question: QuizQuestion) => Promise<void>;
  onDeleteBankQuestion: (id:string) => Promise<void>;
  questionFolders: QuestionFolder[];
  onSaveQuestionFolder: (folder:QuestionFolder) => Promise<void>;
  onDeleteQuestionFolder: (id:string) => Promise<void>;
  onSaveSubmission: (sub: QuizSubmission) => void;
  onAddQuiz?: (quiz: Quiz) => Promise<void>;
  onEditQuiz?: (quiz: Quiz) => void;
  onDeleteQuiz?: (id: string) => void;
  onAssignQuiz?: (quizId: string, recipientIds: string[]) => Promise<void>;
  initialAiFile?: { name: string; blob?: Blob } | null;
  onClearInitialAiFile?: () => void;
  onBackToDashboard?: () => void;
  appSettings?: AppSettings | null;
}

export const QuizView: React.FC<QuizViewProps> = ({
  quizzes = [],
  submissions = [],
  currentUser,
  allEmployees = [],
  questionBank: savedQuestionBank = [],
  onSaveBankQuestion,
  onDeleteBankQuestion,
  questionFolders = [],
  onSaveQuestionFolder,
  onDeleteQuestionFolder,
  onSaveSubmission,
  onAddQuiz,
  onEditQuiz,
  onDeleteQuiz,
  onAssignQuiz,
  initialAiFile,
  onClearInitialAiFile,
  onBackToDashboard,
  appSettings,
}) => {
  const [questionDrafts,setQuestionDrafts]=useState<Record<string,QuizQuestion>>({});
  const [bankBusy,setBankBusy]=useState(false), [bankError,setBankError]=useState(''), [bankNotice,setBankNotice]=useState('');
  const bankInFlight=useRef(false);
  const questionBank=[...Object.values(questionDrafts).filter(q=>!savedQuestionBank.some(saved=>saved.id===q.id)),...savedQuestionBank.map(q=>questionDrafts[q.id]||q)];
  const onUpdateQuestionBank=(items:QuizQuestion[])=>setQuestionDrafts(previous=>{
    const next={...previous};
    for(const q of items)if(JSON.stringify(q)!==JSON.stringify(questionBank.find(old=>old.id===q.id)))next[q.id]=q;
    return next;
  });
  const bankAction=async(action:()=>Promise<void>,message:string)=>{
    if(bankInFlight.current)return;
    bankInFlight.current=true;setBankBusy(true);setBankError('');setBankNotice('');
    try{await action();setBankNotice(message);}catch(e){setBankError((e as Error).message);}finally{bankInFlight.current=false;setBankBusy(false);}
  };
  const clearDraft=(id:string)=>setQuestionDrafts(previous=>{const next={...previous};delete next[id];return next;});
  const [activeTab, setActiveTab] = useState<'LIST' | 'TAKE' | 'RESULT' | 'RECORDS' | 'CREATE' | 'BANK'>('LIST');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // Google Sheet Webhook Sync state for Quiz
  const [isSyncingQuizSheet, setIsSyncingQuizSheet] = useState(false);
  const [quizSyncNotice, setQuizSyncNotice] = useState<string | null>(null);

  const handleSyncQuizzesToSheet = async () => {
    if (!confirm('Xếp hàng báo cáo kết quả thi đã lưu?')) return;
    setIsSyncingQuizSheet(true); setQuizSyncNotice(null);
    try { await syncAllQuizzesToSheet('',submissions); setQuizSyncNotice('Đã xếp hàng báo cáo. Quản trị viên theo dõi kết quả tại Google Sync.'); }
    catch(err:any) { setQuizSyncNotice(err.message); }
    finally { setIsSyncingQuizSheet(false); }
  };

  // Take quiz state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Result state
  const [latestResult, setLatestResult] = useState<QuizSubmission | null>(null);

  // Create Quiz State
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [newQuizExamType, setNewQuizExamType] = useState<ExamType>('OFFICIAL');
  const [newQuizDuration, setNewQuizDuration] = useState(15);
  const [newQuizPassScore, setNewQuizPassScore] = useState(80);
  const [newQuizMaxAttempts, setNewQuizMaxAttempts] = useState<number>(1);
  const [newQuizQuestions, setNewQuizQuestions] = useState<Omit<QuizQuestion, 'id'>[]>([]);
  
  // Multi-folder exam creation state
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [createQuizActiveFolderTab, setCreateQuizActiveFolderTab] = useState<string>('all');
  const [createQuizSearch, setCreateQuizSearch] = useState<string>('');
  const [createQuizReviewMode, setCreateQuizReviewMode] = useState<'SELECT' | 'REVIEW'>('SELECT');
  const [showFolderMatrix, setShowFolderMatrix] = useState<boolean>(false);
  const [folderQuotas, setFolderQuotas] = useState<Record<string, number>>({});
  const hasInitializedFoldersRef = useRef<boolean>(false);
  
  // Hẹn giờ phát đề, kết thúc kiểm tra & câu hỏi ngẫu nhiên
  const [newQuizScheduledStart, setNewQuizScheduledStart] = useState<string>('');
  const [newQuizScheduledEnd, setNewQuizScheduledEnd] = useState<string>('');
  const [newQuizIsRandom, setNewQuizIsRandom] = useState<boolean>(false);
  const [newQuizRandomCount, setNewQuizRandomCount] = useState<number>(10);
  const [autoPickCount, setAutoPickCount] = useState<number>(10);

  // Modal Tổng hợp cá nhân chưa hoàn thành bài thi
  const [viewUncompletedQuiz, setViewUncompletedQuiz] = useState<Quiz | null>(null);
  const [uncompletedSearch, setUncompletedSearch] = useState<string>('');
  const [copiedUncompleted, setCopiedUncompleted] = useState<boolean>(false);
  const [uncompletedModalTab, setUncompletedModalTab] = useState<'UNCOMPLETED' | 'COMPLETED'>('UNCOMPLETED');

  // Phân mục trong Hồ sơ năng lực (Xem theo nhân sự, Xem theo đề thi, Toàn bộ bài nộp)
  const [recordsSection, setRecordsSection] = useState<'EMPLOYEES' | 'EXAMS' | 'SUBMISSIONS'>('EMPLOYEES');
  const [employeeRecordSearch, setEmployeeRecordSearch] = useState<string>('');
  const [employeeDeptFilter, setEmployeeDeptFilter] = useState<string>('ALL');
  const [examRecordSearch, setExamRecordSearch] = useState<string>('');
  const [examTypeFilter, setExamTypeFilter] = useState<'ALL' | 'OFFICIAL' | 'PRACTICE'>('ALL');
  const [selectedEmpQuizDetail, setSelectedEmpQuizDetail] = useState<Employee | null>(null);

  // Lọc theo xếp loại điểm số (Giỏi, Khá, Trung bình, Không đạt) trong Hồ sơ năng lực
  const [scoreGradeFilter, setScoreGradeFilter] = useState<'ALL' | 'GIOI' | 'KHA' | 'TRUNG_BINH' | 'KHONG_DAT'>('ALL');

  // Lọc tài khoản test và bài nộp test khỏi thống kê chung
  const testAccountIds = React.useMemo(
    () => new Set(allEmployees.filter(isTestAccount).map((e) => e.id)),
    [allEmployees]
  );

  const standardSubmissions = React.useMemo(
    () => submissions.filter((s) => !isTestSubmission(s, allEmployees) && !testAccountIds.has(s.employeeId)),
    [submissions, allEmployees, testAccountIds]
  );

  const standardEmployees = React.useMemo(
    () => allEmployees.filter((e) => !isTestAccount(e)),
    [allEmployees]
  );

  // Thống kê tổng hợp số lượng & tỷ lệ các bậc điểm Giỏi, Khá, Trung bình, Không đạt (chỉ tính bài thi chuẩn)
  const gradeStats = React.useMemo(() => {
    let gioi = 0, kha = 0, tb = 0, kd = 0;
    standardSubmissions.forEach((s) => {
      const g = getScoreGrade(s.score).grade;
      if (g === 'GIOI') gioi++;
      else if (g === 'KHA') kha++;
      else if (g === 'TRUNG_BINH') tb++;
      else kd++;
    });
    const total = standardSubmissions.length || 1;
    return {
      gioi,
      kha,
      tb,
      kd,
      gioiPercent: Math.round((gioi / total) * 100),
      khaPercent: Math.round((kha / total) * 100),
      tbPercent: Math.round((tb / total) * 100),
      kdPercent: Math.round((kd / total) * 100),
      totalSubmissions: standardSubmissions.length,
    };
  }, [standardSubmissions]);

  // Lấy danh sách nhân sự được giao đề (loại trừ tài khoản test độc lập)
  const getQuizTargetEmployees = React.useCallback((quiz: Quiz) => {
    const activeBase = allEmployees.filter((e) => !isTestAccount(e) && e.status === 'ACTIVE');
    if (quiz.targetEmployeeIds && quiz.targetEmployeeIds.length > 0) {
      return activeBase.filter((e) => quiz.targetEmployeeIds!.includes(e.id));
    }
    if (quiz.targetDepartments?.length && !quiz.targetDepartments.includes('ALL')) {
      return activeBase.filter((e) => quiz.targetDepartments.includes(e.department));
    }
    return activeBase;
  }, [allEmployees]);

  // Danh sách các Ca trong Tổ RTG (loại trừ tài khoản test)
  const availableShifts = React.useMemo(() => {
    const depts = new Set<string>();
    allEmployees.forEach((e) => {
      if (!isTestAccount(e) && e.status === 'ACTIVE' && e.department) {
        depts.add(e.department);
      }
    });
    return Array.from(depts).sort();
  }, [allEmployees]);

  // Danh sách nhân sự có thể giao bài (loại trừ tài khoản test)
  const assignableEmployees = React.useMemo(() => {
    return allEmployees.filter((e) => !isTestAccount(e) && e.status === 'ACTIVE');
  }, [allEmployees]);

  // Question Bank Folders & AI State
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [bankSearch, setBankSearch] = useState<string>('');
  const [showAiImportModal, setShowAiImportModal] = useState<boolean>(false);
  const [folderModalOpen, setFolderModalOpen] = useState<boolean>(false);
  const [editingFolder, setEditingFolder] = useState<QuestionFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState<string>('');
  const [folderDescInput, setFolderDescInput] = useState<string>('');

  // Assign Quiz State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);
  const [assignType, setAssignType] = useState<'ALL' | 'DEPARTMENT' | 'INDIVIDUAL'>('ALL');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedIndividualIds, setSelectedIndividualIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [assignShiftFilter, setAssignShiftFilter] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [quizActionError, setQuizActionError] = useState('');
  const createPending = useRef(false);
  const assignPending = useRef(false);

  // Search in records
  const [recordSearch, setRecordSearch] = useState('');

  // Open AI modal if initialAiFile is passed (e.g. from Google Drive)
  useEffect(() => {
    if (initialAiFile) {
      setActiveTab('BANK');
      setShowAiImportModal(true);
    }
  }, [initialAiFile]);

  // Countdown timer effect
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timeLeftSeconds > 0) {
      interval = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeftSeconds]);

  const [attemptId,setAttemptId]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const handleStartQuiz = async (quiz: Quiz) => {
    // 1. Kiểm tra hẹn giờ phát đề & kết thúc kiểm tra
    const scheduleInfo = getQuizScheduleStatus(quiz);
    if (scheduleInfo.status === 'UPCOMING') {
      alert(
        `Bài kiểm tra này chưa đến giờ mở đề!\nThời gian phát đề dự kiến: ${new Date(
          quiz.scheduledStartTime!
        ).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`
      );
      return;
    }
    if (scheduleInfo.status === 'EXPIRED') {
      alert(
        `Bài kiểm tra này đã kết thúc kiểm tra vào lúc: ${new Date(
          quiz.scheduledEndTime!
        ).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`
      );
      return;
    }

    // 2. Kiểm tra giới hạn số lần làm bài quy định
    const userPriorSubmissions = submissions.filter(
      (s) => s.quizId === quiz.id && s.employeeId === currentUser.id
    );
    if (quiz.maxAttempts && quiz.maxAttempts > 0 && userPriorSubmissions.length >= quiz.maxAttempts) {
      alert(
        `Bạn đã hết số lần làm bài quy định (${userPriorSubmissions.length}/${quiz.maxAttempts} lần). Hệ thống không cho phép làm lại bài này nữa.`
      );
      return;
    }

    try {
      const attempt=await api('/exams/'+encodeURIComponent(quiz.id)+'/start',{method:'POST'});
      setAttemptId(attempt.attemptId);setSelectedQuiz(attempt.quiz);setSelectedAnswers({});setCurrentQuestionIdx(0);
      setTimeLeftSeconds(Math.max(0,Math.floor((Date.parse(attempt.expiresAt)-Date.now())/1000)));setTimerActive(true);
    }catch(e){alert((e as Error).message);return;}
    setActiveTab('TAKE');
  };

  // Danh sách các thư mục khả dụng (kèm thư mục Chưa phân loại nếu có)
  const availableQuestionFolders = React.useMemo(() => {
    const list = questionFolders.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      color: f.color || 'indigo',
      count: questionBank.filter((q) => q.folderId === f.id).length,
    }));
    const uncatCount = questionBank.filter(
      (q) => !q.folderId || !questionFolders.some((f) => f.id === q.folderId)
    ).length;
    if (uncatCount > 0) {
      list.push({
        id: 'uncategorized',
        name: 'Chưa phân loại',
        description: 'Câu hỏi chưa được gán vào thư mục nào',
        color: 'slate',
        count: uncatCount,
      });
    }
    return list;
  }, [questionFolders, questionBank]);

  // Khởi tạo mặc định chọn tất cả thư mục khả dụng
  useEffect(() => {
    if (!hasInitializedFoldersRef.current && availableQuestionFolders.length > 0) {
      setSelectedFolderIds(availableQuestionFolders.map((f) => f.id));
      hasInitializedFoldersRef.current = true;
    }
  }, [availableQuestionFolders]);

  // Lấy ID thư mục chuẩn của câu hỏi
  const getQuestionFolderId = (q: { folderId?: string }) => {
    if (!q.folderId || !questionFolders.some((f) => f.id === q.folderId)) {
      return 'uncategorized';
    }
    return q.folderId;
  };

  // Lấy tên thư mục chuẩn của câu hỏi
  const getQuestionFolderName = (q: { folderId?: string }) => {
    const fId = getQuestionFolderId(q);
    if (fId === 'uncategorized') return 'Chưa phân loại';
    return questionFolders.find((f) => f.id === fId)?.name || 'Chưa phân loại';
  };

  // Bật/tắt chọn một thư mục
  const handleToggleFolder = (folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  };

  const handleSelectAllFolders = () => {
    setSelectedFolderIds(availableQuestionFolders.map((f) => f.id));
  };

  const handleDeselectAllFolders = () => {
    setSelectedFolderIds([]);
  };

  // Thống kê phân bổ câu hỏi trong đề thi hiện tại theo từng thư mục
  const selectedQuestionsSummary = React.useMemo(() => {
    const map: Record<string, number> = {};
    newQuizQuestions.forEach((q) => {
      const fId = getQuestionFolderId(q);
      map[fId] = (map[fId] || 0) + 1;
    });
    return map;
  }, [newQuizQuestions, questionFolders]);

  // Danh sách câu hỏi lọc theo các thư mục đã chọn & tìm kiếm
  const filteredQuestionBank = React.useMemo(() => {
    return questionBank.filter((q) => {
      const fId = getQuestionFolderId(q);
      if (!selectedFolderIds.includes(fId)) return false;
      if (createQuizActiveFolderTab !== 'all' && fId !== createQuizActiveFolderTab) return false;
      if (createQuizSearch.trim()) {
        const query = createQuizSearch.toLowerCase();
        const inQuestion = q.question.toLowerCase().includes(query);
        const inCitation = q.citation?.toLowerCase().includes(query);
        const inOptions = q.options.some((o) => o.text.toLowerCase().includes(query));
        if (!inQuestion && !inCitation && !inOptions) return false;
      }
      return true;
    });
  }, [questionBank, selectedFolderIds, createQuizActiveFolderTab, createQuizSearch, questionFolders]);

  // Tự động bốc ngẫu nhiên tổng hợp từ tất cả các thư mục đã chọn
  const handleAutoPickRandomQuestions = (mode: 'replace' | 'append' = 'replace') => {
    const pool = questionBank.filter((q) => {
      const fId = getQuestionFolderId(q);
      return selectedFolderIds.includes(fId);
    });

    if (pool.length === 0) {
      alert('Không có câu hỏi nào trong các thư mục đang chọn. Vui lòng chọn ít nhất 1 thư mục có câu hỏi.');
      return;
    }

    if (mode === 'replace') {
      const count = Math.min(Math.max(1, autoPickCount), pool.length);
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, count);
      setNewQuizQuestions(picked);
    } else {
      const existingKeys = new Set(newQuizQuestions.map((q) => q.question));
      const availableToPick = pool.filter((q) => !existingKeys.has(q.question));
      if (availableToPick.length === 0) {
        alert('Tất cả câu hỏi trong các thư mục đã chọn đều đã có trong đề thi!');
        return;
      }
      const count = Math.min(Math.max(1, autoPickCount), availableToPick.length);
      const shuffled = [...availableToPick].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, count);
      setNewQuizQuestions((prev) => [...prev, ...picked]);
    }
  };

  // Bốc ngẫu nhiên theo ma trận phân bổ từng thư mục
  const handlePickByFolderMatrix = (mode: 'replace' | 'append' = 'replace') => {
    if (selectedFolderIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thư mục để bốc đề.');
      return;
    }

    let combinedPicked: QuizQuestion[] = [];
    let summaryDetails: string[] = [];
    const existingKeys = mode === 'append' ? new Set(newQuizQuestions.map((q) => q.question)) : new Set<string>();

    for (const fId of selectedFolderIds) {
      const folderObj = availableQuestionFolders.find((f) => f.id === fId);
      const quota = folderQuotas[fId] ?? Math.min(5, folderObj?.count || 0);
      if (quota <= 0) continue;

      const folderPool = questionBank.filter((q) => {
        const qFId = getQuestionFolderId(q);
        return qFId === fId && !existingKeys.has(q.question);
      });

      if (folderPool.length === 0) continue;

      const count = Math.min(quota, folderPool.length);
      const shuffled = [...folderPool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, count);
      combinedPicked.push(...picked);
      picked.forEach((p) => existingKeys.add(p.question));

      const fName = folderObj?.name || 'Thư mục';
      summaryDetails.push(`• ${fName}: ${count} câu`);
    }

    if (combinedPicked.length === 0) {
      alert('Vui lòng nhập số câu cần lấy (> 0) cho ít nhất 1 thư mục trong bảng ma trận.');
      return;
    }

    if (mode === 'replace') {
      setNewQuizQuestions(combinedPicked);
    } else {
      setNewQuizQuestions((prev) => [...prev, ...combinedPicked]);
    }
  };

  // Chọn tất cả câu hỏi đang hiển thị (cộng dồn không trùng lặp)
  const handleSelectAllFilteredQuestions = () => {
    if (filteredQuestionBank.length === 0) return;
    setNewQuizQuestions((prev) => {
      const existingKeys = new Set(prev.map((q) => q.question));
      const toAdd = filteredQuestionBank.filter((q) => !existingKeys.has(q.question));
      return [...prev, ...toAdd];
    });
  };

  // Bỏ chọn các câu hỏi đang hiển thị khỏi đề
  const handleDeselectFilteredQuestions = () => {
    if (filteredQuestionBank.length === 0) return;
    const filterKeys = new Set(filteredQuestionBank.map((q) => q.question));
    setNewQuizQuestions((prev) => prev.filter((q) => !filterKeys.has(q.question)));
  };

  // Bỏ chọn toàn bộ câu hỏi trong đề
  const handleDeselectAllQuestions = () => {
    if (newQuizQuestions.length > 0 && window.confirm('Bỏ chọn tất cả câu hỏi đang có trong đề thi này?')) {
      setNewQuizQuestions([]);
    }
  };

  // Bốc ngẫu nhiên riêng cho 1 thư mục và thêm vào đề
  const handlePickSingleFolder = (folderId: string, count: number) => {
    const existingKeys = new Set(newQuizQuestions.map((q) => q.question));
    const pool = questionBank.filter((q) => {
      const qFId = getQuestionFolderId(q);
      return qFId === folderId && !existingKeys.has(q.question);
    });
    if (pool.length === 0) {
      alert('Không còn câu hỏi khả dụng chưa thêm trong thư mục này!');
      return;
    }
    const safeCount = Math.min(Math.max(1, count), pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, safeCount);
    setNewQuizQuestions((prev) => [...prev, ...picked]);
  };

  // Thêm tất cả câu hỏi của 1 thư mục vào đề
  const handleAddAllQuestionsFromFolder = (folderId: string) => {
    const folderPool = questionBank.filter((q) => getQuestionFolderId(q) === folderId);
    setNewQuizQuestions((prev) => {
      const existingKeys = new Set(prev.map((q) => q.question));
      const toAdd = folderPool.filter((q) => !existingKeys.has(q.question));
      return [...prev, ...toAdd];
    });
  };

  // Bỏ tất cả câu hỏi thuộc 1 thư mục ra khỏi đề
  const handleRemoveQuestionsFromFolder = (folderId: string) => {
    setNewQuizQuestions((prev) => prev.filter((q) => getQuestionFolderId(q) !== folderId));
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    const q = selectedQuiz?.questions?.find((item) => item.id === questionId);
    const isMulti = isQuestionMultiSelect(q);
    if (isMulti) {
      setSelectedAnswers((prev) => {
        const currentIds = getAnswerIds(prev[questionId]);
        const nextIds = currentIds.includes(optionId)
          ? currentIds.filter((id) => id !== optionId)
          : [...currentIds, optionId];
        return {
          ...prev,
          [questionId]: nextIds.join(', '),
        };
      });
    } else {
      setSelectedAnswers((prev) => ({
        ...prev,
        [questionId]: optionId,
      }));
    }
  };

  const handleSubmitQuiz = async () => {
    if(!attemptId||submitting)return;setSubmitting(true);setTimerActive(false);
    try{
      const result=await api<QuizSubmission>('/exams/attempts/'+attemptId+'/submit',{method:'POST',body:JSON.stringify({answers:selectedAnswers})});
      await onSaveSubmission(result);
      setLatestResult(result);
      const unredacted = result.questions || quizzes.find(q => q.id === selectedQuiz.id)?.questions;
      if (unredacted) {
        setSelectedQuiz(prev => ({ ...prev, questions: unredacted }));
      }
      setActiveTab('RESULT');
    }catch(e){alert((e as Error).message);}finally{setSubmitting(false);}
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPending.current || !onAddQuiz) return;
    if (!newQuizTitle || newQuizQuestions.length === 0) {
      alert('Vui lòng nhập tên đề thi và thêm ít nhất 1 câu hỏi.');
      return;
    }

    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      title: newQuizTitle,
      code: `KT-${Date.now().toString().slice(-4)}`,
      category: 'KiemTra',
      description: newQuizDescription,
      examType: newQuizExamType,
      isPractice: newQuizExamType === 'PRACTICE',
      durationMinutes: newQuizDuration,
      passScore: newQuizPassScore,
      targetDepartments: ['ALL'],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      questions: newQuizQuestions.map((q, idx) => ({ ...q, id: `q-${Date.now()}-${idx}`, explanation: q.explanation || '', citation: q.citation || '' })),
      scheduledStartTime: newQuizScheduledStart || undefined,
      scheduledEndTime: newQuizScheduledEnd || undefined,
      isRandomQuestions: newQuizIsRandom,
      randomQuestionCount: newQuizIsRandom ? Number(newQuizRandomCount) : undefined,
      maxAttempts: newQuizMaxAttempts > 0 ? Number(newQuizMaxAttempts) : undefined,
    };

    createPending.current = true;
    setIsCreating(true);
    setQuizActionError('');
    try {
    await onAddQuiz(newQuiz);
    setCreatedQuizId(newQuiz.id);
    setAssignType('ALL');
    setSelectedShifts([]);
    setSelectedIndividualIds([]);
    setAssignSearch('');
    setAssignShiftFilter('ALL');
    setShowAssignModal(true);
    
    // Reset form
    setNewQuizTitle('');
    setNewQuizDescription('');
    setNewQuizExamType('OFFICIAL');
    setNewQuizQuestions([]);
    setNewQuizScheduledStart('');
    setNewQuizScheduledEnd('');
    setNewQuizIsRandom(false);
    setNewQuizRandomCount(10);
    setNewQuizMaxAttempts(1);
    setCreateQuizSearch('');
    setCreateQuizReviewMode('SELECT');
    } catch (error) {
      setQuizActionError((error as Error).message);
    } finally {
      createPending.current = false;
      setIsCreating(false);
    }
  };

  const handleAssignQuiz = async () => {
    if (assignPending.current || !onAssignQuiz || !createdQuizId) return;

    let recipients: string[] = [];
    if (assignType === 'ALL') {
      recipients = assignableEmployees.map((e) => e.id);
    } else if (assignType === 'DEPARTMENT') {
      if (selectedShifts.length === 0) {
        setQuizActionError('Vui lòng chọn ít nhất một Ca để giao bài.');
        return;
      }
      recipients = assignableEmployees
        .filter((e) => selectedShifts.includes(e.department))
        .map((e) => e.id);
    } else if (assignType === 'INDIVIDUAL') {
      if (selectedIndividualIds.length === 0) {
        setQuizActionError('Vui lòng chọn ít nhất một nhân sự để giao bài.');
        return;
      }
      recipients = selectedIndividualIds;
    }

    if (!recipients.length) {
      setQuizActionError('Vui lòng chọn nhân viên đang hoạt động để giao bài.');
      return;
    }
    assignPending.current = true;
    setIsAssigning(true);
    setQuizActionError('');
    try {
      if (onEditQuiz) {
        const quizToUpdate = quizzes.find((q) => q.id === createdQuizId);
        if (quizToUpdate) {
          const updatedQuiz: Quiz = {
            ...quizToUpdate,
            targetDepartments: assignType === 'ALL' ? ['ALL'] : (assignType === 'DEPARTMENT' ? selectedShifts : []),
            targetEmployeeIds: assignType === 'INDIVIDUAL' ? recipients : undefined,
          };
          onEditQuiz(updatedQuiz);
        }
      }
      await onAssignQuiz(createdQuizId, recipients);
      setShowAssignModal(false);
      setActiveTab('LIST');
    } catch (error) {
      setQuizActionError((error as Error).message);
    } finally {
      assignPending.current = false;
      setIsAssigning(false);
    }
  };

  const handleAddFolder = async (name:string,description?:string):Promise<string> => {
    const folder:QuestionFolder={id:'fld-'+crypto.randomUUID(),name:name.trim(),description:description?.trim()||'',color:'indigo',createdAt:new Date().toISOString()};
    await onSaveQuestionFolder(folder);return folder.id;
  };
  const handleSaveEditFolder = async (e:React.FormEvent) => {
    e.preventDefault();if(!folderNameInput.trim())return;
    await bankAction(async()=>{
      if(editingFolder)await onSaveQuestionFolder({...editingFolder,name:folderNameInput.trim(),description:folderDescInput.trim()});
      else await handleAddFolder(folderNameInput,folderDescInput);
      setFolderModalOpen(false);setEditingFolder(null);setFolderNameInput('');setFolderDescInput('');
    },'Đã lưu thư mục.');
  };
  const handleDeleteFolder = async (folderId:string) => {
    const folder=questionFolders.find(f=>f.id===folderId);if(!folder)return;
    if(!window.confirm('Xóa thư mục "'+folder.name+'"? Các câu hỏi vẫn được giữ lại trong Chưa phân loại.'))return;
    await bankAction(async()=>{await onDeleteQuestionFolder(folderId);
      setQuestionDrafts(previous=>Object.fromEntries(Object.entries(previous).map(([id,q])=>[id,q.folderId===folderId?{...q,folderId:undefined}:q])));
      if(selectedFolderId===folderId)setSelectedFolderId('all');
    },'Đã xóa thư mục, giữ nguyên câu hỏi.');
  };
  const handleConfirmAddAiQuestions = async (questions:QuizQuestion[],folderId?:string,jobId?:string) => {
    const result=await api<any>('/operations/question-bank/import',{method:'POST',body:JSON.stringify({questions,folderId:folderId||'',job_id:jobId})});
    setBankNotice('Đã lưu '+result.added+'/'+result.submitted+' câu; '+result.skipped+' câu trùng đã có trong thư mục.');
    setSelectedFolderId(folderId||'all');
    window.dispatchEvent(new CustomEvent('rtg:records-changed',{detail:'questionBank'}));
    return result;
  };

  // Filter records (chỉ lấy bài nộp chuẩn, loại trừ tài khoản test độc lập)
  const filteredSubmissions = standardSubmissions.filter((s) => {
    const matchSearch =
      s.employeeName.toLowerCase().includes(recordSearch.toLowerCase()) ||
      s.department.toLowerCase().includes(recordSearch.toLowerCase()) ||
      s.quizTitle.toLowerCase().includes(recordSearch.toLowerCase());
    if (!matchSearch) return false;
    if (scoreGradeFilter === 'ALL') return true;
    return getScoreGrade(s.score).grade === scoreGradeFilter;
  });

  // Danh sách các phòng ban/tổ từ danh sách nhân sự
  const departmentList = React.useMemo(() => {
    const depts = new Set<string>();
    allEmployees.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [allEmployees]);

  // Tổng hợp số liệu theo từng nhân sự
  const employeeRecords = React.useMemo(() => {
    return allEmployees.map((emp) => {
      const isTest = isTestAccount(emp);
      const empSubs = submissions.filter(
        (s) => s.employeeId === emp.id || (s.employeeName && s.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
      );
      const officialSubs = empSubs.filter((s) => !s.isPractice && s.examType !== 'PRACTICE');
      const practiceSubs = empSubs.filter((s) => s.isPractice || s.examType === 'PRACTICE');
      const avgScore = empSubs.length > 0
        ? Math.round(empSubs.reduce((acc, cur) => acc + cur.score, 0) / empSubs.length)
        : null;
      const passedSubs = empSubs.filter((s) => s.score >= 50);

      return {
        employee: emp,
        isTest,
        submissions: empSubs,
        totalAttempts: empSubs.length,
        officialCount: officialSubs.length,
        practiceCount: practiceSubs.length,
        avgScore,
        passRate: empSubs.length > 0 ? Math.round((passedSubs.length / empSubs.length) * 100) : 0,
        competencyScore: emp.competencyScore ?? 100,
        quizzesCompleted: emp.quizzesCompleted ?? officialSubs.length,
      };
    });
  }, [allEmployees, submissions]);

  const filteredEmployeeRecords = React.useMemo(() => {
    return employeeRecords.filter((rec) => {
      const term = employeeRecordSearch.trim().toLowerCase();
      const matchSearch =
        !term ||
        rec.employee.fullName.toLowerCase().includes(term) ||
        rec.employee.employeeCode.toLowerCase().includes(term) ||
        (rec.employee.department && rec.employee.department.toLowerCase().includes(term));
      const matchDept = employeeDeptFilter === 'ALL' || rec.employee.department === employeeDeptFilter;
      return matchSearch && matchDept;
    });
  }, [employeeRecords, employeeRecordSearch, employeeDeptFilter]);

  // Tổng hợp số liệu theo từng đề thi (loại trừ tài khoản test khỏi số liệu chung)
  const quizRecords = React.useMemo(() => {
    return quizzes.map((quiz) => {
      const qSubs = standardSubmissions.filter((s) => s.quizId === quiz.id);
      const targetEmps = getQuizTargetEmployees(quiz);
      const submittedIds = new Set(qSubs.map((s) => s.employeeId));
      const completedCount = targetEmps.filter((e) => submittedIds.has(e.id)).length;
      const uncompletedCount = Math.max(0, targetEmps.length - completedCount);
      const avgScore = qSubs.length > 0
        ? Math.round(qSubs.reduce((acc, cur) => acc + cur.score, 0) / qSubs.length)
        : null;
      const passedCount = qSubs.filter((s) => s.score >= (quiz.passScore || 80)).length;
      const passRate = qSubs.length > 0 ? Math.round((passedCount / qSubs.length) * 100) : null;
      const isPractice = Boolean(quiz.examType === 'PRACTICE' || quiz.isPractice);

      return {
        quiz,
        submissions: qSubs,
        totalAssigned: targetEmps.length,
        completedCount,
        uncompletedCount,
        avgScore,
        passRate,
        isPractice,
      };
    });
  }, [quizzes, standardSubmissions, getQuizTargetEmployees]);

  const filteredQuizRecords = React.useMemo(() => {
    return quizRecords.filter((rec) => {
      const term = examRecordSearch.trim().toLowerCase();
      const matchSearch =
        !term ||
        rec.quiz.title.toLowerCase().includes(term) ||
        (rec.quiz.description && rec.quiz.description.toLowerCase().includes(term));
      const matchType =
        examTypeFilter === 'ALL' ||
        (examTypeFilter === 'PRACTICE' && rec.isPractice) ||
        (examTypeFilter === 'OFFICIAL' && !rec.isPractice);
      return matchSearch && matchType;
    });
  }, [quizRecords, examRecordSearch, examTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Mobile/Quick Navigation Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        {activeTab !== 'LIST' ? (
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'TAKE') {
                if (window.confirm('Bạn có chắc muốn thoát bài thi? Các câu trả lời chưa nộp sẽ không được lưu.')) {
                  setActiveTab('LIST');
                }
              } else {
                setActiveTab('LIST');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
            <span>← Quay lại danh sách đề thi</span>
          </button>
        ) : onBackToDashboard ? (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
            <span>Quay lại Tổng quan</span>
          </button>
        ) : (
          <div />
        )}
        {activeTab !== 'LIST' && (
          <span className="text-[11px] font-semibold text-slate-500">
            {activeTab === 'TAKE' && 'Đang làm bài thi'}
            {activeTab === 'RESULT' && 'Kết quả bài thi'}
            {activeTab === 'BANK' && 'Ngân hàng câu hỏi'}
            {activeTab === 'CREATE' && 'Tạo đề thi mới'}
            {activeTab === 'RECORDS' && 'Hồ sơ năng lực'}
          </span>
        )}
      </div>

      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Kiểm Tra Năng Lực & Tự Động Đánh Giá
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {quizzes.length} Bộ đề thi
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Thi trắc nghiệm quy chế nội bộ, tự động chấm điểm tức thì và cập nhật vào hồ sơ năng lực nhân sự
          </p>
        </div>

        {/* Tab Buttons */}
        {activeTab !== 'TAKE' && activeTab !== 'RESULT' && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Danh sách đề thi
            </button>
            <button
              onClick={() => setActiveTab('RECORDS')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'RECORDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Hồ sơ năng lực ({submissions.length})</span>
            </button>
            {(currentUser.role === 'ADMIN' ||
              currentUser.role === 'MANAGER' ||
              currentUser.role === 'MANAGER_L1' ||
              currentUser.role === 'MANAGER_L2' ||
              currentUser.assignedPermissions.includes('MANAGE_QUIZ') ||
              currentUser.assignedPermissions.includes('CREATE_QUIZ')) && (
              <>
                <button
                  onClick={() => setActiveTab('BANK')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'BANK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ngân hàng câu hỏi</span>
                </button>
                <button
                  onClick={() => setActiveTab('CREATE')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto ${
                    activeTab === 'CREATE' ? 'bg-indigo-700 text-white shadow-xs' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  + Ra đề thi mới
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 1. QUIZ LIST VIEW */}
      {activeTab === 'LIST' && (
        <div className="space-y-6">
          {/* Top Overview & Grade Distribution Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Tổng Quan Tiến Độ & Thống Kê Điểm Số
                </h3>
              </div>
              <p className="text-xs text-indigo-200">
                Tổng số: <b>{quizzes.length}</b> bộ đề thi • Đã nộp: <b>{standardSubmissions.length}</b> lượt thi trên toàn hệ thống
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-emerald-500/20">
                <span className="text-[10px] text-emerald-300 font-bold uppercase block">Giỏi (≥85đ)</span>
                <span className="text-base sm:text-lg font-black text-white">{gradeStats.gioi} <span className="text-xs font-normal text-emerald-300">({gradeStats.gioiPercent}%)</span></span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-blue-500/20">
                <span className="text-[10px] text-blue-300 font-bold uppercase block">Khá (70–84đ)</span>
                <span className="text-base sm:text-lg font-black text-white">{gradeStats.kha} <span className="text-xs font-normal text-blue-300">({gradeStats.khaPercent}%)</span></span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-amber-500/20">
                <span className="text-[10px] text-amber-300 font-bold uppercase block">TB (50–69đ)</span>
                <span className="text-base sm:text-lg font-black text-white">{gradeStats.tb} <span className="text-xs font-normal text-amber-300">({gradeStats.tbPercent}%)</span></span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-rose-500/20">
                <span className="text-[10px] text-rose-300 font-bold uppercase block">Không đạt (&lt;50đ)</span>
                <span className="text-base sm:text-lg font-black text-white">{gradeStats.kd} <span className="text-xs font-normal text-rose-300">({gradeStats.kdPercent}%)</span></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quizzes.map((quiz) => {
              const targetList = getQuizTargetEmployees(quiz);
              const totalAssigned = Math.max(targetList.length, 1);
              const quizSubs = standardSubmissions.filter((s) => s.quizId === quiz.id);
              const completedEmpIds = new Set(quizSubs.map((s) => s.employeeId));
              const completedCount = completedEmpIds.size;
              const percentCompleted = Math.round((completedCount / totalAssigned) * 100);
              const uncompletedList = targetList.filter((e) => !completedEmpIds.has(e.id));
              const userSubmissions = quizSubs.filter((s) => s.employeeId === currentUser.id);
              const latestSub = userSubmissions[userSubmissions.length - 1];
              const scheduleInfo = getQuizScheduleStatus(quiz);
              const isAttemptsExhausted = Boolean(
                quiz.maxAttempts && quiz.maxAttempts > 0 && userSubmissions.length >= quiz.maxAttempts
              );

              return (
                <div
                  key={quiz.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                          {quiz.code}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {quiz.category}
                        </span>
                        {quiz.examType === 'PRACTICE' || quiz.isPractice ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            Ôn tập
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                            Thi chính thức
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {quiz.maxAttempts ? `Tối đa ${quiz.maxAttempts} lần làm` : 'Làm không giới hạn'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs ${scheduleInfo.badgeClass}`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{scheduleInfo.label}</span>
                        </span>

                        {onAssignQuiz && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER_L1' || currentUser.role === 'MANAGER') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreatedQuizId(quiz.id);
                              if (quiz.targetEmployeeIds && quiz.targetEmployeeIds.length > 0) {
                                setAssignType('INDIVIDUAL');
                                setSelectedIndividualIds(quiz.targetEmployeeIds);
                                setSelectedShifts([]);
                              } else if (quiz.targetDepartments && !quiz.targetDepartments.includes('ALL') && quiz.targetDepartments.length > 0) {
                                setAssignType('DEPARTMENT');
                                setSelectedShifts(quiz.targetDepartments);
                                setSelectedIndividualIds([]);
                              } else {
                                setAssignType('ALL');
                                setSelectedShifts([]);
                                setSelectedIndividualIds([]);
                              }
                              setAssignSearch('');
                              setAssignShiftFilter('ALL');
                              setQuizActionError('');
                              setShowAssignModal(true);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Giao bài thi này cho các Ca hoặc Nhân sự"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onDeleteQuiz && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER_L1' || currentUser.role === 'MANAGER') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Bạn có chắc chắn muốn xóa bộ đề thi "${quiz.title}"?`)) {
                                onDeleteQuiz(quiz.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{quiz.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{quiz.description}</p>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center mb-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Thời gian</span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {quiz.durationMinutes} phút
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Số câu hỏi</span>
                        {quiz.isRandomQuestions && quiz.randomQuestionCount ? (
                          <span className="text-xs font-extrabold text-indigo-700 flex items-center justify-center gap-1">
                            <Shuffle className="w-3 h-3" />
                            <span>
                              {quiz.randomQuestionCount} / {quiz.questions.length} câu
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-extrabold text-slate-800">
                            {quiz.questions.length} câu
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Điểm chuẩn</span>
                        <span className="text-xs font-extrabold text-emerald-600">
                          ≥ {quiz.passScore}đ
                        </span>
                      </div>
                    </div>

                    {/* TIẾN ĐỘ HOÀN THÀNH / TỔNG SỐ BÀI PHÁT RA & NÚT XEM AI CHƯA HOÀN THÀNH */}
                    <div className="mb-4 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100/90">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Số bài đã hoàn thành:</span>
                        </span>
                        <span className="text-indigo-700 font-extrabold">
                          {completedCount} / {totalAssigned} bài ({percentCompleted}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-2">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, percentCompleted)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-500">
                          Chưa nộp bài: <b className="text-rose-600">{uncompletedList.length}</b> cá nhân
                        </span>
                        {uncompletedList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setViewUncompletedQuiz(quiz);
                              setUncompletedSearch('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-800 text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Bấm để xem danh sách chi tiết các cá nhân chưa hoàn thành"
                          >
                            <UserX className="w-3 h-3 text-rose-600" />
                            <span>Xem ai chưa làm ({uncompletedList.length})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {/* Latest user attempt status if any */}
                    {latestSub && (
                      <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {latestSub.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600" />
                          )}
                          <span className="text-slate-600 font-medium">Lần thi gần nhất:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${latestSub.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {latestSub.score}đ ({latestSub.competencyLevel})
                          </span>
                          <span className="text-[10px] text-slate-400">({latestSub.submittedAt})</span>
                        </div>
                      </div>
                    )}

                    {scheduleInfo.status === 'EXPIRED' ? (
                      <button
                        disabled
                        className="w-full py-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2 border border-slate-200"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Đã kết thúc kiểm tra</span>
                      </button>
                    ) : scheduleInfo.status === 'UPCOMING' ? (
                      <button
                        onClick={() => handleStartQuiz(quiz)}
                        className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Chưa đến giờ mở đề ({scheduleInfo.label})</span>
                      </button>
                    ) : isAttemptsExhausted ? (
                      <button
                        disabled
                        className="w-full py-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2 border border-slate-200 shadow-2xs"
                        title={`Bạn đã hoàn thành đủ số lần làm đề quy định (${userSubmissions.length}/${quiz.maxAttempts} lần)`}
                      >
                        <Lock className="w-4 h-4 text-slate-400" />
                        <span>Đã hết số lần làm bài ({userSubmissions.length}/{quiz.maxAttempts} lần)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartQuiz(quiz)}
                        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-indigo-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span>
                          {latestSub
                            ? `Làm lại bài kiểm tra (${userSubmissions.length}${quiz.maxAttempts ? `/${quiz.maxAttempts}` : ''})`
                            : `Bắt đầu làm bài thi${quiz.maxAttempts ? ` (Tối đa ${quiz.maxAttempts} lần)` : ''}`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TAKE QUIZ INTERFACE */}
      {activeTab === 'TAKE' && selectedQuiz && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
          {/* Quiz Header with Timer */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  {selectedQuiz.category}
                </span>
                {selectedQuiz.isRandomQuestions && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>Bốc ngẫu nhiên {selectedQuiz.questions.length} câu</span>
                  </span>
                )}
                {selectedQuiz.scheduledEndTime && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30 flex items-center gap-1">
                    <Timer className="w-2.5 h-2.5" />
                    <span>Đóng đề lúc: {new Date(selectedQuiz.scheduledEndTime).toLocaleTimeString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}
                {selectedQuiz.examType === 'PRACTICE' || selectedQuiz.isPractice ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/40">
                    Ôn tập (Không lưu điểm năng lực)
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/40">
                    Thi chính thức (Tính điểm năng lực)
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight mt-0.5">
                {selectedQuiz.title}
              </h3>
            </div>

            {/* Timer countdown */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur font-mono font-bold text-sm sm:text-base">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className={timeLeftSeconds < 120 ? 'text-rose-400' : 'text-white'}>
                {formatTime(timeLeftSeconds)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{
                width: `${((currentQuestionIdx + 1) / selectedQuiz.questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Active Question Box */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Question Counter */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>
                Câu hỏi {currentQuestionIdx + 1} / {selectedQuiz.questions.length}
              </span>
              <span>
                Đã trả lời {Object.keys(selectedAnswers).length} / {selectedQuiz.questions.length} câu
              </span>
            </div>

            {/* Question Text */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Câu {currentQuestionIdx + 1}
                </span>
                {isQuestionMultiSelect(selectedQuiz.questions[currentQuestionIdx]) ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-purple-700" />
                    <span>Chọn nhiều đáp án</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    Chọn 1 đáp án
                  </span>
                )}
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {selectedQuiz.questions[currentQuestionIdx]?.question}
              </h4>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {(() => {
                const currentQ = selectedQuiz.questions[currentQuestionIdx];
                const isMulti = isQuestionMultiSelect(currentQ);
                const currentAnswerIds = getAnswerIds(selectedAnswers[currentQ?.id]);

                return (currentQ?.options || []).map((opt, i) => {
                  const isSelected = currentAnswerIds.includes(opt.id);
                  const letter = String.fromCharCode(65 + i);

                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        handleSelectOption(currentQ?.id, opt.id)
                      }
                      className={`w-full p-4 rounded-2xl text-left border transition-all flex items-start gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 font-medium ring-1 ring-indigo-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isMulti ? (
                          isSelected ? <Check className="w-4 h-4 text-white" /> : letter
                        ) : (
                          letter
                        )}
                      </div>
                      <span className="text-xs sm:text-sm leading-relaxed">{opt.text}</span>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Bottom Nav Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold text-xs"
              >
                Câu trước
              </button>

              <div className="flex items-center gap-2">
                {currentQuestionIdx < selectedQuiz.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
                  >
                    Câu tiếp theo →
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Bạn đã làm ${Object.keys(selectedAnswers).length}/${selectedQuiz.questions.length} câu. Bạn có chắc chắn muốn nộp bài để hệ thống chấm điểm tự động?`
                        )
                      ) {
                        handleSubmitQuiz();
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nộp bài & Chấm điểm</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. RESULT & INSTANT AUTO-GRADING BREAKDOWN */}
      {activeTab === 'RESULT' && latestResult && selectedQuiz && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Score Card */}
          <div
            className={`p-8 rounded-3xl border shadow-lg text-center ${
              latestResult.passed
                ? 'bg-gradient-to-b from-emerald-50 via-white to-emerald-50/30 border-emerald-200'
                : 'bg-gradient-to-b from-rose-50 via-white to-rose-50/30 border-rose-200'
            }`}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 shadow-inner">
              {latestResult.passed ? (
                <CheckCircle2 className="w-16 h-16 text-emerald-600" />
              ) : (
                <XCircle className="w-16 h-16 text-rose-600" />
              )}
            </div>

            <span
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 ${
                latestResult.passed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {latestResult.passed ? 'Kết Quả: ĐẠT YÊU CẦU' : 'Kết Quả: CẦN ĐÀO TẠO LẠI'}
            </span>

            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mb-1">
              {latestResult.score} / 100 Điểm
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-indigo-700 mb-3">
              (Tương đương {(latestResult.score / 10).toFixed(1)} / 10 điểm)
            </p>

            <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
              Bạn đã trả lời đúng <b>{latestResult.correctCount}</b> trên tổng số{' '}
              <b>{latestResult.totalQuestions}</b> câu hỏi ({latestResult.totalQuestions > 0 ? Math.round((latestResult.correctCount / latestResult.totalQuestions) * 100) : 0}%). Kết quả đã được tự động lưu vào{' '}
              <b>Hồ sơ Đánh giá Năng lực</b> của nhân sự <b>{latestResult.employeeName}</b>.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Xếp loại năng lực: </span>
              <span className="text-indigo-600 font-bold">{latestResult.competencyLevel}</span>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => handleStartQuiz(selectedQuiz)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm lại bài này</span>
              </button>
              <button
                onClick={() => setActiveTab('LIST')}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                Trở về danh sách đề thi
              </button>
            </div>
          </div>

          {/* Detailed Question Review & Citations */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-900 text-base">
                Đối Soát Chi Tiết Từng Câu & Căn Cứ Điều Khoản
              </h4>
              <p className="text-xs text-slate-500">
                Xem lại giải thích và trích dẫn điều khoản văn bản quy chế doanh nghiệp
              </p>
            </div>

            <div className="space-y-6">
              {(latestResult.questions || selectedQuiz.questions || []).map((q, idx) => {
                const originalQ = quizzes.find((qz) => qz.id === selectedQuiz.id)?.questions.find((item) => item.id === q.id);
                const correctOptionIds = getQuestionCorrectOptionIds(q).length > 0
                  ? getQuestionCorrectOptionIds(q)
                  : getQuestionCorrectOptionIds(originalQ);
                const userChoiceIds = getAnswerIds(latestResult.answers[q.id]);
                const isMulti = isQuestionMultiSelect(q) || isQuestionMultiSelect(originalQ);
                const isCorrect =
                  correctOptionIds.length > 0 &&
                  correctOptionIds.length === userChoiceIds.length &&
                  correctOptionIds.every((id) => userChoiceIds.includes(id));

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border ${
                      isCorrect
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">Câu {idx + 1}</span>
                          {isMulti && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              Chọn nhiều đáp án
                            </span>
                          )}
                        </div>
                        <h5 className="font-semibold text-slate-800 text-sm">{q.question}</h5>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCorrect ? 'Chính xác' : 'Sai'}
                      </span>
                    </div>

                    {/* Options status */}
                    <div className="space-y-1.5 text-xs mb-3">
                      {(q.options || []).map((opt) => {
                        const isThisUserChoice = userChoiceIds.includes(opt.id);
                        const isThisCorrect = correctOptionIds.includes(opt.id);

                        let style = 'bg-white text-slate-700 border-slate-200';
                        if (isThisCorrect) {
                          style = 'bg-emerald-100/70 border-emerald-300 text-emerald-950 font-bold';
                        } else if (isThisUserChoice && !isThisCorrect) {
                          style = 'bg-rose-100/70 border-rose-300 text-rose-950 line-through';
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${style}`}
                          >
                            <span>{opt.text}</span>
                            {isThisCorrect && (
                              <span className="text-[10px] text-emerald-700 font-bold">
                                ✓ Đáp án đúng
                              </span>
                            )}
                            {isThisUserChoice && !isThisCorrect && (
                              <span className="text-[10px] text-rose-700 font-bold">
                                ✗ Lựa chọn của bạn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Citation & Explanation Box */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1 text-slate-600">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Giải thích căn cứ:</span>
                      </div>
                      <p className="leading-relaxed">{q.explanation}</p>
                      <div className="pt-1 text-[11px] font-mono text-indigo-700 font-semibold">
                        📖 {q.citation}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. COMPETENCY RECORDS ARCHIVE */}
      {activeTab === 'RECORDS' && (
        <div className="space-y-4">
          {/* Thanh chuyển đổi phân mục trong Hồ sơ năng lực */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setRecordsSection('EMPLOYEES')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  recordsSection === 'EMPLOYEES'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Xem theo nhân sự</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  recordsSection === 'EMPLOYEES' ? 'bg-indigo-700/80 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {filteredEmployeeRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRecordsSection('EXAMS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  recordsSection === 'EXAMS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Xem theo đề thi</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  recordsSection === 'EXAMS' ? 'bg-indigo-700/80 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {filteredQuizRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRecordsSection('SUBMISSIONS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  recordsSection === 'SUBMISSIONS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Toàn bộ bài nộp</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  recordsSection === 'SUBMISSIONS' ? 'bg-indigo-700/80 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {filteredSubmissions.length}
                </span>
              </button>
            </div>

            {/* Google Sheet Sync Button (Admin) */}
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={handleSyncQuizzesToSheet}
                disabled={isSyncingQuizSheet}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Đồng bộ toàn bộ kết quả thi vào Google Sheet (sheet KetQuaThi)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isSyncingQuizSheet ? 'Đang đồng bộ...' : 'Đồng bộ Google Sheet'}</span>
              </button>
            )}
          </div>

          {quizSyncNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quizSyncNotice}</span>
            </div>
          )}

          {/* PHÂN MỤC 1: XEM THEO NHÂN SỰ */}
          {recordsSection === 'EMPLOYEES' && (
            <div className="space-y-4">
              {/* Thanh lọc nhân sự */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, mã NV, phòng ban..."
                      value={employeeRecordSearch}
                      onChange={(e) => setEmployeeRecordSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={employeeDeptFilter}
                      onChange={(e) => setEmployeeDeptFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-auto"
                    >
                      <option value="ALL">Tất cả phòng ban / tổ ({allEmployees.length})</option>
                      {departmentList.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept} ({allEmployees.filter((e) => e.department === dept).length})
                        </option>
                      ))}
                    </select>

                    {(employeeRecordSearch || employeeDeptFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeRecordSearch('');
                          setEmployeeDeptFilter('ALL');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Xóa lọc</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Hiển thị <b>{filteredEmployeeRecords.length}</b> / <b>{allEmployees.length}</b> nhân sự
                </div>
              </div>

              {/* Bảng danh sách nhân sự & điểm năng lực */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Nhân sự</th>
                        <th className="py-3 px-4">Mã NV</th>
                        <th className="py-3 px-4">Tổ / Phòng ban</th>
                        <th className="py-3 px-4 text-center">Điểm năng lực</th>
                        <th className="py-3 px-4 text-center">Đã hoàn thành</th>
                        <th className="py-3 px-4 text-center">Điểm TB</th>
                        <th className="py-3 px-4 text-center">Tỷ lệ đạt</th>
                        <th className="py-3 px-4 text-right">Lịch sử thi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployeeRecords.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                            Không tìm thấy nhân sự phù hợp với điều kiện tìm kiếm.
                          </td>
                        </tr>
                      ) : (
                        filteredEmployeeRecords.map((rec) => {
                          const score = rec.competencyScore;
                          const scoreColorClass =
                            score >= 85 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                            score >= 70 ? 'text-blue-700 bg-blue-50 border-blue-200' :
                            score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-rose-700 bg-rose-50 border-rose-200';

                          return (
                            <tr key={rec.employee.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    {rec.employee.fullName ? rec.employee.fullName.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{rec.employee.fullName}</span>
                                      {rec.employee.isHidden && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                          Ẩn
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{rec.employee.position || 'Nhân viên'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-medium text-slate-600 text-xs">
                                {rec.employee.employeeCode || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 font-medium">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs border border-slate-200">
                                  {rec.employee.department || 'Tổ RTG'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${scoreColorClass}`}>
                                  {score} đ
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="font-bold text-slate-900">{rec.totalAttempts}</span>
                                <span className="text-[11px] text-slate-500 ml-1">
                                  ({rec.officialCount} chính thức{rec.practiceCount > 0 ? `, ${rec.practiceCount} ôn tập` : ''})
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold">
                                {rec.avgScore !== null ? (
                                  <span className={rec.avgScore >= 50 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {rec.avgScore}đ
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Chưa thi</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {rec.totalAttempts > 0 ? (
                                  <span className={`text-xs font-bold ${rec.passRate >= 80 ? 'text-emerald-600' : rec.passRate >= 50 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {rec.passRate}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmpQuizDetail(rec.employee)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem bài thi ({rec.totalAttempts})</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PHÂN MỤC 2: XEM THEO ĐỀ THI */}
          {recordsSection === 'EXAMS' && (
            <div className="space-y-4">
              {/* Thanh lọc đề thi */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên đề thi, mô tả..."
                      value={examRecordSearch}
                      onChange={(e) => setExamRecordSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={examTypeFilter}
                      onChange={(e) => setExamTypeFilter(e.target.value as any)}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-auto"
                    >
                      <option value="ALL">Tất cả loại đề ({quizzes.length})</option>
                      <option value="OFFICIAL">
                        Thi chính thức ({quizzes.filter((q) => !q.isPractice && q.examType !== 'PRACTICE').length})
                      </option>
                      <option value="PRACTICE">
                        Ôn tập ({quizzes.filter((q) => q.isPractice || q.examType === 'PRACTICE').length})
                      </option>
                    </select>

                    {(examRecordSearch || examTypeFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setExamRecordSearch('');
                          setExamTypeFilter('ALL');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Xóa lọc</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Hiển thị <b>{filteredQuizRecords.length}</b> / <b>{quizzes.length}</b> đề thi
                </div>
              </div>

              {/* Danh sách đề thi & tình trạng theo dõi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQuizRecords.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                    Không tìm thấy đề thi phù hợp với điều kiện tìm kiếm.
                  </div>
                ) : (
                  filteredQuizRecords.map((rec) => {
                    const percentDone = rec.totalAssigned > 0
                      ? Math.min(100, Math.round((rec.completedCount / rec.totalAssigned) * 100))
                      : 0;

                    return (
                      <div
                        key={rec.quiz.id}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="font-bold text-slate-900 text-sm leading-snug">
                              {rec.quiz.title}
                            </h4>
                            {rec.isPractice ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                📝 Ôn tập
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                                🎯 Thi chính thức
                              </span>
                            )}
                          </div>

                          {rec.quiz.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                              {rec.quiz.description}
                            </p>
                          )}

                          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 text-center mb-3">
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Số câu</div>
                              <div className="text-sm font-black text-slate-800">
                                {rec.quiz.questions?.length || 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Thời gian</div>
                              <div className="text-sm font-black text-slate-800">
                                {rec.quiz.durationMinutes}p
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Điểm đạt</div>
                              <div className="text-sm font-black text-indigo-700">
                                {rec.quiz.passScore}đ
                              </div>
                            </div>
                          </div>

                          {/* Tiến độ hoàn thành bài thi */}
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700">Tiến độ nộp bài</span>
                              <span className="font-bold text-slate-900">
                                <b className="text-emerald-700">{rec.completedCount}</b> / {rec.totalAssigned} nhân sự ({percentDone}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${percentDone}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                              <span>Chưa làm: <b className="text-rose-600">{rec.uncompletedCount}</b></span>
                              <span>Điểm TB: <b className="text-slate-800">{rec.avgScore !== null ? `${rec.avgScore}đ` : '—'}</b></span>
                              <span>Tỷ lệ đạt: <b className="text-emerald-700">{rec.passRate !== null ? `${rec.passRate}%` : '—'}</b></span>
                            </div>
                          </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setViewUncompletedQuiz(rec.quiz);
                              setUncompletedModalTab('UNCOMPLETED');
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Theo dõi hoàn thành</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRecordSearch(rec.quiz.title);
                              setRecordsSection('SUBMISSIONS');
                            }}
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                            title="Xem tất cả bài nộp của đề thi này"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{rec.submissions.length} bài nộp</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PHÂN MỤC 3: TOÀN BỘ BÀI NỘP */}
          {recordsSection === 'SUBMISSIONS' && (
            <div className="space-y-4">
              {/* BẢNG THỐNG KÊ ĐIỂM: GIỎI, KHÁ, TRUNG BÌNH, KHÔNG ĐẠT */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setScoreGradeFilter(scoreGradeFilter === 'GIOI' ? 'ALL' : 'GIOI')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    scoreGradeFilter === 'GIOI'
                      ? 'bg-emerald-100 border-emerald-500 shadow-xs ring-2 ring-emerald-500/30'
                      : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Giỏi (≥ 85đ)</span>
                    <Trophy className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-900">{gradeStats.gioi} <span className="text-xs font-normal text-emerald-700">bài</span></div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    Chiếm {gradeStats.gioiPercent}% tổng số bài nộp
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScoreGradeFilter(scoreGradeFilter === 'KHA' ? 'ALL' : 'KHA')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    scoreGradeFilter === 'KHA'
                      ? 'bg-blue-100 border-blue-500 shadow-xs ring-2 ring-blue-500/30'
                      : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Khá (70–84đ)</span>
                    <Medal className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-900">{gradeStats.kha} <span className="text-xs font-normal text-blue-700">bài</span></div>
                  <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
                    Chiếm {gradeStats.khaPercent}% tổng số bài nộp
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScoreGradeFilter(scoreGradeFilter === 'TRUNG_BINH' ? 'ALL' : 'TRUNG_BINH')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    scoreGradeFilter === 'TRUNG_BINH'
                      ? 'bg-amber-100 border-amber-500 shadow-xs ring-2 ring-amber-500/30'
                      : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Trung bình (50–69đ)</span>
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-900">{gradeStats.tb} <span className="text-xs font-normal text-amber-700">bài</span></div>
                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                    Chiếm {gradeStats.tbPercent}% tổng số bài nộp
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScoreGradeFilter(scoreGradeFilter === 'KHONG_DAT' ? 'ALL' : 'KHONG_DAT')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    scoreGradeFilter === 'KHONG_DAT'
                      ? 'bg-rose-100 border-rose-500 shadow-xs ring-2 ring-rose-500/30'
                      : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">Không đạt (&lt; 50đ)</span>
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-900">{gradeStats.kd} <span className="text-xs font-normal text-rose-700">bài</span></div>
                  <div className="text-[11px] text-rose-700 font-semibold mt-0.5">
                    Chiếm {gradeStats.kdPercent}% tổng số bài nộp
                  </div>
                </button>
              </div>

              {/* Thanh tìm kiếm & lọc */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên nhân sự, phòng ban, bài thi..."
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {scoreGradeFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setScoreGradeFilter('ALL')}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Xóa lọc xếp loại</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-xs text-slate-500 font-medium">
                    Hiển thị <b>{filteredSubmissions.length}</b> / <b>{submissions.length}</b> bản ghi
                  </span>
                </div>
              </div>

              {/* Bảng chi tiết toàn bộ bài nộp */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Nhân sự</th>
                        <th className="py-3 px-4">Phòng ban</th>
                        <th className="py-3 px-4">Đề thi</th>
                        <th className="py-3 px-4">Phân loại</th>
                        <th className="py-3 px-4">Điểm số</th>
                        <th className="py-3 px-4">Xếp loại</th>
                        <th className="py-3 px-4">Thời gian nộp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                            Không có bài nộp nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((sub) => {
                          const gradeInfo = getScoreGrade(sub.score);
                          const isPractice = Boolean(sub.isPractice || sub.examType === 'PRACTICE');

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-900">{sub.employeeName}</td>
                              <td className="py-3.5 px-4 text-slate-600">{sub.department}</td>
                              <td className="py-3.5 px-4 text-slate-800 font-medium">{sub.quizTitle}</td>
                              <td className="py-3.5 px-4">
                                {isPractice ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    Ôn tập
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    Thi chính thức
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`font-black text-sm ${sub.score >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {sub.score} / 100
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${gradeInfo.badgeClass}`}
                                >
                                  {gradeInfo.label} ({sub.competencyLevel})
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">{sub.submittedAt}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: CHI TIẾT LỊCH SỬ THI CỦA NHÂN SỰ */}
          {selectedEmpQuizDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {selectedEmpQuizDetail.fullName ? selectedEmpQuizDetail.fullName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>{selectedEmpQuizDetail.fullName}</span>
                        <span className="text-xs font-normal text-slate-500 font-mono">
                          ({selectedEmpQuizDetail.employeeCode || 'Chưa có mã'})
                        </span>
                      </h4>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{selectedEmpQuizDetail.department || 'Tổ RTG'}</span>
                        <span>•</span>
                        <span>Điểm năng lực: <b className="text-indigo-700">{selectedEmpQuizDetail.competencyScore ?? 100}đ</b></span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEmpQuizDetail(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                  {(() => {
                    const empSubs = submissions.filter(
                      (s) =>
                        s.employeeId === selectedEmpQuizDetail.id ||
                        (s.employeeName && s.employeeName.trim().toLowerCase() === selectedEmpQuizDetail.fullName.trim().toLowerCase())
                    );
                    const officialCount = empSubs.filter((s) => !s.isPractice && s.examType !== 'PRACTICE').length;
                    const practiceCount = empSubs.filter((s) => s.isPractice || s.examType === 'PRACTICE').length;
                    const avgScore = empSubs.length > 0 ? Math.round(empSubs.reduce((a, b) => a + b.score, 0) / empSubs.length) : 0;
                    const highestScore = empSubs.length > 0 ? Math.max(...empSubs.map((s) => s.score)) : 0;

                    return (
                      <>
                        <div className="grid grid-cols-4 gap-2.5 text-center">
                          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">Tổng lần thi</div>
                            <div className="text-lg font-black text-slate-800">{empSubs.length}</div>
                          </div>
                          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                            <div className="text-[10px] text-indigo-700 font-semibold uppercase">Thi chính thức</div>
                            <div className="text-lg font-black text-indigo-900">{officialCount}</div>
                          </div>
                          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                            <div className="text-[10px] text-amber-700 font-semibold uppercase">Ôn tập</div>
                            <div className="text-lg font-black text-amber-900">{practiceCount}</div>
                          </div>
                          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                            <div className="text-[10px] text-emerald-700 font-semibold uppercase">Điểm TB / Cao nhất</div>
                            <div className="text-lg font-black text-emerald-900">{avgScore} / {highestScore}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Lịch sử làm bài chi tiết ({empSubs.length})
                          </h5>
                          {empSubs.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs">
                              Nhân sự chưa tham gia làm bài thi nào.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                              {empSubs.map((sub) => {
                                const isPractice = Boolean(sub.isPractice || sub.examType === 'PRACTICE');
                                const grade = getScoreGrade(sub.score);
                                return (
                                  <div key={sub.id} className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                                        <span>{sub.quizTitle}</span>
                                        {isPractice ? (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                            Ôn tập
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                                            Thi chính thức
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        Thời gian: {sub.submittedAt}
                                      </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3 shrink-0">
                                      <div>
                                        <div className={`font-black text-sm ${sub.score >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {sub.score} / 100
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">
                                          {grade.label}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedEmpQuizDetail(null)}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CREATE QUIZ (ADMIN) */}
      {activeTab === 'CREATE' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Tạo Đề Thi Mới</h3>
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên đề thi</label>
                <input
                  required
                  type="text"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả</label>
                <input
                  type="text"
                  placeholder="Nhập mô tả đề thi (tùy chọn)..."
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
                {/* 2 ô tích chọn: Ôn tập vs Thi chính thức */}
                <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-700 shrink-0">Phân loại:</span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="examTypeOption"
                      checked={newQuizExamType === 'PRACTICE'}
                      onChange={() => setNewQuizExamType('PRACTICE')}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      newQuizExamType === 'PRACTICE' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'text-slate-600'
                    }`}>
                      Ôn tập
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">(Thi không lưu điểm vào điểm năng lực)</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="examTypeOption"
                      checked={newQuizExamType === 'OFFICIAL'}
                      onChange={() => setNewQuizExamType('OFFICIAL')}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      newQuizExamType === 'OFFICIAL' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'text-slate-600'
                    }`}>
                      Thi chính thức
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">(Thi sẽ tính điểm vào điểm năng lực)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Thời gian làm bài (phút)</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={newQuizDuration}
                  onChange={(e) => setNewQuizDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Điểm đạt (%)</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={newQuizPassScore}
                  onChange={(e) => setNewQuizPassScore(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Số lần được làm đề</span>
                  <span className="text-[10px] text-slate-400 font-normal">0 = Không giới hạn</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newQuizMaxAttempts}
                    onChange={(e) => setNewQuizMaxAttempts(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="VD: 1 (mặc định 1 lần)"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setNewQuizMaxAttempts(1)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        newQuizMaxAttempts === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      1 lần (Thi chuẩn)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewQuizMaxAttempts(2)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        newQuizMaxAttempts === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      2 lần
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewQuizMaxAttempts(0)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        newQuizMaxAttempts === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      Không giới hạn
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hẹn giờ phát đề & Kết thúc kiểm tra */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                  Khung giờ thi & Hẹn giờ phát đề / Kết thúc kiểm tra
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>Hẹn giờ phát đề (bắt đầu mở thi):</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newQuizScheduledStart}
                    onChange={(e) => setNewQuizScheduledStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Để trống nếu muốn mở đề ngay lập tức.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Timer className="w-3 h-3 text-rose-500" />
                    <span>Hẹn giờ kết thúc kiểm tra (đóng đề):</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newQuizScheduledEnd}
                    onChange={(e) => setNewQuizScheduledEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Sau thời điểm này bài thi sẽ tự động khóa và nộp bài.</p>
                </div>
              </div>
            </div>

            {/* Tính năng tự động bốc câu hỏi ngẫu nhiên cho thí sinh */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newQuizIsRandom}
                    onChange={(e) => setNewQuizIsRandom(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Shuffle className="w-4 h-4 text-indigo-600" />
                    <span>Tự động chọn ngẫu nhiên câu hỏi khi thí sinh vào làm bài</span>
                  </span>
                </label>
              </div>

              {newQuizIsRandom && (
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Số lượng câu hỏi mỗi thí sinh nhận được:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, newQuizQuestions.length)}
                      value={newQuizRandomCount}
                      onChange={(e) => setNewQuizRandomCount(Math.max(1, Number(e.target.value)))}
                      className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-indigo-700 text-center"
                    />
                    <span className="text-xs text-slate-500">
                      câu (trong tổng số {newQuizQuestions.length} câu hỏi đã thêm vào đề)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-slate-100 space-y-4">
              {/* Header: Title + Mode Toggle (Tabs) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Chọn câu hỏi cho đề thi</span>
                    </h4>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                        newQuizQuestions.length > 0
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {newQuizQuestions.length} câu đã chọn
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chọn câu hỏi linh hoạt từ nhiều thư mục khác nhau hoặc dùng công cụ tự động phân bổ câu hỏi
                  </p>
                </div>

                {/* Switch between Bank and Review selected questions */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCreateQuizReviewMode('SELECT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      createQuizReviewMode === 'SELECT'
                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ngân hàng câu hỏi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateQuizReviewMode('REVIEW')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      createQuizReviewMode === 'REVIEW'
                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đề thi đã chọn ({newQuizQuestions.length})</span>
                  </button>
                </div>
              </div>

              {/* KHU VỰC 1: BỘ CHỌN NHIỀU THƯ MỤC NGUỒN */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Chọn các thư mục nguồn lấy câu hỏi (Đang chọn {selectedFolderIds.length}/{availableQuestionFolders.length} thư mục):
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllFolders}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <CheckSquare className="w-3 h-3 text-indigo-600" />
                      <span>Chọn tất cả thư mục</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFolders}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 text-slate-400" />
                      <span>Bỏ chọn hết</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách các thư mục dưới dạng chips checkbox */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {availableQuestionFolders.map((folder) => {
                    const isChecked = selectedFolderIds.includes(folder.id);
                    const countInQuiz = selectedQuestionsSummary[folder.id] || 0;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => handleToggleFolder(folder.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                          isChecked
                            ? 'bg-white text-indigo-950 border-indigo-500 shadow-xs ring-1 ring-indigo-500/30'
                            : 'bg-white/70 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span>📁 {folder.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isChecked ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {folder.count} câu
                        </span>
                        {countInQuiz > 0 && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200"
                            title="Số câu đã đưa vào đề từ thư mục này"
                          >
                            +{countInQuiz} trong đề
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedFolderIds.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>Chưa chọn thư mục nào! Hãy tích chọn ít nhất 1 thư mục ở trên để lấy câu hỏi vào đề thi.</span>
                  </p>
                )}
              </div>

              {/* KHU VỰC 2: CÔNG CỤ BỐC ĐỀ THÔNG MINH (BỐC NHANH & MA TRẬN PHÂN BỔ) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Bốc nhanh tổng hợp */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Bốc nhanh từ các thư mục đã chọn:</span>
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={autoPickCount}
                      onChange={(e) => setAutoPickCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                    />
                    <span className="text-xs text-slate-600">câu</span>
                    <button
                      type="button"
                      onClick={() => handleAutoPickRandomQuestions('replace')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Tạo mới đề thi với số câu bốc ngẫu nhiên từ các thư mục đã chọn"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>🎲 Bốc mới {autoPickCount} câu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoPickRandomQuestions('append')}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Bốc thêm ngẫu nhiên câu hỏi chưa có trong đề và cộng dồn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Bốc thêm</span>
                    </button>
                  </div>

                  {/* Nút bật/tắt ma trận phân bổ */}
                  <button
                    type="button"
                    onClick={() => setShowFolderMatrix(!showFolderMatrix)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      showFolderMatrix
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showFolderMatrix ? '▲ Thu gọn Ma trận thư mục' : '⚙️ Phân bổ số câu theo từng thư mục (Ma trận)'}</span>
                  </button>
                </div>

                {/* Bảng cấu hình Ma trận phân bổ câu hỏi theo từng thư mục */}
                {showFolderMatrix && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Cấu hình số câu lấy từ từng thư mục đã chọn:</span>
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Nhập số câu muốn lấy cho mỗi thư mục rồi bấm nút bốc đề bên dưới
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {availableQuestionFolders
                        .filter((f) => selectedFolderIds.includes(f.id))
                        .map((folder) => {
                          const quota = folderQuotas[folder.id] ?? Math.min(5, folder.count);
                          const countInQuiz = selectedQuestionsSummary[folder.id] || 0;
                          return (
                            <div
                              key={folder.id}
                              className="p-2.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 truncate" title={folder.name}>
                                  📁 {folder.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                                  Kho: {folder.count} câu
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-slate-600 font-medium">Lấy:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={folder.count}
                                    value={quota}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(folder.count, Number(e.target.value)));
                                      setFolderQuotas((prev) => ({ ...prev, [folder.id]: val }));
                                    }}
                                    className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center font-bold text-indigo-700 bg-slate-50 focus:bg-white"
                                  />
                                  <span className="text-[11px] text-slate-500">câu</span>
                                </div>
                                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  Trong đề: {countInQuiz}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 pt-1 border-t border-slate-100 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handlePickSingleFolder(folder.id, quota)}
                                  disabled={folder.count === 0 || quota <= 0}
                                  className="flex-1 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors cursor-pointer text-center disabled:opacity-40"
                                  title={`Bốc ngẫu nhiên ${quota} câu từ thư mục này thêm vào đề`}
                                >
                                  🎲 Bốc {quota} câu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddAllQuestionsFromFolder(folder.id)}
                                  disabled={folder.count === 0}
                                  className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-40"
                                  title="Thêm tất cả câu hỏi của thư mục này vào đề"
                                >
                                  Chọn hết
                                </button>
                                {countInQuiz > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuestionsFromFolder(folder.id)}
                                    className="py-1 px-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold transition-colors cursor-pointer"
                                    title="Gỡ tất cả câu của thư mục này khỏi đề"
                                  >
                                    ✕ Gỡ
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Dòng tổng kết Ma trận */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                      <div className="text-xs text-slate-700 font-medium">
                        Tổng số câu theo cấu hình ma trận:{' '}
                        <b className="text-indigo-700 font-black text-sm">
                          {selectedFolderIds.reduce((acc, fId) => {
                            const folderObj = availableQuestionFolders.find((f) => f.id === fId);
                            const q = folderQuotas[fId] ?? Math.min(5, folderObj?.count || 0);
                            return acc + q;
                          }, 0)}{' '}
                          câu
                        </b>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePickByFolderMatrix('replace')}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>🎲 Tạo mới đề theo ma trận</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePickByFolderMatrix('append')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Bốc thêm theo ma trận</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* KHU VỰC 3: THANH TÓM TẮT PHÂN BỔ CÂU HỎI TRONG ĐỀ THI */}
              {newQuizQuestions.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đề thi hiện có <b>{newQuizQuestions.length} câu hỏi</b> phân bổ từ:</span>
                    </span>
                    {availableQuestionFolders
                      .filter((f) => (selectedQuestionsSummary[f.id] || 0) > 0)
                      .map((f) => (
                        <span
                          key={f.id}
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-300 shadow-2xs flex items-center gap-1"
                        >
                          <span>📁 {f.name}:</span>
                          <span className="text-emerald-600">{selectedQuestionsSummary[f.id]} câu</span>
                        </span>
                      ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {createQuizReviewMode === 'SELECT' && (
                      <button
                        type="button"
                        onClick={() => setCreateQuizReviewMode('REVIEW')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Xem chi tiết các câu đã chọn ({newQuizQuestions.length}) →</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeselectAllQuestions}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="Bỏ chọn tất cả câu hỏi trong đề"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa toàn bộ đề</span>
                    </button>
                  </div>
                </div>
              )}

              {/* KHU VỰC 4: DANH SÁCH CÂU HỎI (2 CHẾ ĐỘ XEM: NGÂN HÀNG vs XEM LẠI ĐỀ) */}
              {createQuizReviewMode === 'SELECT' ? (
                <div className="space-y-3">
                  {/* Thanh công cụ lọc & tìm kiếm */}
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      {/* Lọc xem theo thư mục cụ thể */}
                      <div className="flex items-center gap-1.5">
                        <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium">Lọc xem:</span>
                        <select
                          value={createQuizActiveFolderTab}
                          onChange={(e) => setCreateQuizActiveFolderTab(e.target.value)}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800"
                        >
                          <option value="all">
                            Tất cả thư mục đang chọn ({availableQuestionFolders.filter(f => selectedFolderIds.includes(f.id)).reduce((acc, f) => acc + f.count, 0)} câu)
                          </option>
                          {availableQuestionFolders
                            .filter((f) => selectedFolderIds.includes(f.id))
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                📁 {f.name} ({f.count} câu)
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Ô tìm kiếm câu hỏi */}
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={createQuizSearch}
                          onChange={(e) => setCreateQuizSearch(e.target.value)}
                          placeholder="Tìm từ khóa câu hỏi, nội dung..."
                          className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Nút Chọn / Bỏ chọn nhanh câu hỏi đang hiển thị */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredQuestions}
                        disabled={filteredQuestionBank.length === 0}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                        title="Thêm tất cả các câu hỏi đang hiển thị vào đề thi (cộng dồn không trùng)"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Chọn tất cả ({filteredQuestionBank.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectFilteredQuestions}
                        disabled={filteredQuestionBank.length === 0}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                        title="Bỏ chọn các câu hỏi đang hiển thị khỏi đề thi"
                      >
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Bỏ chọn</span>
                      </button>
                    </div>
                  </div>

                  {/* Danh sách các câu hỏi trong ngân hàng */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {filteredQuestionBank.map((q) => {
                      const isSelected = newQuizQuestions.some((nq) => nq.question === q.question);
                      const folderName = getQuestionFolderName(q);
                      return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                            isSelected ? 'bg-indigo-50 border-indigo-200 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 w-4 h-4 text-indigo-600 rounded cursor-pointer"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewQuizQuestions([...newQuizQuestions, q]);
                              } else {
                                setNewQuizQuestions(newQuizQuestions.filter((nq) => nq.question !== q.question));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800">{q.question}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                                📁 {folderName}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                                  ✓ Đã thêm vào đề
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                              {q.options.map((opt, i) => (
                                <p
                                  key={opt.id}
                                  className={
                                    getQuestionCorrectOptionIds(q).includes(opt.id)
                                      ? 'text-indigo-700 font-bold bg-indigo-50/60 px-1.5 py-0.5 rounded inline-block mr-2'
                                      : ''
                                  }
                                >
                                  {String.fromCharCode(65 + i)}. {opt.text}
                                </p>
                              ))}
                            </div>
                            {q.citation && (
                              <p className="text-[10px] text-slate-400 mt-1 italic">
                                Trích dẫn: {q.citation}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}

                    {filteredQuestionBank.length === 0 && (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                        <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-semibold">
                          Không có câu hỏi nào khớp với các thư mục hoặc từ khóa tìm kiếm đã chọn.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Hãy kiểm tra lại danh sách các thư mục được chọn ở trên hoặc thử tìm kiếm với từ khóa khác.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ XEM LẠI CÁC CÂU ĐÃ CHỌN TRONG ĐỀ THI */
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Danh sách các câu hỏi hiện có trong đề thi ({newQuizQuestions.length} câu)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateQuizReviewMode('SELECT')}
                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Chọn thêm từ Ngân hàng</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {newQuizQuestions.map((q, idx) => {
                      const folderName = getQuestionFolderName(q);
                      return (
                        <div
                          key={`selected-${idx}-${q.question.slice(0, 10)}`}
                          className="flex items-start justify-between gap-3 p-3.5 border border-indigo-100 bg-indigo-50/30 rounded-xl"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                Câu {idx + 1}
                              </span>
                              {isQuestionMultiSelect(q) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                                  Nhiều đáp án
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                                📁 {folderName}
                              </span>
                              <p className="text-sm font-semibold text-slate-800">{q.question}</p>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1 mt-2">
                              {q.options.map((opt, i) => (
                                <p
                                  key={opt.id}
                                  className={
                                    getQuestionCorrectOptionIds(q).includes(opt.id)
                                      ? 'text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded inline-block mr-2'
                                      : ''
                                  }
                                >
                                  {String.fromCharCode(65 + i)}. {opt.text}
                                </p>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewQuizQuestions(newQuizQuestions.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                            title="Gỡ câu hỏi này khỏi đề thi"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}

                    {newQuizQuestions.length === 0 && (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-semibold">Đề thi hiện chưa có câu hỏi nào.</p>
                        <button
                          type="button"
                          onClick={() => setCreateQuizReviewMode('SELECT')}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Quay lại Ngân hàng để chọn câu hỏi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {quizActionError && !showAssignModal && <p role="alert" className="text-sm text-red-600">{quizActionError}</p>}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isCreating || !onAddQuiz}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
              >
                {isCreating ? 'Đang lưu đề thi...' : 'Lưu & Giao bài'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. BANK VIEW WITH FOLDERS, AI PARSER & TEMPLATES */}
      {activeTab === 'BANK' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          {bankError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{bankError}</p>}
          {bankNotice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{bankNotice}</p>}
          <p className="text-xs text-slate-500">Chỉnh sửa từng câu rồi bấm Lưu câu hỏi. Các thay đổi chưa lưu được giữ trên màn hình.</p>
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Ngân hàng câu hỏi trắc nghiệm</h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {questionBank.length} câu hỏi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổ chức theo chủ đề, tự động nhập từ tệp Word, Excel, PDF bằng AI hoặc nhập thủ công
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAiImportModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nhập file & Tạo bằng AI</span>
              </button>
              <button
                onClick={() => {
                  const sampleOptions = [
                    { id: `o-${Date.now()}-1`, text: 'Lựa chọn A' },
                    { id: `o-${Date.now()}-2`, text: 'Lựa chọn B' },
                    { id: `o-${Date.now()}-3`, text: 'Lựa chọn C' },
                    { id: `o-${Date.now()}-4`, text: 'Lựa chọn D' },
                  ];
                  const newQ: QuizQuestion = {
                    id: `q-${Date.now()}`,
                    folderId: selectedFolderId === 'all' ? (questionFolders[0]?.id || undefined) : selectedFolderId,
                    question: 'Nội dung câu hỏi mới...',
                    options: sampleOptions,
                    correctOptionId: sampleOptions[0].id,
                    explanation: '',
                    citation: '',
                  };
                  onUpdateQuestionBank([newQ, ...questionBank]);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm câu hỏi</span>
              </button>
            </div>
          </div>

          {/* Folder Filter Bar & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            {/* Folder Badges / Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-1">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 flex-shrink-0 mr-1">
                <Folder className="w-3.5 h-3.5" />
                <span>Chủ đề:</span>
              </span>

              {/* All Folder chip */}
              <button
                onClick={() => setSelectedFolderId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedFolderId === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <span>Tất cả</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedFolderId === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {questionBank.length}
                </span>
              </button>

              {/* Individual Question Folders */}
              {questionFolders.map((folder) => {
                const count = questionBank.filter((q) => q.folderId === folder.id).length;
                const isSelected = selectedFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`inline-flex items-center rounded-xl text-xs font-semibold transition-all flex-shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>📁 {folder.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                    {/* Rename folder */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setFolderNameInput(folder.name);
                        setFolderDescInput(folder.description || '');
                        setFolderModalOpen(true);
                      }}
                      className={`p-1 hover:text-amber-300 transition-colors cursor-pointer ${
                        isSelected ? 'text-indigo-200' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Sửa tên thư mục"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {/* Delete folder */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                      className={`p-1 pr-1.5 hover:text-rose-300 transition-colors cursor-pointer ${
                        isSelected ? 'text-indigo-200' : 'text-slate-400 hover:text-rose-600'
                      }`}
                      title="Xóa thư mục"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Add New Folder Button */}
              <button
                onClick={() => {
                  setEditingFolder(null);
                  setFolderNameInput('');
                  setFolderDescInput('');
                  setFolderModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex-shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Thêm thư mục</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64 flex-shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Tìm câu hỏi, trích dẫn..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* List of Questions in the Bank */}
          <div className="space-y-4">
            {questionBank
              .filter((q) => {
                if (selectedFolderId !== 'all') {
                  return q.folderId === selectedFolderId;
                }
                return true;
              })
              .filter((q) => {
                if (!bankSearch.trim()) return true;
                const matchQ = q.question.toLowerCase().includes(bankSearch.toLowerCase());
                const matchCit = q.citation?.toLowerCase().includes(bankSearch.toLowerCase());
                const matchOpt = q.options.some((o) =>
                  o.text.toLowerCase().includes(bankSearch.toLowerCase())
                );
                return matchQ || matchCit || matchOpt;
              })
              .map((q) => {
                const bankIdx = questionBank.findIndex((item) => item.id === q.id);
                const currentFolder = questionFolders.find((f) => f.id === q.folderId);

                return (
                  <div
                    key={q.id}
                    className="p-5 border border-slate-200 rounded-2xl bg-white shadow-2xs relative group hover:border-indigo-300 transition-colors"
                  >
                    {questionDrafts[q.id] && <div className="mb-3 flex gap-2 items-center"><span className="text-xs text-amber-700">Chưa lưu</span>
                      <button disabled={bankBusy} onClick={()=>void bankAction(async()=>{await onSaveBankQuestion(q);clearDraft(q.id);},'Đã lưu câu hỏi.')} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs">{bankBusy?'Đang lưu…':'Lưu câu hỏi'}</button>
                      <button disabled={bankBusy} onClick={()=>clearDraft(q.id)} className="text-xs text-slate-600">Hủy thay đổi</button></div>}
                    {/* Top Row: Folder selector & Delete Question */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">Chủ đề:</span>
                        <select
                          value={q.folderId || ''}
                          onChange={(e) => {
                            const newBank = structuredClone(questionBank);
                            newBank[bankIdx].folderId = e.target.value || undefined;
                            onUpdateQuestionBank(newBank);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Chưa phân loại --</option>
                          {questionFolders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))}
                        </select>
                        {currentFolder && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            {currentFolder.name}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (window.confirm('Xóa câu hỏi này khỏi ngân hàng?')) {
                            void bankAction(async()=>{if(savedQuestionBank.some(saved=>saved.id===q.id))await onDeleteBankQuestion(q.id);clearDraft(q.id);},'Đã xóa câu hỏi.');
                          }
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Content Input */}
                    <div className="mb-3">
                      <input
                        value={q.question}
                        onChange={(e) => {
                          const newBank = structuredClone(questionBank);
                          newBank[bankIdx].question = e.target.value;
                          onUpdateQuestionBank(newBank);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                        placeholder="Nội dung câu hỏi..."
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-2 mb-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                        <span className="text-[11px] font-bold text-slate-600">
                          Các phương án trả lời ({isQuestionMultiSelect(q) ? 'Chọn nhiều đáp án' : 'Chọn 1 đáp án'}):
                        </span>
                        <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              const newBank = structuredClone(questionBank);
                              const currentCorrects = getQuestionCorrectOptionIds(q);
                              const firstCorrect = currentCorrects[0] || (q.options[0]?.id || '');
                              newBank[bankIdx].questionType = 'SINGLE';
                              newBank[bankIdx].correctOptionId = firstCorrect;
                              newBank[bankIdx].correctOptionIds = firstCorrect ? [firstCorrect] : [];
                              onUpdateQuestionBank(newBank);
                            }}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              !isQuestionMultiSelect(q)
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            1 đáp án
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newBank = structuredClone(questionBank);
                              const currentCorrects = getQuestionCorrectOptionIds(q);
                              const initial = currentCorrects.length > 0 ? currentCorrects : (q.options[0]?.id ? [q.options[0].id] : []);
                              newBank[bankIdx].questionType = 'MULTIPLE';
                              newBank[bankIdx].correctOptionIds = initial;
                              newBank[bankIdx].correctOptionId = initial.join(', ');
                              onUpdateQuestionBank(newBank);
                            }}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              isQuestionMultiSelect(q)
                                ? 'bg-purple-600 text-white shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Nhiều đáp án
                          </button>
                        </div>
                      </div>

                      {q.options.map((opt, oIdx) => {
                        const isMulti = isQuestionMultiSelect(q);
                        const isOptCorrect = getQuestionCorrectOptionIds(q).includes(opt.id);

                        return (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              type={isMulti ? 'checkbox' : 'radio'}
                              name={isMulti ? undefined : `bank-correct-${q.id}`}
                              checked={isOptCorrect}
                              onChange={(e) => {
                                const newBank = structuredClone(questionBank);
                                if (isMulti) {
                                  const currentCorrects = getQuestionCorrectOptionIds(q);
                                  const nextCorrects = e.target.checked
                                    ? Array.from(new Set([...currentCorrects, opt.id]))
                                    : currentCorrects.filter((id) => id !== opt.id);
                                  newBank[bankIdx].questionType = 'MULTIPLE';
                                  newBank[bankIdx].correctOptionIds = nextCorrects;
                                  newBank[bankIdx].correctOptionId = nextCorrects.join(', ');
                                } else {
                                  newBank[bankIdx].questionType = 'SINGLE';
                                  newBank[bankIdx].correctOptionId = opt.id;
                                  newBank[bankIdx].correctOptionIds = [opt.id];
                                }
                                onUpdateQuestionBank(newBank);
                              }}
                              className={`cursor-pointer ${isMulti ? 'rounded text-purple-600 focus:ring-purple-500' : 'text-indigo-600 focus:ring-indigo-500'}`}
                            />
                            <span className="text-xs font-bold text-slate-500 w-5">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input
                              value={opt.text}
                              onChange={(e) => {
                                const newBank = structuredClone(questionBank);
                                newBank[bankIdx].options[oIdx].text = e.target.value;
                                onUpdateQuestionBank(newBank);
                              }}
                              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:ring-2 focus:ring-indigo-500/20 ${
                                isOptCorrect
                                  ? 'border-emerald-300 bg-emerald-50/60 font-medium text-emerald-900'
                                  : 'border-slate-200 text-slate-700 bg-white'
                              }`}
                              placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newBank = structuredClone(questionBank);
                                newBank[bankIdx].options.splice(oIdx, 1);
                                const remainingCorrects = getQuestionCorrectOptionIds(newBank[bankIdx]).filter((id) => id !== opt.id);
                                if (remainingCorrects.length === 0 && newBank[bankIdx].options.length > 0) {
                                  remainingCorrects.push(newBank[bankIdx].options[0].id);
                                }
                                newBank[bankIdx].correctOptionIds = remainingCorrects;
                                newBank[bankIdx].correctOptionId = remainingCorrects.join(', ');
                                onUpdateQuestionBank(newBank);
                              }}
                              className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                              title="Xóa lựa chọn"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => {
                          const newBank = structuredClone(questionBank);
                          newBank[bankIdx].options.push({
                            id: `o-${Date.now()}-${newBank[bankIdx].options.length}`,
                            text: 'Lựa chọn mới',
                          });
                          onUpdateQuestionBank(newBank);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1 mt-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm lựa chọn</span>
                      </button>
                    </div>

                    {/* Explanations & Citations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Giải thích đáp án đúng:
                        </label>
                        <input
                          value={q.explanation || ''}
                          onChange={(e) => {
                            const newBank = structuredClone(questionBank);
                            newBank[bankIdx].explanation = e.target.value;
                            onUpdateQuestionBank(newBank);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                          placeholder="Giải thích lý do lựa chọn này đúng..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Trích dẫn căn cứ điều khoản quy chế:
                        </label>
                        <input
                          value={q.citation || ''}
                          onChange={(e) => {
                            const newBank = structuredClone(questionBank);
                            newBank[bankIdx].citation = e.target.value;
                            onUpdateQuestionBank(newBank);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                          placeholder="Ví dụ: Điều 2, Nội quy Lao động 2026..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

            {questionBank.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Ngân hàng câu hỏi đang trống</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Bạn có thể nhập tệp Excel, Word, PDF để AI tự động trích xuất hoặc thêm thủ công.
                </p>
                <button
                  onClick={() => setShowAiImportModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tải tệp & Tạo bằng AI</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ASSIGNMENT MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Giao bài thi</h3>
                  <p className="text-xs text-slate-500">Chỉ định đối tượng thực hiện kiểm tra trong Tổ RTG</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setActiveTab('LIST');
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hình thức giao bài:</label>
                <select
                  value={assignType}
                  disabled={isAssigning}
                  onChange={(e) => {
                    setAssignType(e.target.value as any);
                    setQuizActionError('');
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ALL">Toàn bộ Tổ RTG</option>
                  <option value="DEPARTMENT">Theo từng Ca</option>
                  <option value="INDIVIDUAL">Theo cá nhân</option>
                </select>
              </div>

              {/* TOÀN BỘ TỔ RTG */}
              {assignType === 'ALL' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-indigo-900">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Giao bài cho Toàn bộ Tổ RTG</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Đề thi sẽ được giao cho tất cả <b>{assignableEmployees.length}</b> nhân sự đang hoạt động trong Tổ RTG.
                  </p>
                  <p className="text-[11px] text-slate-500 italic">
                    * Các tài khoản test độc lập sẽ tự động không được tính vào danh sách giao bài này.
                  </p>
                </div>
              )}

              {/* THEO TỪNG CA - CHỌN MỘT HOẶC NHIỀU CA */}
              {assignType === 'DEPARTMENT' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Chọn các Ca (chọn 1 hoặc nhiều Ca):
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedShifts([...availableShifts])}
                        className="text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Chọn tất cả ca
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedShifts([])}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availableShifts.map((shift) => {
                      const isChecked = selectedShifts.includes(shift);
                      const shiftCount = assignableEmployees.filter((e) => e.department === shift).length;
                      return (
                        <label
                          key={shift}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isAssigning}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedShifts([...selectedShifts, shift]);
                                } else {
                                  setSelectedShifts(selectedShifts.filter((s) => s !== shift));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs truncate">{shift}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {shiftCount} NV
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Đã chọn: <b className="text-indigo-700">{selectedShifts.length}</b> / {availableShifts.length} Ca</span>
                    <span>Tổng: <b className="text-indigo-700">{assignableEmployees.filter((e) => selectedShifts.includes(e.department)).length}</b> nhân sự</span>
                  </div>
                </div>
              )}

              {/* THEO CÁ NHÂN - CHỌN MỘT HOẶC NHIỀU NHÂN SỰ */}
              {assignType === 'INDIVIDUAL' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Chọn nhân viên (chọn 1 hoặc nhiều người):
                    </label>
                    <span className="text-[11px] font-bold text-indigo-600">
                      Đã chọn {selectedIndividualIds.length} nhân sự
                    </span>
                  </div>

                  {/* Thanh lọc & tìm kiếm */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Tìm tên hoặc mã NV..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <select
                      value={assignShiftFilter}
                      onChange={(e) => setAssignShiftFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                    >
                      <option value="ALL">Tất cả Ca</option>
                      {availableShifts.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick selection actions & list */}
                  {(() => {
                    const q = assignSearch.trim().toLowerCase();
                    const filteredAssignable = assignableEmployees.filter((e) => {
                      const matchSearch =
                        !q ||
                        e.fullName.toLowerCase().includes(q) ||
                        (e.employeeCode || '').toLowerCase().includes(q);
                      const matchShift = assignShiftFilter === 'ALL' || e.department === assignShiftFilter;
                      return matchSearch && matchShift;
                    });

                    return (
                      <>
                        <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                          <span>Hiển thị {filteredAssignable.length} nhân sự</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const idsToAdd = filteredAssignable.map((e) => e.id);
                                setSelectedIndividualIds(Array.from(new Set([...selectedIndividualIds, ...idsToAdd])));
                              }}
                              className="text-indigo-600 font-bold hover:underline cursor-pointer"
                            >
                              Chọn tất cả hiển thị
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedIndividualIds([])}
                              className="text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Bỏ chọn tất cả
                            </button>
                          </div>
                        </div>

                        {/* Scrollable Checkbox List */}
                        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50 pr-1">
                          {filteredAssignable.length === 0 ? (
                            <p className="text-center py-4 text-xs text-slate-400">Không tìm thấy nhân viên phù hợp.</p>
                          ) : (
                            filteredAssignable.map((emp) => {
                              const isChecked = selectedIndividualIds.includes(emp.id);
                              return (
                                <label
                                  key={emp.id}
                                  className={`flex items-center justify-between p-2 text-xs cursor-pointer transition-colors ${
                                    isChecked ? 'bg-indigo-50/80 font-semibold text-indigo-950' : 'hover:bg-slate-100/70 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isAssigning}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedIndividualIds([...selectedIndividualIds, emp.id]);
                                        } else {
                                          setSelectedIndividualIds(selectedIndividualIds.filter((id) => id !== emp.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="truncate">{emp.fullName}</span>
                                    <span className="text-[10px] font-mono text-slate-400">({emp.employeeCode || emp.id})</span>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700 shrink-0">
                                    {emp.department || 'Tổ RTG'}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {quizActionError && <p role="alert" className="mt-3 text-sm text-red-600">{quizActionError}</p>}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isAssigning}
                onClick={() => {
                  setShowAssignModal(false);
                  setActiveTab('LIST');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={handleAssignQuiz}
                disabled={isAssigning || !onAssignQuiz}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isAssigning ? 'Đang giao bài...' : 'Xác nhận giao bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Create / Edit Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              {editingFolder ? 'Chỉnh sửa Thư mục Chủ đề' : 'Tạo Thư mục Chủ đề mới'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Phân loại câu hỏi trắc nghiệm theo từng chủ đề hoặc nhóm quy chế.
            </p>

            <form onSubmit={handleSaveEditFolder} className="space-y-4">{bankError && <p role="alert" className="text-sm text-rose-700">{bankError}</p>}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên thư mục / Chủ đề:</label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="Ví dụ: Quy chế Thưởng & Đãi ngộ"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả ngắn:</label>
                <input
                  type="text"
                  value={folderDescInput}
                  onChange={(e) => setFolderDescInput(e.target.value)}
                  placeholder="Ví dụ: Các quy định về phụ cấp, thưởng KPI..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFolderModalOpen(false);
                    setEditingFolder(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!folderNameInput.trim() || bankBusy}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {editingFolder ? 'Lưu thay đổi' : 'Tạo thư mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Question Import & Template Modal */}
      {showAiImportModal && (
        <AiQuestionImportModal
          isOpen={showAiImportModal}
          onClose={() => {
            setShowAiImportModal(false);
            if (onClearInitialAiFile) onClearInitialAiFile();
          }}
          questionFolders={questionFolders}
          onAddFolder={handleAddFolder}
          onConfirmAddQuestions={handleConfirmAddAiQuestions}
          initialFileBlob={initialAiFile?.blob}
          initialFileName={initialAiFile?.name}
        />
      )}

      {/* MODAL TỔNG HỢP CÁC CÁ NHÂN CHƯA HOÀN THÀNH BÀI THI */}
      {viewUncompletedQuiz && (() => {
        const modalTargets = getQuizTargetEmployees(viewUncompletedQuiz);
        const modalSubs = submissions.filter((s) => s.quizId === viewUncompletedQuiz.id);
        const modalCompletedMap = new Map<string, QuizSubmission>();
        modalSubs.forEach((s) => {
          if (!modalCompletedMap.has(s.employeeId) || new Date(s.submittedAt).getTime() > new Date(modalCompletedMap.get(s.employeeId)!.submittedAt).getTime()) {
            modalCompletedMap.set(s.employeeId, s);
          }
        });
        const modalCompletedEmployees = modalTargets.filter((e) => modalCompletedMap.has(e.id));
        const modalUncompleted = modalTargets.filter((e) => !modalCompletedMap.has(e.id));

        const q = uncompletedSearch.trim().toLowerCase();
        const matchesQuery = (e: Employee) => {
          if (!q) return true;
          return (
            e.fullName.toLowerCase().includes(q) ||
            (e.employeeCode || '').toLowerCase().includes(q) ||
            (e.department || '').toLowerCase().includes(q) ||
            (e.position || '').toLowerCase().includes(q)
          );
        };

        const filteredUncompleted = modalUncompleted.filter(matchesQuery);
        const filteredCompleted = modalCompletedEmployees.filter(matchesQuery);

        const handleCopyList = () => {
          if (uncompletedModalTab === 'UNCOMPLETED') {
            let txt = `DANH SÁCH NHÂN SỰ CHƯA HOÀN THÀNH BÀI THI: ${viewUncompletedQuiz.title} (${viewUncompletedQuiz.code})\n`;
            txt += `Tổng số chưa hoàn thành: ${modalUncompleted.length} / ${modalTargets.length} nhân sự\n`;
            txt += `STT\tMã NV\tHọ và tên\tPhòng ban / Ca kíp\tChức danh\n`;
            modalUncompleted.forEach((emp, i) => {
              txt += `${i + 1}\t${emp.employeeCode || emp.id}\t${emp.fullName}\t${emp.department || ''}\t${emp.position || ''}\n`;
            });
            navigator.clipboard.writeText(txt).then(() => {
              setCopiedUncompleted(true);
              setTimeout(() => setCopiedUncompleted(false), 2000);
            });
          } else {
            let txt = `DANH SÁCH NHÂN SỰ ĐÃ NỘP BÀI THI: ${viewUncompletedQuiz.title} (${viewUncompletedQuiz.code})\n`;
            txt += `Tổng số đã nộp: ${modalCompletedEmployees.length} / ${modalTargets.length} nhân sự\n`;
            txt += `STT\tMã NV\tHọ và tên\tPhòng ban / Ca kíp\tChức danh\tĐiểm số\tXếp loại\tThời gian nộp\n`;
            modalCompletedEmployees.forEach((emp, i) => {
              const sub = modalCompletedMap.get(emp.id);
              txt += `${i + 1}\t${emp.employeeCode || emp.id}\t${emp.fullName}\t${emp.department || ''}\t${emp.position || ''}\t${sub ? sub.score + 'đ' : '-'}\t${sub ? sub.competencyLevel : '-'}\t${sub?.submittedAt || '-'}\n`;
            });
            navigator.clipboard.writeText(txt).then(() => {
              setCopiedUncompleted(true);
              setTimeout(() => setCopiedUncompleted(false), 2000);
            });
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-2xs ${
                    uncompletedModalTab === 'UNCOMPLETED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {uncompletedModalTab === 'UNCOMPLETED' ? <UserX className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {uncompletedModalTab === 'UNCOMPLETED'
                          ? 'TỔNG HỢP CÁC CÁ NHÂN CHƯA HOÀN THÀNH BÀI THI'
                          : 'TỔNG HỢP CÁC CÁ NHÂN ĐÃ NỘP BÀI THI'}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        {viewUncompletedQuiz.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đề thi: <b className="text-slate-800">{viewUncompletedQuiz.title}</b> • Đã nộp:{' '}
                      <b className="text-emerald-700">{modalCompletedEmployees.length} / {modalTargets.length}</b> bài ({Math.round((modalCompletedEmployees.length / Math.max(1, modalTargets.length)) * 100)}%) • Chưa nộp: <b className="text-rose-700">{modalUncompleted.length}</b>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewUncompletedQuiz(null)}
                  className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Toolbar with 2 buttons */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, mã NV, phòng ban..."
                      value={uncompletedSearch}
                      onChange={(e) => setUncompletedSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* 2 NÚT CHỌN: NHÂN SỰ CHƯA LÀM & NHÂN SỰ ĐÃ NỘP BÀI */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setUncompletedModalTab('UNCOMPLETED')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        uncompletedModalTab === 'UNCOMPLETED'
                          ? 'bg-white text-rose-700 shadow-2xs border border-rose-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                      <span>Nhân sự chưa làm</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-black">
                        {modalUncompleted.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUncompletedModalTab('COMPLETED')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        uncompletedModalTab === 'COMPLETED'
                          ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Nhân sự đã nộp bài</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                        {modalCompletedEmployees.length}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleCopyList}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    {copiedUncompleted ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>{uncompletedModalTab === 'UNCOMPLETED' ? 'Sao chép chưa làm' : 'Sao chép đã nộp'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Modal Table */}
              <div className="overflow-y-auto flex-1 p-4">
                {uncompletedModalTab === 'UNCOMPLETED' ? (
                  filteredUncompleted.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      {modalUncompleted.length === 0
                        ? '🎉 Tất cả nhân viên thuộc đối tượng đã hoàn thành bài thi!'
                        : `Không tìm thấy nhân viên nào phù hợp với từ khóa "${uncompletedSearch}".`}
                    </div>
                  ) : (
                    <table className="w-full border-collapse border border-slate-200 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="border border-slate-200 px-3 py-2 text-center w-12">STT</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Mã nhân viên</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Họ và tên</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Phòng ban / Ca kíp</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Chức danh / Vị trí</th>
                          <th className="border border-slate-200 px-3 py-2 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUncompleted.map((emp, idx) => (
                          <tr
                            key={emp.id}
                            className={`hover:bg-rose-50/30 transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="border border-slate-200 px-3 py-2.5 text-center text-slate-500 font-mono">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-200 px-3 py-2.5 font-mono font-semibold text-slate-700">
                              {emp.employeeCode || emp.id}
                            </td>
                            <td className="border border-slate-200 px-3 py-2.5 font-bold text-slate-900">
                              {emp.fullName}
                            </td>
                            <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                              {emp.department || '-'}
                            </td>
                            <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                              {emp.position || '-'}
                            </td>
                            <td className="border border-slate-200 px-3 py-2.5 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Chưa làm bài
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  filteredCompleted.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      {modalCompletedEmployees.length === 0
                        ? 'Chưa có nhân sự nào nộp bài thi này.'
                        : `Không tìm thấy nhân viên nào phù hợp với từ khóa "${uncompletedSearch}".`}
                    </div>
                  ) : (
                    <table className="w-full border-collapse border border-slate-200 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="border border-slate-200 px-3 py-2 text-center w-12">STT</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Mã nhân viên</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Họ và tên</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">Phòng ban / Ca kíp</th>
                          <th className="border border-slate-200 px-3 py-2 text-center">Điểm số</th>
                          <th className="border border-slate-200 px-3 py-2 text-center">Xếp loại</th>
                          <th className="border border-slate-200 px-3 py-2 text-center">Thời gian nộp</th>
                          <th className="border border-slate-200 px-3 py-2 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompleted.map((emp, idx) => {
                          const sub = modalCompletedMap.get(emp.id);
                          const gradeInfo = sub ? getScoreGrade(sub.score) : null;
                          return (
                            <tr
                              key={emp.id}
                              className={`hover:bg-emerald-50/30 transition-colors ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                              }`}
                            >
                              <td className="border border-slate-200 px-3 py-2.5 text-center text-slate-500 font-mono">
                                {idx + 1}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 font-mono font-semibold text-slate-700">
                                {emp.employeeCode || emp.id}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 font-bold text-slate-900">
                                {emp.fullName}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                                {emp.department || '-'}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 text-center font-black">
                                <span className={sub && sub.score >= 50 ? 'text-emerald-700' : 'text-rose-600'}>
                                  {sub ? `${sub.score} / 100` : '-'}
                                </span>
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 text-center">
                                {gradeInfo ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${gradeInfo.badgeClass}`}>
                                    {gradeInfo.label}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 text-center font-mono text-[11px] text-slate-500">
                                {sub?.submittedAt ? sub.submittedAt.slice(0, 16).replace('T', ' ') : '-'}
                              </td>
                              <td className="border border-slate-200 px-3 py-2.5 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Đã nộp bài
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div>
                  {uncompletedModalTab === 'UNCOMPLETED' ? (
                    <>Đang hiển thị <b>{filteredUncompleted.length}</b> / <b>{modalUncompleted.length}</b> người chưa làm</>
                  ) : (
                    <>Đang hiển thị <b>{filteredCompleted.length}</b> / <b>{modalCompletedEmployees.length}</b> người đã nộp</>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewUncompletedQuiz(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
