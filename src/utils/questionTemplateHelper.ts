import { parseQuestionWorkbook, parseQuestionText } from './questionImport';
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
      'Câu hỏi': 'Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào? (Chọn 1 đáp án)',
      'Lựa chọn A': '08h00 - 17h00 (Nghỉ trưa 60 phút)',
      'Lựa chọn B': '08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)',
      'Lựa chọn C': '08h30 - 18h00 (Nghỉ trưa 90 phút)',
      'Lựa chọn D': 'Tùy nhân viên tự chọn khung giờ linh hoạt',
      'Lựa chọn E': '',
      'Lựa chọn F': '',
      'Lựa chọn G': '',
      'Lựa chọn H': '',
      'Đáp án đúng': 'B',
      'Giải thích': 'Giờ làm việc tiêu chuẩn từ 08h00 - 17h30, nghỉ trưa 90 phút từ 12h00 - 13h30.',
      'Căn cứ quy chế': 'Điều 1, Nội quy Lao động 2026 (NQ-01)',
    },
    {
      'Câu hỏi': 'Những quy định an toàn nào bắt buộc nhân viên Tổ RTG phải tuân thủ trước khi vận hành cẩu khung? (Chọn nhiều đáp án đúng)',
      'Lựa chọn A': 'Kiểm tra tình trạng kỹ thuật tổng thể, hệ thống phanh, cáp và chốt khóa gù',
      'Lựa chọn B': 'Trang bị đầy đủ bảo hộ lao động: mũ bảo hộ, giày bảo hộ, áo phản quang',
      'Lựa chọn C': 'Vận hành cẩu ngay cả khi phát hiện có người đang đứng trong vùng nguy hiểm dưới gantry',
      'Lựa chọn D': 'Thử còi báo hiệu, đèn xoay cảnh báo và bộ đàm liên lạc với điều độ bãi',
      'Lựa chọn E': 'Kiểm tra tình trạng camera giám sát và màn hình hiển thị cabin RTG',
      'Lựa chọn F': '',
      'Lựa chọn G': '',
      'Lựa chọn H': '',
      'Đáp án đúng': 'A, B, D, E',
      'Giải thích': 'Phương án C vi phạm quy trình an toàn. Các phương án A, B, D, E là bắt buộc tuân thủ trước ca làm việc.',
      'Căn cứ quy chế': 'Điều 4, Quy trình An toàn Vận hành Cẩu RTG (SOP-RTG-01)',
    },
    {
      'Câu hỏi': 'Các trường hợp nào sau đây lái cẩu RTG bắt buộc phải dừng thao tác nâng hạ container ngay lập tức? (Chọn nhiều đáp án đúng)',
      'Lựa chọn A': 'Gió bão giật trên cấp quy định cho phép vận hành an toàn',
      'Lựa chọn B': 'Phát hiện có chướng ngại vật hoặc người lạ di chuyển trong đường chạy cẩu',
      'Lựa chọn C': 'Gặp container hàng đông lạnh đang cắm điện bình thường',
      'Lựa chọn D': 'Hệ thống phanh nâng hạ hoặc phanh di chuyển xe con có dấu hiệu trượt',
      'Lựa chọn E': 'Có tín hiệu cảnh báo quá tải (Overload) từ hệ thống máy tính cẩu',
      'Lựa chọn F': 'Tầm nhìn bị hạn chế nghiêm trọng do mưa lớn, sương mù dày đặc',
      'Lựa chọn G': '',
      'Lựa chọn H': '',
      'Đáp án đúng': 'A, B, D, E, F',
      'Giải thích': 'Container đông lạnh cắm điện thao tác bình thường theo quy trình. Các tình huống A, B, D, E, F bắt buộc dừng thao tác khẩn cấp.',
      'Căn cứ quy chế': 'Điều 7, Quy trình Ứng phó Sự cố và Dừng Cẩu Khẩn cấp',
    },
    {
      'Câu hỏi': 'Hồ sơ đánh giá thi đua và phân loại năng lực tháng (Bình xét BXXL) của nhân viên Tổ RTG căn cứ vào những tiêu chí nào? (Chọn nhiều đáp án đúng)',
      'Lựa chọn A': 'Năng suất bình quân thao tác cẩu (Moves/giờ)',
      'Lựa chọn B': 'Ý thức chấp hành kỷ luật lao động và quy chế an toàn cảng',
      'Lựa chọn C': 'Sở thích cá nhân ngoài giờ làm việc của nhân viên',
      'Lựa chọn D': 'Kết quả bài kiểm tra trắc nghiệm kiến thức định kỳ',
      'Lựa chọn E': 'Không để xảy ra sự cố va quẹt, tai nạn hoặc hư hỏng thiết bị do lỗi chủ quan',
      'Lựa chọn F': 'Số ngày nghỉ không phép hoặc đi làm muộn trong tháng',
      'Lựa chọn G': 'Điểm cộng từ các sáng kiến cải tiến kỹ thuật hợp lý hóa quy trình',
      'Lựa chọn H': 'Thái độ phối hợp điều độ và đồng đội trong ca sản xuất',
      'Đáp án đúng': 'A, B, D, E, F, G, H',
      'Giải thích': 'Tiêu chuẩn đánh giá KPI & BXXL căn cứ năng suất, an toàn, kỷ luật, bài kiểm tra, sáng kiến và phối hợp (loại trừ C sở thích cá nhân).',
      'Căn cứ quy chế': 'Quy chế Bình xét Xếp loại Lao động Tổ RTG (QC-BXXL-2026)',
    },
  ];

  const guideData = [
    {
      'MỤC HƯỚNG DẪN': '1. Không giới hạn số lượng phương án (A, B, C, D, E, F, G, H...)',
      'CHI TIẾT QUY ĐỊNH': 'Hệ thống không giới hạn số lượng phương án. Bạn có thể tạo 2, 3, 4, 5, 6, 7, 8... phương án trả lời bằng cách thêm các cột Lựa chọn E, F, G, H, I, J... Các phương án không dùng có thể để trống hoặc xóa cột.',
    },
    {
      'MỤC HƯỚNG DẪN': '2. Câu hỏi chọn 1 đáp án đúng (Single Choice)',
      'CHI TIẾT QUY ĐỊNH': 'Tại cột "Đáp án đúng", nhập 1 chữ cái in hoa duy nhất tương ứng với phương án đúng (Ví dụ: B hoặc C).',
    },
    {
      'MỤC HƯỚNG DẪN': '3. Câu hỏi chọn NHIỀU đáp án đúng (Multiple Choice)',
      'CHI TIẾT QUY ĐỊNH': 'Tại cột "Đáp án đúng", nhập danh sách các chữ cái đúng cách nhau bởi dấu phẩy hoặc chấm phẩy (Ví dụ: A, B hoặc A, B, D, E hoặc A; C; E).',
    },
    {
      'MỤC HƯỚNG DẪN': '4. Giải thích và Căn cứ quy chế',
      'CHI TIẾT QUY ĐỊNH': 'Điền lý do giải thích và trích dẫn điều khoản/quy chế nội bộ tương ứng để nhân viên tra cứu đối soát sau khi làm bài.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const guideWorksheet = XLSX.utils.json_to_sheet(guideData);

  // Set column widths for comfortable reading
  worksheet['!cols'] = [
    { wch: 48 }, // Câu hỏi
    { wch: 28 }, // Lựa chọn A
    { wch: 28 }, // Lựa chọn B
    { wch: 28 }, // Lựa chọn C
    { wch: 28 }, // Lựa chọn D
    { wch: 28 }, // Lựa chọn E
    { wch: 28 }, // Lựa chọn F
    { wch: 28 }, // Lựa chọn G
    { wch: 28 }, // Lựa chọn H
    { wch: 24 }, // Đáp án đúng
    { wch: 42 }, // Giải thích
    { wch: 36 }, // Căn cứ quy chế
  ];

  guideWorksheet['!cols'] = [
    { wch: 40 },
    { wch: 80 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NganHangCauHoi');
  XLSX.utils.book_append_sheet(workbook, guideWorksheet, 'HuongDanSuDung');

  XLSX.writeFile(workbook, 'Mau_Ngan_Hang_Cau_Hoi_Trac_Nghiem_Da_Phuong_An.xlsx');
}

/**
 * Returns formatted text template for Word / Text
 */
export function getSampleWordTextTemplate(): string {
  return `MẪU BỐ TRÍ NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM CHUẨN
(Hỗ trợ không giới hạn phương án A, B, C, D, E, F, G, H... và chọn 1 hoặc nhiều đáp án đúng)

Câu 1: Thời gian làm việc tiêu chuẩn hàng ngày của doanh nghiệp được quy định như thế nào? (Chọn 1 đáp án)
A. 08h00 - 17h00 (Nghỉ trưa 60 phút)
B. 08h00 - 17h30 (Nghỉ trưa từ 12h00 đến 13h30)
C. 08h30 - 18h00 (Nghỉ trưa 90 phút)
D. Tùy nhân viên tự chọn khung giờ linh hoạt
Đáp án đúng: B
Giải thích: Giờ làm việc tiêu chuẩn là từ 08h00 đến 17h30 từ Thứ Hai đến Thứ Sáu, nghỉ trưa 90 phút (12h00 - 13h30).
Căn cứ: Điều 1, Nội quy Lao động 2026 (NQ-01)

Câu 2: Những quy định an toàn nào bắt buộc nhân viên Tổ RTG phải tuân thủ trước khi vận hành cẩu khung? (Chọn nhiều đáp án đúng)
A. Kiểm tra tình trạng kỹ thuật tổng thể, hệ thống phanh, cáp và chốt khóa gù
B. Trang bị đầy đủ bảo hộ lao động: mũ bảo hộ, giày bảo hộ, áo phản quang
C. Vận hành cẩu ngay cả khi phát hiện có người đang đứng trong vùng nguy hiểm dưới gantry
D. Thử còi báo hiệu, đèn xoay cảnh báo và bộ đàm liên lạc với điều độ bãi
E. Kiểm tra tình trạng camera giám sát và màn hình hiển thị cabin RTG
Đáp án đúng: A, B, D, E
Giải thích: Phương án C vi phạm nghiêm trọng quy trình an toàn. Các phương án A, B, D, E là bắt buộc tuân thủ trước ca làm việc.
Căn cứ: Điều 4, Quy trình An toàn Vận hành Cẩu RTG (SOP-RTG-01)

Câu 3: Các trường hợp nào sau đây lái cẩu RTG bắt buộc phải dừng thao tác nâng hạ container ngay lập tức? (Chọn nhiều đáp án đúng - 6 phương án)
A. Gió bão giật trên cấp quy định cho phép vận hành an toàn
B. Phát hiện có chướng ngại vật hoặc người lạ di chuyển trong đường chạy cẩu
C. Gặp container hàng đông lạnh đang cắm điện bình thường
D. Hệ thống phanh nâng hạ hoặc phanh di chuyển xe con có dấu hiệu trượt
E. Có tín hiệu cảnh báo quá tải (Overload) từ hệ thống máy tính cẩu
F. Tầm nhìn bị hạn chế nghiêm trọng do mưa lớn, sương mù dày đặc
Đáp án đúng: A, B, D, E, F
Giải thích: Căn cứ quy trình an toàn, các tình huống A, B, D, E, F là trường hợp dừng cẩu khẩn cấp bắt buộc.
Căn cứ: Điều 7, Quy trình Ứng phó Sự cố và Dừng Cẩu Khẩn cấp
`;
}

/**
 * Reads any uploaded file (.xlsx, .xls, .csv, .docx, .pdf, .txt) and returns:
 * - structured questions (if Excel has the standard headers)
 * - extracted raw text (for AI analysis)
 * - base64 (if PDF)
 */
export async function parseFileForQuestions(file: File | Blob, fileName: string): Promise<{
  report?: import('./questionImport').QuestionImportReport;
  structuredQuestions?: QuizQuestion[];
  rawText?: string;
  base64?: string;
  mimeType: string;
}> {
  if(file.size>25*1024*1024)throw new Error('Tệp vượt giới hạn 25 MB.');
  const extension = fileName.split('.').pop()?.toLowerCase();

  // 1. EXCEL / CSV
  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const report = parseQuestionWorkbook(workbook);
    return {structuredQuestions:report.questions,report,rawText:workbook.SheetNames.map(name=>name+'\n'+XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n'),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  }

  // 2. WORD (.docx)
  if (['docx'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const report=parseQuestionText(result.value);
    return {
      rawText: result.value,
      structuredQuestions:report.questions,
      report,
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
  if(extension==='doc')throw new Error('Định dạng Word cũ .doc chưa đọc trực tiếp được. Hãy lưu thành .docx rồi nhập lại.');
  const text = await file.text();
  const report=parseQuestionText(text);
  return {
    rawText: text,
    structuredQuestions:report.questions,
    report,
    mimeType: 'text/plain',
  };
}
