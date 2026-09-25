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
