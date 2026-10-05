import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderPlus,
  Upload,
  RefreshCw,
  Search,
  FileText,
  FileSpreadsheet,
  File,
  Folder,
  Trash2,
  ExternalLink,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronRight,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import {
  auth,
  signInWithGoogleDrive,
  connectGoogleDriveStorage,
  signOutGoogleDrive,
  fetchDriveFiles,
  createDriveFolder,
  uploadFileToDrive,
  deleteDriveFile,
  downloadDriveFileBlob,
  getCachedToken,
} from '../services/googleDriveAuth';
import { DriveFileItem, Employee } from '../types';
import { api } from '../services/supabase';

interface GoogleDriveViewProps {
  currentUser: Employee;
  onImportToQuestionBank?: (fileItem: DriveFileItem, fileBlob?: Blob) => void;
  onImportToLibrary?: (fileItem: DriveFileItem) => void;
  onBackToDashboard?: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  currentUser,
  onImportToQuestionBank,
  onImportToLibrary,
  onBackToDashboard,
}) => {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Files state
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [folderHistory, setFolderHistory] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Drive của tôi' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'folders' | 'docs' | 'sheets' | 'pdf'>('all');

  // New folder modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Upload modal / state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Delete confirmation modal (MANDATORY for Workspace destructive actions)
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import feedback
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Check auth on mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && getCachedToken()) {
        setGoogleUser(user);
        loadFiles('root');
      } else {
        setGoogleUser(null);
        setFiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const currentFolder = folderHistory[folderHistory.length - 1];

  const loadFiles = async (folderId: string = currentFolder.id, search?: string) => {
    if (!getCachedToken()) return;
    setIsLoadingFiles(true);
    setAuthError(null);
    try {
      const fetched = await fetchDriveFiles(folderId, search);
      setFiles(fetched);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      setAuthError(err.message || 'Không thể tải tệp từ Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      if (currentUser.role === 'ADMIN' || currentUser.assignedPermissions?.includes('MANAGE_PERMISSIONS')) {
        const connection = await api<{ connected: boolean; oauthAvailable: boolean }>('/google/connection');
        if (!connection.connected && connection.oauthAvailable) {
          if (!confirm('Kết nối tài khoản Google của admin để RTG tạo thư mục và file báo cáo?')) return;
          await connectGoogleDriveStorage();
          return;
        }
      }
      const { user } = await signInWithGoogleDrive();
      setGoogleUser(user);
      await loadFiles('root');
      setActionNotice({ text: 'Đăng nhập Google Drive thành công!', type: 'success' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(err.message || 'Đăng nhập Google Drive thất bại.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setGoogleUser(null);
      setFiles([]);
      setFolderHistory([{ id: 'root', name: 'Drive của tôi' }]);
      setActionNotice({ text: 'Đã ngắt kết nối Google Drive.', type: 'success' });
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleOpenFolder = (folder: DriveFileItem) => {
    const nextHistory = [...folderHistory, { id: folder.id, name: folder.name }];
    setFolderHistory(nextHistory);
    loadFiles(folder.id);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const nextHistory = folderHistory.slice(0, index + 1);
    setFolderHistory(nextHistory);
    loadFiles(nextHistory[nextHistory.length - 1].id);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await createDriveFolder(newFolderName.trim(), currentFolder.id);
      setShowNewFolderModal(false);
      setNewFolderName('');
      await loadFiles(currentFolder.id);
      setActionNotice({ text: `Đã tạo thư mục "${newFolderName}" thành công!`, type: 'success' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo thư mục.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    setIsUploading(true);
    try {
      await uploadFileToDrive(file, currentFolder.id);
      setUploadSuccessMessage(`Đã tải lên thành công: ${file.name}`);
      setTimeout(() => setUploadSuccessMessage(null), 4000);
      await loadFiles(currentFolder.id);
    } catch (err: any) {
      alert(err.message || 'Tải tệp lên thất bại.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setFileToDelete(null);
      await loadFiles(currentFolder.id);
      setActionNotice({ text: `Đã xóa tệp "${fileToDelete.name}" khỏi Google Drive.`, type: 'success' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Không thể xóa tệp.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadFile = async (item: DriveFileItem) => {
    try {
      const { blob } = await downloadDriveFileBlob(item.id, item.mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Không thể tải tệp về máy.');
    }
  };

  const handleImportToQuestionBank = async (item: DriveFileItem) => {
    if (!onImportToQuestionBank) return;
    try {
      setActionNotice({ text: `Đang chuẩn bị tệp "${item.name}" chuyển tới Ngân hàng câu hỏi AI...`, type: 'success' });
      const { blob } = await downloadDriveFileBlob(item.id, item.mimeType);
      onImportToQuestionBank(item, blob);
    } catch (err: any) {
      alert(err.message || 'Không thể đọc nội dung tệp từ Google Drive.');
    }
  };

  // Filter items
  const filteredFiles = files.filter((item) => {
    if (selectedFilter === 'folders') return item.isFolder;
    if (selectedFilter === 'docs')
      return (
        item.mimeType.includes('document') ||
        item.name.endsWith('.doc') ||
        item.name.endsWith('.docx')
      );
    if (selectedFilter === 'sheets')
      return (
        item.mimeType.includes('spreadsheet') ||
        item.name.endsWith('.xls') ||
        item.name.endsWith('.xlsx') ||
        item.name.endsWith('.csv')
      );
    if (selectedFilter === 'pdf')
      return item.mimeType.includes('pdf') || item.name.endsWith('.pdf');
    return true;
  });

  const getFileIcon = (item: DriveFileItem) => {
    if (item.isFolder) {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-100" />;
    }
    if (item.mimeType.includes('spreadsheet') || item.name.endsWith('.xlsx') || item.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (item.mimeType.includes('document') || item.name.endsWith('.docx') || item.name.endsWith('.doc')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (item.mimeType.includes('pdf') || item.name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-600" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
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
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Quay lại Tổng quan</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500">Google Drive</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Google Drive Doanh Nghiệp</h1>
              <p className="text-xs text-slate-500">
                Lưu trữ tài liệu quy chế, trích xuất dữ liệu và đồng bộ ngân hàng câu hỏi trắc nghiệm
              </p>
            </div>
          </div>
        </div>

        {/* Auth Status & Google Sign-in */}
        <div>
          {googleUser ? (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <img
                src={googleUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt="Google avatar"
                className="w-8 h-8 rounded-full border border-slate-300"
              />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {googleUser.displayName || 'Google Account'}
                </p>
                <p className="text-[10px] text-slate-500 truncate max-w-[160px]">{googleUser.email}</p>
              </div>
              <button
                id="btn-google-signout"
                onClick={handleSignOut}
                title="Đăng xuất Google Drive"
                className="ml-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* OFFICIAL "Sign in with Google" BUTTON SPECIFICATION */
            <button
              id="btn-google-signin"
              onClick={handleSignIn}
              disabled={isConnecting}
              style={{
                backgroundColor: '#ffffff',
                color: '#3c4043',
                borderColor: '#dadce0',
                fontFamily: 'Roboto, arial, sans-serif',
              }}
              className="inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isConnecting ? 'Đang kết nối...' : 'Đăng nhập bằng Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications & Action Alerts */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {uploadSuccessMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{uploadSuccessMessage}</span>
        </div>
      )}

      {authError && (
        <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Thông báo phân quyền Google Drive</p>
            <p className="text-amber-800">{authError}</p>
          </div>
        </div>
      )}

      {!googleUser ? (
        /* Not logged in State Screen */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <HardDrive className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Kết nối Google Drive để quản lý tệp và ngân hàng câu hỏi
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Duyệt thư mục, mở file Word, Excel, PDF trên đám mây của bạn, tự động trích xuất quy chế nội bộ
            và tạo câu hỏi kiểm tra bằng AI.
          </p>

          <button
            id="btn-google-signin-hero"
            onClick={handleSignIn}
            disabled={isConnecting}
            style={{
              backgroundColor: '#ffffff',
              color: '#3c4043',
              borderColor: '#dadce0',
              fontFamily: 'Roboto, arial, sans-serif',
            }}
            className="inline-flex items-center justify-center gap-3 px-6 py-3 rounded-xl border text-sm font-medium shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="font-semibold">{isConnecting ? 'Đang xác thực...' : 'Đăng nhập bằng Google'}</span>
          </button>
        </div>
      ) : (
        /* Connected Google Drive Content */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Action Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Breadcrumb Navigation with Back Button */}
            <div className="flex items-center gap-2 text-xs text-slate-600 overflow-x-auto py-1">
              {folderHistory.length > 1 && (
                <button
                  onClick={() => handleNavigateBreadcrumb(folderHistory.length - 2)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex-shrink-0"
                  title="Lùi lại thư mục cha"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
                  <span>Quay lại</span>
                </button>
              )}
              <div className="flex items-center gap-1.5">
                {folderHistory.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    <button
                      onClick={() => handleNavigateBreadcrumb(index)}
                      className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                        index === folderHistory.length - 1
                          ? 'font-bold text-slate-900 bg-slate-100'
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {item.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                id="btn-drive-refresh"
                onClick={() => loadFiles(currentFolder.id)}
                disabled={isLoadingFiles}
                title="Làm mới danh sách"
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-indigo-600' : ''}`} />
              </button>

              <button
                id="btn-drive-new-folder"
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>Tạo thư mục</span>
              </button>

              {/* Upload Input */}
              <label
                id="btn-drive-upload-label"
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Đang tải lên...' : 'Tải tệp lên'}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {/* Search & Filter bar */}
          <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadFiles(currentFolder.id, searchQuery);
                }}
                placeholder="Tìm kiếm tệp trong thư mục..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'folders', label: 'Thư mục' },
                  { id: 'docs', label: 'Word/Docs' },
                  { id: 'sheets', label: 'Excel/Sheets' },
                  { id: 'pdf', label: 'PDF' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    selectedFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Files List Table */}
          <div className="overflow-x-auto">
            {isLoadingFiles ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p>Đang tải danh sách tệp từ Google Drive...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Folder className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>Thư mục trống hoặc không tìm thấy tệp phù hợp.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Tên tệp / thư mục</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Kích thước</th>
                    <th className="px-4 py-3 hidden md:table-cell">Cập nhật lần cuối</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (file.isFolder) handleOpenFolder(file);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file)}
                          <span className="font-medium text-slate-900 truncate max-w-xs md:max-w-md">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {file.isFolder ? '--' : file.size || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                        {file.modifiedTime || '--'}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* AI Question Bank Import Button */}
                          {!file.isFolder && (
                            <button
                              onClick={() => handleImportToQuestionBank(file)}
                              title="Tạo câu hỏi trắc nghiệm bằng AI từ tệp này"
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span className="hidden lg:inline">Tạo câu hỏi AI</span>
                            </button>
                          )}

                          {/* Open in Google Drive */}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              title="Mở trên Google Drive"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          {/* Download */}
                          {!file.isFolder && (
                            <button
                              onClick={() => handleDownloadFile(file)}
                              title="Tải về máy"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete File (With required confirmation modal) */}
                          <button
                            onClick={() => setFileToDelete(file)}
                            title="Xóa tệp / thư mục"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Tạo thư mục mới trên Google Drive</h3>
            <p className="text-xs text-slate-500 mb-4">
              Thư mục mới sẽ được tạo trong:{' '}
              <strong className="text-slate-700">{currentFolder.name}</strong>
            </p>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nhập tên thư mục..."
                autoFocus
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {isCreatingFolder ? 'Đang tạo...' : 'Tạo thư mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY USER CONFIRMATION DIALOG FOR DELETE OPERATIONS */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">
              Xác nhận xóa tệp trên Google Drive?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Bạn có chắc chắn muốn xóa vĩnh viễn tệp{' '}
              <strong className="text-slate-800 break-words">"{fileToDelete.name}"</strong> khỏi Google Drive của bạn? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
