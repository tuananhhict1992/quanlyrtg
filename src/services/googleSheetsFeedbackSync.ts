import {api} from './supabase';
import { FeedbackProposal } from '../types';

export const FEEDBACK_SHEET_TITLE = 'Data_RTG';
export const FEEDBACK_SHEET_TAB_NAME ='FEEDBACK';

/**
 * Rút trích Spreadsheet ID từ đường link Google Sheets đầy đủ hoặc ID thô
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Khớp định dạng: /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Nhãn danh mục tiếng Việt
 */
export const CATEGORY_LABELS: Record<string, string> = {
  DONG_GOP: 'Đóng góp ý kiến',
  DE_XUAT: 'Đề xuất sáng kiến',
  CANH_BAO_NGUY_HIEM: 'Cảnh báo nguy hiểm',
  KHAC: 'Khác',
};

/**
 * Nhãn trạng thái xử lý tiếng Việt
 */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Từ chối',
};

/**
 * Tiêu đề các cột dữ liệu trên Google Sheets
 */
export const FEEDBACK_SHEET_HEADERS = [
  'Mã Góp Ý (ID)',
  'Thời Gian Gửi',
  'Tiêu Đề',
  'Phân Loại',
  'Nội Dung Ý Kiến / Sáng Kiến',
  'Người Gửi',
  'Phòng Ban',
  'Nhân Viên Gây Nguy Hiểm (Nếu Có)',
  'Mức Trừ Điểm Năng Lực',
  'Trạng Thái Hồ Sơ Năng Lực',
  'Hình Ảnh Minh Chứng (Link / Xem Ảnh)',
  'Hiển Thị Ảnh Trực Tiếp (=IMAGE)',
  'Trạng Thái Xử Lý',
  'Người Phản Hồi (Admin)',
  'Thời Gian Phản Hồi',
  'Ý Kiến Phản Hồi',
  'Kế Hoạch Hành Động',
];

/**
 * Chuyển đổi base64 dataURI sang Blob
 */
export function base64ToBlob(dataURI: string): { blob: Blob; mime: string } {
  const parts = dataURI.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(parts[1] || '');
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([array], { type: mime }), mime };
}

/**
 * Tải ảnh base64 lên Google Drive và cấp quyền công khai để có thể hiển thị trong Google Sheet
 */
export async function uploadFeedbackImageToDrive(
  accessToken: string,
  base64Data: string,
  fileName: string
): Promise<{ id: string; viewUrl: string; directImageUrl: string }> { const {blob,mime}=base64ToBlob(base64Data); const {uploadFileToDrive}=await import('./googleDriveAuth');const file=await uploadFileToDrive(new File([blob],fileName,{type:mime}));return {id:file.id,viewUrl:file.webViewLink!,directImageUrl:file.webViewLink!}; }

/**
 * Chuyển đổi danh sách FeedbackProposal thành mảng dữ liệu 2 chiều cho Google Sheets
 */
export function convertFeedbacksToSheetRows(
  feedbacks: FeedbackProposal[],
  imageUrlsMap?: Record<string, string[]>
): any[][] {
  const rows = feedbacks.map((fb) => {
    const sender = fb.isAnonymous ? 'Ẩn danh (Bảo mật)' : fb.authorName || 'Nhân viên';
    const dept = fb.isAnonymous ? 'Bảo mật' : fb.authorDepartment || 'N/A';
    const cat = CATEGORY_LABELS[fb.category] || fb.categoryName || fb.category;
    const stat = STATUS_LABELS[fb.status] || fb.status;

    // Nhân viên gây nguy hiểm
    const dangerCauser = fb.dangerCauserName
      ? `${fb.dangerCauserName}${fb.dangerCauserDepartment ? ` (${fb.dangerCauserDepartment})` : ''}`
      : fb.category === 'CANH_BAO_NGUY_HIEM'
      ? 'Chưa ghi nhận tên NV'
      : 'Không áp dụng';

    // Mức trừ điểm
    const penaltyText = fb.penaltyPoints
      ? `-${fb.penaltyPoints} điểm`
      : fb.category === 'CANH_BAO_NGUY_HIEM'
      ? '-5 điểm (Đề xuất)'
      : 'N/A';

    // Trạng thái hồ sơ năng lực
    const competencyStatus = fb.pointsDeductedApplied
      ? `Đã trừ điểm & Lưu hồ sơ năng lực${fb.pointsDeductedAt ? ` (${fb.pointsDeductedAt.substring(0, 16)})` : ''}`
      : fb.category === 'CANH_BAO_NGUY_HIEM'
      ? (fb.status === 'APPROVED' ? 'Chờ ghi nhận hồ sơ' : 'Chờ phê duyệt để trừ điểm')
      : 'Không áp dụng';

    // Xử lý hình ảnh đính kèm (hỗ trợ cả link Drive / URL ngoài và công thức Google Sheets)
    const imagesToUse = (imageUrlsMap && imageUrlsMap[fb.id]) ? imageUrlsMap[fb.id] : (fb.images || []);
    const imgCount = imagesToUse.length;
    let imageCellLink = 'Không có ảnh';
    let imageFormula = 'Không có';

    if (imgCount > 0) {
      const validUrls = imagesToUse.filter((img) => img.startsWith('http'));
      if (validUrls.length === 1) {
        imageCellLink = `=HYPERLINK("${validUrls[0]}", "Xem ảnh minh chứng")`;
        imageFormula = `=IMAGE("${validUrls[0]}")`;
      } else if (validUrls.length > 1) {
        imageCellLink = validUrls.map((u, i) => `Ảnh ${i + 1}: ${u}`).join('\n');
        imageFormula = `=IMAGE("${validUrls[0]}")`;
      } else {
        // Ảnh dạng base64 nhưng chưa tải lên drive
        imageCellLink = `Có ${imgCount} ảnh minh chứng đính kèm`;
        imageFormula = 'Đang đồng bộ ảnh...';
      }
    }

    const adminResponder = fb.adminResponse?.by || '';
    const adminRespondedAt = fb.adminResponse?.date || '';
    const adminComment = fb.adminResponse?.comment || '';
    const adminAction = fb.adminResponse?.actionPlan || '';

    return [
      fb.id,
      fb.submittedAt,
      fb.title,
      cat,
      fb.content,
      sender,
      dept,
      dangerCauser,
      penaltyText,
      competencyStatus,
      imageCellLink,
      imageFormula,
      stat,
      adminResponder,
      adminRespondedAt,
      adminComment,
      adminAction,
    ];
  });

  return [FEEDBACK_SHEET_HEADERS, ...rows];
}

/**
 * Tạo một Google Trang tính (Spreadsheet) mới trên tài khoản Google Workspace
 */
export async function createFeedbackGoogleSpreadsheet(
  accessToken: string,
  customTitle?: string
): Promise<{ id: string; url: string; title: string }> { return api('/google/setup',{method:'POST'}); }

/**
 * Định dạng dòng tiêu đề Google Sheet chuyên nghiệp
 */
async function formatSheetHeaderRow(accessToken: string, spreadsheetId: string, sheetId: number = 0) { return; }

/**
 * Ghi toàn bộ dữ liệu góp ý và đề xuất sáng kiến vào Google Trang tính
 */
export async function syncAllFeedbacksToSheet(
  accessToken: string,
  spreadsheetId: string,
  feedbacks: FeedbackProposal[]
): Promise<{ updatedRows: number; spreadsheetUrl: string }> { return api('/google/sync',{method:'POST',body:JSON.stringify({module:'feedbacks'})}); }

/**
 * Đồng bộ qua Webhook Apps Script (nếu Admin cấu hình URL Web App)
 */
export async function syncFeedbackViaWebhook(
  webhookUrl: string,
  feedbacks: FeedbackProposal[]
): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'feedbacks'})}); return true; }

/**
 * Xuất file CSV hỗ trợ tiếng Việt có dấu (UTF-8 BOM) để mở trực tiếp trong Excel / Trang tính
 */
export function exportFeedbacksToCsv(feedbacks: FeedbackProposal[], fileName = 'hom_thu_gop_y_sang_kien.csv') {
  const rows = convertFeedbacksToSheetRows(feedbacks);
  
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
    .join('\r\n');

  // Thêm BOM (\uFEFF) để Excel và Google Sheets nhận diện UTF-8 chuẩn xác, không bị lỗi font tiếng Việt
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
