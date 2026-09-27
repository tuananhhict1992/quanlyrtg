import * as XLSX from 'xlsx';
import { fileTypeFromBuffer } from 'file-type';
import { validateFile } from './file-validation';
import { HttpError } from './db';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';
export async function parseSpreadsheet(buffer: Buffer, claimed: string, name: string) {
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new HttpError(413,'Tệp phải từ 1 byte đến 20 MB.');
  const ext = name.split('.').pop()?.toLowerCase();
  const mime = claimed.toLowerCase().split(';')[0].trim();
  let canonicalMime: string, source: Buffer | string = buffer;
  if (ext === 'xlsx') {
    canonicalMime = await validateFile(buffer, mime, name);
    if (canonicalMime !== XLSX_MIME) throw new HttpError(415,'Nội dung tệp không phải Excel XLSX.');
  } else if (ext === 'xls') {
    if (!['', 'application/octet-stream', XLS_MIME, XLSX_MIME, 'application/x-cfb'].includes(mime))
      throw new HttpError(415,'MIME của tệp XLS không hợp lệ.');
    // Port exports sometimes contain a genuine OOXML workbook under a .xls name.
    // Recognize its content explicitly; do not relax validation for arbitrary ZIPs.
    const detected = await fileTypeFromBuffer(buffer).catch(() => undefined);
    if (detected?.mime === XLSX_MIME) canonicalMime = XLSX_MIME;
    else { try {
      if (buffer.subarray(0,8).toString('hex') !== 'd0cf11e0a1b11ae1') throw new Error();
      const compound = XLSX.CFB.read(buffer,{type:'buffer'});
      const workbook = compound.FileIndex.find(entry => ['Workbook','Book'].includes(entry.name));
      const bytes = Buffer.from(workbook?.content || []);
      // BIFF workbook BOF; reject renamed Word/PowerPoint/opaque compound files.
      if (bytes.length < 8 || ![0x0809,0x0409,0x0209,0x0009].includes(bytes.readUInt16LE(0))) throw new Error();
    } catch { throw new HttpError(415,'Tệp XLS không có cấu trúc Excel hợp lệ. Mở bằng Excel và lưu lại thành .xlsx rồi thử lại.'); }
    canonicalMime = XLS_MIME; }
  } else if (ext === 'csv') {
    if (!['', 'application/octet-stream', 'text/csv', 'text/plain', 'application/csv', XLS_MIME].includes(mime))
      throw new HttpError(415,'MIME của tệp CSV không hợp lệ.');
    const utf16 = (buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff);
    if (!utf16 && await fileTypeFromBuffer(buffer).catch(() => undefined)) throw new HttpError(415,'Nội dung tệp CSV phải là văn bản.');
    try {
      const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? 'utf-16le' : buffer[0] === 0xfe && buffer[1] === 0xff ? 'utf-16be' : 'utf-8';
      source = new TextDecoder(encoding,{fatal:true}).decode(buffer);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source) || /^\s*(?:<|\{|\[)/.test(source) || !/[,;\t]/.test(source)) throw new Error();
    } catch { throw new HttpError(415,'CSV cần là văn bản UTF-8 hoặc UTF-16 có cột phân cách bằng dấu phẩy, chấm phẩy hoặc tab.'); }
    canonicalMime = 'text/csv';
  } else throw new HttpError(415,'Công cụ xử lý dữ liệu hỗ trợ .xlsx, .xls và .csv.');
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(source,{type:typeof source==='string'?'string':'buffer',sheetRows:2001,cellFormula:false,cellHTML:false,bookVBA:false,raw:ext==='csv'});
  } catch { throw new HttpError(415,'Không đọc được bảng tính. Tệp có thể hỏng hoặc được bảo vệ bằng mật khẩu; hãy lưu một bản .xlsx hợp lệ.'); }
  if (!workbook.SheetNames.length) throw new HttpError(415,'Tệp không chứa bảng dữ liệu.');
  if (workbook.SheetNames.length > 20) throw new HttpError(413,'Tối đa 20 sheet mỗi tệp.');
  for (const name of workbook.SheetNames) {
    const sheet=workbook.Sheets[name];
    const range=XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (range.e.r>=2000 || range.e.c>=100) throw new HttpError(413,'Mỗi sheet tối đa 2.000 dòng và 100 cột.');
  }
  return {workbook,mimeType:canonicalMime};
}
