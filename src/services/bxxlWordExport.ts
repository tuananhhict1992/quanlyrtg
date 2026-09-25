import type {BxxlRecord} from '../types';
import {apiFetch} from './supabase';
import {generateBxxlHtml} from './bxxlTemplate';
export {generateBxxlHtml,toRomanNumeral,formatCountDoc} from './bxxlTemplate';
export const exportBxxlToWord = async (record: BxxlRecord, filename?: string): Promise<void> => {
  const response=await apiFetch('/api/operations/ranking/word',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record})});
  if(!response.ok){alert('Không thể tạo file Word. Vui lòng kiểm tra quyền và kết nối.');return;}
  const blob=await response.blob();
  const cleanMonth = (record.evaluationMonth || 'BXXL').replace(/[\/\\]/g, '-');
  const safeFileName = filename || `Danh_Sach_Xep_Loai_Thang_${cleanMonth}.doc`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Print or Save as PDF via native browser dialog
 */
export const printBxxlDocument = (record: BxxlRecord): void => {
  const previewHtml = generateBxxlHtml(record, false);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép popup để in văn bản.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Danh Sách Xếp Loại Tháng ${String(record.evaluationMonth||'').replace(/[<>&]/g,'')}</title>
      <style>
        @page {
          size: A4;
          margin: 20mm 15mm 20mm 30mm;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 14pt;
          line-height: 1.2;
          margin: 0;
          padding: 0;
          color: #000;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 5px;
        }
        .header-table td {
          vertical-align: top;
          text-align: center;
          border: none;
          padding: 0;
        }
        .col-left { width: 42%; }
        .col-right { width: 58%; }
        .company { margin: 0; font-size: 11.5pt; line-height: 1.25; text-transform: uppercase; }
        .department { margin: 0; font-weight: bold; font-size: 12pt; text-transform: uppercase; }
        .republic { margin: 0; font-weight: bold; font-size: 12pt; white-space: nowrap; }
        .motto { margin: 0; font-weight: bold; font-size: 13pt; white-space: nowrap; }
        .date { text-align: right; font-style: italic; margin-top: 10px; margin-bottom: 20px; }
        .main-title { text-align: center; margin-bottom: 20px; }
        .title-text { margin: 0; font-weight: bold; font-size: 14pt; }
        .subtitle-text { margin: 0; font-size: 14pt; }
        .section-heading { font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
        .person-list { margin: 0; padding-left: 20px; list-style-type: none; }
        .person-list li { margin-bottom: 3px; }
        .note-text { margin-top: 10px; margin-bottom: 15px; padding-left: 35px; }
      </style>
    </head>
    <body>
      ${previewHtml}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
