import { parseWorkbook } from '../services/excelProcessing';
import React, { useState, useRef, useMemo } from 'react';
import type { Employee } from '../types';
import {
  FileSpreadsheet,
  Upload,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  Database,
  ArrowRight,
  Boxes,
  HelpCircle,
  Eye,
  X,
  Search,
  Layers,
  Filter,
  Clock,
  MapPin,
  ArrowUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface YardBlockRow {
  blockA: string;
  countA: number | '';
  blockB: string;
  countB: number | '';
}

export interface ContainerItemDetail {
  id: string;
  containerNo: string;
  block: string;
  location: string;
  time: string; // Cột U trong file dữ liệu
  sizeType?: string;
  fe: string; // Full/Empty
  grossWeight: string;
  operator: string;
  loadlistFlag: string;
  rowIdx: number;
}

export interface YardProcessResult {
  fileName: string;
  processedAt: string;
  totalRowsRaw: number;
  totalValidContainers: number;
  totalIgnoredEmptyBlock: number;
  totalIgnoredNotInLoadlist: number;
  rows: YardBlockRow[];
  totalA: number;
  totalB: number;
  totalYard: number;
  containersByBlock: Record<string, ContainerItemDetail[]>;
}

/**
 * Tự động chuẩn hóa tên Block ở Cột S về chuẩn 2 chữ số (ví dụ: 'A1' -> 'A01', 'B2' -> 'B02')
 */
export function normalizeBlockName(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (!str) return '';

  // Nhận diện tiền tố chữ + số (ví dụ: A1, A01, B2, B12...)
  const match = str.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const formatted = num < 10 ? `0${num}` : `${num}`;
    return `${prefix}${formatted}`;
  }
  return str;
}

/**
 * Định dạng vị trí bãi (Bay-Row-Tier) phân cách theo:
 * 3 số đầu là bay, 2 số tiếp theo là row, 2 số cuối là tier
 * Ví dụ: 0260202 -> 026-02-02
 */
export function formatYardLocation(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Nếu đã có định dạng 3 số - 2 số - 2 số (ví dụ: 026-02-02)
  if (/^\d{3}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Chuỗi thuần 7 chữ số (ví dụ: 0260202 -> 026-02-02)
  if (/^\d{7}$/.test(str)) {
    return `${str.slice(0, 3)}-${str.slice(3, 5)}-${str.slice(5, 7)}`;
  }

  // Chuỗi chứa cụm 7 số (ví dụ: A01-0260202 hoặc A010260202)
  const match7 = str.match(/(?:^|[^\d])(\d{7})(?:$|[^\d])/);
  if (match7) {
    const digits = match7[1];
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
    return str.replace(digits, formatted);
  }

  // Nếu chuỗi kết thúc bằng 7 chữ số
  const matchTrailing = str.match(/^(.*?)(\d{3})(\d{2})(\d{2})$/);
  if (matchTrailing) {
    const prefix = matchTrailing[1].trim();
    const bay = matchTrailing[2];
    const row = matchTrailing[3];
    const tier = matchTrailing[4];
    return prefix ? `${prefix}-${bay}-${row}-${tier}` : `${bay}-${row}-${tier}`;
  }

  return str;
}

/**
 * Chuẩn hóa giá trị thời gian lấy từ Cột U trong file Excel
 */
export function formatYardTime(raw: any): string {
  if (raw === undefined || raw === null || raw === '') return '-';

  // Nếu là số serial date của Excel
  if (typeof raw === 'number') {
    try {
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const mi = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${mi} ${d}/${m}/${y}`;
      }
    } catch {
      return String(raw);
    }
  }

  const str = String(raw).trim();
  if (!str) return '-';

  // Nếu là chuỗi số serial
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 30000 && num < 60000) {
      try {
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          const d = date.getDate().toString().padStart(2, '0');
          const m = (date.getMonth() + 1).toString().padStart(2, '0');
          const y = date.getFullYear();
          const h = date.getHours().toString().padStart(2, '0');
          const mi = date.getMinutes().toString().padStart(2, '0');
          return `${h}:${mi} ${d}/${m}/${y}`;
        }
      } catch {
        // fallback
      }
    }
  }

  return str;
}

interface ContainerYardProcessorViewProps {
  currentUser?: Employee | null;
  onBackToDashboard?: () => void;
}

export const ContainerYardProcessorView: React.FC<ContainerYardProcessorViewProps> = ({
  currentUser,
  onBackToDashboard,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<YardProcessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal xem chi tiết từng Block
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [copiedModalList, setCopiedModalList] = useState(false);
  const [modalSortKey, setModalSortKey] = useState<'default' | 'time' | 'location'>('default');
  const [modalSortOrder, setModalSortOrder] = useState<'asc' | 'desc'>('asc');

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Quy trình xử lý dữ liệu ngầm theo Quy tắc:
   * 1. Xác định Cột S (BLOCK) và Cột AD (NOTIN_LOADLIST_FLG).
   * 2. Nhận diện các cột thông tin bổ trợ: Số Cont, Vị trí bãi, Kích cỡ, FE, Hãng tàu, Trọng lượng.
   * 3. Loại bỏ các dòng có Cột S để trống. LOẠI BỎ HOÀN TOÀN các dòng có chứa chữ 'Y' hoặc 'y' ở Cột AD.
   * 4. Tự động chuẩn hóa tên Block ở Cột S về chuẩn 2 chữ số (ví dụ: 'A1' -> 'A01', 'B2' -> 'B02').
   * 5. Lưu trữ danh sách container chi tiết theo từng Block để tra cứu khi nhấn vào Block.
   */
  const processExcelData = (rawRows: any[][], fileName: string) => {
    if (!rawRows || rawRows.length === 0) {
      throw new Error('Tệp Excel không có dữ liệu để xử lý.');
    }

    let colSIdx = 18; // Cột S (BLOCK)
    let colADIdx = 29; // Cột AD (NOTIN_LOADLIST_FLG)
    let colCntrIdx = 4; // Cột E (Số Container - Cố định theo Cột E trong file dữ liệu)
    let colLocIdx = 19; // Cột T (Vị trí bãi Bay-Row-Tier)
    let colTimeIdx = 20; // Cột U (Thời gian - Cố định theo Cột U trong file dữ liệu)
    let colSizeIdx = 4; // Kích cỡ / SZTP
    let colFEIdx = 5; // FE (Hàng/Rỗng)
    let colWeightIdx = 8; // Trọng lượng
    let colOprIdx = 2; // Hãng tàu
    let startRow = 0;

    // Quét 5 hàng đầu tiên xem có hàng tiêu đề để ánh xạ cột chính xác
    for (let r = 0; r < Math.min(6, rawRows.length); r++) {
      const row = rawRows[r] || [];
      const sVal = String(row[colSIdx] || '').trim().toUpperCase();
      const adVal = String(row[colADIdx] || '').trim().toUpperCase();

      const foundS = row.findIndex((c) => String(c).trim().toUpperCase() === 'BLOCK');
      const foundAD = row.findIndex(
        (c) =>
          String(c).trim().toUpperCase().includes('NOTIN_LOADLIST') ||
          String(c).trim().toUpperCase() === 'NOTIN_LOADLIST_FLG'
      );

      if (foundS !== -1) colSIdx = foundS;
      if (foundAD !== -1) colADIdx = foundAD;

      // Tìm vị trí bãi nếu có tên cột
      const foundLoc = row.findIndex((c) => {
        const str = String(c).trim().toUpperCase();
        return str === 'LOCATION' || str === 'YARD_LOC' || str === 'BAY_ROW_TIER' || str === 'POSITION' || str === 'VỊ TRÍ';
      });
      if (foundLoc !== -1) colLocIdx = foundLoc;

      const foundFE = row.findIndex((c) => {
        const str = String(c).trim().toUpperCase();
        return str === 'FE' || str === 'F/E' || str === 'STATUS' || str === 'FULL_EMPTY' || str === 'TRẠNG THÁI';
      });
      if (foundFE !== -1) colFEIdx = foundFE;

      const foundOpr = row.findIndex((c) => {
        const str = String(c).trim().toUpperCase();
        return str === 'OPR' || str === 'OPERATOR' || str === 'LINE' || str === 'HÃNG TÀU';
      });
      if (foundOpr !== -1) colOprIdx = foundOpr;

      const foundWt = row.findIndex((c) => {
        const str = String(c).trim().toUpperCase();
        return str === 'GROSS_WT' || str === 'GW' || str === 'WEIGHT' || str === 'TRỌNG LƯỢNG';
      });
      if (foundWt !== -1) colWeightIdx = foundWt;

      if (foundS !== -1 || foundAD !== -1 || sVal === 'BLOCK' || adVal.includes('NOTIN')) {
        startRow = r + 1;
        break;
      }
    }

    let ignoredEmpty = 0;
    let ignoredNotInLoadlist = 0;
    let totalValid = 0;

    const mapA = new Map<string, number>();
    const mapB = new Map<string, number>();
    const containersByBlock: Record<string, ContainerItemDetail[]> = {};

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const rawBlockVal = row[colSIdx];
      const rawBlockStr = String(rawBlockVal ?? '').trim();

      // 2. Loại bỏ các dòng có Cột S để trống
      if (!rawBlockStr || rawBlockStr === '' || rawBlockStr.toUpperCase() === 'BLOCK') {
        ignoredEmpty++;
        continue;
      }

      // LOẠI BỎ HOÀN TOÀN các dòng có chứa chữ 'Y' hoặc 'y' ở Cột AD
      const rawADVal = String(row[colADIdx] ?? '').trim().toUpperCase();
      if (rawADVal.includes('Y')) {
        ignoredNotInLoadlist++;
        continue;
      }

      // 3. Tự động chuẩn hóa tên Block ở Cột S về chuẩn 2 chữ số (ví dụ: 'A1' -> 'A01', 'B2' -> 'B02')
      const normalizedBlock = normalizeBlockName(rawBlockStr);

      // Trích xuất chi tiết container:
      // - Cột container lấy dữ liệu của cột E (index 4) trong file dữ liệu
      const rawCntrVal = (row[4] !== undefined && row[4] !== '') ? row[4] : (colCntrIdx !== -1 && row[colCntrIdx] !== undefined ? row[colCntrIdx] : '');
      const cntrNo = String(rawCntrVal ?? '').trim() || `CONT-${i + 1}`;

      // - Vị trí bãi (Bay-Row-Tier) phân cách 3 số đầu là bay, 2 số tiếp row, 2 số cuối tier (ví dụ: 0260202 -> 026-02-02)
      const rawLoc = String(row[colLocIdx] ?? row[19] ?? '').trim();
      const location = formatYardLocation(rawLoc);

      // - Cột thời gian lấy dữ liệu từ cột U (index 20) trong file dữ liệu
      const rawTimeVal = (row[20] !== undefined && row[20] !== '') ? row[20] : (colTimeIdx !== -1 && row[colTimeIdx] !== undefined ? row[colTimeIdx] : '');
      const time = formatYardTime(rawTimeVal);

      const sizeType = String(row[colSizeIdx] ?? '').trim();
      const fe = String(row[colFEIdx] ?? '').trim();
      const grossWeight = String(row[colWeightIdx] ?? '').trim();
      const operator = String(row[colOprIdx] ?? '').trim();

      const itemDetail: ContainerItemDetail = {
        id: `cntr-${i}-${normalizedBlock}`,
        containerNo: cntrNo,
        block: normalizedBlock,
        location: location || `${normalizedBlock}`,
        time: time,
        sizeType: sizeType || '40HC',
        fe: fe || 'F',
        grossWeight: grossWeight || '',
        operator: operator || '',
        loadlistFlag: rawADVal || 'N',
        rowIdx: i + 1,
      };

      if (!containersByBlock[normalizedBlock]) {
        containersByBlock[normalizedBlock] = [];
      }
      containersByBlock[normalizedBlock].push(itemDetail);

      // 4. Đếm tổng số lượng container hợp lệ cho từng Block. Phân thành LINE A và LINE B
      if (normalizedBlock.startsWith('A')) {
        mapA.set(normalizedBlock, (mapA.get(normalizedBlock) || 0) + 1);
        totalValid++;
      } else if (normalizedBlock.startsWith('B')) {
        mapB.set(normalizedBlock, (mapB.get(normalizedBlock) || 0) + 1);
        totalValid++;
      } else {
        totalValid++;
      }
    }

    // Sắp xếp tên Block theo thứ tự tăng dần từ nhỏ đến lớn
    const sortedA = Array.from(mapA.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    const sortedB = Array.from(mapB.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const maxRows = Math.max(sortedA.length, sortedB.length);
    const tableRows: YardBlockRow[] = [];

    let sumA = 0;
    let sumB = 0;

    for (let i = 0; i < maxRows; i++) {
      const bA = sortedA[i] || '';
      const cA = bA ? (mapA.get(bA) ?? 0) : '';
      const bB = sortedB[i] || '';
      const cB = bB ? (mapB.get(bB) ?? 0) : '';

      if (typeof cA === 'number') sumA += cA;
      if (typeof cB === 'number') sumB += cB;

      tableRows.push({
        blockA: bA,
        countA: cA,
        blockB: bB,
        countB: cB,
      });
    }

    const compiled: YardProcessResult = {
      fileName,
      processedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      totalRowsRaw: rawRows.length - startRow,
      totalValidContainers: totalValid,
      totalIgnoredEmptyBlock: ignoredEmpty,
      totalIgnoredNotInLoadlist: ignoredNotInLoadlist,
      rows: tableRows,
      totalA: sumA,
      totalB: sumB,
      totalYard: sumA + sumB,
      containersByBlock,
    };

    setResult(compiled);
    setErrorMessage(null);
    return compiled;
  };

  const handleFileUpload = async (file: File) => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setResult(null);
    setSelectedBlock(null);
    try {
      let workbook: XLSX.WorkBook;
      try {
        workbook = await parseWorkbook(file, 'shipProductivity');
      } catch (serverErr: any) {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
          const buffer = await file.arrayBuffer();
          workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false });
        } else {
          throw serverErr;
        }
      }
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      });

      processExcelData(rows, file.name);
    } catch (err: any) {
      console.error('Lỗi phân tích file Excel:', err);
      setErrorMessage(
        err.message || 'Không thể đọc tệp Excel. Vui lòng đảm bảo tệp đúng định dạng .xlsx, .xls hoặc .csv.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  /**
   * Nạp dữ liệu mô phỏng thực tế của Cảng container TC-HICT để kiểm tra
   */
  const handleLoadDemoData = () => {
    setIsProcessing(true);
    setSelectedBlock(null);
    setModalSortKey('default');
    setModalSortOrder('asc');
    setTimeout(() => {
      const demoRows: any[][] = [];
      const headerRow = new Array(30).fill('');
      headerRow[2] = 'OPR';
      headerRow[4] = 'CONTAINER'; // Cột E: Số Container
      headerRow[5] = 'FE';
      headerRow[8] = 'GROSS_WT';
      headerRow[18] = 'BLOCK';
      headerRow[19] = 'LOCATION'; // Cột T: Vị trí bãi
      headerRow[20] = 'IN_TIME';  // Cột U: Thời gian
      headerRow[29] = 'NOTIN_LOADLIST_FLG';
      demoRows.push(headerRow);

      const blockPool = ['A00', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'B00', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'];
      const oprPool = ['ONE', 'MSC', 'CMA-CGM', 'MAERSK', 'COSCO', 'EVERGREEN', 'HAPAG-LLOYD'];
      const sztpPool = ['20GP', '40HC', '40GP', '45HC', '20RF', '40RF'];

      for (let i = 0; i < 300; i++) {
        const row = new Array(30).fill('');
        const chosenBlock = blockPool[Math.floor(Math.random() * blockPool.length)];
        const bay = Math.floor(Math.random() * 30) + 1;
        const rowNum = Math.floor(Math.random() * 6) + 1;
        const tier = Math.floor(Math.random() * 5) + 1;

        // Cột E (index 4): Số Container
        row[4] = `TCKU${Math.floor(1000000 + Math.random() * 9000000)}`;
        row[2] = oprPool[Math.floor(Math.random() * oprPool.length)];
        row[5] = Math.random() > 0.3 ? 'F' : 'E';
        row[8] = `${(Math.random() * 28 + 2).toFixed(1)}T`;
        row[18] = chosenBlock;

        // Cột T (index 19): Vị trí bãi dạng 7 chữ số (ví dụ: 0260202 -> 026-02-02)
        const bayStr = String(bay).padStart(3, '0');
        const rowStr = String(rowNum).padStart(2, '0');
        const tierStr = String(tier).padStart(2, '0');
        row[19] = `${bayStr}${rowStr}${tierStr}`;

        // Cột U (index 20): Thời gian
        const day = String(1 + (i % 28)).padStart(2, '0');
        const hour = String(6 + (i % 16)).padStart(2, '0');
        const min = String((i * 13) % 60).padStart(2, '0');
        row[20] = `${hour}:${min} ${day}/05/2026`;

        if (i % 9 === 0) {
          row[29] = 'Y';
        } else if (i % 30 === 0) {
          row[29] = 'y';
        } else {
          row[29] = 'N';
        }

        if (i % 50 === 0) {
          row[18] = '';
        }

        demoRows.push(row);
      }

      processExcelData(demoRows, 'DATA_TON_BAI_CONTAINER_TC_HICT.xlsx');
      setIsProcessing(false);
    }, 250);
  };

  /**
   * Sao chép bảng kết quả dưới dạng Markdown/Text chuẩn để dán vào Zalo / Báo cáo ca
   */
  const handleCopyTable = () => {
    if (!result) return;

    let text = `| KHU VỰC LINE A | Số lượng (A) | KHU VỰC LINE B | Số lượng (B) |\n`;
    text += `|:---|:---|:---|:---|\n`;

    result.rows.forEach((r) => {
      text += `| ${r.blockA || '-'} | ${r.countA !== '' ? r.countA : '-'} | ${r.blockB || '-'} | ${r.countB !== '' ? r.countB : '-'} |\n`;
    });

    text += `| TỔNG LINE A | ${result.totalA} | TỔNG LINE B | ${result.totalB} |\n`;
    text += `| TỔNG CỘNG ĐANG LƯU BÃI | ${result.totalYard} Cont | | |\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /**
   * Xuất file Excel chuẩn đúng 1 bảng 4 cột này
   */
  const handleExportExcel = () => {
    if (!result) return;

    const data: any[][] = [
      ['KHU VỰC LINE A', 'Số lượng (A)', 'KHU VỰC LINE B', 'Số lượng (B)'],
    ];

    result.rows.forEach((r) => {
      data.push([
        r.blockA || '',
        r.countA !== '' ? r.countA : '',
        r.blockB || '',
        r.countB !== '' ? r.countB : '',
      ]);
    });

    data.push(['TỔNG LINE A', result.totalA, 'TỔNG LINE B', result.totalB]);
    data.push(['TỔNG CỘNG ĐANG LƯU BÃI', `${result.totalYard} Cont`, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'THONG_KE_LINET_AB');
    XLSX.writeFile(wb, `THONG_KE_BAI_CONT_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearResult = () => {
    setResult(null);
    setErrorMessage(null);
    setSelectedBlock(null);
    setModalSortKey('default');
    setModalSortOrder('asc');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper chuyển đổi chuỗi thời gian thành timestamp để so sánh
  const parseTimeToTimestamp = (val: string): number => {
    if (!val || val === '-') return 0;
    const t = Date.parse(val);
    if (!isNaN(t)) return t;

    // Định dạng HH:mm DD/MM/YYYY
    const m1 = val.match(/(\d{1,2}):(\d{1,2})\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m1) {
      return new Date(Number(m1[5]), Number(m1[4]) - 1, Number(m1[3]), Number(m1[1]), Number(m1[2])).getTime();
    }
    // Định dạng DD/MM/YYYY HH:mm
    const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})/);
    if (m2) {
      return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]), Number(m2[4]), Number(m2[5])).getTime();
    }
    // Định dạng DD/MM/YYYY
    const m3 = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m3) {
      return new Date(Number(m3[3]), Number(m3[2]) - 1, Number(m3[1])).getTime();
    }
    return 0;
  };

  // Lọc và sắp xếp danh sách container thuộc block đang chọn trong Modal
  const blockContainers = useMemo(() => {
    if (!result || !selectedBlock) return [];
    const list = result.containersByBlock[selectedBlock] || [];
    let filtered = list;

    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      filtered = list.filter(
        (c) =>
          c.containerNo.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.time.toLowerCase().includes(q) ||
          c.operator.toLowerCase().includes(q)
      );
    }

    if (modalSortKey === 'default') {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      if (modalSortKey === 'location') {
        // Sắp xếp tự nhiên theo vị trí bãi (Bay-Row-Tier)
        const cmp = (a.location || '').localeCompare(b.location || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        return modalSortOrder === 'asc' ? cmp : -cmp;
      }

      if (modalSortKey === 'time') {
        // Sắp xếp theo thời gian
        const tA = parseTimeToTimestamp(a.time);
        const tB = parseTimeToTimestamp(b.time);

        if (tA !== 0 && tB !== 0) {
          return modalSortOrder === 'asc' ? tA - tB : tB - tA;
        }
        const cmp = (a.time || '').localeCompare(b.time || '');
        return modalSortOrder === 'asc' ? cmp : -cmp;
      }

      return 0;
    });
  }, [result, selectedBlock, modalSearch, modalSortKey, modalSortOrder]);

  const handleCopyModalList = () => {
    if (!selectedBlock || !blockContainers.length) return;
    let txt = `DANH SÁCH CONTAINER LƯU BÃI - BLOCK ${selectedBlock} (${blockContainers.length} Cont)\n`;
    txt += `STT\tSố Container\tVị trí bãi\tThời gian\tF/E\tHãng tàu\tTrọng lượng\n`;
    blockContainers.forEach((c, idx) => {
      txt += `${idx + 1}\t${c.containerNo}\t${c.location}\t${c.time}\t${c.fe}\t${c.operator}\t${c.grossWeight}\n`;
    });
    navigator.clipboard.writeText(txt).then(() => {
      setCopiedModalList(true);
      setTimeout(() => setCopiedModalList(false), 2000);
    });
  };

  const handleExportBlockExcel = () => {
    if (!selectedBlock || !blockContainers.length) return;
    const data: any[][] = [
      ['STT', 'Số Container (Cột E)', 'Vị trí bãi (Bay-Row-Tier)', 'Thời gian (Cột U)', 'F/E', 'Hãng tàu', 'Trọng lượng', 'Dòng Excel gốc'],
    ];
    blockContainers.forEach((c, idx) => {
      data.push([
        idx + 1,
        c.containerNo,
        c.location,
        c.time,
        c.fe,
        c.operator,
        c.grossWeight,
        c.rowIdx,
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `BLOCK_${selectedBlock}`);
    XLSX.writeFile(wb, `CONTAINER_BLOCK_${selectedBlock}_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  CÔNG CỤ XỬ LÝ DỮ LIỆU TỰ ĐỘNG
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                  BÃI CONTAINER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kéo thả file Excel để xem bảng thống kê LINE A / LINE B. Nhấp vào bất kỳ Block nào (A00, B00, A01, B02...) để tra cứu chi tiết danh sách container.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={handleClearResult}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                title="Xóa kết quả tra cứu và làm mới"
              >
                <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa kết quả & Đóng tra cứu</span>
              </button>
            )}

            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
              >
                Về Tổng quan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Box: Bảng kéo thả file để thực hiện thống kê */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`bg-white rounded-3xl border-2 border-dashed transition-all p-8 sm:p-12 text-center cursor-pointer relative overflow-hidden shadow-xs ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          disabled={isProcessing}
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-blue-50 to-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
            {isProcessing ? (
              <RefreshCw className="w-9 h-9 animate-spin" />
            ) : (
              <Upload className="w-9 h-9 text-blue-600" />
            )}
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              {isProcessing
                ? 'Đang đọc và tự động tổng hợp dữ liệu bãi container...'
                : 'Kéo thả tệp Excel báo cáo bãi vào đây hoặc nhấp để chọn tệp'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-lg mx-auto">
              Hỗ trợ định dạng <b>.xlsx, .xls, .csv</b>. Tự động nhận diện Cột S (Block) và Cột AD (NOTIN_LOADLIST_FLG = 'Y').
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              Khớp chuẩn Line A / Line B
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              Chuẩn hóa 2 chữ số (A01..A99)
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              Nút ấn xem chi tiết từng Block
            </span>
          </div>

          {!result && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
              <span className="text-xs text-slate-400">Chưa có tệp Excel?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemoData();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-2xs"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Nạp dữ liệu mẫu Cảng TC-HICT để thử nghiệm</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-700 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Lỗi xử lý tệp:</span>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* BẢNG KẾT QUẢ THỐNG KÊ CONTAINER LƯU BÃI (LINE A - LINE B) */}
      {result && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in duration-300">
          {/* Header Action Bar */}
          <div className="p-5 sm:p-6 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                  KẾT QUẢ THỐNG KÊ CONTAINER LƯU BÃI (LINE A - LINE B)
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tệp: <b className="text-slate-700">{result.fileName}</b> • Xử lý lúc: {result.processedAt} • Hợp lệ: <b className="text-emerald-600">{result.totalValidContainers}</b> cont (Loại bỏ {result.totalIgnoredNotInLoadlist} cont Flag Y, {result.totalIgnoredEmptyBlock} dòng Block trống)
              </p>
              <p className="text-[11px] text-blue-600 font-semibold mt-1 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Mẹo: Nhấp vào nút ô vị trí (A00, B00, A01, B02...) để xem bảng chi tiết từng container đã thống kê.</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyTable}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                title="Sao chép bảng dạng văn bản để dán vào Zalo / Báo cáo"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sao chép Bảng</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                title="Tải bảng kết quả về dưới dạng tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Excel (.xlsx)</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                title="In ấn hoặc lưu PDF bảng thống kê"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In / PDF</span>
              </button>

              <button
                onClick={handleClearResult}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                title="Xóa ngay kết quả tra cứu, không lưu tệp"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Xóa kết quả & Đóng tra cứu</span>
              </button>
            </div>
          </div>

          {/* TABLE CONTAINER: BẢNG DUY NHẤT GỒM 4 CỘT SONG SONG */}
          <div className="overflow-x-auto p-4 sm:p-6 print:p-0">
            <table className="w-full border-collapse border border-slate-300 text-sm font-sans">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                  <th className="border border-slate-300 px-4 py-3 text-center font-extrabold uppercase text-xs tracking-wider bg-blue-50/70 w-1/4">
                    KHU VỰC LINE A
                  </th>
                  <th className="border border-slate-300 px-4 py-3 text-center font-extrabold uppercase text-xs tracking-wider bg-blue-50/70 w-1/4">
                    Số lượng (A)
                  </th>
                  <th className="border border-slate-300 px-4 py-3 text-center font-extrabold uppercase text-xs tracking-wider bg-emerald-50/70 w-1/4">
                    KHU VỰC LINE B
                  </th>
                  <th className="border border-slate-300 px-4 py-3 text-center font-extrabold uppercase text-xs tracking-wider bg-emerald-50/70 w-1/4">
                    Số lượng (B)
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    {/* CỘT KHU VỰC LINE A - NÚT ẤN TƯƠNG TÁC */}
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      {row.blockA ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBlock(row.blockA);
                            setModalSearch('');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs text-blue-700 bg-blue-50/90 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-all shadow-2xs hover:scale-105 active:scale-95 group cursor-pointer"
                          title={`Nhấn vào để xem bảng vị trí chi tiết các cont tại Block ${row.blockA}`}
                        >
                          <span>{row.blockA}</span>
                          <Eye className="w-3 h-3 text-blue-500 group-hover:text-white transition-colors" />
                        </button>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-bold text-blue-700">
                      {row.countA !== '' ? row.countA : '-'}
                    </td>

                    {/* CỘT KHU VỰC LINE B - NÚT ẤN TƯƠNG TÁC */}
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      {row.blockB ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBlock(row.blockB);
                            setModalSearch('');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs text-emerald-700 bg-emerald-50/90 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 transition-all shadow-2xs hover:scale-105 active:scale-95 group cursor-pointer"
                          title={`Nhấn vào để xem bảng vị trí chi tiết các cont tại Block ${row.blockB}`}
                        >
                          <span>{row.blockB}</span>
                          <Eye className="w-3 h-3 text-emerald-500 group-hover:text-white transition-colors" />
                        </button>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-bold text-emerald-700">
                      {row.countB !== '' ? row.countB : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* DÒNG CHỐT 1: TỔNG LINE A | [Số] | TỔNG LINE B | [Số] */}
                <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                  <td className="border border-slate-300 px-4 py-3 text-center uppercase tracking-wide bg-blue-100/50">
                    TỔNG LINE A
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center text-blue-800 text-base bg-blue-100/50 font-black">
                    {result.totalA}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center uppercase tracking-wide bg-emerald-100/50">
                    TỔNG LINE B
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center text-emerald-800 text-base bg-emerald-100/50 font-black">
                    {result.totalB}
                  </td>
                </tr>

                {/* DÒNG CHỐT 2: TỔNG CỘNG ĐANG LƯU BÃI | [Tổng A+B] Cont */}
                <tr className="bg-amber-50 font-black text-slate-900 border-t border-slate-300">
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-4 py-3.5 text-center uppercase text-sm tracking-wider text-slate-900 bg-amber-100/60"
                  >
                    TỔNG CỘNG ĐANG LƯU BÃI
                  </td>
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-4 py-3.5 text-center text-base sm:text-lg text-amber-900 bg-amber-100/60 tracking-tight"
                  >
                    {result.totalYard} Cont
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer note */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
            <span>
              Quy chuẩn tên Block: 2 chữ số tự động (A00, A01..A99, B00, B01..B99) • Bỏ qua hoàn toàn container có cờ NOTIN_LOADLIST_FLG = 'Y'
            </span>
            <span className="font-mono text-slate-400">
              Cảng TC-HICT Yard Inventory Engine
            </span>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT DANH SÁCH CONTAINER CỦA BLOCK KHI NGƯỜI DÙNG BẤM VÀO Ô VỊ TRÍ */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm ${
                    selectedBlock.startsWith('A') ? 'bg-blue-600' : 'bg-emerald-600'
                  }`}
                >
                  {selectedBlock}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      VỊ TRÍ CHI TIẾT CONTAINER - BLOCK {selectedBlock}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedBlock.startsWith('A')
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedBlock.startsWith('A') ? 'LINE A' : 'LINE B'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tổng số: <b className="text-slate-800">{result?.containersByBlock[selectedBlock]?.length || 0} container</b> đang lưu bãi tại Block này
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Action Toolbar với Nút Sắp Xếp Nhanh */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm số cont, vị trí, thời gian..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Nhóm Nút Sắp Xếp Nhanh (Thời gian / Vị trí bãi) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 mr-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Sắp xếp:
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (modalSortKey === 'time') {
                      setModalSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setModalSortKey('time');
                      setModalSortOrder('desc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                    modalSortKey === 'time'
                      ? 'bg-blue-600 text-white shadow-blue-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title="Nhấn để sắp xếp container theo thời gian (cột U)"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Theo Thời gian</span>
                  {modalSortKey === 'time' && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-normal">
                      {modalSortOrder === 'desc' ? 'Mới nhất ↓' : 'Cũ nhất ↑'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (modalSortKey === 'location') {
                      setModalSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setModalSortKey('location');
                      setModalSortOrder('asc');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                    modalSortKey === 'location'
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title="Nhấn để sắp xếp container theo vị trí bãi (Bay-Row-Tier)"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Theo Vị trí bãi</span>
                  {modalSortKey === 'location' && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-normal">
                      {modalSortOrder === 'asc' ? 'Bay ↑' : 'Bay ↓'}
                    </span>
                  )}
                </button>

                {modalSortKey !== 'default' && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalSortKey('default');
                      setModalSortOrder('asc');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Khôi phục thứ tự gốc theo dòng file Excel"
                  >
                    Đặt lại
                  </button>
                )}
              </div>

              {/* Nút Sao chép & Xuất Excel */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCopyModalList}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  {copiedModalList ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportBlockExcel}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Excel Block</span>
                </button>
              </div>
            </div>

            {/* Modal Table Container */}
            <div className="overflow-y-auto flex-1 p-4">
              {blockContainers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Không tìm thấy container nào phù hợp với từ khóa "{modalSearch}".
                </div>
              ) : (
                <table className="w-full border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="border border-slate-200 px-3 py-2 text-center w-12">STT</th>
                      <th className="border border-slate-200 px-3 py-2 text-left">Số Container (Cột E)</th>
                      <th className="border border-slate-200 px-3 py-2 text-center">Vị trí bãi (Bay-Row-Tier)</th>
                      <th className="border border-slate-200 px-3 py-2 text-center">Thời gian</th>
                      <th className="border border-slate-200 px-3 py-2 text-center">F / E</th>
                      <th className="border border-slate-200 px-3 py-2 text-center">Hãng tàu (OPR)</th>
                      <th className="border border-slate-200 px-3 py-2 text-center">Trọng lượng</th>
                      <th className="border border-slate-200 px-3 py-2 text-center w-16">Dòng Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockContainers.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 font-mono font-bold text-slate-900">
                          {item.containerNo}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {item.location || item.block}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center font-medium text-slate-700 whitespace-nowrap">
                          {item.time || '-'}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.fe === 'F' || item.fe === 'FULL'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.fe === 'F' ? 'Hàng (F)' : item.fe === 'E' ? 'Rỗng (E)' : item.fe}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center font-bold text-slate-800">
                          {item.operator || '-'}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">
                          {item.grossWeight || '-'}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                          #{item.rowIdx}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Đang hiển thị <b>{blockContainers.length}</b> container
              </div>
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-2xs"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
