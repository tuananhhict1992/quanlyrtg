import { Employee, QuizSubmission } from '../types';

/**
 * Kiểm tra xem một nhân sự có phải là tài khoản test / nhân sự ẩn thử nghiệm hay không.
 * Các tài khoản test hoạt động độc lập và không được thống kê, tính toán vào dữ liệu chung của hệ thống.
 */
export function isTestAccount(emp: Partial<Employee> | null | undefined): boolean {
  if (!emp) return false;
  if (emp.isHidden === true) return true;
  const code = (emp.employeeCode || '').trim().toLowerCase();
  if (code.includes('test') || code.startsWith('test') || code.startsWith('thu_nghiem')) return true;
  const name = (emp.fullName || '').trim().toLowerCase();
  if (
    name.includes('tài khoản test') ||
    name.includes('thử nghiệm') ||
    name.includes('account test') ||
    name === 'test' ||
    name.startsWith('test ') ||
    name.endsWith(' test')
  ) return true;
  const email = (emp.email || '').trim().toLowerCase();
  if (email.includes('test@') || email.includes('+test')) return true;
  return false;
}

/**
 * Kiểm tra xem một bài nộp trắc nghiệm có thuộc về tài khoản test hay không.
 */
export function isTestSubmission(
  sub: Partial<QuizSubmission> | null | undefined,
  employees?: Partial<Employee>[]
): boolean {
  if (!sub) return false;
  if (employees && sub.employeeId) {
    const matched = employees.find((e) => e.id === sub.employeeId);
    if (matched && isTestAccount(matched)) return true;
  }
  const name = (sub.employeeName || '').trim().toLowerCase();
  if (
    name.includes('tài khoản test') ||
    name.includes('thử nghiệm') ||
    name.includes('account test') ||
    name === 'test' ||
    name.startsWith('test ') ||
    name.endsWith(' test')
  ) return true;
  return false;
}
