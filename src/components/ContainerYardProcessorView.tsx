import {saveDocumentsBatch} from '../services/supabase';
import {parseWorkbook} from '../services/excelProcessing';
import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface YardBlockRow {
  blockA: string;
  countA: number | '';
  blockB: string;
  countB: number | '';
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

interface ContainerYardProcessorViewProps {
  onBackToDashboard?: () => void;
}

export const ContainerYardProcessorView: React.FC<ContainerYardProcessorViewProps> = ({
  onBackToDashboard,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<YardProcessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Quy trình xử lý dữ liệu ngầm theo Quy tắc tối cao:
   * 1. Xác định Cột S (BLOCK) và Cột AD (NOTIN_LOADLIST_FLG).
   * 2. Loại bỏ các dòng có Cột S để trống. LOẠI BỎ HOÀN TOÀN các dòng có chứa chữ 'Y' hoặc 'y' ở Cột AD.
   * 3. Tự động chuẩn hóa tên Block ở Cột S về chuẩn 2 chữ số (ví dụ: 'A1' -> 'A01', 'B2' -> 'B02').
   * 4. Đếm tổng số lượng container hợp lệ cho từng Block. Phân thành LINE A (bắt đầu bằng 'A') và LINE B (bắt đầu bằng 'B').
   * 
   * Định dạng đầu ra yêu cầu:
   * Chỉ in ra MỘT BẢNG DUY NHẤT gồm 4 cột song song theo đúng mẫu:
   * | KHU VỰC LINE A | Số lượng (A) | KHU VỰC LINE B | Số lượng (B) |
   * • Sắp xếp tên Block theo thứ tự tăng dần từ nhỏ đến lớn.
   * • Dưới cùng của bảng, chốt 2 dòng tổng kết:
   *   ◦ TỔNG LINE A | [Số] | TỔNG LINE B | [Số]
   *   ◦ TỔNG CỘNG ĐANG LƯU BÃI | [Tổng A+B] Cont
   */
  const processExcelData = (rawRows: any[][], fileName: string) => {
    if (!rawRows || rawRows.length === 0) {
      throw new Error('Tệp Excel không có dữ liệu để xử lý.');
    }

    // 1. Xác định Cột S (index 18) và Cột AD (index 29)
    // Đồng thời kiểm tra nếu hàng đầu tiên có chứa tiêu đề để linh hoạt
    let colSIdx = 18; // Cột S (BLOCK)
    let colADIdx = 29; // Cột AD (NOTIN_LOADLIST_FLG)
    let startRow = 0;

    // Quét 3 hàng đầu tiên xem có hàng tiêu đề hay không
    for (let r = 0; r < Math.min(5, rawRows.length); r++) {
      const row = rawRows[r] || [];
      const sVal = String(row[colSIdx] || '').trim().toUpperCase();
      const adVal = String(row[colADIdx] || '').trim().toUpperCase();

      // Kiểm tra tiêu đề
      if (sVal === 'BLOCK' || adVal.includes('NOTIN_LOADLIST') || adVal.includes('NOTIN')) {
        startRow = r + 1;
        break;
      }

      // Quét tìm cột nếu vị trí lệch
      const foundS = row.findIndex((c) => String(c).trim().toUpperCase() === 'BLOCK');
      const foundAD = row.findIndex(
        (c) =>
          String(c).trim().toUpperCase().includes('NOTIN_LOADLIST') ||
          String(c).trim().toUpperCase() === 'NOTIN_LOADLIST_FLG'
      );
      if (foundS !== -1) colSIdx = foundS;
      if (foundAD !== -1) colADIdx = foundAD;
      if (foundS !== -1 || foundAD !== -1) {
        startRow = r + 1;
        break;
      }
    }

    let ignoredEmpty = 0;
    let ignoredNotInLoadlist = 0;
    let totalValid = 0;

    const mapA = new Map<string, number>();
    const mapB = new Map<string, number>();

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

      // 4. Đếm tổng số lượng container hợp lệ cho từng Block. Phân thành LINE A và LINE B
      if (normalizedBlock.startsWith('A')) {
        mapA.set(normalizedBlock, (mapA.get(normalizedBlock) || 0) + 1);
        totalValid++;
      } else if (normalizedBlock.startsWith('B')) {
        mapB.set(normalizedBlock, (mapB.get(normalizedBlock) || 0) + 1);
        totalValid++;
      } else {
        // Trường hợp khác nếu có (vẫn tính vào LINE tương ứng nếu có)
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
      processedAt: new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
      totalRowsRaw: rawRows.length - startRow,
      totalValidContainers: totalValid,
      totalIgnoredEmptyBlock: ignoredEmpty,
      totalIgnoredNotInLoadlist: ignoredNotInLoadlist,
      rows: tableRows,
      totalA: sumA,
      totalB: sumB,
      totalYard: sumA + sumB,
    };

    setResult(compiled);
    setErrorMessage(null);
    return compiled;
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = await parseWorkbook(file,'shipProductivity');
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        });

        const compiled=processExcelData(rows, file.name);if(compiled){const id=crypto.randomUUID();await saveDocumentsBatch('shipProductivity',[{id,data:{...compiled,id}}]);}
      } catch (err: any) {
        console.error('Lỗi phân tích file Excel:', err);
        setErrorMessage(
          err.message || 'Không thể đọc tệp Excel. Vui lòng đảm bảo tệp đúng định dạng .xlsx, .xls hoặc .csv.'
        );
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setErrorMessage('Đã xảy ra lỗi khi đọc tệp tin.');
    };

    reader.readAsArrayBuffer(file);
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
    setTimeout(() => {
      // Giả lập 100 dòng mẫu với các block A1..A10, B1..B12 và một số dòng chứa 'Y' ở Cột AD
      const demoRows: any[][] = [];
      // Hàng tiêu đề (đủ 30 cột tới AD)
      const headerRow = new Array(30).fill('');
      headerRow[18] = 'BLOCK';
      headerRow[29] = 'NOTIN_LOADLIST_FLG';
      demoRows.push(headerRow);

      const blockPool = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'];

      for (let i = 0; i < 280; i++) {
        const row = new Array(30).fill('');
        const chosenBlock = blockPool[Math.floor(Math.random() * blockPool.length)];
        row[18] = chosenBlock; // Cột S (BLOCK)

        // 10% dòng có NOTIN_LOADLIST_FLG = 'Y'
        if (i % 8 === 0) {
          row[29] = 'Y';
        } else if (i % 25 === 0) {
          row[29] = 'y';
        } else {
          row[29] = 'N';
        }

        // Một số dòng để trống Cột S
        if (i % 45 === 0) {
          row[18] = '';
        }

        demoRows.push(row);
      }

      processExcelData(demoRows, 'DATA_TON_BAI_CONTAINER_DEMO.xlsx');
      setIsProcessing(false);
    }, 300);
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

    // 2 dòng chốt
    data.push(['TỔNG LINE A', result.totalA, 'TỔNG LINE B', result.totalB]);
    data.push(['TỔNG CỘNG ĐANG LƯU BÃI', `${result.totalYard} Cont`, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Căn chỉnh độ rộng cột
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

  /**
   * Xóa sạch kết quả tra cứu và giải phóng bộ nhớ ngay lập tức
   */
  const handleClearResult = () => {
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
                Kéo thả file Excel để tự động thống kê LINE A / LINE B. Không lưu trữ file trên máy chủ.
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

          <div className="max-w-md">
            <p className="text-base sm:text-lg font-extrabold text-slate-900">
              {isProcessing
                ? 'Đang phân tích và xử lý ngầm dữ liệu...'
                : 'Kéo & thả file Excel vào đây để tra cứu thống kê'}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Nhấp vào vùng này hoặc kéo tệp <b>.xlsx, .xls, .csv</b> vào để hệ thống tự động lọc Cột S và Cột AD, kết xuất bảng 4 cột LINE A / LINE B tức thì.
            </p>
          </div>

          {!isProcessing && (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-200">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Chọn file Excel từ máy tính</span>
            </div>
          )}

          {/* Privacy & Security Guarantee */}
          <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Không lưu trữ file: Tệp chỉ đọc tạm trên bộ nhớ máy và xóa sạch sau khi tra cứu.</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3">
          <span className="font-bold">Lỗi:</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* RESULT SECTION: MỘT BẢNG DUY NHẤT 4 CỘT */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-fadeIn">
          {/* Action & Info Bar */}
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="font-bold text-slate-900 text-sm">
                  KẾT QUẢ THỐNG KÊ CONTAINER LƯU BÃI (LINE A - LINE B)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tệp: <b className="text-slate-700">{result.fileName}</b> • Xử lý lúc: {result.processedAt} • Hợp lệ: <b className="text-emerald-600">{result.totalValidContainers}</b> cont (Loại bỏ {result.totalIgnoredNotInLoadlist} cont Flag Y, {result.totalIgnoredEmptyBlock} dòng Block trống)
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
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-bold text-slate-800">
                      {row.blockA || '-'}
                    </td>
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-semibold text-blue-700">
                      {row.countA !== '' ? row.countA : '-'}
                    </td>
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-bold text-slate-800">
                      {row.blockB || '-'}
                    </td>
                    <td className="border border-slate-300 px-4 py-2.5 text-center font-semibold text-emerald-700">
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
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Quy chuẩn tên Block: 2 chữ số tự động (A01..A99, B01..B99) • Bỏ qua hoàn toàn container có cờ NOTIN_LOADLIST_FLG = 'Y'
            </span>
            <span className="font-mono text-slate-400">
              Cảng TC-HICT Yard Inventory Engine
            </span>
          </div>
        </div>
      )}
    </div>
  );
};


