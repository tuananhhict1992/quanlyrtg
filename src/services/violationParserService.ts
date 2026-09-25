import * as XLSX from 'xlsx';
import { IncidentViolation, IncidentAnalysisReport, Employee } from '../types';

/**
 * =========================================================================
 * BỘ QUY TẮC CHUẨN HÓA VÀ ĐỐI SOÁT NHÂN SỰ HỆ THỐNG (TỔ RTG - CẢNG BIỂN)
 * =========================================================================
 */

// 1. Quy tắc Chuẩn hóa Tên Nhân viên Bắt buộc
export const NAME_NORMALIZATION_MAP: Record<string, string> = {
  'phạm ngọc tuấn': 'Phạm Ngọc Tuân',
  'pham ngoc tuan': 'Phạm Ngọc Tuân',
  'ngọc tuấn': 'Phạm Ngọc Tuân',
};

/**
 * Danh sách các từ khóa không phải tên người để tránh nhận diện nhầm
 */
const EXCLUDED_NON_PERSONS = [
  'đội cơ giới',
  'đội cơ giới (tổ rtg)',
  'tổ rtg',
  'tổ cẩu khung',
  'tổ cẩu',
  'ban tổ chức',
  'người phụ trách',
  'cán bộ phụ trách',
  'chi huy đội',
  'chỉ huy đội',
  'tập thể',
  'bch',
  'hội đồng',
  'ban chấp hành',
  'công ty',
  'nội quy',
  'quy định',
  'hải phòng',
  'việt nam',
  'bãi container',
  'đoàn tham quan',
  'tham quan du lịch',
  'tham quan',
  'du lịch',
  'văn hóa ứng xử',
  'an toàn lao động',
  'kỷ luật lao động',
  'toàn đoàn',
  'các bên',
  'các cá nhân',
  'đoàn viên',
  'người lao động',
  'nld',
  'nlđ',
  'sự cố',
  'va chạm',
  'mâu thuẫn',
  'đánh bài',
  'bia rượu',
  'hậu quả',
  'nguyên nhân',
  'biện pháp',
];

/**
 * Loại bỏ dấu tiếng Việt để đối soát tên linh hoạt, chính xác
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Chuẩn hóa tên nhân sự theo quy định bắt buộc của hệ thống
 */
export function normalizeEmployeeName(rawName: string): { normalized: string; isModified: boolean; original: string } {
  if (!rawName) return { normalized: '', isModified: false, original: '' };

  let clean = rawName.trim().replace(/\s+/g, ' ');

  // Loại bỏ các tiền tố xưng hô / chức vụ thường gặp trong biên bản
  clean = clean.replace(/^(lái cẩu|lái cẩu rtg|công nhân|nhân viên|đồng chí|đ\/c|đ\/chí|đc|anh|chị|ông|bà)\s+/i, '').trim();

  const lower = clean.toLowerCase();

  for (const [pattern, target] of Object.entries(NAME_NORMALIZATION_MAP)) {
    if (lower === pattern || lower.includes(pattern)) {
      const regex = new RegExp(pattern, 'gi');
      const replaced = clean.replace(regex, target);
      return {
        normalized: replaced,
        isModified: true,
        original: rawName.trim(),
      };
    }
  }

  return {
    normalized: clean,
    isModified: false,
    original: rawName.trim(),
  };
}

/**
 * Kiểm tra xem một nhân viên trong hệ thống có thuộc Tổ RTG (Tổ Cẩu khung / Đội cơ giới) hay không
 */
export function isRtgEmployee(emp: Employee): boolean {
  if (!emp) return false;
  const combined = `${emp.department || ''} ${emp.position || ''}`.toLowerCase();
  
  // Các từ khóa xác định Tổ RTG (Tổ cẩu khung / Đội cơ giới)
  const isRtg =
    combined.includes('rtg') ||
    combined.includes('cẩu khung') ||
    combined.includes('cẩu bãi') ||
    combined.includes('lái cẩu') ||
    combined.includes('cơ giới') ||
    combined.includes('ca 1') ||
    combined.includes('ca 2') ||
    combined.includes('ca 3') ||
    combined.includes('ca 4');

  // Các từ khóa loại trừ thuộc các tổ khác
  const isOther =
    combined.includes('đầu kéo') ||
    combined.includes('xe nâng') ||
    combined.includes('giao nhận') ||
    combined.includes('kho hàng');

  return isRtg && !isOther;
}

/**
 * Kiểm tra xem tên tổ có phải là Tổ RTG / Tổ Cẩu Khung hay không
 */
export function isRtgTeamName(teamStr: string): boolean {
  if (!teamStr) return false;
  const lower = teamStr.toLowerCase().trim();
  return (
    lower.includes('rtg') ||
    lower.includes('cẩu khung') ||
    lower.includes('cẩu bãi') ||
    lower.includes('cẩu rtg') ||
    lower.includes('vận hành cẩu')
  );
}

/**
 * Phát hiện tất cả các cụm "Tổ ..." xuất hiện trong văn bản mà KHÔNG PHẢI là Tổ RTG hay Tổ Cẩu Khung.
 * Quy tắc bắt buộc: Nếu xuất hiện chữ Tổ... mà không phải là Tổ RTG hay Tổ Cẩu Khung thì không trích xuất.
 */
export function extractNonRtgTeams(text: string): string[] {
  if (!text) return [];
  // Regex bắt "Tổ <tên tổ>": 1 đến 3 từ sau chữ Tổ
  const regex = /\b[Tt]ổ\s+([A-Za-zÀ-ỹ0-9]+(?:\s+[A-Za-zÀ-ỹ0-9]+){0,3})/gu;
  const nonRtgTeams: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const fullTeam = match[0].trim();
    if (!isRtgTeamName(fullTeam)) {
      nonRtgTeams.push(fullTeam);
    }
  }
  return nonRtgTeams;
}

/**
 * Kiểm tra xem nội dung sự cố có liên quan đến Tổ RTG (Tổ cẩu khung / Đội cơ giới) hay không
 */
export function isRtgRelatedIncident(
  department: string = '',
  description: string = '',
  violator: string = '',
  equipment: string = ''
): boolean {
  const deptLower = (department || '').toLowerCase().trim();
  const descLower = (description || '').toLowerCase();
  const violatorLower = (violator || '').toLowerCase();
  const equipLower = (equipment || '').toLowerCase();
  const combinedText = `${deptLower} ${descLower} ${violatorLower} ${equipLower}`;

  // 1. Kiểm tra cột Đơn vị / Đơn vị quản lý
  // Nếu cột đơn vị có chữ "Tổ ..." mà không phải Tổ RTG hay Tổ Cẩu Khung -> LOẠI TRỪ 100%
  const nonRtgTeamsInDept = extractNonRtgTeams(deptLower);
  if (nonRtgTeamsInDept.length > 0) {
    return false;
  }

  // Các đơn vị khác cần loại trừ hoàn toàn nếu nằm trong cột đơn vị
  const otherUnits = [
    'đầu kéo',
    'xe nâng',
    'giao nhận',
    'buộc cáp',
    'kho hàng',
    'sts',
    'cẩu bờ',
    'kiểm đếm',
    'kỹ thuật ô tô',
    'bảo vệ',
    'sửa chữa ô tô',
    'vận tải',
    'điều hành bãi',
  ];

  if (otherUnits.some((unit) => deptLower.includes(unit)) && !isRtgTeamName(deptLower)) {
    return false;
  }

  // 2. Kiểm tra nếu có sự xuất hiện của "Tổ [khác]" trong toàn bộ văn bản
  const nonRtgTeamsInCombined = extractNonRtgTeams(combinedText);
  const hasExplicitRtgMention =
    combinedText.includes('rtg') ||
    combinedText.includes('cẩu khung') ||
    combinedText.includes('cẩu bãi') ||
    combinedText.includes('tổ rtg') ||
    /rtg\s*0?\d+/i.test(combinedText) ||
    combinedText.includes('đỗ xuân tùng') ||
    combinedText.includes('nguyễn văn quang') ||
    combinedText.includes('phạm ngọc tuân') ||
    combinedText.includes('phạm ngọc tuấn');

  // Nếu có nhắc đến "Tổ ..." (không phải RTG) và không hề có phương tiện / nhân sự RTG nào liên quan
  if (nonRtgTeamsInCombined.length > 0 && !hasExplicitRtgMention) {
    return false;
  }

  // 3. Nếu toàn bộ sự cố chỉ nói về đơn vị khác
  if (otherUnits.some((unit) => combinedText.includes(unit)) && !hasExplicitRtgMention) {
    return false;
  }

  // 4. Các từ khóa xác định thuộc Tổ RTG
  const rtgKeywords = [
    'rtg',
    'cẩu khung',
    'cẩu bãi',
    'lái cẩu',
    'vận hành cẩu',
    'tổ rtg',
    'cẩu rtg',
    'đỗ xuân tùng',
    'nguyễn văn quang',
    'phạm ngọc tuân',
    'phạm ngọc tuấn',
  ];

  const hasRtgKeyword = rtgKeywords.some((kw) => combinedText.includes(kw));
  const hasRtgEquipmentPattern = /rtg\s*0?\d+/i.test(combinedText);

  if (hasRtgKeyword || hasRtgEquipmentPattern) {
    return true;
  }

  // Nếu chỉ có "cơ giới" chung chung mà không có dấu hiệu RTG thì cần kiểm tra kỹ
  if (combinedText.includes('cơ giới') && !otherUnits.some((u) => combinedText.includes(u))) {
    return true;
  }

  return false;
}

/**
 * Trích xuất số hiệu thiết bị cẩu (vd: RTG 02, RTG 05) từ văn bản
 */
export function extractEquipmentCode(text: string): string {
  const match = text.match(/rtg\s*0?(\d+)/i);
  if (match) {
    const num = match[1].padStart(2, '0');
    return `RTG ${num}`;
  }
  return '';
}

/**
 * Đánh giá mức độ nghiêm trọng dựa trên hậu quả
 */
export function evaluateSeverity(what: string, why: string): 'THAP' | 'TRUNG_BINH' | 'NGHIEM_TRONG' {
  const text = `${what} ${why}`.toLowerCase();
  if (
    text.includes('va quẹt') ||
    text.includes('va chạm') ||
    text.includes('rơi cont') ||
    text.includes('lật cont') ||
    text.includes('hư hỏng nặng') ||
    text.includes('đình chỉ') ||
    text.includes('tai nạn') ||
    text.includes('đứt cáp') ||
    text.includes('sập gantry') ||
    text.includes('thiệt hại lớn') ||
    text.includes('mâu thuẫn')
  ) {
    return 'NGHIEM_TRONG';
  }

  if (
    text.includes('sai quy trình') ||
    text.includes('không thắt dây') ||
    text.includes('quên chốt') ||
    text.includes('móp nhẹ') ||
    text.includes('thiếu quan sát') ||
    text.includes('chậm tiến độ') ||
    text.includes('sử dụng điện thoại') ||
    text.includes('bia rượu') ||
    text.includes('đánh bài')
  ) {
    return 'TRUNG_BINH';
  }

  return 'THAP';
}

/**
 * Cấu trúc đối soát thông tin từng người vi phạm được phát hiện
 */
export interface DetectedViolator {
  violatorName: string;
  normalizedName: string;
  originalName?: string;
  isModified: boolean;
  matchedEmployee: Employee | null;
  isMatchedWithSystem: boolean;
  department: string;
  position?: string;
  avatar?: string;
  employeeCode?: string;
}

/**
 * Lấy danh sách gộp ứng viên nhân viên hệ thống (kết hợp cả state và INITIAL_EMPLOYEES)
 */
function getSystemCandidates(systemEmployees: Employee[]): Employee[] { return systemEmployees; }

/**
 * =========================================================================
 * TRÍCH XUẤT TẤT CẢ NHÂN VIÊN VI PHẠM TỪ NỘI DUNG VÀ Ô NHÂN SỰ
 * =========================================================================
 * Hỗ trợ trích xuất nhiều nhân viên cùng lúc (vd: Nhân viên mẫu 01 và Nhân viên mẫu 02)
 */
export function extractAllViolatorsFromRow(
  violatorColText: string,
  contextText: string,
  systemEmployees: Employee[]
): DetectedViolator[] {
  const candidates = getSystemCandidates(systemEmployees);
  const results: DetectedViolator[] = [];
  const processedEmpIds = new Set<string>();

  const combinedSearchText = `${violatorColText || ''} ${contextText || ''}`;
  const lowerSearchText = combinedSearchText.toLowerCase();
  const noToneSearchText = removeVietnameseTones(combinedSearchText);

  // 1. Quét đối soát trực tiếp các nhân viên hệ thống trong văn bản (cột Trách nhiệm, Diễn biến, v.v.)
  for (const emp of candidates) {
    const empNameLower = emp.fullName.trim().toLowerCase();
    const empNameNoTone = removeVietnameseTones(emp.fullName).trim();

    // Bao gồm cả các biến thể cần chuẩn hóa bắt buộc (vd: Phạm Ngọc Tuấn -> Phạm Ngọc Tuân)
    const aliases = [empNameLower, empNameNoTone];
    for (const [rawAlias, normTarget] of Object.entries(NAME_NORMALIZATION_MAP)) {
      if (normTarget.toLowerCase() === empNameLower) {
        aliases.push(rawAlias.toLowerCase());
        aliases.push(removeVietnameseTones(rawAlias));
      }
    }

    const isMatch = aliases.some(
      (alias) => alias.length >= 4 && (lowerSearchText.includes(alias) || noToneSearchText.includes(alias))
    );

    if (isMatch && !processedEmpIds.has(emp.id)) {
      processedEmpIds.add(emp.id);

      let originalNameUsed: string | undefined = undefined;
      let wasModified = false;
      for (const [rawAlias, normTarget] of Object.entries(NAME_NORMALIZATION_MAP)) {
        if (normTarget.toLowerCase() === empNameLower && lowerSearchText.includes(rawAlias.toLowerCase())) {
          originalNameUsed = rawAlias;
          wasModified = true;
          break;
        }
      }

      results.push({
        violatorName: emp.fullName,
        normalizedName: emp.fullName,
        originalName: wasModified ? originalNameUsed : undefined,
        isModified: wasModified,
        matchedEmployee: emp,
        isMatchedWithSystem: true,
        department: emp.department || 'Đội cơ giới (Tổ RTG)',
        position: emp.position || 'Lái cẩu RTG',
        avatar: emp.avatar,
        employeeCode: emp.employeeCode,
      });
    }
  }

  // 2. Nếu quét trực tiếp chưa thấy, phân tích các cụm từ trong ô Trách nhiệm / Nhân sự
  if (results.length === 0 && violatorColText && violatorColText.trim()) {
    const splitParts = violatorColText
      .split(/[,;\n\+]|\s+(?:và|cùng|với|&)\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of splitParts) {
      const cleanPart = part
        .replace(/^(đồng\s*chí|đ\/c|đ\/chí|đc|anh|chị|ông|bà|lái\s*cẩu|công\s*nhân|nhân\s*viên)\s+/i, '')
        .trim();
      const norm = normalizeEmployeeName(cleanPart);
      const cleanNorm = norm.normalized.toLowerCase().trim();
      const cleanNoTone = removeVietnameseTones(norm.normalized).trim();

      const matchedEmp = candidates.find((e) => {
        const eName = e.fullName.trim().toLowerCase();
        const eNoTone = removeVietnameseTones(e.fullName).trim();
        return (
          eName === cleanNorm ||
          eNoTone === cleanNoTone ||
          (cleanNorm.length >= 6 && (eName.includes(cleanNorm) || cleanNorm.includes(eName))) ||
          (cleanNoTone.length >= 6 && (eNoTone.includes(cleanNoTone) || cleanNoTone.includes(eNoTone)))
        );
      });

      if (matchedEmp && !processedEmpIds.has(matchedEmp.id)) {
        processedEmpIds.add(matchedEmp.id);
        results.push({
          violatorName: matchedEmp.fullName,
          normalizedName: matchedEmp.fullName,
          originalName: norm.isModified ? norm.original : (cleanPart !== matchedEmp.fullName ? cleanPart : undefined),
          isModified: norm.isModified,
          matchedEmployee: matchedEmp,
          isMatchedWithSystem: true,
          department: matchedEmp.department || 'Đội cơ giới (Tổ RTG)',
          position: matchedEmp.position || 'Lái cẩu RTG',
          avatar: matchedEmp.avatar,
          employeeCode: matchedEmp.employeeCode,
        });
      }
    }
  }

  // QUY TẮC BẮT BUỘC 1: Chỉ giữ lại các vụ việc khớp chính xác với nhân viên trong hệ thống.
  // Tuyệt đối loại bỏ/không liệt kê bất kỳ vụ việc nào của cá nhân không có tên trong hệ thống.
  return results;
}

/**
 * Tương thích ngược hàm reconcileEmployeeWithSystem
 */
export interface ReconcileResult {
  matchedEmployee: Employee | null;
  normalizedName: string;
  originalName: string;
  isModified: boolean;
  isRtg: boolean;
}

export function reconcileEmployeeWithSystem(
  rawName: string,
  contextText: string,
  systemEmployees: Employee[]
): ReconcileResult {
  const violators = extractAllViolatorsFromRow(rawName, contextText, systemEmployees);
  const first = violators[0];

  return {
    matchedEmployee: first?.matchedEmployee || null,
    normalizedName: first?.normalizedName || rawName,
    originalName: first?.originalName || rawName,
    isModified: first?.isModified || false,
    isRtg: true,
  };
}

/**
 * =========================================================================
 * PARSER EXCEL: ĐỐI SOÁT VỚI NHÂN VIÊN HỆ THỐNG VÀ LỌC ĐỘC QUYỀN TỔ RTG
 * =========================================================================
 */
export function parseExcelViolationsFile(
  workbook: XLSX.WorkBook,
  systemEmployees: Employee[] = []
): IncidentAnalysisReport {
  const extractedViolations: IncidentViolation[] = [];
  let incidentCounter = 1;
  let nonRtgIgnoredCount = 0;
  let totalRowsScanned = 0;

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const lowerSheet = sheetName.toLowerCase();
    let appendixType: 'PHU_LUC_1' | 'PHU_LUC_2' | 'OTHER' = 'OTHER';
    if (lowerSheet.includes('phụ lục 1') || lowerSheet.includes('sự cố') || lowerSheet.includes('tai nạn')) {
      appendixType = 'PHU_LUC_1';
    } else if (lowerSheet.includes('phụ lục 2') || lowerSheet.includes('vi phạm') || lowerSheet.includes('nội quy')) {
      appendixType = 'PHU_LUC_2';
    }

    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawData.length < 2) return;

    // Tìm dòng header
    let headerRowIndex = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(rawData.length, 10); r++) {
      const row = rawData[r].map((cell) => String(cell).toLowerCase().trim());
      const hasTime = row.some((c) => c.includes('thời gian') || c.includes('ngày') || c.includes('giờ'));
      const hasContent = row.some(
        (c) =>
          c.includes('diễn biến') ||
          c.includes('nội dung') ||
          c.includes('vi phạm') ||
          c.includes('sự cố') ||
          c.includes('hậu quả') ||
          c.includes('trách nhiệm')
      );

      if (hasTime || hasContent) {
        headerRowIndex = r;
        row.forEach((colName, idx) => {
          if (
            (colName.includes('thời gian') && colName.includes('địa điểm')) ||
            colName.includes('thời gian, địa điểm') ||
            colName.includes('thời gian & địa điểm')
          ) {
            colMap['timeAndLocation'] = idx;
          } else if (colName.includes('thời gian') || colName.includes('khi nào')) {
            colMap['time'] = idx;
          } else if (colName.includes('địa điểm') || colName.includes('vị trí') || colName.includes('ở đâu')) {
            colMap['location'] = idx;
          }

          if (
            colName.includes('diễn biến vụ việc') ||
            colName.includes('diễn biến sự việc') ||
            colName.includes('nội dung vụ việc') ||
            colName.includes('nội dung sự việc') ||
            colName.includes('diễn biến')
          ) {
            colMap['progression'] = idx;
          } else if (colName.includes('hậu quả') || colName.includes('thiệt hại') || colName.includes('tổn thất')) {
            colMap['consequence'] = idx;
          } else if (colName.includes('nguyên nhân') || colName.includes('tại sao')) {
            colMap['cause'] = idx;
          }

          if (
            colName.includes('trách nhiệm') ||
            colName.includes('nhân sự') ||
            colName.includes('nhân viên') ||
            colName.includes('người vi phạm') ||
            colName.includes('họ và tên') ||
            colName.includes('cá nhân vi phạm') ||
            colName.includes('ai')
          ) {
            colMap['violator'] = idx;
          }

          if (
            colName.includes('đơn vị quản lý') ||
            colName.includes('đơn vị') ||
            colName.includes('bộ phận') ||
            colName.includes('tổ quản lý') ||
            colName.includes('tổ / đội') ||
            colName.includes('chức danh')
          ) {
            colMap['department'] = idx;
          }

          if (
            colName.includes('biện pháp xử lý') ||
            colName.includes('biện pháp khắc phục') ||
            colName.includes('xử lý khắc phục') ||
            colName.includes('hình thức kỷ luật') ||
            colName.includes('biện pháp') ||
            colName.includes('xử lý') ||
            colName.includes('kỷ luật') ||
            colName.includes('khắc phục') ||
            colName.includes('như thế nào')
          ) {
            colMap['correctiveAction'] = idx;
          }

          if (
            colName.includes('phân loại') ||
            colName.includes('loại vụ việc') ||
            colName.includes('loại sự cố') ||
            colName.includes('loại vi phạm')
          ) {
            colMap['classification'] = idx;
          }

          if (colName.includes('thiết bị') || colName.includes('số xe') || colName.includes('cẩu')) {
            colMap['equipment'] = idx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.every((c) => !c || String(c).trim() === '')) continue;
      totalRowsScanned++;

      let timeLocVal = '';
      let timeVal = '';
      let locVal = '';
      let progressionVal = '';
      let consequenceVal = '';
      let causeVal = '';
      let violatorVal = '';
      let deptVal = '';
      let correctiveVal = '';
      let classificationVal = '';
      let equipVal = '';

      if (colMap['timeAndLocation'] !== undefined) timeLocVal = String(row[colMap['timeAndLocation']] || '');
      if (colMap['time'] !== undefined) timeVal = String(row[colMap['time']] || '');
      if (colMap['location'] !== undefined) locVal = String(row[colMap['location']] || '');
      if (colMap['progression'] !== undefined) progressionVal = String(row[colMap['progression']] || '');
      if (colMap['consequence'] !== undefined) consequenceVal = String(row[colMap['consequence']] || '');
      if (colMap['cause'] !== undefined) causeVal = String(row[colMap['cause']] || '');
      if (colMap['violator'] !== undefined) violatorVal = String(row[colMap['violator']] || '');
      if (colMap['department'] !== undefined) deptVal = String(row[colMap['department']] || '');
      if (colMap['correctiveAction'] !== undefined) correctiveVal = String(row[colMap['correctiveAction']] || '');
      if (colMap['classification'] !== undefined) classificationVal = String(row[colMap['classification']] || '');
      if (colMap['equipment'] !== undefined) equipVal = String(row[colMap['equipment']] || '');

      // Hỗ trợ cấu trúc bảng 8-9 cột chuẩn theo thứ tự vị trí nếu chưa có header map đầy đủ
      // | STT | Thời gian, Địa điểm | Diễn biến vụ việc | Hậu quả | Nguyên nhân | Trách nhiệm | Đơn vị quản lý | Biện pháp xử lý khắc phục | Phân loại |
      const nonBlankCols = row.map((c) => String(c || '').trim());
      if (!progressionVal && row.length >= 8) {
        // Kiểm tra xem cột 0 có phải số STT không
        const isCol0Number = /^\d+$/.test(String(row[0] || '').trim());
        const offset = isCol0Number ? 1 : 0;
        if (!timeLocVal && row[offset]) timeLocVal = String(row[offset]);
        if (!progressionVal && row[offset + 1]) progressionVal = String(row[offset + 1]);
        if (!consequenceVal && row[offset + 2]) consequenceVal = String(row[offset + 2]);
        if (!causeVal && row[offset + 3]) causeVal = String(row[offset + 3]);
        if (!violatorVal && row[offset + 4]) violatorVal = String(row[offset + 4]);
        if (!deptVal && row[offset + 5]) deptVal = String(row[offset + 5]);
        if (!correctiveVal && row[offset + 6]) correctiveVal = String(row[offset + 6]);
        if (!classificationVal && row[offset + 7]) classificationVal = String(row[offset + 7]);
      }

      // Hỗ trợ cấu trúc bảng 4 cột (Thời gian & Địa điểm / Diễn biến / Nguyên nhân / Biện pháp xử lý)
      if (!progressionVal && nonBlankCols.filter(Boolean).length <= 4 && row.length >= 3) {
        const col0 = String(row[0] || '').trim();
        timeLocVal = col0;
        progressionVal = String(row[1] || '').trim();
        causeVal = String(row[2] || '').trim();
        correctiveVal = String(row[3] || '').trim();
      }

      // Chuẩn hóa thời gian và địa điểm
      if (!timeLocVal && (timeVal || locVal)) {
        timeLocVal = [timeVal.trim(), locVal.trim()].filter(Boolean).join(', ');
      }
      if (timeLocVal && (!timeVal || !locVal)) {
        const dateMatch = timeLocVal.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s*(?:đến|-)\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})?)/i);
        if (dateMatch) {
          timeVal = dateMatch[0];
          locVal = timeLocVal.replace(dateMatch[0], '').replace(/^từ\s+/i, '').replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim() || 'Bãi container Cảng';
        } else {
          timeVal = timeLocVal.split(',')[0]?.trim() || new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
          locVal = timeLocVal.split(',').slice(1).join(',').trim() || 'Địa bàn Đội cơ giới';
        }
      }

      if (!progressionVal.trim() && !causeVal.trim() && !violatorVal.trim()) continue;

      const fullRowText = row.map((c) => String(c || '')).join(' ');

      // QUY TẮC LỌC 1: Khớp tên nhân sự (Điều kiện tiên quyết)
      // Rà soát các cột liên quan đến nhân sự. Chỉ giữ lại vụ việc trùng khớp chính xác nhân viên hệ thống.
      // Tuyệt đối loại bỏ bất kỳ vụ việc nào không có tên trong hệ thống.
      const detectedViolators = extractAllViolatorsFromRow(violatorVal, fullRowText, systemEmployees);
      if (detectedViolators.length === 0) {
        nonRtgIgnoredCount++;
        continue;
      }

      // QUY TẮC TOÀN VẸN DỮ LIỆU: Giữ nguyên văn phong, nội dung chi tiết
      detectedViolators.forEach((violator, vIdx) => {
        const codeSuffix = detectedViolators.length > 1 ? (vIdx === 0 ? '-A' : '-B') : '';
        const code = `SC-${new Date().getFullYear()}-${String(incidentCounter).padStart(3, '0')}${codeSuffix}`;
        const finalEquip = equipVal || extractEquipmentCode(fullRowText);

        extractedViolations.push({
          id: `inc-xl-${Date.now()}-${incidentCounter}-${vIdx}-${Math.random().toString(36).substring(2, 6)}`,
          code,
          time: timeVal.trim() || new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
          location: locVal.trim() || 'Bãi container Cảng',
          // 8 cột chuẩn bắt buộc
          timeAndLocation: timeLocVal.trim() || `${timeVal.trim()}, ${locVal.trim()}`,
          incidentProgression: progressionVal.trim(),
          consequence: consequenceVal.trim(),
          cause: causeVal.trim(),
          responsibility: violator.violatorName + (finalEquip ? ` (${finalEquip})` : ''),
          managingUnit: deptVal.trim() || violator.matchedEmployee?.department || 'Đội cơ giới (Tổ RTG)',
          correctiveAction: correctiveVal.trim(),
          classification: classificationVal.trim() || (appendixType === 'PHU_LUC_1' ? 'Sự cố / TNLĐ' : 'Vi phạm nội quy'),
          // Thông tin đối soát nhân viên hệ thống
          violatorName: violator.violatorName,
          normalizedName: violator.normalizedName,
          originalName: violator.originalName,
          matchedEmployeeId: violator.matchedEmployee?.id,
          matchedEmployeeCode: violator.matchedEmployee?.employeeCode,
          matchedEmployeeName: violator.matchedEmployee?.fullName,
          matchedDepartment: violator.matchedEmployee?.department || violator.department,
          matchedPosition: violator.matchedEmployee?.position || violator.position,
          matchedAvatar: violator.avatar || violator.matchedEmployee?.avatar,
          isMatchedWithSystem: true,
          department: violator.matchedEmployee?.department || deptVal.trim() || 'Đội cơ giới (Tổ RTG)',
          equipment: finalEquip,
          what: progressionVal.trim() || 'Sự cố vận hành thiết bị cẩu khung',
          why: causeVal.trim() || 'Thiếu chú ý / sai quy trình',
          how: correctiveVal.trim() || 'Lập biên bản chấn chỉnh kỷ luật',
          sourceAppendix: appendixType,
          isRtgRelated: true,
          severity: evaluateSeverity(consequenceVal || progressionVal, causeVal),
        });
      });

      incidentCounter++;
    }
  });

  return buildAnalysisReport(
    extractedViolations,
    nonRtgIgnoredCount,
    totalRowsScanned,
    'Báo cáo đối soát sự cố & vi phạm Tổ RTG'
  );
}

/**
 * =========================================================================
 * PARSER VĂN BẢN THÔ: ĐỐI SOÁT VỚI NHÂN VIÊN HỆ THỐNG
 * =========================================================================
 */
export function parseRawTextViolations(
  rawText: string,
  systemEmployees: Employee[] = []
): IncidentAnalysisReport {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const extractedViolations: IncidentViolation[] = [];
  let nonRtgIgnoredCount = 0;
  let counter = 1;
  let totalLinesScanned = 0;

  for (const line of lines) {
    if (
      line.startsWith('|---') ||
      line.startsWith('|:---') ||
      line.includes('Mã vụ việc') ||
      line.includes('Thời gian (When)') ||
      (line.includes('STT') && line.includes('Thời gian, Địa điểm'))
    ) {
      continue;
    }
    totalLinesScanned++;

    // 1. Dòng dạng ô Excel copy paste qua Tab (\t)
    if (line.includes('\t')) {
      const parts = line.split('\t').map((p) => p.trim());
      let timeLoc = '';
      let progression = '';
      let consequence = '';
      let cause = '';
      let violator = '';
      let dept = '';
      let corrective = '';
      let classification = '';

      if (parts.length >= 8) {
        const isPart0Number = /^\d+$/.test(parts[0]);
        const offset = isPart0Number ? 1 : 0;
        timeLoc = parts[offset] || '';
        progression = parts[offset + 1] || '';
        consequence = parts[offset + 2] || '';
        cause = parts[offset + 3] || '';
        violator = parts[offset + 4] || '';
        dept = parts[offset + 5] || '';
        corrective = parts[offset + 6] || '';
        classification = parts[offset + 7] || '';
      } else if (parts.length === 4) {
        timeLoc = parts[0] || '';
        progression = parts[1] || '';
        cause = parts[2] || '';
        corrective = parts[3] || '';
      } else if (parts.length >= 5) {
        timeLoc = parts[0] || '';
        violator = parts[1] || '';
        dept = parts[2] || '';
        progression = parts[3] || '';
        cause = parts[4] || '';
        corrective = parts[5] || '';
      }

      const fullText = `${line} ${progression} ${cause} ${corrective}`;
      const detected = extractAllViolatorsFromRow(violator, fullText, systemEmployees);
      if (detected.length === 0) {
        nonRtgIgnoredCount++;
        continue;
      }

      const finalEquip = extractEquipmentCode(fullText);

      detected.forEach((v, vIdx) => {
        const codeSuffix = detected.length > 1 ? (vIdx === 0 ? '-A' : '-B') : '';
        const code = `SC-${new Date().getFullYear()}-${String(counter).padStart(3, '0')}${codeSuffix}`;

        extractedViolations.push({
          id: `inc-tab-${Date.now()}-${counter}-${vIdx}`,
          code,
          time: timeLoc.split(',')[0]?.trim() || new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
          location: timeLoc.split(',').slice(1).join(',').trim() || 'Bãi container Cảng',
          timeAndLocation: timeLoc || 'Trong ca trực',
          incidentProgression: progression,
          consequence: consequence,
          cause: cause,
          responsibility: v.violatorName + (finalEquip ? ` (${finalEquip})` : ''),
          managingUnit: dept || v.matchedEmployee?.department || 'Đội cơ giới (Tổ RTG)',
          correctiveAction: corrective,
          classification: classification || 'Sự cố / Vi phạm nội quy',
          violatorName: v.violatorName,
          normalizedName: v.normalizedName,
          originalName: v.originalName,
          matchedEmployeeId: v.matchedEmployee?.id,
          matchedEmployeeCode: v.matchedEmployee?.employeeCode,
          matchedEmployeeName: v.matchedEmployee?.fullName,
          matchedDepartment: v.matchedEmployee?.department || v.department,
          matchedPosition: v.matchedEmployee?.position || v.position,
          matchedAvatar: v.avatar || v.matchedEmployee?.avatar,
          isMatchedWithSystem: true,
          department: v.matchedEmployee?.department || dept || 'Đội cơ giới (Tổ RTG)',
          equipment: finalEquip,
          what: progression || 'Sự cố vi phạm nội quy / an toàn',
          why: cause || 'Sai quy trình / quy định',
          how: corrective || 'Lập biên bản xử lý kỷ luật',
          sourceAppendix: 'PHU_LUC_1',
          isRtgRelated: true,
          severity: evaluateSeverity(consequence || progression, cause),
        });
      });

      counter++;
      continue;
    }

    // 2. Dòng dạng bảng Markdown (|)
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim()).filter((p, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 4) {
        let timeLoc = '';
        let progression = '';
        let consequence = '';
        let cause = '';
        let violator = '';
        let dept = '';
        let corrective = '';
        let classification = '';

        if (parts.length >= 8) {
          const isPart0Number = /^\d+$/.test(parts[0]);
          if (isPart0Number && parts.length >= 9) {
            // Định dạng chuẩn 9 cột: STT | Thời gian, Địa điểm | Diễn biến vụ việc | Hậu quả | Nguyên nhân | Trách nhiệm | Đơn vị quản lý | Biện pháp xử lý khắc phục | Phân loại
            timeLoc = parts[1] || '';
            progression = parts[2] || '';
            consequence = parts[3] || '';
            cause = parts[4] || '';
            violator = parts[5] || '';
            dept = parts[6] || '';
            corrective = parts[7] || '';
            classification = parts[8] || '';
          } else {
            timeLoc = parts[0] || '';
            progression = parts[1] || '';
            consequence = parts[2] || '';
            cause = parts[3] || '';
            violator = parts[4] || '';
            dept = parts[5] || '';
            corrective = parts[6] || '';
            classification = parts[7] || '';
          }
        } else {
          timeLoc = parts[0] || '';
          progression = parts[1] || '';
          cause = parts[2] || '';
          corrective = parts[3] || '';
        }

        const fullText = `${line} ${progression} ${cause} ${corrective}`;
        const detected = extractAllViolatorsFromRow(violator, fullText, systemEmployees);
        if (detected.length === 0) {
          nonRtgIgnoredCount++;
          continue;
        }

        const finalEquip = extractEquipmentCode(fullText);

        detected.forEach((v, vIdx) => {
          const codeSuffix = detected.length > 1 ? (vIdx === 0 ? '-A' : '-B') : '';
          const code = `SC-${String(counter).padStart(3, '0')}${codeSuffix}`;

          extractedViolations.push({
            id: `inc-txt-${Date.now()}-${counter}-${vIdx}`,
            code,
            time: timeLoc.split(',')[0]?.trim() || new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
            location: timeLoc.split(',').slice(1).join(',').trim() || 'Bãi container Cảng',
            timeAndLocation: timeLoc || 'Trong ca trực',
            incidentProgression: progression,
            consequence: consequence,
            cause: cause,
            responsibility: v.violatorName + (finalEquip ? ` (${finalEquip})` : ''),
            managingUnit: dept || v.matchedEmployee?.department || 'Đội cơ giới (Tổ RTG)',
            correctiveAction: corrective,
            classification: classification || 'Sự cố / Vi phạm nội quy',
            violatorName: v.violatorName,
            normalizedName: v.normalizedName,
            originalName: v.originalName,
            matchedEmployeeId: v.matchedEmployee?.id,
            matchedEmployeeCode: v.matchedEmployee?.employeeCode,
            matchedEmployeeName: v.matchedEmployee?.fullName,
            matchedDepartment: v.matchedEmployee?.department || v.department,
            matchedPosition: v.matchedEmployee?.position || v.position,
            matchedAvatar: v.avatar || v.matchedEmployee?.avatar,
            isMatchedWithSystem: true,
            department: v.matchedEmployee?.department || dept || 'Đội cơ giới (Tổ RTG)',
            equipment: finalEquip,
            what: progression || 'Sự cố vận hành thiết bị cẩu khung',
            why: cause || 'Thiếu tập trung, sai quy trình an toàn',
            how: corrective || 'Lập biên bản vi phạm, hạ bậc BXXL',
            sourceAppendix: 'PHU_LUC_1',
            isRtgRelated: true,
            severity: evaluateSeverity(consequence || progression, cause),
          });
        });

        counter++;
        continue;
      }
    }

    // 3. Xử lý đoạn văn bản tự do
    if (line.length > 15) {
      const finalEquip = extractEquipmentCode(line);
      const detected = extractAllViolatorsFromRow('', line, systemEmployees);
      if (detected.length === 0) {
        nonRtgIgnoredCount++;
        continue;
      }

      detected.forEach((v, vIdx) => {
        const codeSuffix = detected.length > 1 ? (vIdx === 0 ? '-A' : '-B') : '';
        const code = `SC-${new Date().getFullYear()}-${String(counter).padStart(3, '0')}${codeSuffix}`;

        extractedViolations.push({
          id: `inc-free-${Date.now()}-${counter}-${vIdx}`,
          code,
          time: new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
          location: 'Địa bàn Đội cơ giới',
          timeAndLocation: `Ca trực ngày ${new Date().toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}, Bãi Cảng`,
          incidentProgression: line,
          consequence: '',
          cause: 'Sai quy trình / quy định an toàn vận hành',
          responsibility: v.violatorName + (finalEquip ? ` (${finalEquip})` : ''),
          managingUnit: v.matchedEmployee?.department || 'Đội cơ giới (Tổ RTG)',
          correctiveAction: 'Yêu cầu kiểm điểm, xem xét hạ bậc thi đua BXXL tháng',
          classification: 'Sự cố / Vi phạm nội quy',
          violatorName: v.violatorName,
          normalizedName: v.normalizedName,
          originalName: v.originalName,
          matchedEmployeeId: v.matchedEmployee?.id,
          matchedEmployeeCode: v.matchedEmployee?.employeeCode,
          matchedEmployeeName: v.matchedEmployee?.fullName,
          matchedDepartment: v.matchedEmployee?.department || v.department,
          matchedPosition: v.matchedEmployee?.position || v.position,
          matchedAvatar: v.avatar || v.matchedEmployee?.avatar,
          isMatchedWithSystem: true,
          department: v.matchedEmployee?.department || 'Đội cơ giới (Tổ RTG)',
          equipment: finalEquip,
          what: line,
          why: 'Sai quy trình / quy định / thiếu kiềm chế',
          how: 'Yêu cầu kiểm điểm, xem xét hạ bậc thi đua BXXL tháng',
          sourceAppendix: 'PHU_LUC_1',
          isRtgRelated: true,
          severity: evaluateSeverity(line, ''),
        });
      });

      counter++;
    }
  }

  return buildAnalysisReport(
    extractedViolations,
    nonRtgIgnoredCount,
    totalLinesScanned,
    'Báo cáo phân tích văn bản đối soát nhân sự RTG'
  );
}

/**
 * =========================================================================
 * TỔNG HỢP VÀ ĐÁNH GIÁ NĂNG LỰC (REPORTS & RECOMMENDATIONS)
 * =========================================================================
 */
export function buildAnalysisReport(
  items: IncidentViolation[],
  nonRtgIgnoredCount: number,
  totalFileRows: number,
  title: string
): IncidentAnalysisReport {
  const rtgItems = items.filter((i) => i.isRtgRelated);

  const violatorStats: Record<
    string,
    {
      name: string;
      normalizedName: string;
      employeeCode?: string;
      department?: string;
      count: number;
      equipment: Set<string>;
      severities: string[];
      highSeverityCount: number;
    }
  > = {};

  rtgItems.forEach((item) => {
    const key = item.normalizedName || item.violatorName || 'Chưa xác định';
    if (!violatorStats[key]) {
      violatorStats[key] = {
        name: key,
        normalizedName: item.normalizedName || key,
        employeeCode: item.matchedEmployeeCode,
        department: item.matchedDepartment,
        count: 0,
        equipment: new Set<string>(),
        severities: [],
        highSeverityCount: 0,
      };
    }

    violatorStats[key].count++;
    if (item.equipment) violatorStats[key].equipment.add(item.equipment);
    violatorStats[key].severities.push(item.severity);
    if (item.severity === 'NGHIEM_TRONG') {
      violatorStats[key].highSeverityCount++;
    }
  });

  // Lập danh sách các nhân viên Tổ RTG vi phạm nhiều lần hoặc gây sự cố nghiêm trọng
  const repeatViolators = Object.values(violatorStats)
    .filter((v) => v.count >= 2 || v.highSeverityCount >= 1)
    .map((v) => {
      let rec = '';
      if (v.highSeverityCount >= 1 && v.count >= 2) {
        rec = 'Hạ bậc BXXL tháng xuống loại C (-10 điểm), trừ 30 điểm năng lực; tạm dừng vận hành cẩu để sát hạch quy trình an toàn.';
      } else if (v.highSeverityCount >= 1) {
        rec = 'Hạ bậc BXXL tháng xuống loại b (-5 điểm), trừ 15 điểm năng lực do để xảy ra sự cố nghiêm trọng đối với thiết bị cẩu khung hoặc nội quy.';
      } else {
        rec = 'Vi phạm lặp lại trong kỳ (≥2 lần): Khiển trách trong buổi giao ca, hạ 1 bậc BXXL và trừ 15 điểm năng lực cá nhân.';
      }

      return {
        name: v.name,
        normalizedName: v.normalizedName,
        employeeCode: v.employeeCode,
        department: v.department,
        count: v.count,
        equipment: Array.from(v.equipment).join(', ') || undefined,
        severities: Array.from(new Set(v.severities)),
        recommendations: rec,
      };
    });

  // Khuyến nghị chung
  let generalRec = `1. Hệ thống đã đối soát dữ liệu và trích xuất thành công **${rtgItems.length}** vụ việc thuộc Tổ RTG (Đã loại bỏ ${nonRtgIgnoredCount} dòng ngoài Tổ RTG).\n`;
  if (repeatViolators.length > 0) {
    generalRec += `2. Cần đặc biệt lưu ý ${repeatViolators.length} nhân sự Tổ RTG thuộc diện vi phạm nhiều lần hoặc gây sự cố nghiêm trọng (${repeatViolators.map((r) => `${r.name}${r.employeeCode ? ` [${r.employeeCode}]` : ''}`).join(', ')}).\n`;
    generalRec += `3. Đề nghị Hội đồng thi đua Đội Cơ Giới áp dụng hạ bậc BXXL tháng (loại b hoặc C) và đồng bộ trừ điểm năng lực cá nhân theo đúng quy định.`;
  } else {
    generalRec += `2. Không có nhân viên Tổ RTG nào vi phạm từ 2 lần trở lên trong kỳ. Nhắc nhở toàn tổ rút kinh nghiệm trong buổi giao ca đầu giờ.`;
  }

  return {
    id: `rep-${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    totalIncidents: rtgItems.length,
    rtgIncidentsCount: rtgItems.length,
    matchedCount: rtgItems.filter((i) => i.isMatchedWithSystem).length,
    unmatchedOrNonRtgCount: nonRtgIgnoredCount,
    nonRtgIgnoredCount,
    totalFileRows: totalFileRows || (rtgItems.length + nonRtgIgnoredCount),
    repeatViolators,
    recommendations: generalRec,
    items: rtgItems,
  };
}

/**
 * =========================================================================
 * XUẤT ĐỊNH DẠNG BẢNG MARKDOWN CHUẨN 8 CỘT CHO TỔ RTG
 * =========================================================================
 */
export function generateMarkdownTable(report: IncidentAnalysisReport): string {
  const rtgItems = report.items.filter((i) => i.isMatchedWithSystem || i.isRtgRelated);

  if (!rtgItems || rtgItems.length === 0) {
    return 'Không có dữ liệu sự việc nào liên quan đến danh sách nhân sự được cung cấp.';
  }

  let md = `| STT | Thời gian, Địa điểm | Diễn biến vụ việc | Hậu quả | Nguyên nhân | Trách nhiệm | Đơn vị quản lý | Biện pháp xử lý khắc phục | Phân loại |\n`;
  md += `|:---:|---|---|---|---|---|---|---|---|\n`;

  rtgItems.forEach((item, index) => {
    const stt = index + 1;
    const timeLoc = (
      item.timeAndLocation ||
      [item.time, item.location].filter(Boolean).join(', ') ||
      item.time ||
      item.location ||
      ''
    )
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const progression = (item.incidentProgression || item.what || '')
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const consequence = (item.consequence || item.what || '')
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const cause = (item.cause || item.why || '')
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const resp = (
      item.responsibility ||
      (item.equipment ? `${item.normalizedName || item.violatorName} (${item.equipment})` : item.normalizedName || item.violatorName)
    )
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const managingUnit = (
      item.managingUnit ||
      item.matchedDepartment ||
      item.department ||
      'Đội cơ giới (Tổ RTG)'
    )
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const correctiveAction = (item.correctiveAction || item.how || '')
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    const classification = (
      item.classification ||
      (item.sourceAppendix === 'PHU_LUC_1' ? 'Sự cố / TNLĐ' : 'Vi phạm nội quy')
    )
      .replace(/\|/g, '-')
      .replace(/\r?\n/g, ' ')
      .trim();

    md += `| ${stt} | ${timeLoc} | ${progression} | ${consequence} | ${cause} | ${resp} | ${managingUnit} | ${correctiveAction} | ${classification} |\n`;
  });

  md += `\n### Tóm tắt sau bảng:\n`;
  md += `1. **Tổng số vụ việc/vi phạm của Tổ RTG trong kỳ/tháng**: **${report.rtgIncidentsCount}** vụ việc.\n`;

  if (report.repeatViolators.length > 0) {
    md += `2. **Danh sách các nhân viên Tổ RTG vi phạm nhiều lần hoặc gây sự cố nghiêm trọng** (làm cơ sở hạ bậc đánh giá hồ sơ năng lực KPI/Thưởng phạt):\n`;
    report.repeatViolators.forEach((rv) => {
      const codeStr = rv.employeeCode ? ` [Mã NV: ${rv.employeeCode}]` : '';
      const equipStr = rv.equipment ? ` (Thiết bị: ${rv.equipment})` : '';
      md += `   - **${rv.name}**${codeStr}: ${rv.count} vụ việc${equipStr} - Khuyến nghị: ${rv.recommendations}\n`;
    });
  } else {
    md += `2. **Danh sách nhân viên vi phạm nhiều lần**: Không ghi nhận nhân viên Tổ RTG nào vi phạm từ 2 lần trở lên hoặc gây sự cố nghiêm trọng trong kỳ.\n`;
  }

  return md;
}

/**
 * Xuất dữ liệu dưới định dạng TSV chuẩn 8 cột để người dùng Copy và Paste trực tiếp vào Excel
 */
export function generateExcelTsvTable(report: IncidentAnalysisReport): string {
  const rtgItems = report.items.filter((i) => i.isMatchedWithSystem || i.isRtgRelated);
  if (!rtgItems || rtgItems.length === 0) {
    return 'Không có dữ liệu sự việc nào liên quan đến danh sách nhân sự được cung cấp.';
  }

  const headers = [
    'STT',
    'Thời gian, Địa điểm',
    'Diễn biến vụ việc',
    'Hậu quả',
    'Nguyên nhân',
    'Trách nhiệm',
    'Đơn vị quản lý',
    'Biện pháp xử lý khắc phục',
    'Phân loại',
  ];

  const rows = rtgItems.map((item, idx) => {
    const timeLoc = item.timeAndLocation || [item.time, item.location].filter(Boolean).join(', ') || '';
    const progression = item.incidentProgression || item.what || '';
    const consequence = item.consequence || '';
    const cause = item.cause || item.why || '';
    const resp = item.responsibility || (item.equipment ? `${item.normalizedName || item.violatorName} (${item.equipment})` : item.normalizedName || item.violatorName);
    const unit = item.managingUnit || item.matchedDepartment || item.department || 'Đội cơ giới (Tổ RTG)';
    const corrective = item.correctiveAction || item.how || '';
    const classification = item.classification || (item.sourceAppendix === 'PHU_LUC_1' ? 'Sự cố / TNLĐ' : 'Vi phạm nội quy');

    return [
      idx + 1,
      timeLoc.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      progression.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      consequence.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      cause.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      resp.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      unit.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      corrective.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
      classification.replace(/\t/g, ' ').replace(/\r?\n/g, ' '),
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}

/**
 * =========================================================================
 * DỮ LIỆU MẪU ĐỐI SOÁT CHUẨN VỚI NHÂN VIÊN HỆ THỐNG
 * =========================================================================
 */
export function generateSamplePortIncidents(systemEmployees: Employee[] = []): IncidentViolation[] {
  const candidates = getSystemCandidates(systemEmployees);

  const tuan = candidates.find((e) => e.fullName === 'Nhân viên mẫu 01') || {
    id: 'demo-employee-01',
    employeeCode: 'DEMO-001',
    fullName: 'Nhân viên mẫu 01',
    department: 'RTG ca 2',
    position: 'Lái cẩu RTG',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  };

  const tung = candidates.find((e) => e.fullName === 'Nhân viên mẫu 02') || {
    id: 'demo-employee-02',
    employeeCode: 'DEMO-002',
    fullName: 'Nhân viên mẫu 02',
    department: 'RTG ca 2',
    position: 'Lái cẩu RTG',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  };

  const quang = candidates.find((e) => e.fullName === 'Nhân viên mẫu 03') || {
    id: 'demo-employee-03',
    employeeCode: 'DEMO-003',
    fullName: 'Nhân viên mẫu 03',
    department: 'RTG ca 1',
    position: 'Lái cẩu RTG',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  };

  const nhuong = candidates.find((e) => e.fullName === 'Nhân viên mẫu 04') || {
    id: 'demo-employee-04',
    employeeCode: 'DEMO-004',
    fullName: 'Nhân viên mẫu 04',
    department: 'RTG ca 2',
    position: 'Lái cẩu RTG',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  };

  const hoang = candidates.find((e) => e.fullName === 'Nhân viên mẫu 05') || {
    id: 'demo-employee-05',
    employeeCode: 'DEMO-005',
    fullName: 'Nhân viên mẫu 05',
    department: 'RTG ca 1',
    position: 'Lái cẩu RTG',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  };

  return [
    {
      id: 'sample-01',
      code: 'SC-2026-001',
      time: '08:30 05/03/2026',
      location: 'Block B04 - Lane 02 (Bãi Cảng)',
      timeAndLocation: '08:30 05/03/2026, Block B04 - Lane 02 (Bãi Cảng)',
      incidentProgression: 'Va quẹt gầu cẩu khung RTG vào rơ moóc xe đầu kéo số 15 khi đang hạ container 40 feet',
      consequence: 'Móp nhẹ thành xe đầu kéo, chậm giải phóng hàng 20 phút',
      cause: 'Thiếu quan sát khoảng cách an toàn, không có tín hiệu xi nhan phụ trợ từ hoa tiêu',
      responsibility: 'Nhân viên mẫu 01 (RTG 02)',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Lập biên bản sự cố, tạm đình chỉ ca trực để viết bản kiểm điểm, trừ điểm KPI tháng',
      classification: 'Sự cố thiết bị / TNLĐ',
      violatorName: tuan.fullName,
      normalizedName: tuan.fullName,
      originalName: 'Nhân viên mẫu 01',
      matchedEmployeeId: tuan.id,
      matchedEmployeeCode: tuan.employeeCode,
      matchedEmployeeName: tuan.fullName,
      matchedDepartment: tuan.department,
      matchedPosition: tuan.position,
      matchedAvatar: tuan.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: 'RTG 02',
      what: 'Va quẹt gầu cẩu khung RTG vào rơ moóc xe đầu kéo số 15 khi đang hạ container 40 feet, móp nhẹ thành xe',
      why: 'Thiếu quan sát khoảng cách an toàn, không có tín hiệu xi nhan phụ trợ từ hoa tiêu',
      how: 'Lập biên bản sự cố, tạm đình chỉ ca trực để viết bản kiểm điểm, trừ điểm KPI tháng',
      sourceAppendix: 'PHU_LUC_1',
      isRtgRelated: true,
      severity: 'NGHIEM_TRONG',
      isSyncedToProfile: true,
    },
    {
      id: 'sample-02a',
      code: 'VP-2026-002-A',
      time: '22/08/2026 - 23/08/2026',
      location: 'Đoàn tham quan du lịch đợt 1 - 2026',
      timeAndLocation: '22/08/2026 - 23/08/2026, Đoàn tham quan du lịch đợt 1 - 2026',
      incidentProgression: 'Mâu thuẫn, xô xát va chạm với đồng nghiệp trong quá trình tham gia hoạt động đoàn tham quan du lịch',
      consequence: 'Gây mất trật tự đoàn thể, ảnh hưởng uy tín tập thể Đội cơ giới',
      cause: 'Mâu thuẫn phát sinh khi chơi bài và sử dụng rượu bia, không làm chủ được cảm xúc và hành vi',
      responsibility: 'Nhân viên mẫu 02',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Yêu cầu viết bản tường trình, kiểm điểm trước tập thể Đội cơ giới, hạ 1 bậc BXXL tháng',
      classification: 'Vi phạm nội quy lao động',
      violatorName: tung.fullName,
      normalizedName: tung.fullName,
      originalName: 'Nhân viên mẫu 02',
      matchedEmployeeId: tung.id,
      matchedEmployeeCode: tung.employeeCode,
      matchedEmployeeName: tung.fullName,
      matchedDepartment: tung.department,
      matchedPosition: tung.position,
      matchedAvatar: tung.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: '',
      what: 'Mâu thuẫn, xô xát va chạm với đồng nghiệp trong quá trình tham gia hoạt động đoàn tham quan du lịch',
      why: 'Mâu thuẫn phát sinh khi chơi bài và sử dụng rượu bia, không làm chủ được cảm xúc và hành vi',
      how: 'Yêu cầu viết bản tường trình, kiểm điểm trước tập thể Đội cơ giới, hạ 1 bậc BXXL tháng',
      sourceAppendix: 'PHU_LUC_2',
      isRtgRelated: true,
      severity: 'NGHIEM_TRONG',
      isSyncedToProfile: true,
    },
    {
      id: 'sample-02b',
      code: 'VP-2026-002-B',
      time: '22/08/2026 - 23/08/2026',
      location: 'Đoàn tham quan du lịch đợt 1 - 2026',
      timeAndLocation: '22/08/2026 - 23/08/2026, Đoàn tham quan du lịch đợt 1 - 2026',
      incidentProgression: 'Mâu thuẫn, xô xát va chạm với đồng nghiệp trong quá trình tham gia hoạt động đoàn tham quan du lịch',
      consequence: 'Gây mất trật tự đoàn thể, ảnh hưởng uy tín tập thể Đội cơ giới',
      cause: 'Mâu thuẫn phát sinh khi chơi bài và sử dụng rượu bia, không làm chủ được cảm xúc và hành vi',
      responsibility: 'Nhân viên mẫu 03',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Yêu cầu viết bản tường trình, kiểm điểm trước tập thể Đội cơ giới, hạ 1 bậc BXXL tháng',
      classification: 'Vi phạm nội quy lao động',
      violatorName: quang.fullName,
      normalizedName: quang.fullName,
      originalName: 'Nhân viên mẫu 03',
      matchedEmployeeId: quang.id,
      matchedEmployeeCode: quang.employeeCode,
      matchedEmployeeName: quang.fullName,
      matchedDepartment: quang.department,
      matchedPosition: quang.position,
      matchedAvatar: quang.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: '',
      what: 'Mâu thuẫn, xô xát va chạm với đồng nghiệp trong quá trình tham gia hoạt động đoàn tham quan du lịch',
      why: 'Mâu thuẫn phát sinh khi chơi bài và sử dụng rượu bia, không làm chủ được cảm xúc và hành vi',
      how: 'Yêu cầu viết bản tường trình, kiểm điểm trước tập thể Đội cơ giới, hạ 1 bậc BXXL tháng',
      sourceAppendix: 'PHU_LUC_2',
      isRtgRelated: true,
      severity: 'NGHIEM_TRONG',
      isSyncedToProfile: true,
    },
    {
      id: 'sample-03',
      code: 'VP-2026-003',
      time: '14:15 10/03/2026',
      location: 'Block A02 - Cabin RTG 05',
      timeAndLocation: '14:15 10/03/2026, Block A02 - Cabin RTG 05',
      incidentProgression: 'Không mang đầy đủ dây đai an toàn và mũ bảo hộ khi di chuyển lên thang cabin cẩu RTG 05',
      consequence: 'Nguy cơ mất an toàn lao động trên cao',
      cause: 'Chủ quan coi nhẹ quy tắc an toàn bảo hộ lao động trên cao',
      responsibility: 'Nhân viên mẫu 04 (RTG 05)',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Nhắc nhở, lập biên bản vi phạm nội quy an toàn, trừ 15 điểm năng lực kỷ luật',
      classification: 'Vi phạm nội quy lao động',
      violatorName: nhuong.fullName,
      normalizedName: nhuong.fullName,
      originalName: nhuong.fullName,
      matchedEmployeeId: nhuong.id,
      matchedEmployeeCode: nhuong.employeeCode,
      matchedEmployeeName: nhuong.fullName,
      matchedDepartment: nhuong.department,
      matchedPosition: nhuong.position,
      matchedAvatar: nhuong.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: 'RTG 05',
      what: 'Không mang đầy đủ dây đai an toàn và mũ bảo hộ khi di chuyển lên thang cabin cẩu RTG 05',
      why: 'Chủ quan coi nhẹ quy tắc an toàn bảo hộ lao động trên cao',
      how: 'Nhắc nhở, lập biên bản vi phạm nội quy an toàn, trừ 15 điểm năng lực kỷ luật',
      sourceAppendix: 'PHU_LUC_2',
      isRtgRelated: true,
      severity: 'TRUNG_BINH',
      isSyncedToProfile: true,
    },
    {
      id: 'sample-04',
      code: 'SC-2026-004',
      time: '21:45 14/03/2026',
      location: 'Block B02 - Cẩu RTG 02',
      timeAndLocation: '21:45 14/03/2026, Block B02 - Cẩu RTG 02',
      incidentProgression: 'Hạ container lệch vị trí chốt khóa twistlock, làm cong thanh dẫn hướng bãi',
      consequence: 'Cong thanh dẫn hướng bãi, cản trở di chuyển container tiếp theo',
      cause: 'Vận hành tốc độ cao trong ca đêm, không giảm tốc ở cự ly tiếp xúc an toàn',
      responsibility: 'Nhân viên mẫu 01 (RTG 02)',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Vi phạm lần 2 trong tháng: Đề xuất hạ bậc BXXL tháng xuống loại C, bồi thường chi phí nắn thanh dẫn hướng',
      classification: 'Sự cố thiết bị / TNLĐ',
      violatorName: tuan.fullName,
      normalizedName: tuan.fullName,
      originalName: 'Nhân viên mẫu 01',
      matchedEmployeeId: tuan.id,
      matchedEmployeeCode: tuan.employeeCode,
      matchedEmployeeName: tuan.fullName,
      matchedDepartment: tuan.department,
      matchedPosition: tuan.position,
      matchedAvatar: tuan.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: 'RTG 02',
      what: 'Hạ container lệch vị trí chốt khóa twistlock, làm cong thanh dẫn hướng bãi',
      why: 'Vận hành tốc độ cao trong ca đêm, không giảm tốc ở cự ly tiếp xúc an toàn',
      how: 'Vi phạm lần 2 trong tháng: Đề xuất hạ bậc BXXL tháng xuống loại C, bồi thường chi phí nắn thanh dẫn hướng',
      sourceAppendix: 'PHU_LUC_1',
      isRtgRelated: true,
      severity: 'NGHIEM_TRONG',
      isSyncedToProfile: true,
    },
    {
      id: 'sample-05',
      code: 'VP-2026-005',
      time: '10:00 18/03/2026',
      location: 'Khu vực Block C01',
      timeAndLocation: '10:00 18/03/2026, Khu vực Block C01',
      incidentProgression: 'Sử dụng điện thoại cá nhân trong lúc điều khiển cẩu khung gắp container',
      consequence: 'Nguy cơ cao gây va chạm hoặc rơi lệch container',
      cause: 'Không tuân thủ nghiêm ngặt nội quy cấm sử dụng điện thoại khi vận hành thiết bị nặng',
      responsibility: 'Nhân viên mẫu 05 (RTG 08)',
      managingUnit: 'Đội cơ giới (Tổ RTG)',
      correctiveAction: 'Lập biên bản vi phạm kỷ luật lao động, đình chỉ điều khiển 01 ca',
      classification: 'Vi phạm nội quy lao động',
      violatorName: hoang.fullName,
      normalizedName: hoang.fullName,
      originalName: hoang.fullName,
      matchedEmployeeId: hoang.id,
      matchedEmployeeCode: hoang.employeeCode,
      matchedEmployeeName: hoang.fullName,
      matchedDepartment: hoang.department,
      matchedPosition: hoang.position,
      matchedAvatar: hoang.avatar,
      isMatchedWithSystem: true,
      department: 'Đội cơ giới (Tổ RTG)',
      equipment: 'RTG 08',
      what: 'Sử dụng điện thoại cá nhân trong lúc điều khiển cẩu khung gắp container',
      why: 'Không tuân thủ nghiêm ngặt nội quy cấm sử dụng điện thoại khi vận hành thiết bị nặng',
      how: 'Lập biên bản vi phạm kỷ luật lao động, đình chỉ điều khiển 01 ca',
      sourceAppendix: 'PHU_LUC_2',
      isRtgRelated: true,
      severity: 'TRUNG_BINH',
      isSyncedToProfile: true,
    },
  ];
}

/**
 * =========================================================================
 * XUẤT FILE EXCEL (.XLSX) PHÂN TÍCH SỰ CỐ & VI PHẠM TỔ RTG
 * =========================================================================
 */
export function exportViolationsToExcel(report: IncidentAnalysisReport) {
  const rtgItems = report.items.filter((i) => i.isMatchedWithSystem || i.isRtgRelated);

  const headers = [
    'STT',
    'Thời gian, Địa điểm',
    'Diễn biến vụ việc',
    'Hậu quả',
    'Nguyên nhân',
    'Trách nhiệm',
    'Đơn vị quản lý',
    'Biện pháp xử lý khắc phục',
    'Phân loại',
  ];

  const rows = rtgItems.map((item, idx) => {
    const timeLoc = item.timeAndLocation || [item.time, item.location].filter(Boolean).join(', ') || '';
    const progression = item.incidentProgression || item.what || '';
    const consequence = item.consequence || '';
    const cause = item.cause || item.why || '';
    const resp = item.responsibility || (item.equipment ? `${item.normalizedName || item.violatorName} (${item.equipment})` : item.normalizedName || item.violatorName);
    const unit = item.managingUnit || item.matchedDepartment || item.department || 'Đội cơ giới (Tổ RTG)';
    const corrective = item.correctiveAction || item.how || '';
    const classification = item.classification || (item.sourceAppendix === 'PHU_LUC_1' ? 'Sự cố / TNLĐ' : 'Vi phạm nội quy');

    return [
      idx + 1,
      timeLoc,
      progression,
      consequence,
      cause,
      resp,
      unit,
      corrective,
      classification,
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = [
    { wch: 8 },  // STT
    { wch: 25 }, // Thời gian, Địa điểm
    { wch: 45 }, // Diễn biến vụ việc
    { wch: 30 }, // Hậu quả
    { wch: 35 }, // Nguyên nhân
    { wch: 25 }, // Trách nhiệm
    { wch: 22 }, // Đơn vị quản lý
    { wch: 35 }, // Biện pháp xử lý khắc phục
    { wch: 18 }, // Phân loại
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sự Cố & Vi Phạm Tổ RTG');

  // Sheet 2: Danh sách vi phạm lặp lại & khuyến nghị BXXL
  const recHeaders = ['STT', 'Họ và tên', 'Mã NV', 'Bộ phận', 'Số vụ việc', 'Thiết bị liên quan', 'Khuyến nghị BXXL & Hồ sơ'];
  const recRows = report.repeatViolators.map((r, idx) => [
    idx + 1,
    r.name,
    r.employeeCode || '',
    r.department || '',
    r.count,
    r.equipment || 'RTG',
    r.recommendations,
  ]);
  const recSheet = XLSX.utils.aoa_to_sheet([recHeaders, ...recRows]);
  recSheet['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, recSheet, 'Danh Sách Hạ Bậc BXXL');

  XLSX.writeFile(workbook, `Bao_Cao_Su_Co_Vi_Pham_To_RTG_${new Date().toISOString().substring(0, 10)}.xlsx`);
}
