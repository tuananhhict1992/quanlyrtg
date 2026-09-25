import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { QuizQuestion } from '../types';

export interface ParsedQuestionRow {
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  citation: string;
}

/**
 * Downloads a pre-formatted Excel template (.xlsx) for Admin to easily fill in question banks
 */
export function downloadSampleExcelTemplate(): void {
  const sampleData = [
    {
      'Câu hỏi': 'Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào?',
      'Lựa chọn A': '08h00 - 17h00 (Nghỉ trưa 60 phút)',
      'Lựa chọn B': '08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)',
      'Lựa chọn C': '08h30 - 18h00 (Nghỉ trưa 90 phút)',
      'Lựa chọn D': 'Tùy nhân viên tự chọn khung giờ linh hoạt',
      'Đáp án đúng (A/B/C/D)': 'B',
      'Giải thích': 'Giờ làm việc tiêu chuẩn từ 08h00 - 17h30, nghỉ trưa 90 phút từ 12h00 - 13h30.',
      'Căn cứ quy chế': 'Điều 1, Nội quy Lao động 2026 (NQ-01)',
    },
    {
      'Câu hỏi': 'Nhân viên cần nộp đơn xin nghỉ phép trước bao lâu nếu dự định nghỉ từ 01 đến 02 ngày làm việc?',
      'Lựa chọn A': 'Trước 12 giờ',
      'Lựa chọn B': 'Trước 24 giờ',
      'Lựa chọn C': 'Trước ít nhất 48 giờ (02 ngày làm việc)',
      'Lựa chọn D': 'Chỉ cần báo Quản lý vào buổi sáng ngày nghỉ',
      'Đáp án đúng (A/B/C/D)': 'C',
      'Giải thích': 'Quy trình SOP-HR01 quy định nghỉ từ 1 - 2 ngày phải gửi đơn trước ít nhất 48 giờ.',
      'Căn cứ quy chế': 'Điều 2, Quy trình Đăng ký Nghỉ phép (HD-01)',
    },
    {
      'Câu hỏi': 'Hình thức xử lý đối với nhân viên đi làm muộn từ 03 đến 05 lần trong 01 tháng không có lý do là gì?',
      'Lựa chọn A': 'Khiển trách bằng văn bản và trừ lương tháng',
      'Lựa chọn B': 'Nhắc nhở bằng biên bản và trừ 10 điểm KPI tháng',
      'Lựa chọn C': 'Sa thải ngay lập tức',
      'Lựa chọn D': 'Không bị xử lý nếu làm bù buổi tối',
      'Đáp án đúng (A/B/C/D)': 'B',
      'Giải thích': 'Đi muộn 3-5 lần/tháng thuộc Mức 1: Nhắc nhở và trừ 10 điểm KPI tháng.',
      'Căn cứ quy chế': 'Mức 1, Khung Chế tài Kỷ luật Lao động (VP-01)',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for comfortable reading
  worksheet['!cols'] = [
    { wch: 45 }, // Câu hỏi
    { wch: 30 }, // Lựa chọn A
    { wch: 30 }, // Lựa chọn B
    { wch: 30 }, // Lựa chọn C
    { wch: 30 }, // Lựa chọn D
    { wch: 22 }, // Đáp án đúng
    { wch: 40 }, // Giải thích
    { wch: 35 }, // Căn cứ
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NganHangCauHoi');

  XLSX.writeFile(workbook, 'Mau_Ngan_Hang_Cau_Hoi_Trac_Nghiem.xlsx');
}

/**
 * Returns formatted text template for Word / Text
 */
export function getSampleWordTextTemplate(): string {
  return `MẪU BỐ TRÍ NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM CHUẨN

Câu 1: Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào?
A. 08h00 - 17h00 (Nghỉ trưa 60 phút)
B. 08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)
C. 08h30 - 18h00 (Nghỉ trưa 90 phút)
D. Tùy nhân viên tự chọn khung giờ linh hoạt
Đáp án đúng: B
Giải thích: Giờ làm việc tiêu chuẩn là từ 08h00 đến 17h30 từ Thứ Hai đến Thứ Sáu, nghỉ trưa 90 phút (12h00 - 13h30).
Căn cứ: Điều 1, Nội quy Lao động 2026 (NQ-01)

Câu 2: Nhân viên cần nộp đơn xin nghỉ phép trước bao lâu nếu dự định nghỉ từ 01 đến 02 ngày làm việc?
A. Trước 12 giờ
B. Trước 24 giờ
C. Trước ít nhất 48 giờ (02 ngày làm việc)
D. Chỉ cần báo Quản lý vào buổi sáng ngày nghỉ
Đáp án đúng: C
Giải thích: Quy trình SOP-HR01 quy định nghỉ từ 1 - 2 ngày phải gửi đơn trước ít nhất 48 giờ.
Căn cứ: Điều 2, Quy trình Đăng ký Nghỉ phép (HD-01/2026/SOP-HR)
`;
}

/**
 * Reads any uploaded file (.xlsx, .xls, .csv, .docx, .pdf, .txt) and returns:
 * - structured questions (if Excel has the standard headers)
 * - extracted raw text (for AI analysis)
 * - base64 (if PDF)
 */
export async function parseFileForQuestions(file: File | Blob, fileName: string): Promise<{
  structuredQuestions?: QuizQuestion[];
  rawText?: string;
  base64?: string;
  mimeType: string;
}> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  // 1. EXCEL / CSV
  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    // Check if rows match standard template headers
    const extractedFromTemplate: QuizQuestion[] = [];
    let textDump = '';

    rows.forEach((row, idx) => {
      const qText =
        row['Câu hỏi'] || row['Cau hoi'] || row['Question'] || row['Nội dung câu hỏi'];
      const optA = row['Lựa chọn A'] || row['A'] || row['Option A'];
      const optB = row['Lựa chọn B'] || row['B'] || row['Option B'];
      const optC = row['Lựa chọn C'] || row['C'] || row['Option C'];
      const optD = row['Lựa chọn D'] || row['D'] || row['Option D'];
      const rawAns = (
        row['Đáp án đúng (A/B/C/D)'] ||
        row['Đáp án đúng'] ||
        row['Dap an'] ||
        row['Answer'] ||
        'A'
      )
        .toString()
        .trim()
        .toUpperCase();
      const expl = row['Giải thích'] || row['Giai thich'] || row['Explanation'] || '';
      const cit = row['Căn cứ quy chế'] || row['Căn cứ'] || row['Can cu'] || '';

      if (qText && optA && optB) {
        const options = [
          { id: `opt-a-${idx}`, text: String(optA) },
          { id: `opt-b-${idx}`, text: String(optB) },
        ];
        if (optC) options.push({ id: `opt-c-${idx}`, text: String(optC) });
        if (optD) options.push({ id: `opt-d-${idx}`, text: String(optD) });

        let correctOptionId = options[0].id;
        if (rawAns.includes('B') && options.length > 1) correctOptionId = options[1].id;
        else if (rawAns.includes('C') && options.length > 2) correctOptionId = options[2].id;
        else if (rawAns.includes('D') && options.length > 3) correctOptionId = options[3].id;

        extractedFromTemplate.push({
          id: `imp-${Date.now()}-${idx}`,
          question: String(qText),
          options,
          correctOptionId,
          explanation: String(expl),
          citation: String(cit),
        });
      }

      // Also create text dump in case AI fallback is needed
      textDump += `Dòng ${idx + 1}: ${JSON.stringify(row)}\n`;
    });

    if (extractedFromTemplate.length > 0) {
      return {
        structuredQuestions: extractedFromTemplate,
        rawText: textDump,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    return {
      rawText: textDump,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // 2. WORD (.docx)
  if (['docx'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
      rawText: result.value,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // 3. PDF (.pdf)
  if (extension === 'pdf') {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
    reader.readAsDataURL(file);
    const dataUrl = await base64Promise;
    return {
      base64: dataUrl,
      mimeType: 'application/pdf',
    };
  }

  // 4. PLAIN TEXT / MARKDOWN
  const text = await file.text();
  return {
    rawText: text,
    mimeType: 'text/plain',
  };
}
