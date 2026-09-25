import type { BxxlRecord } from '../types';

/**
 * Helper to convert integer (1, 2, 3...) to Roman numerals (I, II, III, IV, V, VI, VII...)
 */
export const toRomanNumeral = (num: number): string => {
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [val, letter] of romanMap) {
    while (n >= val) {
      result += letter;
      n -= val;
    }
  }
  return result || 'I';
};

export const formatCountDoc = (count: number): string => {
  return count < 10 ? `0${count} đ/c` : `${count} đ/c`;
};

/**
 * Generates the pure HTML string formatted exactly per Vietnamese Administrative Standard A4 template
 */
export const generateBxxlHtml = (record: BxxlRecord, forWord: boolean = false): string => {
  const escape=(v:any):any=>typeof v==='string'?v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)):Array.isArray(v)?v.map(escape):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,escape(x)])):v;
  record=escape(record);
  let sectionIndex = 1;

  // Filter valid items for B, b, C (only items with non-empty reason are included in the final report)
  const validA = record.listA || [];
  const validB = (record.listB || []).filter((item) => item.reason && item.reason.trim() !== '');
  const validSmallB = (record.listSmallB || []).filter((item) => item.reason && item.reason.trim() !== '');
  const validC = (record.listC || []).filter((item) => item.reason && item.reason.trim() !== '');
  const validGpt = record.listGpt || [];

  const sectionsHtml: string[] = [];

  // Check A: must be selected in selectedCategories and has count > 0
  if (record.selectedCategories?.includes('A') && validA.length > 0) {
    const roman = toRomanNumeral(sectionIndex++);
    sectionsHtml.push(`
        <!-- Phần danh sách loại A -->
        <p class="section-heading">${roman}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “A” (${formatCountDoc(validA.length)}):</p>
        <ul class="person-list">
            ${validA.map((p) => `<li>${p.fullName}</li>`).join('\n            ')}
        </ul>
    `);
  }

  // Default rating "a" belongs only to employee profiles, including legacy records
  // that still carry includeDefaultSmallAInDoc=true.

  // Check B: must be selected in selectedCategories and has valid count > 0
  if (record.selectedCategories?.includes('B') && validB.length > 0) {
    const roman = toRomanNumeral(sectionIndex++);
    sectionsHtml.push(`
        <!-- Phần danh sách loại B -->
        <p class="section-heading">${roman}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “B” (${formatCountDoc(validB.length)}):</p>
        <ul class="person-list">
            ${validB.map((p) => `<li>${p.fullName}: ${p.reason}</li>`).join('\n            ')}
        </ul>
    `);
  }

  // Check b: must be selected in selectedCategories and has valid count > 0
  if (record.selectedCategories?.includes('b') && validSmallB.length > 0) {
    const roman = toRomanNumeral(sectionIndex++);
    sectionsHtml.push(`
        <!-- Phần danh sách loại b -->
        <p class="section-heading">${roman}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “b” (${formatCountDoc(validSmallB.length)}):</p>
        <ul class="person-list">
            ${validSmallB.map((p) => `<li>${p.fullName}: ${p.reason}</li>`).join('\n            ')}
        </ul>
    `);
  }

  // Check C: must be selected in selectedCategories and has valid count > 0
  if (record.selectedCategories?.includes('C') && validC.length > 0) {
    const roman = toRomanNumeral(sectionIndex++);
    sectionsHtml.push(`
        <!-- Phần danh sách loại C -->
        <p class="section-heading">${roman}/ DANH SÁCH ĐỀ XUẤT XẾP LOẠI “C” (${formatCountDoc(validC.length)}):</p>
        <ul class="person-list">
            ${validC.map((p) => `<li>${p.fullName}: ${p.reason}</li>`).join('\n            ')}
        </ul>
    `);
  }

  // General note
  const noteHtml = record.generalNote?.trim()
    ? `<p class="note-text">${record.generalNote.trim()}</p>`
    : '';

  // Check GPT: must be included and count > 0
  let gptHtml = '';
  if (record.includeGpt && validGpt.length > 0) {
    const roman = toRomanNumeral(sectionIndex++);
    gptHtml = `
        <!-- Phần danh sách GPT -->
        <p class="section-heading">${roman}/ DANH SÁCH ĐỀ XUẤT GPT (${formatCountDoc(validGpt.length)}):</p>
        <ul class="person-list">
            ${validGpt.map((p) => `<li>${p.fullName}</li>`).join('\n            ')}
        </ul>
    `;
  }

  // Format company lines: ensure "CÔNG TY TNHH CẢNG CONTAINER" is on line 1 and "QUỐC TẾ TÂN CẢNG HẢI PHÒNG" is on line 2
  const rawCompany = record.companyName?.trim() || 'CÔNG TY TNHH CẢNG CONTAINER\nQUỐC TẾ TÂN CẢNG HẢI PHÒNG';
  let companyFormatted = rawCompany;
  if (companyFormatted.includes('CÔNG TY TNHH CẢNG CONTAINER QUỐC TẾ TÂN CẢNG HẢI PHÒNG')) {
    companyFormatted = 'CÔNG TY TNHH CẢNG CONTAINER<br>QUỐC TẾ TÂN CẢNG HẢI PHÒNG';
  } else {
    companyFormatted = companyFormatted.replace(/\n/g, '<br>');
  }

  const innerBody = `
        <!-- Phần Quốc hiệu & Tiêu đề công ty -->
        <table class="header-table">
            <tr>
                <td class="col-left">
                    <p class="company">${companyFormatted}</p>
                    <p class="department">${record.departmentName || 'ĐỘI CƠ GIỚI'}</p>
                </td>
                <td class="col-right">
                    <p class="republic">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p class="motto">Độc lập - Tự do - Hạnh phúc</p>
                </td>
            </tr>
        </table>

        <!-- Ngày tháng -->
        <p class="date">${record.createdCity || 'Hải Phòng'}, ngày ${record.createdDate || '15'} tháng ${record.createdMonth || '04'} năm ${record.createdYear || '2026'}</p>

        <!-- Tiêu đề văn bản -->
        <div class="main-title">
            <p class="title-text">DANH SÁCH XẾP LOẠI THÁNG ${record.evaluationMonth || '03/2026'}</p>
            ${record.groupName ? `<p class="subtitle-text">${record.groupName}</p>` : ''}
        </div>

        ${sectionsHtml.join('\n\n')}

        ${noteHtml}

        ${gptHtml}
  `;

  if (forWord) {
    return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'
      lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Danh Sách Xếp Loại Tháng ${record.evaluationMonth || '03/2026'}</title>
    <!--[if gte mso 9]>
    <xml>
     <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
     </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page Section1 {
            size: 210mm 297mm;
            margin: 20mm 15mm 20mm 30mm;
            mso-header-margin: 36pt;
            mso-footer-margin: 36pt;
            mso-paper-source: 0;
        }
        div.Section1 {
            page: Section1;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 14pt;
            line-height: 1.2;
            margin: 0;
            padding: 0;
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
        .col-left {
            width: 42%;
        }
        .col-right {
            width: 58%;
        }
        .company {
            margin: 0;
            font-size: 11.5pt;
            line-height: 1.25;
            text-transform: uppercase;
        }
        .department {
            margin: 0;
            font-weight: bold;
            font-size: 12pt;
            text-transform: uppercase;
        }
        .republic {
            margin: 0;
            font-weight: bold;
            font-size: 12pt;
            white-space: nowrap;
        }
        .motto {
            margin: 0;
            font-weight: bold;
            font-size: 13pt;
            white-space: nowrap;
        }
        .date {
            text-align: right;
            font-style: italic;
            margin-top: 10px;
            margin-bottom: 20px;
            padding-right: 0px;
        }
        .main-title {
            text-align: center;
            margin-bottom: 20px;
        }
        .title-text {
            margin: 0;
            font-weight: bold;
            font-size: 14pt;
        }
        .subtitle-text {
            margin: 0;
            font-size: 14pt;
        }
        .section-heading {
            font-weight: bold;
            margin-top: 12px;
            margin-bottom: 5px;
        }
        .person-list {
            margin: 0;
            padding-left: 20px;
            list-style-type: none;
        }
        .person-list li {
            margin-bottom: 3px;
        }
        .note-text {
            margin-top: 10px;
            margin-bottom: 15px;
            padding-left: 35px;
        }
    </style>
</head>
<body>
    <div class="Section1">
        ${innerBody}
    </div>
</body>
</html>`;
  }

  // Pure HTML for in-app preview
  return innerBody;
};

/**
 * Downloads the record as a formatted Microsoft Word .doc file
 */
