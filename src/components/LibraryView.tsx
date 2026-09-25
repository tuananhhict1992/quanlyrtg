import {apiFetch} from '../services/supabase';
import {ArchivedFileLink} from './ArchivedFile';
import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  FileText,
  AlertOctagon,
  HelpCircle,
  Plus,
  Eye,
  Calendar,
  Building,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { InternalDocument, DocCategory, Employee } from '../types';

interface LibraryViewProps {
  documents: InternalDocument[];
  currentUser: Employee;
  initialCategory?: DocCategory | 'ALL';
  onClearInitialCategory?: () => void;
  onAddDocument: (doc: Omit<InternalDocument, 'id' | 'viewCount'>) => void;
  onEditDocument: (doc: InternalDocument) => void;
  onDeleteDocument: (id: string) => void;
  onBackToDashboard?: () => void;
  onNavigateToViolations?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  documents = [],
  currentUser,
  initialCategory,
  onClearInitialCategory,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onBackToDashboard,
  onNavigateToViolations,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'ALL'>(initialCategory || 'ALL');

  React.useEffect(() => {
    if (initialCategory && initialCategory !== 'ALL') {
      setSelectedCategory(initialCategory);
      if (onClearInitialCategory) {
        onClearInitialCategory();
      }
    }
  }, [initialCategory, onClearInitialCategory]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<InternalDocument | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Form for adding/editing new doc
  const [newDocData, setNewDocData] = useState<{code:string;category:DocCategory;title:string;summary:string;content:string;departmentInCharge:string;tags:string;fileName?:string;fileUrl?:string}>({
    code: '',
    category: 'NOI_QUY' as DocCategory,
    title: '',
    summary: '',
    content: '',
    departmentInCharge: 'Công ty',
    tags: '',
    fileName: '',
    fileUrl: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setNewDocData((prev) => ({
        ...prev,
        fileName: file.name,
      }));

      setIsExtracting(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          
          setNewDocData((prev) => ({
            ...prev,
            fileUrl: base64,
          }));

          try {
            const res = await apiFetch('/api/extract-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileBase64: base64,
                mimeType: file.type || 'application/pdf',
                fileName: file.name,
              }),
            });
            const data = await res.json();
            if (data && !data.error) {
              setNewDocData((prev) => ({
                ...prev,
                title: data.title || prev.title,
                summary: data.summary || prev.summary,
                category: (data.category as DocCategory) || prev.category,
                content: data.content || prev.content,
              }));
            }
          } catch (err) {
            console.error('Lỗi gọi API extract:', err);
          } finally {
            setIsExtracting(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setIsExtracting(false);
      }
    }
  };

  const canManageLibrary =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.role === 'MANAGER_L1' ||
    currentUser.role === 'MANAGER_L2' ||
    currentUser.assignedPermissions.includes('MANAGE_LIBRARY');

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.title || !newDocData.content) {
      alert('Vui lòng nhập tên tài liệu và nội dung chi tiết.');
      return;
    }
    const catName =
      newDocData.category === 'NOI_QUY'
        ? 'Nội quy - Quy định'
        : newDocData.category === 'HUONG_DAN'
        ? 'Hướng dẫn - Quy trình (SOP)'
        : 'Các vi phạm & Chế tài';

    if (editingDocId) {
      const originalDoc = documents.find((d) => d.id === editingDocId);
      if (originalDoc) {
        onEditDocument({
          ...originalDoc,
          code: newDocData.code || originalDoc.code,
          category: newDocData.category,
          categoryName: catName,
          title: newDocData.title,
          summary: newDocData.summary || newDocData.content.slice(0, 120) + '...',
          content: newDocData.content,
          updatedAt: new Date().toISOString().split('T')[0],
          departmentInCharge: newDocData.departmentInCharge,
          tags: newDocData.tags.split(',').map((t) => t.trim()).filter(Boolean),
          fileName: newDocData.fileName,
          fileUrl: newDocData.fileUrl,
        });
      }
    } else {
      onAddDocument({
        code: newDocData.code || `DOC-${Date.now().toString().slice(-4)}`,
        category: newDocData.category,
        categoryName: catName,
        title: newDocData.title,
        summary: newDocData.summary || newDocData.content.slice(0, 120) + '...',
        content: newDocData.content,
        effectiveDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        departmentInCharge: newDocData.departmentInCharge,
        tags: newDocData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        fileName: newDocData.fileName,
        fileUrl: newDocData.fileUrl,
      });
    }
    setShowAddModal(false);
    setEditingDocId(null);
  };

  const getCategoryBadge = (cat: DocCategory) => {
    switch (cat) {
      case 'NOI_QUY':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'HUONG_DAN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'VI_PHAM':
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
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
          <span className="text-[11px] font-semibold text-slate-500">Thư viện quy chế</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Thư Viện Văn Bản & Quy Chế Nội Bộ
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {documents.length} Văn bản
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kho tri thức chính thống: Nội quy lao động, Hướng dẫn quy trình (SOP) và Các chế tài vi phạm
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageLibrary && (
            <button
              id="btn-add-library-doc"
              onClick={() => {
                setNewDocData({
                  code: `QĐ-0${documents.length + 1}/2026`,
                  category: 'NOI_QUY',
                  title: '',
                  summary: '',
                  content: '',
                  departmentInCharge: 'Công ty',
                  tags: 'Nội quy, Quy chế 2026',
                });
                setShowAddModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-200 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ban hành Văn bản mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({documents.length})
          </button>
          <button
            onClick={() => setSelectedCategory('NOI_QUY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'NOI_QUY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Nội quy - Quy định</span>
          </button>
          <button
            onClick={() => setSelectedCategory('HUONG_DAN')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'HUONG_DAN'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Hướng dẫn - Quy trình (SOP)</span>
          </button>
          <button
            onClick={() => setSelectedCategory('VI_PHAM')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'VI_PHAM'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Các vi phạm & Chế tài</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tra cứu điều khoản, từ khóa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Banner liên kết phân tích Sự cố & Vi phạm Tổ RTG khi xem mục Vi phạm */}
      {selectedCategory === 'VI_PHAM' && onNavigateToViolations && (
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-rose-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                Phân tích Dữ liệu Sự cố & Vi phạm Thực tế (Tổ RTG)
              </h4>
              <p className="text-xs text-rose-200/90 mt-0.5 max-w-2xl leading-relaxed">
                Tải lên file Excel báo cáo sự cố (Phụ lục 1) & vi phạm nội quy (Phụ lục 2), tự động chuẩn hóa nhân sự, trích xuất dữ liệu đối soát và đồng bộ trừ điểm hồ sơ năng lực.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToViolations}
            className="px-4 py-2 bg-white text-rose-900 hover:bg-rose-50 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
          >
            Mở Vi phạm & Sự cố
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between p-5 group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {doc.code}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadge(
                    doc.category
                  )}`}
                >
                  {doc.categoryName}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                {doc.title}
              </h3>

              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                {doc.summary}
              </p>
            </div>

            <div>
              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {(doc.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Meta & Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate max-w-[110px]">{doc.departmentInCharge}</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManageLibrary && (
                    <>
                      <button
                        onClick={() => {
                          setEditingDocId(doc.id);
                          setNewDocData({
                            code: doc.code,
                            category: doc.category,
                            title: doc.title,
                            summary: doc.summary,
                            content: doc.content,
                            departmentInCharge: doc.departmentInCharge,
                            tags: doc.tags.join(', '),
                          });
                          setShowAddModal(true);
                        }}
                        title="Chỉnh sửa"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      >
                        <span className="sr-only">Sửa</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        title="Xóa"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <span className="sr-only">Xóa</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-sm">Không tìm thấy tài liệu quy chế phù hợp</p>
          <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác hoặc chuyển danh mục</p>
        </div>
      )}

      {/* Modal: View Full Document Details */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-600" />
                  <span>Quay lại danh sách văn bản</span>
                </button>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-200/60"
                >
                  ✕
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {selectedDoc.code}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadge(
                      selectedDoc.category
                    )}`}
                  >
                    {selectedDoc.categoryName}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {selectedDoc.title}
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span>Ban hành bởi: <b>{selectedDoc.departmentInCharge}</b></span>
                  <span>•</span>
                  <span>Hiệu lực từ: {selectedDoc.effectiveDate}</span>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs sm:text-sm text-blue-900 leading-relaxed">
                <b>Tóm tắt văn bản:</b> {selectedDoc.summary}
              </div>

              <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal text-slate-700 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                {selectedDoc.content}
              </div>

              {selectedDoc.fileUrl && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Tệp đính kèm:</span>
                  <ArchivedFileLink src={selectedDoc.fileUrl} name={selectedDoc.fileName || 'tai-lieu'} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                {canManageLibrary && (
                  <>
                    <button
                      onClick={() => {
                        setEditingDocId(selectedDoc.id);
                        setNewDocData({...selectedDoc,tags:selectedDoc.tags.join(', ')});
                        setSelectedDoc(null);
                        setShowAddModal(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-xs transition-colors"
                    >
                      Sửa văn bản
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Bạn có chắc chắn muốn xóa văn bản này?')) {
                          onDeleteDocument(selectedDoc.id);
                          setSelectedDoc(null);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold text-xs transition-colors"
                    >
                      Xóa
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Regulation Document */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDocId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Quay lại</span>
              </button>
              <h3 className="font-bold text-slate-900 text-base">
                {editingDocId ? 'Cập Nhật Văn Bản / Quy Chế' : 'Ban Hành Văn Bản / Quy Chế Mới'}
              </h3>
              <button onClick={() => {
                setShowAddModal(false);
                setEditingDocId(null);
              }} className="text-slate-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 mb-4">
                <label className="block text-indigo-900 font-bold mb-2">1. Tải lên tệp đính kèm (PDF, WORD)</label>
                <p className="text-xs text-indigo-700/80 mb-3">Hệ thống AI sẽ tự động đọc và trích xuất thông tin tiêu đề, tóm tắt, nội dung, phân loại từ file.</p>
                <div className="w-full flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="flex-1 px-3 py-2 text-sm text-slate-600 border border-indigo-200 rounded-xl bg-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    onChange={handleFileUpload}
                  />
                  {newDocData.fileName && !isExtracting && (
                    <span className="text-xs text-indigo-600 font-medium truncate max-w-[150px]">
                      {newDocData.fileName}
                    </span>
                  )}
                  {isExtracting && (
                    <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-pulse" /> Đang trích xuất AI...
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Mã hiệu văn bản *</label>
                  <input
                    type="text"
                    required
                    value={newDocData.code}
                    onChange={(e) => setNewDocData({ ...newDocData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phân loại danh mục</label>
                  <select
                    value={newDocData.category}
                    onChange={(e) => setNewDocData({ ...newDocData, category: e.target.value as DocCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="NOI_QUY">Nội quy - Quy định</option>
                    <option value="HUONG_DAN">Hướng dẫn - Quy trình (SOP)</option>
                    <option value="VI_PHAM">Các vi phạm & Chế tài</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tên văn bản / Tiêu đề (AI tự điền) *</label>
                <input
                  type="text"
                  required
                  placeholder="Tiêu đề văn bản..."
                  value={newDocData.title}
                  onChange={(e) => setNewDocData({ ...newDocData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tóm tắt nội dung chính (AI tự điền)</label>
                <input
                  type="text"
                  placeholder="Khái quát 1-2 câu về mục đích văn bản..."
                  value={newDocData.summary}
                  onChange={(e) => setNewDocData({ ...newDocData, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              
              {/* Nội dung chi tiết được ẩn đi vì AI tự động đọc */}
              <input type="hidden" value={newDocData.content} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phòng ban ban hành</label>
                  <select
                    value={newDocData.departmentInCharge}
                    onChange={(e) => setNewDocData({ ...newDocData, departmentInCharge: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Công ty">Công ty</option>
                    <option value="Đội Cơ Giới">Đội Cơ Giới</option>
                    <option value="Tổ RTG">Tổ RTG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Từ khóa / Tags (phân tách dấu phẩy)</label>
                  <input
                    type="text"
                    placeholder="Quy định, Kỷ luật, SOP"
                    value={newDocData.tags}
                    onChange={(e) => setNewDocData({ ...newDocData, tags: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                >
                  Lưu & Ban hành
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


