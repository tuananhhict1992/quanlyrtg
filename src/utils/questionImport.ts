import * as XLSX from 'xlsx';
import type { QuizQuestion } from '../types';

export type QuestionImportReport = { questions: QuizQuestion[]; detected: number; issues: string[] };
const normalize=(value:unknown)=>String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const cell=(value:unknown)=>String(value ?? '').trim();
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function extractAnswerLabels(answer: string): string[] {
  const cleaned = answer.trim();
  if (!cleaned) return [];
  const prefixRemoved = cleaned.replace(/^(?:đáp án(?:\s+đúng)?|answer)\s*[:\-]?\s*/iu, '').trim();
  if (!prefixRemoved) return [];
  const tokens = prefixRemoved.split(/[,;+&]|\s+và\s+/iu).map(s => s.trim().replace(/[.)]$/, '')).filter(Boolean);
  const labels: string[] = [];
  for (const token of tokens) {
    const m = token.toUpperCase().match(/^([A-Z])$/);
    if (m) labels.push(m[1]);
    else return [];
  }
  return Array.from(new Set(labels));
}

function question(text:string,answers:{label:string;text:string}[],answer:string,explanation='',citation=''):QuizQuestion {
  const labels = extractAnswerLabels(answer);
  const options = answers.map(a=>({id:'opt-'+a.label.toLowerCase(),text:a.text}));
  const matched = labels.map(l => options.find(o => o.id === 'opt-' + l.toLowerCase())?.id).filter(Boolean) as string[];
  const isValid = matched.length === labels.length && labels.length > 0;
  const correctOptionIds = isValid ? matched : [];
  return {
    id: 'imp-' + crypto.randomUUID(),
    question: text,
    options,
    correctOptionId: correctOptionIds.join(','),
    correctOptionIds,
    questionType: correctOptionIds.length > 1 ? 'MULTIPLE' : 'SINGLE',
    explanation,
    citation
  };
}

export function parseQuestionWorkbook(book:XLSX.WorkBook):QuestionImportReport {
  const report:QuestionImportReport={questions:[],detected:0,issues:[]};
  for(const sheetName of book.SheetNames){
    const rows=XLSX.utils.sheet_to_json<any[]>(book.Sheets[sheetName],{header:1,defval:'',blankrows:false});
    let columns:string[]=[];
    for(let index=0;index<rows.length;index++){
      const row=rows[index], headers=row.map(normalize);
      if(headers.some(h=>['cau hoi','noi dung cau hoi','question','noi dung'].includes(h)) && headers.some(h=>/^(lua chon |phuong an |dap an |option )?a$/.test(h))) {columns=headers;continue;}
      if(!columns.length){if(row.some(v=>cell(v)))report.issues.push(`${sheetName}, dòng ${index+1}: chưa nhận diện tiêu đề cột.`);continue;}
      const value=(names:string[])=>cell(row[columns.findIndex(h=>names.includes(h))]);
      const q=value(['cau hoi','noi dung cau hoi','question','noi dung']);
      if(!q){if(row.some(v=>cell(v)))report.issues.push(`${sheetName}, dòng ${index+1}: thiếu nội dung câu hỏi.`);continue;}
      report.detected++;
      const options=ALPHABET.map(label=>({label,text:value([label.toLowerCase(),...['lua chon ','phuong an ','dap an ','option '].map(p=>p+label.toLowerCase())])})).filter(o=>o.text);
      if(options.length<2){report.issues.push(`${sheetName}, dòng ${index+1}: câu hỏi thiếu lựa chọn, chưa đưa vào danh sách.`);continue;}
      const answerIndex=columns.findIndex(h=>/^(dap an dung|dap an|answer|correct answer|cac dap an dung)(\s*\(.*\))?$/.test(h));
      const result=question(q,options,cell(row[answerIndex]),value(['giai thich','explanation']),value(['can cu quy che','can cu','citation']));
      if(!result.correctOptionId)report.issues.push(`${sheetName}, dòng ${index+1}: đáp án ${cell(row[answerIndex]) || '(trống)'} — cần rà soát trước khi lưu.`);
      report.questions.push(result);
    }
  }
  return report;
}

export function parseQuestionText(raw:string):QuestionImportReport {
  const report:QuestionImportReport={questions:[],detected:0,issues:[]};
  // Numbered questions are imported in full; this path never calls generative AI.
  const blocks=raw.replace(/\r\n?/g,'\n').split(/(?=^\s*(?:Câu(?:\s+hỏi)?|Question)\s*\d+\s*[.:)\-])/imu);
  for(const block of blocks){
    const start=block.match(/^\s*(?:Câu(?:\s+hỏi)?|Question)\s*(\d+)\s*[.:)\-]\s*/iu);
    if(!start)continue;
    report.detected++;
    const body=block.slice(start[0].length), optionPattern=/^\s*([A-Z])[.)]\s*(.*)$/gm;
    const matches=[...body.matchAll(optionPattern)];
    if(matches.length<2){report.issues.push(`Câu ${start[1]}: chưa tách được các phương án trả lời.`);continue;}
    const metadata=body.match(/^\s*(?:Đáp án(?:\s+đúng)?|Answer)\s*[:\-]\s*([^\n]*)/im);
    const metadataStart=body.search(/^\s*(?:Đáp án(?:\s+đúng)?|Answer|Giải thích|Căn cứ)\s*[:\-]/im);
    const options=matches.filter(m=>metadataStart<0 || m.index!<metadataStart).map((m,i,all)=>({label:m[1],text:body.slice(m.index!+m[0].indexOf(m[2]),Math.min(all[i+1]?.index ?? body.length,metadataStart<0?body.length:metadataStart)).trim()}));
    const result=question(body.slice(0,matches[0].index).trim(),options,metadata?.[1] || '',body.match(/^\s*Giải thích\s*:\s*(.*)$/im)?.[1]||'',body.match(/^\s*Căn cứ\s*:\s*(.*)$/im)?.[1]||'');
    if(!result.question || options.length<2){report.issues.push(`Câu ${start[1]}: nội dung chưa hợp lệ.`);continue;}
    if(!result.correctOptionId)report.issues.push(`Câu ${start[1]}: cần chọn đáp án đúng trước khi lưu.`);
    report.questions.push(result);
  }
  return report;
}
