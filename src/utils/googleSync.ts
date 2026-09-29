export interface SyncSummary {
  total: number;
  drive: number;
  sheet: number;
  waitingConfirmation: number;
  pending: number;
  processing: number;
  failed: number;
  needsAttention: number;
}

export const SYNC_MODULE_NAMES: Record<string, string> = {
  employees: 'Nhân sự', incidents: 'Vi phạm & sự cố', bxxlRecords: 'Bình xét xếp loại',
  leaveRequests: 'Nghỉ phép', shipProductivity: 'Sản lượng', quizzes: 'Bài kiểm tra',
  quizSubmissions: 'Kết quả kiểm tra', questionBank: 'Ngân hàng câu hỏi', questionFolders: 'Thư mục câu hỏi',
  feedbacks: 'Góp ý & đề xuất', zaloMessages: 'Thông báo nội bộ', internalDocuments: 'Tài liệu',
  competencyEvents: 'Lịch sử năng lực', competencyRules: 'Quy tắc năng lực', settings: 'Cài đặt', backup: 'Sao lưu hệ thống',
};

export const SYNC_STAGE_NAMES: Record<string, string> = {
  waiting_confirmation: 'Chờ xác nhận dữ liệu', waiting_processing: 'Chờ xử lý file',
  missing_file: 'Cần kiểm tra file tạm', pending: 'Chờ đồng bộ', processing: 'Đang xử lý',
  success: 'Đã hoàn tất', failed: 'Đồng bộ thất bại',
};
