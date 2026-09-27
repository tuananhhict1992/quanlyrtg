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
} from 'lucide-react';
import { Quiz, QuizQuestion, QuestionFolder, QuizSubmission, Employee, AppSettings } from '../types';
import { AiQuestionImportModal } from './AiQuestionImportModal';
import { syncAllQuizzesToSheet } from '../services/googleSheetSyncService';

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

interface QuizViewProps {
  quizzes: Quiz[];
  submissions: QuizSubmission[];
  currentUser: Employee;
  allEmployees: Employee[];
  questionBank: QuizQuestion[];
  onUpdateQuestionBank: (bank: QuizQuestion[]) => void;
  questionFolders: QuestionFolder[];
  onUpdateQuestionFolders: (folders: QuestionFolder[]) => void;
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
  questionBank = [],
  onUpdateQuestionBank,
  questionFolders = [],
  onUpdateQuestionFolders,
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
  const [newQuizDuration, setNewQuizDuration] = useState(15);
  const [newQuizPassScore, setNewQuizPassScore] = useState(80);
  const [newQuizQuestions, setNewQuizQuestions] = useState<Omit<QuizQuestion, 'id'>[]>([]);
  const [createQuizFolderFilter, setCreateQuizFolderFilter] = useState<string>('all');
  
  // Hẹn giờ phát đề, kết thúc kiểm tra & câu hỏi ngẫu nhiên
  const [newQuizScheduledStart, setNewQuizScheduledStart] = useState<string>('');
  const [newQuizScheduledEnd, setNewQuizScheduledEnd] = useState<string>('');
  const [newQuizIsRandom, setNewQuizIsRandom] = useState<boolean>(false);
  const [newQuizRandomCount, setNewQuizRandomCount] = useState<number>(10);
  const [autoPickCount, setAutoPickCount] = useState<number>(10);

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
  const [assignTarget, setAssignTarget] = useState<string>('');
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

    try {
      const attempt=await api('/exams/'+encodeURIComponent(quiz.id)+'/start',{method:'POST'});
      setAttemptId(attempt.attemptId);setSelectedQuiz(attempt.quiz);setSelectedAnswers({});setCurrentQuestionIdx(0);
      setTimeLeftSeconds(Math.max(0,Math.floor((Date.parse(attempt.expiresAt)-Date.now())/1000)));setTimerActive(true);
    }catch(e){alert((e as Error).message);return;}
    setActiveTab('TAKE');
  };

  // Tự động chọn ngẫu nhiên N câu hỏi từ ngân hàng
  const handleAutoPickRandomQuestions = () => {
    const filtered = questionBank.filter((q) => {
      if (createQuizFolderFilter !== 'all') {
        return q.folderId === createQuizFolderFilter;
      }
      return true;
    });

    if (filtered.length === 0) {
      alert('Không có câu hỏi nào trong chủ đề hiện tại để chọn.');
      return;
    }

    const count = Math.min(Math.max(1, autoPickCount), filtered.length);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    setNewQuizQuestions(picked);
  };

  const handleSelectAllFilteredQuestions = () => {
    const filtered = questionBank.filter((q) => {
      if (createQuizFolderFilter !== 'all') {
        return q.folderId === createQuizFolderFilter;
      }
      return true;
    });
    setNewQuizQuestions(filtered);
  };

  const handleDeselectAllQuestions = () => {
    setNewQuizQuestions([]);
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmitQuiz = async () => {
    if(!attemptId||submitting)return;setSubmitting(true);setTimerActive(false);
    try{const result=await api<QuizSubmission>('/exams/attempts/'+attemptId+'/submit',{method:'POST',body:JSON.stringify({answers:selectedAnswers})});await onSaveSubmission(result);setLatestResult(result);setActiveTab('RESULT');}catch(e){alert((e as Error).message);}finally{setSubmitting(false);}
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
      durationMinutes: newQuizDuration,
      passScore: newQuizPassScore,
      targetDepartments: ['ALL'],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      questions: newQuizQuestions.map((q, idx) => ({ ...q, id: `q-${Date.now()}-${idx}`, explanation: q.explanation || '', citation: q.citation || '' })),
      scheduledStartTime: newQuizScheduledStart || undefined,
      scheduledEndTime: newQuizScheduledEnd || undefined,
      isRandomQuestions: newQuizIsRandom,
      randomQuestionCount: newQuizIsRandom ? Number(newQuizRandomCount) : undefined,
    };

    createPending.current = true;
    setIsCreating(true);
    setQuizActionError('');
    try {
    await onAddQuiz(newQuiz);
    setCreatedQuizId(newQuiz.id);
    setAssignTarget('');
    setAssignType('ALL');
    setShowAssignModal(true);
    
    // Reset form
    setNewQuizTitle('');
    setNewQuizDescription('');
    setNewQuizQuestions([]);
    setNewQuizScheduledStart('');
    setNewQuizScheduledEnd('');
    setNewQuizIsRandom(false);
    setNewQuizRandomCount(10);
    } catch (error) {
      setQuizActionError((error as Error).message);
    } finally {
      createPending.current = false;
      setIsCreating(false);
    }
  };

  const handleAssignQuiz = async () => {
    if (assignPending.current || !onAssignQuiz || !createdQuizId) return;
    const recipients = allEmployees.filter(e => e.status === 'ACTIVE' && (
      assignType === 'ALL' || (assignType === 'DEPARTMENT' ? e.department === assignTarget : e.id === assignTarget)
    )).map(e => e.id);
    if (!recipients.length) {
      setQuizActionError('Vui lòng chọn nhân viên đang hoạt động để giao bài.');
      return;
    }
    assignPending.current = true;
    setIsAssigning(true);
    setQuizActionError('');
    try {
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

  // Folder management functions
  const handleAddFolder = (name: string, description?: string): string => {
    const newFolder: QuestionFolder = {
      id: `fld-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      color: 'indigo',
      createdAt: new Date().toISOString(),
    };
    const updated = [...questionFolders, newFolder];
    onUpdateQuestionFolders(updated);
    return newFolder.id;
  };

  const handleSaveEditFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    if (editingFolder) {
      const updated = questionFolders.map((f) =>
        f.id === editingFolder.id
          ? { ...f, name: folderNameInput.trim(), description: folderDescInput.trim() }
          : f
      );
      onUpdateQuestionFolders(updated);
    } else {
      handleAddFolder(folderNameInput, folderDescInput);
    }

    setFolderModalOpen(false);
    setEditingFolder(null);
    setFolderNameInput('');
    setFolderDescInput('');
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = questionFolders.find((f) => f.id === folderId);
    if (!folder) return;
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa thư mục "${folder.name}"? Các câu hỏi trong thư mục này vẫn sẽ được giữ lại.`
      )
    ) {
      const updatedBank = questionBank.map((q) =>
        q.folderId === folderId ? { ...q, folderId: undefined } : q
      );
      onUpdateQuestionBank(updatedBank);
      onUpdateQuestionFolders(questionFolders.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId('all');
      }
    }
  };

  const handleConfirmAddAiQuestions = (newQuestions: QuizQuestion[], targetFldId?: string) => {
    const questionsWithFolder = newQuestions.map((q) => ({
      ...q,
      folderId: targetFldId || q.folderId || questionFolders[0]?.id,
    }));
    onUpdateQuestionBank([...questionsWithFolder, ...questionBank]);
    if (targetFldId) {
      setSelectedFolderId(targetFldId);
    }
    if (onClearInitialAiFile) {
      onClearInitialAiFile();
    }
  };

  // Filter records
  const filteredSubmissions = submissions.filter(
    (s) =>
      s.employeeName.toLowerCase().includes(recordSearch.toLowerCase()) ||
      s.department.toLowerCase().includes(recordSearch.toLowerCase()) ||
      s.quizTitle.toLowerCase().includes(recordSearch.toLowerCase())
  );

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quizzes.map((quiz) => {
            const userSubmissions = submissions.filter(
              (s) => s.quizId === quiz.id && s.employeeId === currentUser.id
            );
            const latestSub = userSubmissions[userSubmissions.length - 1];
            const scheduleInfo = getQuizScheduleStatus(quiz);

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
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs ${scheduleInfo.badgeClass}`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{scheduleInfo.label}</span>
                      </span>

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
                  ) : (
                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-indigo-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>{latestSub ? 'Làm lại bài kiểm tra' : 'Bắt đầu làm bài thi'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {selectedQuiz.questions[currentQuestionIdx]?.question}
              </h4>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {(selectedQuiz.questions[currentQuestionIdx]?.options || []).map((opt, i) => {
                const isSelected =
                  selectedAnswers[selectedQuiz.questions[currentQuestionIdx]?.id] === opt.id;
                const letter = String.fromCharCode(65 + i);

                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      handleSelectOption(selectedQuiz.questions[currentQuestionIdx]?.id, opt.id)
                    }
                    className={`w-full p-4 rounded-2xl text-left border transition-all flex items-start gap-3.5 ${
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
                      {letter}
                    </div>
                    <span className="text-xs sm:text-sm leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
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

            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">
              {latestResult.score} / 100 Điểm
            </h3>

            <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
              Bạn đã trả lời đúng <b>{latestResult.correctCount}</b> trên tổng số{' '}
              <b>{latestResult.totalQuestions}</b> câu hỏi. Kết quả đã được tự động lưu vào{' '}
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
              {(selectedQuiz.questions || []).map((q, idx) => {
                const userChoice = latestResult.answers[q.id];
                const isCorrect = userChoice === q.correctOptionId;

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
                      <h5 className="font-bold text-slate-900 text-sm">
                        Câu {idx + 1}: {q.question}
                      </h5>
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
                        const isThisUserChoice = userChoice === opt.id;
                        const isThisCorrect = q.correctOptionId === opt.id;

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
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
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

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng <b>{filteredSubmissions.length}</b> bản ghi
              </span>

              {/* Google Sheet Sync Button */}
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
            </div>
          </div>

          {quizSyncNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quizSyncNotice}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Nhân sự</th>
                    <th className="py-3 px-4">Phòng ban</th>
                    <th className="py-3 px-4">Đề thi</th>
                    <th className="py-3 px-4">Điểm số</th>
                    <th className="py-3 px-4">Xếp loại</th>
                    <th className="py-3 px-4">Thời gian nộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{sub.employeeName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{sub.department}</td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">{sub.quizTitle}</td>
                      <td className="py-3.5 px-4">
                        <span className={`font-black text-sm ${sub.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {sub.score} / 100
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sub.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sub.competencyLevel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">{sub.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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

            <div className="pt-4 border-t border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    Chọn câu hỏi từ Ngân hàng ({newQuizQuestions.length} đã chọn)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Chọn câu hỏi cụ thể hoặc dùng công cụ chọn ngẫu nhiên bên dưới
                  </p>
                </div>

                {/* Bộ lọc chủ đề */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Chủ đề:</span>
                  <select
                    value={createQuizFolderFilter}
                    onChange={(e) => setCreateQuizFolderFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium"
                  >
                    <option value="all">Tất cả chủ đề ({questionBank.length})</option>
                    {questionFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name} ({questionBank.filter((q) => q.folderId === f.id).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thanh công cụ Tự động chọn ngẫu nhiên & Chọn tất cả */}
              <div className="mb-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">Bốc ngẫu nhiên:</span>
                  <input
                    type="number"
                    min="1"
                    value={autoPickCount}
                    onChange={(e) => setAutoPickCount(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                  />
                  <span className="text-xs text-slate-600">câu</span>
                  <button
                    type="button"
                    onClick={handleAutoPickRandomQuestions}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>🎲 Tự động chọn ngẫu nhiên {autoPickCount} câu</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredQuestions}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chọn tất cả ({createQuizFolderFilter === 'all' ? questionBank.length : questionBank.filter(q => q.folderId === createQuizFolderFilter).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllQuestions}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Bỏ chọn hết</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {questionBank
                  .filter((q) => {
                    if (createQuizFolderFilter !== 'all') {
                      return q.folderId === createQuizFolderFilter;
                    }
                    return true;
                  })
                  .map((q) => {
                  const isSelected = newQuizQuestions.some(nq => nq.question === q.question);
                  const folder = questionFolders.find((f) => f.id === q.folderId);
                  return (
                    <label key={q.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewQuizQuestions([...newQuizQuestions, q]);
                          } else {
                            setNewQuizQuestions(newQuizQuestions.filter(nq => nq.question !== q.question));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-800">{q.question}</p>
                          {folder && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                              {folder.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          {q.options.map((opt, i) => (
                            <p key={opt.id} className={q.correctOptionId === opt.id ? 'text-indigo-700 font-medium' : ''}>
                              {String.fromCharCode(65 + i)}. {opt.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {questionBank.length === 0 && (
                  <p className="text-sm text-slate-500 italic">Ngân hàng câu hỏi đang trống. Vui lòng thêm câu hỏi ở tab "Ngân hàng câu hỏi".</p>
                )}
              </div>
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
                    {/* Top Row: Folder selector & Delete Question */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">Chủ đề:</span>
                        <select
                          value={q.folderId || ''}
                          onChange={(e) => {
                            const newBank = [...questionBank];
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
                            onUpdateQuestionBank(questionBank.filter((bankQ) => bankQ.id !== q.id));
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
                          const newBank = [...questionBank];
                          newBank[bankIdx].question = e.target.value;
                          onUpdateQuestionBank(newBank);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                        placeholder="Nội dung câu hỏi..."
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-2 mb-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 mb-1">
                        Các phương án trả lời (chọn radio để đặt làm đáp án đúng):
                      </p>
                      {q.options.map((opt, oIdx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`bank-correct-${q.id}`}
                            checked={q.correctOptionId === opt.id}
                            onChange={() => {
                              const newBank = [...questionBank];
                              newBank[bankIdx].correctOptionId = opt.id;
                              onUpdateQuestionBank(newBank);
                            }}
                            className="text-indigo-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-500 w-5">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          <input
                            value={opt.text}
                            onChange={(e) => {
                              const newBank = [...questionBank];
                              newBank[bankIdx].options[oIdx].text = e.target.value;
                              onUpdateQuestionBank(newBank);
                            }}
                            className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:ring-2 focus:ring-indigo-500/20 ${
                              q.correctOptionId === opt.id
                                ? 'border-emerald-300 bg-emerald-50/60 font-medium text-emerald-900'
                                : 'border-slate-200 text-slate-700 bg-white'
                            }`}
                            placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                          />
                          <button
                            onClick={() => {
                              const newBank = [...questionBank];
                              newBank[bankIdx].options.splice(oIdx, 1);
                              if (
                                newBank[bankIdx].correctOptionId === opt.id &&
                                newBank[bankIdx].options.length > 0
                              ) {
                                newBank[bankIdx].correctOptionId = newBank[bankIdx].options[0].id;
                              }
                              onUpdateQuestionBank(newBank);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            title="Xóa lựa chọn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          const newBank = [...questionBank];
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
                            const newBank = [...questionBank];
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
                            const newBank = [...questionBank];
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
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Giao bài & Thông báo</h3>
            <p className="text-xs text-slate-500 mb-4">
              Đề thi đã được lưu. Mỗi nhân viên được chọn sẽ nhận một thông báo trong hệ thống.
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Giao cho:</label>
                <select
                  value={assignType}
                  disabled={isAssigning}
                  onChange={(e) => {setAssignType(e.target.value as any);setAssignTarget('');setQuizActionError('');}}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Toàn bộ công ty</option>
                  <option value="DEPARTMENT">Theo phòng ban</option>
                  <option value="INDIVIDUAL">Cá nhân cụ thể</option>
                </select>
              </div>

              {assignType === 'DEPARTMENT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn phòng ban:</label>
                  <select
                    value={assignTarget}
                    disabled={isAssigning}
                    onChange={(e) => setAssignTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {Array.from(new Set(allEmployees.map((e) => e.department))).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {assignType === 'INDIVIDUAL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn nhân viên:</label>
                  <select
                    value={assignTarget}
                    disabled={isAssigning}
                    onChange={(e) => setAssignTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {allEmployees.filter(e => e.status === 'ACTIVE').map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {quizActionError && <p role="alert" className="mt-3 text-sm text-red-600">{quizActionError}</p>}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                disabled={isAssigning}
                onClick={() => {
                  setShowAssignModal(false);
                  setActiveTab('LIST');
                }}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleAssignQuiz}
                disabled={isAssigning || !onAssignQuiz}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
              >
                {isAssigning ? 'Đang giao bài...' : 'Giao bài & Gửi thông báo'}
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

            <form onSubmit={handleSaveEditFolder} className="space-y-4">
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
                  disabled={!folderNameInput.trim()}
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
    </div>
  );
};
