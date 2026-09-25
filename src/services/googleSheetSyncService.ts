import {api} from './supabase';
import {
  QuizSubmission,
  FeedbackProposal,
  BxxlRecord,
  Employee,
  IncidentViolation,
  LeaveRequest,
} from '../types';
import * as XLSX from 'xlsx';

export const DATA_RTG_TITLE = 'Data_RTG';
export const THONG_TIN_NHAN_SU_TAB ='EMPLOYEES';
export const THEO_DOI_VI_PHAM_TAB ='VIOLATIONS';
export const BAI_THI_KIEM_TRA_TAB ='EXAM_RESULTS';
export const GOP_Y_SANG_KIEN_TAB ='FEEDBACK';
export const BANG_XEP_XE_TAB ='RANKINGS';
export const DANG_KY_NGHI_PHEP_TAB ='LEAVE';

/**
 * Chuẩn hóa họ tên nhân viên theo quy tắc quản trị bến cảng:
 * Tự động đổi "Phạm Ngọc Tuấn" thành "Phạm Ngọc Tuân"
 */
export function normalizeEmployeeName(name: string): string {
  if (!name) return '';
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.toLowerCase() === 'phạm ngọc tuấn') {
    return 'Phạm Ngọc Tuân';
  }
  return trimmed;
}

/**
 * Danh sách từ khóa nhận diện chuỗi địa chỉ
 */
export const ADDRESS_KEYWORDS = [
  'hải phòng', 'hà nội', 'quảng ninh', 'thủy nguyên', 'an lão', 'an dương', 'kiến thụy',
  'tiên lãng', 'vĩnh bảo', 'ngô quyền', 'lê chân', 'hồng bàng', 'hải an', 'đồ sơn', 'dương kinh',
  'đường', 'phố', 'phường', 'xã', 'thị trấn', 'quận', 'huyện', 'tỉnh', 'thành phố', 'tp',
  'thôn', 'xóm', 'tổ dân phố', 'số nhà', 'ngõ', 'ngách', 'kdc', 'khu dân cư', 'địa chỉ',
  'thường trú', 'tạm trú', 'quê quán', 'nơi ở', 'nguyên quán', 'trú quán'
];

export function isAddressString(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  if (s.length > 30 || s.includes(',')) return true;
  return ADDRESS_KEYWORDS.some((kw) => s.includes(kw));
}

/**
 * Chuẩn hóa bộ phận theo quy chuẩn Tổ RTG:
 * Chỉ cho phép 3 giá trị duy nhất: 'RTG ca 1' | 'RTG ca 2' | 'RTG ca 3'
 * Mọi nội dung khác (địa chỉ, tỉnh thành, xã phường...) đều là sai và được chuẩn hóa về đúng ca.
 */
export function normalizeRtgDepartment(dept: any): 'RTG ca 1' | 'RTG ca 2' | 'RTG ca 3' {
  if (!dept) return 'RTG ca 1';
  const s = String(dept).toLowerCase().trim();
  
  // Ca 3 / Kíp 3 / Đội 3 / Tổ 3 / C3 / III / Ba
  if (
    s.includes('ca 3') ||
    s.includes('ca3') ||
    s === '3' ||
    s.includes('rtg 3') ||
    s.includes('rtg ca 3') ||
    s === 'c3' ||
    s.includes('kíp 3') ||
    s.includes('kip 3') ||
    s.includes('đội 3') ||
    s.includes('doi 3') ||
    s.includes('tổ 3') ||
    s.includes('to 3') ||
    s.includes('ca iii') ||
    s === 'iii' ||
    s.includes('ca ba')
  ) {
    return 'RTG ca 3';
  }

  // Ca 2 / Kíp 2 / Đội 2 / Tổ 2 / C2 / II / Hai
  if (
    s.includes('ca 2') ||
    s.includes('ca2') ||
    s === '2' ||
    s.includes('rtg 2') ||
    s.includes('rtg ca 2') ||
    s === 'c2' ||
    s.includes('kíp 2') ||
    s.includes('kip 2') ||
    s.includes('đội 2') ||
    s.includes('doi 2') ||
    s.includes('tổ 2') ||
    s.includes('to 2') ||
    s.includes('ca ii') ||
    s === 'ii' ||
    s.includes('ca hai')
  ) {
    return 'RTG ca 2';
  }

  // Ca 1 / Kíp 1 / Đội 1 / Tổ 1 / C1 / I / Một
  if (
    s.includes('ca 1') ||
    s.includes('ca1') ||
    s === '1' ||
    s.includes('rtg 1') ||
    s.includes('rtg ca 1') ||
    s === 'c1' ||
    s.includes('kíp 1') ||
    s.includes('kip 1') ||
    s.includes('đội 1') ||
    s.includes('doi 1') ||
    s.includes('tổ 1') ||
    s.includes('to 1') ||
    s.includes('ca i') ||
    s === 'i' ||
    s.includes('ca một') ||
    s.includes('ca mot')
  ) {
    return 'RTG ca 1';
  }

  return 'RTG ca 1';
}

/**
 * Làm sạch chức danh/chức vụ:
 * Loại bỏ triệt để thông tin địa chỉ nhà/hộ khẩu bị map nhầm vào cột Chức vụ.
 * Chỉ giữ lại chức danh vận hành hợp lệ của Tổ RTG.
 */
export function cleanRtgPosition(pos: any): string {
  if (!pos) return 'Nhân viên';
  const s = String(pos).trim();
  const lower = s.toLowerCase();

  // Nếu chứa dấu hiệu địa chỉ -> loại bỏ hoàn toàn
  if (isAddressString(s)) {
    return 'Nhân viên';
  }

  if (lower.includes('ca trưởng')) return 'Ca trưởng';
  if (lower.includes('ca phó')) return 'Ca phó';
  if (lower.includes('tổ trưởng')) return 'Tổ trưởng';
  if (lower.includes('tổ phó')) return 'Tổ phó';
  if (lower.includes('lái cẩu') || lower.includes('vận hành cẩu') || lower.includes('cẩu')) return 'Lái cẩu RTG';

  const validPositions = ['Ca trưởng', 'Ca phó', 'Tổ trưởng', 'Tổ phó', 'Lái cẩu RTG', 'Nhân viên'];
  const matched = validPositions.find((p) => p.toLowerCase() === lower);
  if (matched) return matched;

  return 'Nhân viên';
}

/**
 * Trích xuất an toàn Spreadsheet ID từ link Google Sheets hoặc chuỗi ID
 */
export function extractCleanSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  const cleanBare = trimmed.split('/')[0].split('?')[0].split('#')[0];
  return cleanBare;
}

/**
 * Mã nguồn Google Apps Script hoàn chỉnh để dán vào Tiện ích mở rộng -> Apps Script trên Google Sheet.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE ="Google Drive và Sheets được quản lý bởi Secure Node.js Backend. Cấu hình biến môi trường trên server; dữ liệu nghiệp vụ luôn lưu tại Supabase PostgreSQL.";

/**
 * Gửi payload POST tới Google Apps Script Webhook với cơ chế text/plain bypass CORS
 */
async function postToAppsScriptWebhook(webhookUrl: string, payload: any): Promise<boolean> { await api('/google/sync',{method:'POST',body:'{}'});return true; }

/**
 * Kiểm tra kết nối Webhook
 */
export async function testGoogleSheetWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> { await api('/google/status');return {success:true,message:'Google được cấu hình và xác thực ở backend.'}; }

/**
 * Tự động đồng bộ 1 kết quả thi trắc nghiệm khi nhân viên nộp bài
 */
export async function syncQuizSubmissionToSheet(webhookUrl: string, submission: QuizSubmission): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'quizSubmissions'})}); return true; }

/**
 * Đồng bộ toàn bộ kết quả thi trắc nghiệm
 */
export async function syncAllQuizzesToSheet(webhookUrl: string, submissions: QuizSubmission[]): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'quizSubmissions'})}); return true; }

/**
 * Tự động đồng bộ 1 ý kiến / sáng kiến khi gửi
 */
export async function syncFeedbackToSheet(webhookUrl: string, feedback: FeedbackProposal): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'feedbacks'})}); return true; }

/**
 * Đồng bộ toàn bộ hòm thư góp ý / sáng kiến
 */
export async function syncAllFeedbacksToSheet(webhookUrl: string, feedbacks: FeedbackProposal[]): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'feedbacks'})}); return true; }

/**
 * Tự động đồng bộ 1 biên bản Bình xét xếp loại khi lưu
 */
export async function syncBxxlRecordToSheet(webhookUrl: string, record: BxxlRecord): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'bxxlRecords'})}); return true; }

/**
 * Đồng bộ toàn bộ biên bản Bình xét xếp loại
 */
export async function syncAllBxxlToSheet(webhookUrl: string, records: BxxlRecord[]): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'bxxlRecords'})}); return true; }

/**
 * Đồng bộ danh sách nhân sự
 */
export async function syncEmployeesToSheet(webhookUrl: string, employees: Employee[]): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'employees'})}); return true; }

export const syncAllEmployeesToSheet = syncEmployeesToSheet;

/**
 * Đồng bộ danh sách vi phạm & sự cố của nhân viên
 */
export async function syncAllViolationsToSheet(webhookUrl: string, violations: IncidentViolation[]): Promise<boolean> { await api('/google/sync',{method:'POST',body:JSON.stringify({module:'incidents'})}); return true; }

/**
 * Đồng bộ toàn bộ mọi dữ liệu (Tất cả trong 1)
 */
export async function syncAllDataToGoogleSheet(
  webhookUrl: string,
  data: {
    submissions: QuizSubmission[];
    feedbacks: FeedbackProposal[];
    records: BxxlRecord[];
    employees: Employee[];
    violations?: IncidentViolation[];
  }
): Promise<boolean> { await api('/google/sync',{method:'POST',body:'{}'});return true; }

// =========================================================================
// CÁC HÀM XỬ LÝ LIÊN KẾT DỮ LIỆU FILE DATA_RTG - SHEET THONGTINNHANSU
// =========================================================================

export const DATA_RTG_NHAN_SU_HEADERS = [
  'STT',                   // Cột A (index 0)
  'Họ và Tên',            // Cột B (index 1) - YÊU CẦU BẮT BUỘC
  'Mã nhân sự',           // Cột C (index 2) - YÊU CẦU BẮT BUỘC
  'Tên đăng nhập',        // Cột D (index 3) - YÊU CẦU BẮT BUỘC
  'Cột E bỏ qua',             // Cột E (index 4) - YÊU CẦU BẮT BUỘC
  'Chức danh',            // Cột F (index 5)
  'Bộ phận (Ca trực)',     // Cột G (index 6) - YÊU CẦU BẮT BUỘC (RTG ca 1, RTG ca 2, RTG ca 3)
  'Vai trò',              // Cột H (index 7)
  'Số điện thoại',        // Cột I (index 8) - YÊU CẦU BẮT BUỘC
  'Điểm năng lực',        // Cột J (index 9)
  'Bài thi đạt',          // Cột K (index 10)
  'Số lần vi phạm',       // Cột L (index 11)
  'Số sáng kiến',         // Cột M (index 12)
];

export interface ParsedThongTinNhanSuResult {
  preview?: {job_id:string;checksum:string;status:string;rows:any[]};
  employees: Partial<Employee>[];
  totalReadRows: number;
  validCount: number;
  ignoredCount: number;
  detectedSheetName: string;
  sourceType: 'GOOGLE_SHEETS' | 'EXCEL_FILE';
}

/**
 * Trích xuất dữ liệu mảng 2D từ sheet ThongTinNhanSu trong file Data_RTG theo quy chuẩn:
 * - Cột B (index 1): Họ và Tên (chuẩn hóa đổi 'Phạm Ngọc Tuấn' -> 'Phạm Ngọc Tuân')
 * - Cột C (index 2): Mã nhân sự
 * - Cột D (index 3): Tên đăng nhập
 * - Cột E (index 4): Cột E bỏ qua
 * - Cột G (index 6): Bộ phận
 * - Cột I (index 8): Số điện thoại
 */
export function parseThongTinNhanSuRows(
  rawRows: any[][],
  sheetName: string = THONG_TIN_NHAN_SU_TAB,
  sourceType: 'GOOGLE_SHEETS' | 'EXCEL_FILE' = 'GOOGLE_SHEETS'
): ParsedThongTinNhanSuResult {
  if (!rawRows || rawRows.length === 0) {
    return {
      employees: [],
      totalReadRows: 0,
      validCount: 0,
      ignoredCount: 0,
      detectedSheetName: sheetName,
      sourceType,
    };
  }

  // 1. Quét tìm dòng tiêu đề tốt nhất trong 10 dòng đầu
  let headerRowIndex = -1;
  let maxMatchScore = 0;
  const maxScanRows = Math.min(10, rawRows.length);

  for (let r = 0; r < maxScanRows; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    let score = 0;
    row.forEach((cell) => {
      const s = String(cell || '').trim().toLowerCase();
      if (
        s.includes('họ') ||
        s.includes('tên') ||
        s.includes('mã') ||
        s.includes('đăng nhập') ||
        s.includes('mật khẩu') ||
        s.includes('stt') ||
        s.includes('bộ phận') ||
        s.includes('tổ') ||
        s.includes('đơn vị') ||
        s.includes('sđt') ||
        s.includes('điện thoại') ||
        s.includes('chức') ||
        s.includes('vai trò') ||
        s.includes('điểm') ||
        s.includes('score') ||
        s.includes('username') ||
        s.includes('password')
      ) {
        score++;
      }
    });
    if (score > maxMatchScore) {
      maxMatchScore = score;
      headerRowIndex = r;
    }
  }

  // Cấu hình cột mặc định (chuẩn quy ước Cột A: STT, B: Họ tên, C: Mã NV, D: User, E: Pass, F: Chức danh, G: Bộ phận, H: Vai trò, I: SĐT, J: Điểm)
  let colB_name = -1;
  let colC_code = -1;
  let colD_user = -1;
  let colE_pass = -1;
  let colF_pos = -1;
  let colG_dept = -1;
  let colH_role = -1;
  let colI_phone = -1;
  let colJ_score = -1;
  let col_dob = -1;
  let startIndex = 0;

  if (headerRowIndex >= 0 && maxMatchScore >= 2) {
    startIndex = headerRowIndex + 1;
    const headerRow = rawRows[headerRowIndex] || [];
    const addressColIndices = new Set<number>();

    headerRow.forEach((val: any, idx: number) => {
      const s = String(val || '').trim().toLowerCase();
      if (!s) return;

      // Kiểm tra nếu là cột Địa chỉ / Nơi ở / Hộ khẩu
      if (
        s.includes('địa chỉ') ||
        s.includes('nơi ở') ||
        s.includes('quê quán') ||
        s.includes('thường trú') ||
        s.includes('tạm trú') ||
        s.includes('hộ khẩu') ||
        s.includes('nguyên quán') ||
        s.includes('trú quán') ||
        s.includes('address')
      ) {
        addressColIndices.add(idx);
        return; // Không ánh xạ cột địa chỉ vào bất kỳ trường quản lý nào
      }

      // 1. Tên đăng nhập / Username (kiểm tra trước để không nhầm sang Họ tên)
      if (
        s.includes('đăng nhập') ||
        s.includes('username') ||
        s === 'user' ||
        s.includes('tài khoản') ||
        s === 'tên tk' ||
        s === 'tk' ||
        s === 'acc' ||
        s === 'account'
      ) {
        colD_user = idx;
      }
      // 2. Cột E bỏ qua
      else if (
        s.includes('mật khẩu') ||
        s.includes('password') ||
        s === 'pass' ||
        s.includes('mật mã') ||
        s === 'mk'
      ) {
        colE_pass = idx;
      }
      // 3. Số điện thoại (SĐT / Zalo)
      else if (
        s.includes('điện thoại') ||
        s.includes('sđt') ||
        s.includes('số đt') ||
        s.includes('phone') ||
        s.includes('zalo') ||
        s.includes('mobile') ||
        s.includes('tel')
      ) {
        colI_phone = idx;
      }
      // 4. Mã nhân sự
      else if (
        s.includes('mã nv') ||
        s.includes('mã nhân') ||
        s.includes('mã số') ||
        s.includes('số thẻ') ||
        s.includes('mã thẻ') ||
        s.includes('mã cn') ||
        s.includes('mã lái cẩu') ||
        s === 'code' ||
        s === 'mã' ||
        s.includes('employee code')
      ) {
        colC_code = idx;
      }
      // 5. Cột ID (Nếu chưa có User/Mã thì gán cho User hoặc Mã)
      else if (s === 'id' || s.includes('employee id') || s.includes('user id')) {
        if (colD_user === -1) colD_user = idx;
        if (colC_code === -1) colC_code = idx;
      }
      // 6. Họ và Tên (Không nhận nhầm username hoặc tài khoản)
      else if (
        (s.includes('họ') && s.includes('tên')) ||
        s.includes('họ và tên') ||
        s.includes('họ tên') ||
        s === 'họ' ||
        s === 'tên' ||
        s.includes('tên nv') ||
        s.includes('tên nhân sự') ||
        s.includes('tên nhân viên') ||
        s.includes('tên lái cẩu') ||
        s.includes('lái cẩu') ||
        s.includes('fullname') ||
        s.includes('full name') ||
        s.includes('họ & tên') ||
        s.includes('người lái') ||
        s.includes('người thực hiện') ||
        (s.includes('tên') && !s.includes('đăng nhập') && !s.includes('bảng') && !s.includes('file'))
      ) {
        colB_name = idx;
      }
      // 7. Chức danh / Vị trí (kiểm tra trước để tránh từ 'ca' trong 'ca trưởng' hay 'ca phó' làm lệch cột bộ phận)
      else if (
        s.includes('chức vụ') ||
        s.includes('chức danh') ||
        s === 'position' ||
        s.includes('vị trí') ||
        s.includes('nghề nghiệp')
      ) {
        colF_pos = idx;
      }
      // 8. Bộ phận / Ca trực / Tổ RTG (CỘT G)
      else if (
        idx === 6 || // Vị trí chuẩn tuyệt đối Cột G
        s.includes('ca trực') ||
        s.includes('ca làm việc') ||
        s === 'ca' ||
        s.includes('bộ phận') ||
        s.includes('tổ rtg') ||
        s.includes('phòng ban') ||
        s.includes('department') ||
        s.includes('đơn vị') ||
        s.includes('đội')
      ) {
        // Ưu tiên index 6 hoặc các từ khóa chính xác 'ca trực', 'ca', 'bộ phận'
        if (colG_dept === -1 || idx === 6 || s.includes('ca trực') || s === 'ca' || s.includes('bộ phận')) {
          colG_dept = idx;
        }
      }
      // 9. Vai trò
      else if (s.includes('vai trò') || s === 'role' || s.includes('phân quyền')) {
        colH_role = idx;
      }
      // 10. Điểm năng lực
      else if (
        s.includes('điểm') ||
        s.includes('năng lực') ||
        s.includes('kiểm tra') ||
        s.includes('score')
      ) {
        colJ_score = idx;
      }
      // 11. Năm sinh / Ngày sinh
      else if (s.includes('sinh') || s.includes('năm') || s.includes('dob') || s.includes('birth')) {
        col_dob = idx;
      }
    });

    // Nếu cột mặc định trùng vào cột Địa chỉ thì hủy để không đọc nhầm địa chỉ
    if (addressColIndices.has(colF_pos)) colF_pos = -1;
    if (addressColIndices.has(colG_dept)) colG_dept = -1;
  } else if (headerRowIndex === 0) {
    startIndex = 1;
  }

  // Quét tự động dự phòng nếu một số cột chính chưa được xác định
  const sampleRows = rawRows.slice(startIndex, Math.min(startIndex + 5, rawRows.length));
  if (sampleRows.length > 0) {
    const colCount = Math.max(...sampleRows.map((r) => (Array.isArray(r) ? r.length : 0)));

    // Quét tìm cột Họ và Tên nếu chưa xác định
    if (colB_name === -1) {
      for (let c = 0; c < colCount; c++) {
        const matchesName = sampleRows.every((r) => {
          const val = String(r?.[c] || '').trim();
          return !val || (val.length >= 3 && val.includes(' ') && !/^\d+$/.test(val) && !isAddressString(val));
        });
        const hasSomeNames = sampleRows.some((r) => {
          const val = String(r?.[c] || '').trim();
          return val.length >= 4 && val.includes(' ') && !/^\d+$/.test(val);
        });
        if (hasSomeNames && matchesName) {
          colB_name = c;
          break;
        }
      }
    }

    // Quét tìm cột Ca / Bộ phận nếu chưa xác định
    if (colG_dept === -1) {
      for (let c = 0; c < colCount; c++) {
        const hasShift = sampleRows.some((r) => {
          const s = String(r?.[c] || '').toLowerCase().trim();
          return s.includes('ca 1') || s.includes('ca 2') || s.includes('ca 3') || s.includes('rtg');
        });
        if (hasShift) {
          colG_dept = c;
          break;
        }
      }
    }

    // Quét tìm cột SĐT nếu chưa xác định
    if (colI_phone === -1) {
      for (let c = 0; c < colCount; c++) {
        const hasPhone = sampleRows.some((r) => {
          const s = String(r?.[c] || '').replace(/[^0-9]/g, '');
          return s.length >= 9 && s.length <= 11;
        });
        if (hasPhone) {
          colI_phone = c;
          break;
        }
      }
    }

    // Quét tìm cột Mã NV nếu chưa xác định
    if (colC_code === -1) {
      for (let c = 0; c < colCount; c++) {
        if (c === colB_name || c === colG_dept || c === colI_phone) continue;
        const hasCode = sampleRows.some((r) => {
          const s = String(r?.[c] || '').trim();
          return s.startsWith('NV-') || s.startsWith('nv-') || (/^[A-Za-z0-9_-]{3,15}$/.test(s) && !/^\d+$/.test(s));
        });
        if (hasCode) {
          colC_code = c;
          break;
        }
      }
    }
  }

  // Áp dụng vị trí mặc định nếu vẫn chưa tìm thấy (chuẩn: 1: Tên, 2: Mã, 3: User, 4: Pass, 5: Chức danh, 6: Bộ phận, 8: SĐT)
  if (colB_name === -1) colB_name = 1;
  if (colC_code === -1) colC_code = colB_name === 0 ? 1 : 2;
  if (colD_user === -1) colD_user = colC_code + 1;
  if (colE_pass === -1) colE_pass = colD_user + 1;
  if (colF_pos === -1) colF_pos = 5;
  if (colG_dept === -1) colG_dept = 6;
  if (colH_role === -1) colH_role = 7;
  if (colI_phone === -1) colI_phone = 8;
  if (colJ_score === -1) colJ_score = 9;

  const parsedList: Partial<Employee>[] = [];
  let ignored = 0;

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row) || row.length === 0) {
      ignored++;
      continue;
    }

    // 1. Họ và Tên (Cột B hoặc quét tìm ô tên)
    let rawFullName = String(row[colB_name] ?? '').trim();

    // Nếu ô tại colB_name trống hoặc là số, thử tìm ô chứa họ tên trong dòng
    if (!rawFullName || /^\d+$/.test(rawFullName) || rawFullName.length < 2) {
      for (let c = 0; c < row.length; c++) {
        if (c === colI_phone || c === colG_dept) continue;
        const candidate = String(row[c] || '').trim();
        if (
          candidate.length >= 4 &&
          candidate.includes(' ') &&
          !/^\d+$/.test(candidate) &&
          !isAddressString(candidate) &&
          !candidate.toLowerCase().includes('ca 1') &&
          !candidate.toLowerCase().includes('ca 2') &&
          !candidate.toLowerCase().includes('ca 3')
        ) {
          rawFullName = candidate;
          break;
        }
      }
    }

    const cleanLower = rawFullName.toLowerCase();

    // Bỏ qua nếu dòng là tiêu đề lặp lại hoặc dòng tổng kết
    if (
      !rawFullName ||
      cleanLower === 'họ và tên' ||
      cleanLower === 'họ tên' ||
      cleanLower === 'stt' ||
      cleanLower.startsWith('tổng') ||
      cleanLower.startsWith('tổng cộng') ||
      cleanLower.startsWith('cộng:')
    ) {
      ignored++;
      continue;
    }

    // Quy tắc 2: Tự động chuẩn hóa tên nhân sự ("Phạm Ngọc Tuấn" -> "Phạm Ngọc Tuân")
    const fullName = normalizeEmployeeName(rawFullName);

    // 2. Bộ phận / Ca trực (Cột G) & Quy tắc: LỌC DỮ LIỆU ĐỘC QUYỀN TỔ RTG & CHỈ HIỂN THỊ RTG ca 1, 2, 3
    let rawDept = '';
    // Ưu tiên đọc trực tiếp từ ô Cột G (index 6) nếu có giá trị
    if (row[6] !== undefined && row[6] !== null && String(row[6]).trim() !== '') {
      rawDept = String(row[6]).trim();
    } else if (colG_dept >= 0 && row[colG_dept] !== undefined && row[colG_dept] !== null) {
      rawDept = String(row[colG_dept]).trim();
    }

    // Nếu rawDept bị trống hoặc là địa chỉ, quét các ô trong dòng để tìm thông tin ca trực
    if (!rawDept || isAddressString(rawDept)) {
      const foundShift = row.find((cell: any) => {
        const c = String(cell || '').toLowerCase().trim();
        return (
          c.includes('ca 1') ||
          c.includes('ca 2') ||
          c.includes('ca 3') ||
          c === '1' ||
          c === '2' ||
          c === '3' ||
          c.includes('rtg 1') ||
          c.includes('rtg 2') ||
          c.includes('rtg 3') ||
          c === 'c1' ||
          c === 'c2' ||
          c === 'c3' ||
          c.includes('kíp 1') ||
          c.includes('kíp 2') ||
          c.includes('kíp 3')
        );
      });
      if (foundShift) rawDept = String(foundShift);
    }

    const deptLower = rawDept.toLowerCase();

    // Kiểm tra nếu thuộc tổ khác (đầu kéo, xe nâng...) -> BỎ QUA dòng đó theo Quy tắc 1
    const isOtherUnit =
      (deptLower.includes('đầu kéo') ||
        deptLower.includes('xe nâng') ||
        deptLower.includes('lái xe') ||
        deptLower.includes('tàu')) &&
      !deptLower.includes('rtg') &&
      !deptLower.includes('cẩu khung');

    if (isOtherUnit) {
      ignored++;
      continue;
    }

    // Bắt buộc chuẩn hóa thành 1 trong 3 giá trị duy nhất: 'RTG ca 1' | 'RTG ca 2' | 'RTG ca 3'
    const department = normalizeRtgDepartment(rawDept);

    // 3. Mã nhân sự (Cột C)
    const rawCode = colC_code >= 0 ? String(row[colC_code] ?? '').trim() : '';
    const employeeCode = rawCode || (fullName ? `NV-${Date.now().toString().slice(-4)}-${i}` : '');

    // 4. Tên đăng nhập (Cột D)
    const rawUsername = colD_user >= 0 ? String(row[colD_user] ?? '').trim() : '';
    const username = rawUsername || (employeeCode ? employeeCode.toLowerCase() : `user${i}`);

    // 5. Cột E bỏ qua (Cột E)
    const rawPass = colE_pass >= 0 ? String(row[colE_pass] ?? '').trim() : '';


    // 6. Số điện thoại (Cột I)
    const rawPhone = colI_phone >= 0 ? String(row[colI_phone] ?? '').trim().replace(/[^0-9+]/g, '') : '';
    const phone = rawPhone;
    const zaloPhone = rawPhone;

    // Chức danh: loại bỏ triệt để địa chỉ
    const rawPos = colF_pos >= 0 ? String(row[colF_pos] ?? '').trim() : '';
    const position = cleanRtgPosition(rawPos);

    const rawRole = colH_role >= 0 ? String(row[colH_role] ?? '').trim().toUpperCase() : '';
    const role: any = ['ADMIN', 'MANAGER_L1', 'MANAGER_L2', 'USER'].includes(rawRole) ? rawRole : 'USER';

    const competencyScore = colJ_score >= 0 && !isNaN(Number(row[colJ_score])) ? Number(row[colJ_score]) : 85;
    const dateOfBirth = col_dob >= 0 ? String(row[col_dob] ?? '').trim() : '';

    // Bỏ qua các dòng hoàn toàn trống
    if (!fullName && !rawCode && !rawUsername && !rawPhone) {
      ignored++;
      continue;
    }

    parsedList.push({
      employeeCode,
      fullName: fullName || 'Chưa cập nhật',
      username,
      department,
      phone,
      zaloPhone,
      position,
      role,
      dateOfBirth,
      competencyScore,
      status: 'ACTIVE',
      onboardingCompleted: true,
      zaloSynced: !!zaloPhone,
      email: `${(employeeCode || username).toLowerCase()}@doanhnghiep.vn`,
      joinDate: new Date().toISOString().split('T')[0],
      avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName || 'NV') + '&background=random',
    });
  }

  return {
    employees: parsedList,
    totalReadRows: rawRows.length - startIndex,
    validCount: parsedList.length,
    ignoredCount: ignored,
    detectedSheetName: sheetName,
    sourceType,
  };
}

/**
 * Đọc dữ liệu sheet ThongTinNhanSu từ Google Trang tính
 * Hỗ trợ cả Google Sheets REST API v4 (nếu có OAuth) lẫn đọc trực tiếp/qua proxy với bảng tính link chia sẻ
 */
export async function fetchThongTinNhanSuFromGoogleSheets(
  accessToken: string | null | undefined,
  spreadsheetId: string,
  customTabName: string = THONG_TIN_NHAN_SU_TAB
): Promise<ParsedThongTinNhanSuResult> { const preview=await api('/google/import/preview',{method:'POST',body:JSON.stringify({module:'employees'})});return {employees:preview.rows,rawRows:preview.rows,headers:[],totalReadRows:preview.rows.length,validCount:preview.rows.length,ignoredCount:0,detectedSheetName:'EMPLOYEES',sourceType:'GOOGLE_SHEETS',preview} as any; }

/**
 * Đồng bộ danh sách nhân sự hiện tại lên sheet ThongTinNhanSu trong file Data_RTG trên Google Sheets
 */
export async function syncEmployeesToDataRtgGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  employees: Employee[],
  customTabName: string = THONG_TIN_NHAN_SU_TAB
): Promise<{ updatedRows: number; spreadsheetUrl: string }> { return api('/google/sync',{method:'POST',body:JSON.stringify({module:'employees'})}); }

export const DATA_RTG_VIOLATION_HEADERS = [
  'Mã vụ việc',                               // Cột A
  'Thời gian (When)',                         // Cột B
  'Địa điểm (Where)',                         // Cột C
  'Mã nhân sự',                              // Cột D
  'Họ và tên vi phạm (Who)',                  // Cột E (Tự động chuẩn hóa "Phạm Ngọc Tuấn" -> "Phạm Ngọc Tuân")
  'Đơn vị / Ca trực',                         // Cột F (RTG ca 1, RTG ca 2, RTG ca 3)
  'Chức danh',                               // Cột G
  'Thiết bị cẩu',                            // Cột H (RTG 01, RTG 02...)
  'Mô tả Vi phạm / Diễn biến & Hậu quả (What)', // Cột I
  'Nguyên nhân cốt lõi (Why)',                // Cột J
  'Biện pháp xử lý & Khắc phục (How)',         // Cột K
  'Mức độ nghiêm trọng',                      // Cột L (Nghiêm trọng / Trung bình / Nhẹ)
  'Phân loại (Phụ lục)',                      // Cột M
  'Thời gian đồng bộ',                        // Cột N
];

/**
 * Đồng bộ danh sách vi phạm Tổ RTG lên sheet TheoDoiViPham trong file Data_RTG trên Google Sheets
 */
export async function syncViolationsToDataRtgGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  violations: IncidentViolation[],
  customTabName: string = THEO_DOI_VI_PHAM_TAB
): Promise<{ updatedRows: number; spreadsheetUrl: string }> { return api('/google/sync',{method:'POST',body:JSON.stringify({module:'incidents'})}); }

/**
 * Đọc dữ liệu sự cố vi phạm từ sheet TheoDoiViPham trong file Data_RTG trên Google Sheets
 */
export async function fetchViolationsFromDataRtgGoogleSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string,
  customTabName: string = THEO_DOI_VI_PHAM_TAB
): Promise<{ violations: IncidentViolation[]; totalRows: number; sheetName: string }> { const preview=await api('/google/import/preview',{method:'POST',body:JSON.stringify({module:'incidents'})});return {violations:preview.rows,rawRows:preview.rows,headers:[],preview} as any; }

/**
 * Tải file mẫu Excel chuẩn Data_RTG.xlsx chứa cả 2 sheet ThongTinNhanSu và TheoDoiViPham
 */
export function exportDataRtgExcelTemplate(
  currentEmployees?: Employee[],
  currentViolations?: IncidentViolation[]
) {
  // 1. Sheet ThongTinNhanSu
  const headers = DATA_RTG_NHAN_SU_HEADERS;
  
  let dataRows: any[][];
  if (currentEmployees && currentEmployees.length > 0) {
    dataRows = currentEmployees.map((e, index) => [
      index + 1,
      normalizeEmployeeName(e.fullName),
      e.employeeCode || '',
      e.username || (e.employeeCode ? e.employeeCode.toLowerCase() : ''),
      '',
      cleanRtgPosition(e.position),
      normalizeRtgDepartment(e.department),
      e.role || 'USER',
      e.phone || e.zaloPhone || '',
      e.competencyScore ?? 85,
      e.quizzesCompleted ?? 0,
      e.violationCount ?? 0,
      e.proposalsCount ?? 0,
    ]);
  } else {
    dataRows = [
      [1, 'Nhân viên mẫu 01', 'DEMO-001', 'demo01', '', 'Ca trưởng', 'RTG ca 3', 'ADMIN', '', 96, 6, 0, 5],
      [2, 'Nhân viên mẫu 02', 'DEMO-002', 'demo02', '', 'Tổ trưởng', 'RTG ca 2', 'MANAGER_L1', '', 94, 5, 0, 8],
      [3, 'Nhân viên mẫu 03', 'DEMO-003', 'demo03', '', 'Tổ phó', 'RTG ca 1', 'MANAGER_L2', '', 92, 4, 1, 3],
      [4, 'Nhân viên mẫu 04', 'DEMO-004', 'demo04', '', 'Nhân viên', 'RTG ca 2', 'USER', '', 80, 0, 1, 0],
      [5, 'Nhân viên mẫu 05', 'DEMO-005', 'demo05', '', 'Nhân viên', 'RTG ca 1', 'USER', '', 88, 2, 0, 1],
    ];
  }

  const wsEmployees = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  wsEmployees['!cols'] = [
    { wch: 6 },  // A: STT
    { wch: 24 }, // B: Họ và Tên
    { wch: 14 }, // C: Mã nhân sự
    { wch: 16 }, // D: Tên đăng nhập
    { wch: 14 }, // E: Cột E bỏ qua
    { wch: 16 }, // F: Chức danh
    { wch: 16 }, // G: Bộ phận
    { wch: 12 }, // H: Vai trò
    { wch: 16 }, // I: Số điện thoại
    { wch: 14 }, // J: Điểm năng lực
    { wch: 12 }, // K: Bài thi đạt
    { wch: 10 }, // L: Vi phạm
    { wch: 12 }, // M: Sáng kiến
  ];

  // 2. Sheet TheoDoiViPham
  const violationHeaders = DATA_RTG_VIOLATION_HEADERS;
  let violationRows: any[][];
  if (currentViolations && currentViolations.length > 0) {
    violationRows = currentViolations.map((v) => [
      v.code || '',
      v.time || '',
      v.location || '',
      v.matchedEmployeeCode || '',
      normalizeEmployeeName(v.violatorName || v.matchedEmployeeName || ''),
      v.matchedDepartment || v.department || 'RTG ca 1',
      v.matchedPosition || 'Lái cẩu RTG',
      v.equipment || '',
      v.what || '',
      v.why || '',
      v.how || '',
      v.severity === 'NGHIEM_TRONG' ? 'Nghiêm trọng' : v.severity === 'TRUNG_BINH' ? 'Trung bình' : 'Nhẹ',
      v.sourceAppendix === 'PHU_LUC_1' ? 'Phụ lục 1 (Sự cố)' : 'Phụ lục 2 (Vi phạm nội quy)',
      new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
    ]);
  } else {
    violationRows = [
      ['SC-01', '08:30 15/09/2026', 'Block A3 - Cảng HICT', 'DEMO-004', 'Nhân viên mẫu 04', 'RTG ca 2', 'Lái cẩu RTG', 'RTG 02', 'Cẩu gầu chạm nóc container tầng 4 gây móp góc bên phải', 'Thao tác hạ gầu nhanh, thiếu quan sát gương cầu phụ', 'Yêu cầu bồi thường 1.200.000đ và học lại quy trình vận hành cẩu', 'Trung bình', 'Phụ lục 1 (Sự cố)', new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],
      ['VP-02', '22:15 18/09/2026', 'Block B1 - Bãi cẩu khung', 'DEMO-005', 'Nhân viên mẫu 05', 'RTG ca 1', 'Lái cẩu RTG', 'RTG 05', 'Rời cabin cẩu khi chưa hạ gầu xuống mặt đất an toàn và chưa tắt máy', 'Chủ quan đi giao ca sớm', 'Nhắc nhở toàn ca, hạ 1 bậc thi đua tháng', 'Nhẹ', 'Phụ lục 2 (Vi phạm nội quy)', new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],
      ['SC-03', '14:20 20/09/2026', 'Block C2 - Bãi container hàng', 'DEMO-003', 'Nhân viên mẫu 03', 'RTG ca 1', 'Tổ phó', 'RTG 01', 'Va quẹt thanh chốt twistlock vào vách xe đầu kéo số hiệu DK-18', 'Gió bãi cấp 6 giật mạnh, hoa tiêu xi nhan chưa dứt khoát', 'Lập biên bản sự cố, bảo hiểm giám định chi phí khắc phục', 'Nghiêm trọng', 'Phụ lục 1 (Sự cố)', new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],
    ];
  }

  const wsViolations = XLSX.utils.aoa_to_sheet([violationHeaders, ...violationRows]);
  wsViolations['!cols'] = [
    { wch: 12 }, // Mã vụ việc
    { wch: 18 }, // Thời gian
    { wch: 22 }, // Địa điểm
    { wch: 14 }, // Mã NV
    { wch: 22 }, // Họ tên
    { wch: 16 }, // Ca trực
    { wch: 16 }, // Chức danh
    { wch: 12 }, // Thiết bị
    { wch: 36 }, // Mô tả vi phạm
    { wch: 32 }, // Nguyên nhân
    { wch: 34 }, // Biện pháp xử lý
    { wch: 16 }, // Mức độ
    { wch: 22 }, // Phân loại
    { wch: 18 }, // Thời gian đồng bộ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsEmployees, THONG_TIN_NHAN_SU_TAB);
  XLSX.utils.book_append_sheet(wb, wsViolations, THEO_DOI_VI_PHAM_TAB);

  XLSX.writeFile(wb, 'Data_RTG.xlsx');
}

/**
 * Tiêu đề bảng điểm thi / bài kiểm tra
 */
export const DATA_RTG_QUIZ_HEADERS = [
  'Mã Bài Thi',
  'Tiêu Đề Bài Thi',
  'Mã Nhân Sự',
  'Họ và Tên Thí Sinh',
  'Bộ Phận / Ca',
  'Điểm Số',
  'Kết Quả',
  'Số Câu Đúng',
  'Tổng Số Câu',
  'Xếp Loại Năng Lực',
  'Thời Gian Nộp Bài',
];

/**
 * Tiêu đề góp ý & sáng kiến
 */
export const DATA_RTG_FEEDBACK_HEADERS = [
  'Mã Góp Ý',
  'Thời Gian Gửi',
  'Tiêu Đề',
  'Phân Loại',
  'Nội Dung Ý Kiến / Sáng Kiến',
  'Người Gửi',
  'Phòng Ban',
  'Trạng Thái Xử Lý',
  'Người Phản Hồi',
  'Ý Kiến Phản Hồi Admin',
];

/**
 * Tiêu đề bình xét xếp loại (BXXL)
 */
export const DATA_RTG_BXXL_HEADERS = [
  'Mã Biên Bản',
  'Tháng Bình Xét',
  'Mã Nhân Viên',
  'Họ và Tên',
  'Đơn Vị / Ca',
  'Xếp Loại (A/a/B/b/C)',
  'Lý Do / Đánh Giá',
  'Người Lập Biên Bản',
  'Thời Gian Tạo',
];

/**
 * Tiêu đề đăng ký nghỉ phép
 */
export const DATA_RTG_LEAVE_HEADERS = [
  'Mã Đơn',
  'Mã Nhân Sự',
  'Họ và Tên',
  'Bộ Phận / Ca',
  'Loại Nghỉ Phép',
  'Từ Ngày',
  'Đến Ngày',
  'Số Ngày Nghỉ',
  'Lý Do',
  'Người Thay Thế',
  'Trạng Thái',
  'Người Duyệt',
  'Thời Gian Tạo',
];

/**
 * Helper ghi dữ liệu vào một Tab trong Google Spreadsheet (tự động tạo tab nếu chưa có, xóa dữ liệu cũ và ghi mới)
 */
async function writeSpreadsheetTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  rows: any[][]
): Promise<number> { await api('/google/sync',{method:'POST',body:'{}'});return 0; }

export interface SyncAllDataParams {
  accessToken?: string | null;
  spreadsheetId: string;
  employees: Employee[];
  violations: IncidentViolation[];
  submissions?: QuizSubmission[];
  feedbacks?: FeedbackProposal[];
  bxxlRecords?: BxxlRecord[];
  leaveRequests?: LeaveRequest[];
  webhookUrl?: string | null;
  onProgress?: (step: string, current: number, total: number) => void;
}

export interface SyncAllResult {
  success: boolean;
  spreadsheetUrl: string;
  sheetStats: { name: string; rowCount: number }[];
  totalRows: number;
  message: string;
}

/**
 * NÚT TỔNG ADMIN: Đẩy toàn bộ 6 nguồn dữ liệu lên file Google Sheet Data_RTG
 */
export async function syncAllDataToDataRtgGoogleSheet(
  params: SyncAllDataParams
): Promise<SyncAllResult> { return api('/google/sync',{method:'POST',body:'{}'}); }

/**
 * Tải toàn bộ file Excel Data_RTG đầy đủ 6 sheet dự phòng offline
 */
export function exportDataRtgFullMasterExcel(
  employees: Employee[],
  violations: IncidentViolation[],
  submissions: QuizSubmission[] = [],
  feedbacks: FeedbackProposal[] = [],
  bxxlRecords: BxxlRecord[] = [],
  leaveRequests: LeaveRequest[] = []
) {
  const wb = XLSX.utils.book_new();

  // 1. ThongTinNhanSu
  const empRows = employees.map((e, index) => [
    index + 1,
    normalizeEmployeeName(e.fullName),
    e.employeeCode || '',
    e.username || (e.employeeCode ? e.employeeCode.toLowerCase() : ''),
    '',
    cleanRtgPosition(e.position),
    normalizeRtgDepartment(e.department),
    e.role || 'USER',
    e.phone || e.zaloPhone || '',
    e.competencyScore ?? 85,
    e.quizzesCompleted ?? 0,
    e.violationCount ?? 0,
    e.proposalsCount ?? 0,
  ]);
  const wsEmp = XLSX.utils.aoa_to_sheet([DATA_RTG_NHAN_SU_HEADERS, ...empRows]);
  XLSX.utils.book_append_sheet(wb, wsEmp, THONG_TIN_NHAN_SU_TAB);

  // 2. TheoDoiViPham
  const nowStr = new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
  const violRows = violations.map((v) => [
    v.code || '',
    v.time || '',
    v.location || '',
    v.matchedEmployeeCode || '',
    normalizeEmployeeName(v.violatorName || v.matchedEmployeeName || ''),
    v.matchedDepartment || v.department || 'RTG ca 1',
    v.matchedPosition || 'Lái cẩu RTG',
    v.equipment || '',
    v.what || '',
    v.why || '',
    v.how || '',
    v.severity === 'NGHIEM_TRONG' ? 'Nghiêm trọng' : v.severity === 'TRUNG_BINH' ? 'Trung bình' : 'Nhẹ',
    v.sourceAppendix === 'PHU_LUC_1' ? 'Phụ lục 1 (Sự cố)' : 'Phụ lục 2 (Vi phạm nội quy)',
    nowStr,
  ]);
  const wsViol = XLSX.utils.aoa_to_sheet([DATA_RTG_VIOLATION_HEADERS, ...violRows]);
  XLSX.utils.book_append_sheet(wb, wsViol, THEO_DOI_VI_PHAM_TAB);

  // 3. BaiThi_KiemTra
  const quizRows = submissions.map((s) => {
    const emp = employees.find((e) => e.id === s.employeeId);
    return [
      s.quizId || s.id,
      s.quizTitle || 'Bài kiểm tra kiến thức quy chế',
      emp?.employeeCode || '',
      normalizeEmployeeName(emp?.fullName || s.employeeName || s.employeeId),
      emp ? normalizeRtgDepartment(emp.department) : (s.department || 'RTG ca 1'),
      s.score,
      s.passed ? 'ĐẠT' : 'CHƯA ĐẠT',
      s.correctCount,
      s.totalQuestions,
      s.competencyLevel || (s.passed ? 'Đạt' : 'Cần đào tạo lại'),
      s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '',
    ];
  });
  const wsQuiz = XLSX.utils.aoa_to_sheet([DATA_RTG_QUIZ_HEADERS, ...quizRows]);
  XLSX.utils.book_append_sheet(wb, wsQuiz, BAI_THI_KIEM_TRA_TAB);

  // 4. GopY_SangKien
  const fbRows = feedbacks.map((f) => [
    f.id,
    f.submittedAt ? new Date(f.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '',
    f.title || '',
    f.categoryName || f.category || 'Sáng kiến cải tiến',
    f.content || '',
    f.isAnonymous ? 'Ẩn danh' : normalizeEmployeeName(f.authorName || ''),
    f.authorDepartment || 'Tổ RTG',
    f.status === 'APPROVED' ? 'Đã phê duyệt' : f.status === 'IN_REVIEW' ? 'Đang xem xét' : f.status === 'REJECTED' ? 'Từ chối' : 'Chờ xử lý',
    f.adminResponse?.by || '',
    f.adminResponse?.comment || '',
  ]);
  const wsFb = XLSX.utils.aoa_to_sheet([DATA_RTG_FEEDBACK_HEADERS, ...fbRows]);
  XLSX.utils.book_append_sheet(wb, wsFb, GOP_Y_SANG_KIEN_TAB);

  // 5. BangXepXeLoai
  const bxxlRows: any[][] = [];
  bxxlRecords.forEach((b) => {
    const addCat = (list: any[] = [], rating: string) => {
      list.forEach((item) => {
        bxxlRows.push([
          b.id,
          b.evaluationMonth || '',
          item.employeeCode || '',
          normalizeEmployeeName(item.fullName || ''),
          item.department || item.shift || 'Tổ RTG',
          rating,
          item.reason || '',
          b.creatorName || b.createdBy || 'Tổ RTG',
          b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '',
        ]);
      });
    };
    addCat(b.listA, 'A');
    addCat(b.listSmallA, 'a');
    addCat(b.listB, 'B');
    addCat(b.listSmallB, 'b');
    addCat(b.listC, 'C');
    addCat(b.listGpt, 'GPT');
  });

  if (bxxlRows.length === 0 && bxxlRecords.length > 0) {
    bxxlRecords.forEach((b) => {
      bxxlRows.push([
        b.id,
        b.evaluationMonth || '',
        '',
        'Toàn bộ nhân sự',
        b.departmentName || 'Tổ RTG',
        'Tổng hợp',
        b.generalNote || '',
        b.creatorName || b.createdBy || 'Tổ RTG',
        b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '',
      ]);
    });
  }

  const wsBxxl = XLSX.utils.aoa_to_sheet([DATA_RTG_BXXL_HEADERS, ...bxxlRows]);
  XLSX.utils.book_append_sheet(wb, wsBxxl, BANG_XEP_XE_TAB);

  // 6. DangKyNghiPhep
  const leaveRows = leaveRequests.map((l) => [
    l.id,
    l.employeeCode || '',
    normalizeEmployeeName(l.employeeName || ''),
    l.department || 'RTG ca 1',
    l.leaveType || 'Nghỉ phép',
    l.startDate || '',
    l.endDate || '',
    l.daysCount || 1,
    l.reason || '',
    l.substituteName || '',
    l.status === 'APPROVED' ? 'Đã duyệt' : l.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt',
    l.approvedByName || '',
    l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '',
  ]);
  const wsLeave = XLSX.utils.aoa_to_sheet([DATA_RTG_LEAVE_HEADERS, ...leaveRows]);
  XLSX.utils.book_append_sheet(wb, wsLeave, DANG_KY_NGHI_PHEP_TAB);

  XLSX.writeFile(wb, `Data_RTG_Master_Full_${new Date().toISOString().split('T')[0]}.xlsx`);
}

