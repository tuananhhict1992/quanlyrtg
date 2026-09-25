import {apiFetch} from '../services/supabase';
import React, { useState } from 'react';
import {
  Upload,
  Sparkles,
  FileSpreadsheet,
  FileText,
  File,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Folder,
  X,
  Plus,
  Trash2,
  HelpCircle,
  FolderPlus,
} from 'lucide-react';
import { QuizQuestion, QuestionFolder } from '../types';
import {
  downloadSampleExcelTemplate,
  getSampleWordTextTemplate,
  parseFileForQuestions,
} from '../utils/questionTemplateHelper';

interface AiQuestionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionFolders?: QuestionFolder[];
  onAddFolder: (name: string, description?: string) => string;
  onConfirmAddQuestions: (questions: QuizQuestion[], targetFolderId?: string) => void;
  initialFileBlob?: Blob;
  initialFileName?: string;
}

export const AiQuestionImportModal: React.FC<AiQuestionImportModalProps> = ({
  isOpen,
  onClose,
  questionFolders = [],
  onAddFolder,
  onConfirmAddQuestions,
  initialFileBlob,
  initialFileName,
}) => {
  const [activeTab, setActiveTab] = useState<'ANALYZE' | 'TEMPLATES'>('ANALYZE');

  // Input state
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(initialFileBlob || null);
  const [fileName, setFileName] = useState<string>(initialFileName || '');
  const [pastedText, setPastedText] = useState<string>('');
  const [useTextInput, setUseTextInput] = useState<boolean>(false);
  const [targetFolderId, setTargetFolderId] = useState<string>(
    questionFolders[0]?.id || 'folder-noiquy'
  );
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Loading & generation state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Review stage
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Record<number, boolean>>({});
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Create folder submodal
  const [showQuickFolderModal, setShowQuickFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setFileName(files[0].name);
      setErrorMessage(null);
    }
  };

  const handleAnalyzeAndGenerate = async () => {
    setErrorMessage(null);
    if (!selectedFile && (!pastedText || !pastedText.trim())) {
      setErrorMessage('Vui lòng chọn tệp Word, Excel, PDF hoặc dán nội dung văn bản quy chế.');
      return;
    }

    setIsProcessing(true);

    try {
      let parsedData: any = {};
      if (selectedFile) {
        parsedData = await parseFileForQuestions(selectedFile, fileName || 'tailieu');
      } else {
        parsedData = {
          rawText: pastedText,
          mimeType: 'text/plain',
        };
      }

      // If structured questions were extracted directly from standard Excel
      if (parsedData.structuredQuestions && parsedData.structuredQuestions.length > 0) {
        const questionsWithFolder = parsedData.structuredQuestions.map((q: QuizQuestion) => ({
          ...q,
          folderId: targetFolderId,
        }));
        setGeneratedQuestions(questionsWithFolder);
        const allSelected: Record<number, boolean> = {};
        questionsWithFolder.forEach((_: any, idx: number) => {
          allSelected[idx] = true;
        });
        setSelectedQuestionIndices(allSelected);
        setIsReviewing(true);
        setSuccessNotice(
          `Đã phát hiện và đọc ${questionsWithFolder.length} câu hỏi theo mẫu bố trí chuẩn Excel!`
        );
        setIsProcessing(false);
        return;
      }

      // Call server Gemini endpoint
      const selectedFolderName =
        (questionFolders || []).find((f) => f.id === targetFolderId)?.name || 'Quy định chung';

      const response = await apiFetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileText: parsedData.rawText,
          fileBase64: parsedData.base64,
          mimeType: parsedData.mimeType,
          fileName: fileName || 'Văn bản quy định',
          topic: selectedFolderName,
          questionCount: Number(questionCount),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lỗi máy chủ AI (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const rawQuestions: any[] = result.questions || [];

      if (rawQuestions.length === 0) {
        throw new Error('Không tạo được câu hỏi nào từ nội dung được cung cấp.');
      }

      const formattedQuestions: QuizQuestion[] = rawQuestions.map((q, index) => ({
        id: `ai-${Date.now()}-${index}`,
        folderId: targetFolderId,
        question: q.question,
        options: q.options || [
          { id: 'opt-a', text: 'Lựa chọn A' },
          { id: 'opt-b', text: 'Lựa chọn B' },
          { id: 'opt-c', text: 'Lựa chọn C' },
          { id: 'opt-d', text: 'Lựa chọn D' },
        ],
        correctOptionId: q.correctOptionId || 'opt-a',
        explanation: q.explanation || '',
        citation: q.citation || `Trích từ: ${fileName || 'Tài liệu nội bộ'}`,
      }));

      setGeneratedQuestions(formattedQuestions);
      const allSelected: Record<number, boolean> = {};
      formattedQuestions.forEach((_, idx) => {
        allSelected[idx] = true;
      });
      setSelectedQuestionIndices(allSelected);
      setIsReviewing(true);
      setSuccessNotice(result.message || `AI đã tạo ${formattedQuestions.length} câu hỏi thành công!`);
    } catch (err: any) {
      console.error('Error generating questions:', err);
      setErrorMessage(err.message || 'Không thể tạo câu hỏi từ file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAddSelected = () => {
    const finalToAdd = generatedQuestions.filter((_, idx) => selectedQuestionIndices[idx]);
    if (finalToAdd.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 câu hỏi để thêm vào ngân hàng.');
      return;
    }
    onConfirmAddQuestions(finalToAdd, targetFolderId);
    onClose();
  };

  const handleCopyWordTemplate = () => {
    const text = getSampleWordTextTemplate();
    navigator.clipboard.writeText(text);
    setSuccessNotice('Đã sao chép mẫu văn bản Word vào clipboard!');
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleCreateQuickFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newId = onAddFolder(newFolderName.trim());
    setTargetFolderId(newId);
    setNewFolderName('');
    setShowQuickFolderModal(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nhập Ngân hàng câu hỏi từ file ngoài & Tạo bằng AI
              </h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ Word (.docx), Excel (.xlsx, .csv), PDF & Văn bản quy chế nội bộ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Analyze vs Templates */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-100 flex-shrink-0">
          <button
            onClick={() => setActiveTab('ANALYZE')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'ANALYZE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. Tải file & Tạo câu hỏi AI
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'TEMPLATES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>2. Mẫu bố trí chuẩn cho Admin (Excel / Word)</span>
          </button>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successNotice && (
          <div className="mt-3 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {activeTab === 'ANALYZE' && (
            <>
              {!isReviewing ? (
                /* Step 1: Upload and Configuration */
                <div className="space-y-4">
                  {/* Select Destination Folder / Topic */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Thư mục / Chủ đề lưu trữ trong Ngân hàng
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={targetFolderId}
                        onChange={(e) => setTargetFolderId(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {questionFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            📁 {folder.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowQuickFolderModal(true)}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                        <span>Thư mục mới</span>
                      </button>
                    </div>
                  </div>

                  {/* Input Source Choice: File vs Text */}
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="input-source"
                        checked={!useTextInput}
                        onChange={() => setUseTextInput(false)}
                      />
                      <span>Tải tệp từ máy tính (Excel, Word, PDF)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="input-source"
                        checked={useTextInput}
                        onChange={() => setUseTextInput(true)}
                      />
                      <span>Dán nội dung văn bản</span>
                    </label>
                  </div>

                  {!useTextInput ? (
                    /* File Upload Box */
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
                      <input
                        type="file"
                        id="ai-question-file-input"
                        onChange={handleFileChange}
                        accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt"
                        className="hidden"
                      />
                      <label
                        htmlFor="ai-question-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center gap-2"
                      >
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-xs">
                          {selectedFile ? (
                            <p className="font-bold text-indigo-700 text-sm">{fileName}</p>
                          ) : (
                            <>
                              <p className="font-semibold text-slate-800">
                                Nhấp để chọn tệp hoặc kéo thả vào đây
                              </p>
                              <p className="text-slate-400 mt-1">
                                Hỗ trợ: .xlsx, .xls, .csv, .docx, .pdf, .txt (Tối đa 25MB)
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  ) : (
                    /* Direct Text Input */
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dán nội dung quy chế hoặc bộ câu hỏi:
                      </label>
                      <textarea
                        rows={6}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="Dán nội dung điều khoản hoặc các câu hỏi cần phân tích..."
                        className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số lượng câu hỏi AI cần trích xuất / biên soạn
                      </label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      >
                        <option value={3}>3 câu hỏi trọng tâm</option>
                        <option value={5}>5 câu hỏi tiêu chuẩn (Khuyến nghị)</option>
                        <option value={10}>10 câu hỏi toàn diện</option>
                        <option value={15}>15 câu hỏi nâng cao</option>
                      </select>
                    </div>
                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 text-[11px] text-amber-900">
                      <p className="font-semibold mb-0.5">💡 Lưu ý đồng bộ:</p>
                      <p>
                        Nếu tệp Excel của bạn được bố trí theo mẫu ở Tab 2, hệ thống sẽ đọc chính xác 100%
                        từng câu hỏi, đáp án đúng và trích dẫn quy chế.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Review Generated Questions */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Xem lại & Điều chỉnh câu hỏi ({generatedQuestions.length} câu)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Kiểm tra nội dung, điều chỉnh đáp án đúng trước khi lưu vào ngân hàng.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsReviewing(false)}
                      className="text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      ← Tải lại tệp khác
                    </button>
                  </div>

                  <div className="space-y-3">
                    {generatedQuestions.map((q, idx) => {
                      const isSelected = !!selectedQuestionIndices[idx];
                      return (
                        <div
                          key={q.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isSelected ? 'bg-white border-indigo-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedQuestionIndices({
                                  ...selectedQuestionIndices,
                                  [idx]: e.target.checked,
                                })
                              }
                              className="mt-1 w-4 h-4 rounded text-indigo-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                  Câu {idx + 1}
                                </span>
                                <input
                                  value={q.question}
                                  onChange={(e) => {
                                    const updated = [...generatedQuestions];
                                    updated[idx].question = e.target.value;
                                    setGeneratedQuestions(updated);
                                  }}
                                  className="w-full text-xs font-bold text-slate-900 border-b border-slate-200 focus:border-indigo-500 px-1 py-0.5"
                                />
                              </div>

                              <div className="space-y-1.5 mb-2 pl-2 border-l-2 border-slate-100">
                                {q.options.map((opt, oIdx) => (
                                  <div key={opt.id} className="flex items-center gap-2 text-xs">
                                    <input
                                      type="radio"
                                      name={`review-correct-${q.id}`}
                                      checked={q.correctOptionId === opt.id}
                                      onChange={() => {
                                        const updated = [...generatedQuestions];
                                        updated[idx].correctOptionId = opt.id;
                                        setGeneratedQuestions(updated);
                                      }}
                                      className="text-indigo-600"
                                    />
                                    <span className="text-[11px] font-bold text-slate-500 w-4">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    <input
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updated = [...generatedQuestions];
                                        updated[idx].options[oIdx].text = e.target.value;
                                        setGeneratedQuestions(updated);
                                      }}
                                      className={`flex-1 px-2 py-1 rounded-lg border text-xs ${
                                        q.correctOptionId === opt.id
                                          ? 'border-emerald-300 bg-emerald-50/50 font-medium text-emerald-900'
                                          : 'border-slate-200 text-slate-700'
                                      }`}
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <input
                                  value={q.explanation}
                                  onChange={(e) => {
                                    const updated = [...generatedQuestions];
                                    updated[idx].explanation = e.target.value;
                                    setGeneratedQuestions(updated);
                                  }}
                                  placeholder="Giải thích đáp án..."
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-slate-600"
                                />
                                <input
                                  value={q.citation}
                                  onChange={(e) => {
                                    const updated = [...generatedQuestions];
                                    updated[idx].citation = e.target.value;
                                    setGeneratedQuestions(updated);
                                  }}
                                  placeholder="Căn cứ điều khoản..."
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-slate-600"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'TEMPLATES' && (
            /* Templates Guide for Admin */
            <div className="space-y-6 text-xs text-slate-700">
              {/* Excel Template Card */}
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Mẫu bảng tính Excel chuẩn (.xlsx)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Điền trực tiếp các cột theo đúng thứ tự để hệ thống tự động nhận diện 100%
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadSampleExcelTemplate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải file Excel mẫu (.xlsx)</span>
                  </button>
                </div>

                {/* Table structure preview */}
                <div className="overflow-x-auto bg-white rounded-xl border border-emerald-200/80 shadow-xs">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-emerald-100/60 text-emerald-900 font-bold border-b border-emerald-200">
                      <tr>
                        <th className="p-2.5">Câu hỏi</th>
                        <th className="p-2.5">Lựa chọn A</th>
                        <th className="p-2.5">Lựa chọn B</th>
                        <th className="p-2.5">Lựa chọn C</th>
                        <th className="p-2.5">Lựa chọn D</th>
                        <th className="p-2.5">Đáp án đúng</th>
                        <th className="p-2.5">Giải thích</th>
                        <th className="p-2.5">Căn cứ quy chế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="p-2.5 font-medium">Giờ làm việc tiêu chuẩn hàng ngày...</td>
                        <td className="p-2.5">08h00 - 17h00</td>
                        <td className="p-2.5">08h00 - 17h30</td>
                        <td className="p-2.5">08h30 - 18h00</td>
                        <td className="p-2.5">Linh hoạt</td>
                        <td className="p-2.5 font-bold text-emerald-700">B</td>
                        <td className="p-2.5">Nghỉ trưa 90 phút...</td>
                        <td className="p-2.5">Điều 1, NQ-01</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Word / Text Format Card */}
              <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Mẫu văn bản Word (.docx) & PDF chuẩn
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Định dạng đơn giản, AI tự động quét từng câu hỏi và phương án A, B, C, D
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyWordTemplate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Sao chép mẫu văn bản</span>
                  </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 font-mono text-[11px] text-slate-800 whitespace-pre-line leading-relaxed">
                  {getSampleWordTextTemplate()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Đóng
          </button>

          {activeTab === 'ANALYZE' && (
            <div>
              {!isReviewing ? (
                <button
                  onClick={handleAnalyzeAndGenerate}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{isProcessing ? 'AI đang đọc & trích xuất câu hỏi...' : 'Phân tích & Tạo câu hỏi bằng AI'}</span>
                </button>
              ) : (
                <button
                  onClick={handleConfirmAddSelected}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Xác nhận thêm (
                    {
                      generatedQuestions.filter((_, idx) => selectedQuestionIndices[idx]).length
                    }
                    ) câu hỏi vào Ngân hàng
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Folder Creation Modal */}
      {showQuickFolderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm mb-1">Tạo thư mục câu hỏi mới</h4>
            <p className="text-xs text-slate-500 mb-3">Phân chia chủ đề câu hỏi rõ ràng</p>
            <form onSubmit={handleCreateQuickFolder}>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ví dụ: Quy chế Thưởng & Đãi ngộ..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickFolderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  Tạo thư mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
