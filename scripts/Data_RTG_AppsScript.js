/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT CHO FILE "Data_RTG" (CẢNG CONTAINER TỔ RTG)
 * =========================================================================================
 * Hướng dẫn cài đặt vào Google Sheets:
 * 1. Mở file Google Sheet Data_RTG trên trình duyệt.
 * 2. Chọn menu: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết mã cũ trong file Code.gs (nếu có), sao chép toàn bộ mã nguồn này và DÁN vào.
 * 4. Nhấn biểu tượng Lưu (Save - Ctrl+S).
 * 5. Nhấn "Chạy" (Run) hàm "onOpen" hoặc tải lại trang Google Sheet.
 *    -> Thanh công cụ sẽ xuất hiện Menu: "🚢 QUẢN LÝ RTG - HICT".
 * 6. (Tùy chọn Webhook) Nhấn "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
 *    -> Chọn loại: Ứng dụng web (Web app)
 *    -> Thực thi dưới dạng: Tôi (Me)
 *    -> Ai có quyền truy cập: Bất kỳ ai (Anyone)
 *    -> Sao chép URL Webhook dán vào hệ thống quanlyrtg.
 * =========================================================================================
 */

// TÊN CÁC TAB CHUẨN TRONG HỆ THỐNG
const TABS = {
  DASHBOARD: 'Dashboard',
  NHAN_SU: 'ThongTinNhanSu',
  VI_PHAM: 'TheoDoiViPham',
  KET_QUA_THI: 'KetQuaThi',
  SANG_KIEN: 'GopYSangKien',
  BINH_XET: 'BinhXetXepLoai',
  NGHI_PHEP: 'DangKyNghiPhep',
  CALC: 'Calc_Dashboard',
};

// CÁC TIÊU ĐỀ CỘT CHUẨN
const HEADERS = {
  NHAN_SU: [
    'STT', 'Họ và Tên', 'Mã nhân sự', 'Tên đăng nhập', 'Cột E bỏ qua',
    'Chức danh', 'Bộ phận', 'Vai trò', 'Số điện thoại',
    'Điểm năng lực', 'Bài thi đạt', 'Vi phạm', 'Sáng kiến'
  ],
  VI_PHAM: [
    'Mã vụ việc', 'Thời gian (When)', 'Địa điểm (Where)', 'Mã nhân sự',
    'Họ và tên vi phạm (Who)', 'Đơn vị / Ca trực', 'Chức danh', 'Thiết bị cẩu',
    'Mô tả Vi phạm / Diễn biến & Hậu quả (What)', 'Nguyên nhân cốt lõi (Why)',
    'Biện pháp xử lý & Khắc phục (How)', 'Mức độ nghiêm trọng', 'Phân loại (Phụ lục)', 'Thời gian đồng bộ'
  ],
  KET_QUA_THI: [
    'Mã Bài Thi', 'Tiêu Đề Bài Thi', 'Mã Nhân Sự', 'Họ và Tên Thí Sinh',
    'Bộ Phận / Ca', 'Điểm Số', 'Kết Quả', 'Số Câu Đúng', 'Tổng Số Câu',
    'Xếp Loại Năng Lực', 'Thời Gian Nộp Bài'
  ],
  SANG_KIEN: [
    'Mã Góp Ý', 'Thời Gian Gửi', 'Tiêu Đề', 'Phân Loại', 'Nội Dung Ý Kiến / Sáng Kiến',
    'Người Gửi', 'Phòng Ban', 'Trạng Thái Xử Lý', 'Người Phản Hồi', 'Ý Kiến Phản Hồi Admin'
  ],
  BINH_XET: [
    'Mã Biên Bản', 'Tháng Bình Xét', 'Mã Nhân Viên', 'Họ và Tên',
    'Đơn Vị / Ca', 'Xếp Loại (A/a/B/b/C/GPT)', 'Lý Do / Đánh Giá',
    'Người Lập Biên Bản', 'Thời Gian Tạo'
  ],
  NGHI_PHEP: [
    'Mã Đơn', 'Mã Nhân Sự', 'Họ và Tên', 'Bộ Phận / Ca', 'Loại Nghỉ Phép',
    'Từ Ngày', 'Đến Ngày', 'Số Ngày Nghỉ', 'Lý Do', 'Người Thay Thế',
    'Trạng Thái', 'Người Duyệt', 'Thời Gian Tạo'
  ]
};

/**
 * Tự động tạo Menu khi mở Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚢 QUẢN LÝ RTG - HICT')
    .addItem('🚀 1. Chuẩn hóa & Khởi tạo cấu trúc 8 Sheet', 'setupSpreadsheetStructure')
    .addItem('🔄 2. Tính toán lại Điểm Năng Lực & Đồng bộ Dashboard', 'recalculateCompetencyAndDashboard')
    .addItem('🧹 3. Dọn dẹp các Tab bị trùng lặp (Gộp dữ liệu)', 'cleanupDuplicateTabs')
    .addSeparator()
    .addItem('ℹ️ 4. Kiểm tra liên kết dữ liệu & Báo cáo lỗi', 'checkDataIntegrity')
    .addToUi();
}

/**
 * 1. Khởi tạo và chuẩn hóa cấu trúc 8 Sheet theo quy chuẩn hệ thống quanlyrtg
 */
function setupSpreadsheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Dọn dẹp tên tab trước
  cleanupDuplicateTabs();

  // Tạo và định dạng từng tab dữ liệu
  ensureTabWithHeaders(ss, TABS.NHAN_SU, HEADERS.NHAN_SU, '#1E3A8A');
  ensureTabWithHeaders(ss, TABS.VI_PHAM, HEADERS.VI_PHAM, '#DC2626');
  ensureTabWithHeaders(ss, TABS.KET_QUA_THI, HEADERS.KET_QUA_THI, '#0284C7');
  ensureTabWithHeaders(ss, TABS.SANG_KIEN, HEADERS.SANG_KIEN, '#D97706');
  ensureTabWithHeaders(ss, TABS.BINH_XET, HEADERS.BINH_XET, '#7C3AED');
  ensureTabWithHeaders(ss, TABS.NGHI_PHEP, HEADERS.NGHI_PHEP, '#059669');

  // Đảm bảo tab Calc_Dashboard
  setupCalcDashboard(ss);

  // Tính lại điểm
  recalculateCompetencyAndDashboard();

  SpreadsheetApp.getUi().alert('✅ ĐÃ CHUẨN HÓA CẤU TRÚC!\nTất cả 8 sheet dữ liệu đã được cấu hình đúng chuẩn tên và định dạng.');
}

/**
 * Tạo Tab nếu chưa có và định dạng Header
 */
function ensureTabWithHeaders(ss, tabName, headers, headerColor) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  
  // Đặt header dòng 1
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground(headerColor);
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');
  range.setWrap(true);
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  // Tự động căn chỉnh độ rộng cột
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
    const w = sheet.getColumnWidth(c);
    sheet.setColumnWidth(c, Math.max(w + 15, 110));
  }
  return sheet;
}

/**
 * 2. Tính toán Điểm Năng Lực và tổng hợp số liệu cho Dashboard
 */
function recalculateCompetencyAndDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nsSheet = ss.getSheetByName(TABS.NHAN_SU);
  const vpSheet = ss.getSheetByName(TABS.VI_PHAM);
  const thiSheet = ss.getSheetByName(TABS.KET_QUA_THI);
  const skSheet = ss.getSheetByName(TABS.SANG_KIEN);

  if (!nsSheet) {
    SpreadsheetApp.getUi().alert('❌ Không tìm thấy sheet ' + TABS.NHAN_SU);
    return;
  }

  const lastRow = nsSheet.getLastRow();
  if (lastRow <= 1) return;

  const empData = nsSheet.getRange(2, 1, lastRow - 1, HEADERS.NHAN_SU.length).getValues();

  // Đọc danh sách vi phạm
  const vpCounts = {};
  if (vpSheet && vpSheet.getLastRow() > 1) {
    const vpRows = vpSheet.getRange(2, 1, vpSheet.getLastRow() - 1, 5).getValues();
    vpRows.forEach(row => {
      const code = String(row[3] || '').trim(); // Cột D: Mã nhân sự
      const name = normalizeEmployeeName(String(row[4] || '').trim()); // Cột E: Họ tên
      if (code) vpCounts[code] = (vpCounts[code] || 0) + 1;
      if (name) vpCounts[name] = (vpCounts[name] || 0) + 1;
    });
  }

  // Đọc danh sách bài thi đạt
  const thiCounts = {};
  if (thiSheet && thiSheet.getLastRow() > 1) {
    const thiRows = thiSheet.getRange(2, 1, thiSheet.getLastRow() - 1, 7).getValues();
    thiRows.forEach(row => {
      const code = String(row[2] || '').trim(); // Cột C: Mã nhân sự
      const name = normalizeEmployeeName(String(row[3] || '').trim()); // Cột D: Họ tên
      const result = String(row[6] || '').toUpperCase(); // Cột G: Kết quả
      if (result.includes('ĐẠT') || result === 'PASS') {
        if (code) thiCounts[code] = (thiCounts[code] || 0) + 1;
        if (name) thiCounts[name] = (thiCounts[name] || 0) + 1;
      }
    });
  }

  // Đọc danh sách sáng kiến
  const skCounts = {};
  if (skSheet && skSheet.getLastRow() > 1) {
    const skRows = skSheet.getRange(2, 1, skSheet.getLastRow() - 1, 6).getValues();
    skRows.forEach(row => {
      const author = normalizeEmployeeName(String(row[5] || '').trim()); // Cột F: Người gửi
      if (author) skCounts[author] = (skCounts[author] || 0) + 1;
    });
  }

  // Cập nhật lại cho từng nhân sự
  let updatedCount = 0;
  for (let i = 0; i < empData.length; i++) {
    const empName = normalizeEmployeeName(String(empData[i][1] || '').trim());
    const empCode = String(empData[i][2] || '').trim();

    // Chuẩn hóa tên "Phạm Ngọc Tuấn" -> "Phạm Ngọc Tuân"
    empData[i][1] = empName;

    // Chuẩn hóa ca kíp
    empData[i][6] = normalizeDepartment(empData[i][6]);

    const numPass = (empCode ? thiCounts[empCode] : 0) || (empName ? thiCounts[empName] : 0) || 0;
    const numViol = (empCode ? vpCounts[empCode] : 0) || (empName ? vpCounts[empName] : 0) || 0;
    const numIdea = (empName ? skCounts[empName] : 0) || 0;

    // Công thức tính điểm năng lực chuẩn:
    // Điểm cơ bản = 85. +5 điểm cho mỗi bài thi đạt. +3 điểm cho mỗi sáng kiến. -10 điểm cho mỗi vi phạm.
    let score = 85 + (numPass * 5) + (numIdea * 3) - (numViol * 10);
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    // Cập nhật các cột:
    // Cột J (index 9): Điểm năng lực
    // Cột K (index 10): Bài thi đạt
    // Cột L (index 11): Vi phạm
    // Cột M (index 12): Sáng kiến
    empData[i][9] = score;
    empData[i][10] = numPass;
    empData[i][11] = numViol;
    empData[i][12] = numIdea;
    updatedCount++;
  }

  // Ghi ngược lại sheet ThongTinNhanSu
  nsSheet.getRange(2, 1, empData.length, HEADERS.NHAN_SU.length).setValues(empData);

  // Cập nhật Calc_Dashboard
  updateCalcDashboardValues(ss);

  SpreadsheetApp.getActiveSpreadsheet().toast('Đã cập nhật điểm năng lực cho ' + updatedCount + ' nhân sự.', 'Hoàn thành', 4);
}

/**
 * 3. Dọn dẹp và gộp các Tab bị trùng lặp tên
 */
function cleanupDuplicateTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Danh sách các cặp tab cũ cần gộp vào tab chuẩn
  const pairs = [
    { oldName: 'DanhSachNhanSu', standardName: TABS.NHAN_SU },
    { oldName: 'BaiThi_KiemTra', standardName: TABS.KET_QUA_THI },
    { oldName: 'BangXepXe_BXXL', standardName: TABS.BINH_XET },
    { oldName: 'BangXepLoai_BXXL', standardName: TABS.BINH_XET },
  ];

  pairs.forEach(pair => {
    const oldSheet = ss.getSheetByName(pair.oldName);
    const standardSheet = ss.getSheetByName(pair.standardName);

    if (oldSheet && !standardSheet) {
      // Nếu có tab cũ mà chưa có tab chuẩn: Đổi tên thành tab chuẩn
      oldSheet.setName(pair.standardName);
    } else if (oldSheet && standardSheet) {
      // Nếu có cả 2 tab: Nếu tab chuẩn trống thì copy từ tab cũ sang, sau đó đổi tên tab cũ thành _Backup
      if (standardSheet.getLastRow() <= 1 && oldSheet.getLastRow() > 1) {
        const data = oldSheet.getDataRange().getValues();
        standardSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      }
      try {
        oldSheet.setName(pair.oldName + '_Backup');
      } catch (e) {}
    }
  });
}

/**
 * 4. Thiết lập công thức bảng Calc_Dashboard nuôi dữ liệu cho Dashboard
 */
function setupCalcDashboard(ss) {
  let sheet = ss.getSheetByName(TABS.CALC);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.CALC);
  }
  updateCalcDashboardValues(ss);
}

function updateCalcDashboardValues(ss) {
  let sheet = ss.getSheetByName(TABS.CALC);
  if (!sheet) return;

  const headers = ['Ca làm việc', 'Số nhân sự', 'Điểm năng lực TB', 'Bài thi HT', 'Sáng kiến', 'Vi phạm'];
  const rows = [
    ['RTG ca 1',
     '=COUNTIF(ThongTinNhanSu!G:G, "RTG ca 1")',
     '=ROUND(AVERAGEIF(ThongTinNhanSu!G:G, "RTG ca 1", ThongTinNhanSu!J:J), 1)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 1", ThongTinNhanSu!K:K)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 1", ThongTinNhanSu!M:M)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 1", ThongTinNhanSu!L:L)'],
    ['RTG ca 2',
     '=COUNTIF(ThongTinNhanSu!G:G, "RTG ca 2")',
     '=ROUND(AVERAGEIF(ThongTinNhanSu!G:G, "RTG ca 2", ThongTinNhanSu!J:J), 1)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 2", ThongTinNhanSu!K:K)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 2", ThongTinNhanSu!M:M)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 2", ThongTinNhanSu!L:L)'],
    ['RTG ca 3',
     '=COUNTIF(ThongTinNhanSu!G:G, "RTG ca 3")',
     '=ROUND(AVERAGEIF(ThongTinNhanSu!G:G, "RTG ca 3", ThongTinNhanSu!J:J), 1)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 3", ThongTinNhanSu!K:K)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 3", ThongTinNhanSu!M:M)',
     '=SUMIF(ThongTinNhanSu!G:G, "RTG ca 3", ThongTinNhanSu!L:L)'],
    ['Tổng cộng / TB',
     '=SUM(B2:B4)',
     '=ROUND(AVERAGE(ThongTinNhanSu!J2:J), 1)',
     '=SUM(D2:D4)',
     '=SUM(E2:E4)',
     '=SUM(F2:F4)']
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground('#334155').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * 5. WEBHOOK NHẬN DỮ LIỆU TỪ ỨNG DỤNG QUANLYRTG (POST)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const module = payload.module;
    const items = payload.items || payload.data || [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (module === 'employees' || module === 'nhan_su') {
      appendOrUpdateEmployees(ss, items);
    } else if (module === 'incidents' || module === 'vi_pham') {
      appendViolations(ss, items);
    } else if (module === 'quizzes' || module === 'bai_thi') {
      appendQuizResults(ss, items);
    } else if (module === 'feedbacks' || module === 'sang_kien') {
      appendFeedbacks(ss, items);
    } else if (module === 'bxxl' || module === 'binh_xet') {
      appendBxxl(ss, items);
    } else if (module === 'all') {
      if (items.employees) appendOrUpdateEmployees(ss, items.employees);
      if (items.violations) appendViolations(ss, items.violations);
      if (items.quizzes) appendQuizResults(ss, items.quizzes);
      if (items.feedbacks) appendFeedbacks(ss, items.feedbacks);
      if (items.bxxl) appendBxxl(ss, items.bxxl);
    }

    recalculateCompetencyAndDashboard();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Đồng bộ dữ liệu thành công vào Data_RTG',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'Data_RTG Synchronization Hub',
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- CÁC HÀM TIỆN ÍCH CHUẨN HÓA ----------------

function normalizeEmployeeName(name) {
  if (!name) return '';
  let s = String(name).replace(/\s+/g, ' ').trim();
  if (s.toLowerCase() === 'phạm ngọc tuấn') return 'Phạm Ngọc Tuân';
  return s;
}

function normalizeDepartment(dept) {
  if (!dept) return 'RTG ca 1';
  const s = String(dept).toLowerCase().trim();
  if (s.includes('3') || s.includes('iii') || s.includes('ba')) return 'RTG ca 3';
  if (s.includes('2') || s.includes('ii') || s.includes('hai')) return 'RTG ca 2';
  return 'RTG ca 1';
}

function appendOrUpdateEmployees(ss, items) {
  const sheet = ss.getSheetByName(TABS.NHAN_SU);
  if (!sheet) return;
  const rows = items.map((e, index) => [
    index + 1,
    normalizeEmployeeName(e.fullName),
    e.employeeCode || '',
    e.username || '',
    '',
    e.position || 'Lái cẩu RTG',
    normalizeDepartment(e.department),
    e.role || 'USER',
    e.phone || e.zaloPhone || '',
    e.competencyScore || 85,
    e.quizzesCompleted || 0,
    e.violationCount || 0,
    e.proposalsCount || 0
  ]);
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.NHAN_SU.length).clearContent();
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, HEADERS.NHAN_SU.length).setValues(rows);
  }
}

function appendViolations(ss, items) {
  const sheet = ss.getSheetByName(TABS.VI_PHAM);
  if (!sheet) return;
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
  const rows = items.map(v => [
    v.code || '',
    v.time || '',
    v.location || '',
    v.matchedEmployeeCode || v.employeeCode || '',
    normalizeEmployeeName(v.violatorName || v.matchedEmployeeName || ''),
    normalizeDepartment(v.matchedDepartment || v.department),
    v.matchedPosition || 'Lái cẩu RTG',
    v.equipment || '',
    v.what || '',
    v.why || '',
    v.how || '',
    v.severity || 'Trung bình',
    v.sourceAppendix || 'Phụ lục 1 (Sự cố)',
    nowStr
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.VI_PHAM.length).setValues(rows);
  }
}

function appendQuizResults(ss, items) {
  const sheet = ss.getSheetByName(TABS.KET_QUA_THI);
  if (!sheet) return;
  const rows = items.map(s => [
    s.quizId || s.id || '',
    s.quizTitle || 'Bài kiểm tra quy trình',
    s.employeeCode || '',
    normalizeEmployeeName(s.fullName || s.employeeName || ''),
    normalizeDepartment(s.department),
    s.score || 0,
    s.passed ? 'ĐẠT' : 'CHƯA ĐẠT',
    s.correctCount || 0,
    s.totalQuestions || 0,
    s.competencyLevel || 'Đạt',
    s.submittedAt ? Utilities.formatDate(new Date(s.submittedAt), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss') : ''
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.KET_QUA_THI.length).setValues(rows);
  }
}

function appendFeedbacks(ss, items) {
  const sheet = ss.getSheetByName(TABS.SANG_KIEN);
  if (!sheet) return;
  const rows = items.map(f => [
    f.id || '',
    f.submittedAt ? Utilities.formatDate(new Date(f.submittedAt), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss') : '',
    f.title || '',
    f.category || 'Sáng kiến cải tiến',
    f.content || '',
    normalizeEmployeeName(f.authorName || ''),
    normalizeDepartment(f.authorDepartment),
    f.status || 'Chờ xử lý',
    f.adminResponse?.by || '',
    f.adminResponse?.comment || ''
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.SANG_KIEN.length).setValues(rows);
  }
}

function appendBxxl(ss, items) {
  const sheet = ss.getSheetByName(TABS.BINH_XET);
  if (!sheet) return;
  const rows = [];
  items.forEach(b => {
    const addList = (list, rate) => {
      if (!list) return;
      list.forEach(emp => {
        rows.push([
          b.id || '',
          b.evaluationMonth || '',
          emp.employeeCode || '',
          normalizeEmployeeName(emp.fullName || ''),
          normalizeDepartment(emp.department || b.departmentName),
          rate,
          emp.reason || '',
          b.creatorName || 'Tổ RTG',
          b.createdAt ? Utilities.formatDate(new Date(b.createdAt), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss') : ''
        ]);
      });
    };
    addList(b.listA, 'A');
    addList(b.listSmallA, 'a');
    addList(b.listB, 'B');
    addList(b.listSmallB, 'b');
    addList(b.listC, 'C');
    addList(b.listGpt, 'GPT');
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.BINH_XET.length).setValues(rows);
  }
}
