import { Employee, TabType, PermissionKey } from '../types';
import { DEFAULT_VISIBLE_TABS_BY_ROLE } from '../mockData';

/**
 * Bảng ánh xạ quyền nghiệp vụ tối thiểu bắt buộc đối với từng phân hệ
 */
export const TAB_REQUIRED_PERMISSIONS: Partial<Record<TabType, PermissionKey>> = {
  dashboard: 'VIEW_ANALYTICS',
  hr: 'MANAGE_HR',
  bxxl: 'MANAGE_BXXL',
  zalo: 'MANAGE_ZALO',
  permissions: 'MANAGE_PERMISSIONS',
  competency_rules: 'MANAGE_PERMISSIONS',
};

/**
 * Kiểm tra xem người dùng có quyền hiển thị & truy cập vào Tab cụ thể hay không.
 * TUYỆT ĐỐI TUÂN THỦ NGUYÊN TẮC:
 * "chú ý các quyền đã phân thì chỉ hiển thị với người được cấp quyền"
 */
export function isTabAllowed(tabId: TabType, user: Employee | null | undefined): boolean {
  if (!user) return false;

  // 1. Tài khoản bị khóa (không phải ACTIVE) tuyệt đối không có quyền bất kỳ tab nào
  if (user.status !== 'ACTIVE') return false;

  // 2. Tài khoản ADMIN có toàn quyền
  if (user.role === 'ADMIN') return true;

  // 3. Kiểm tra danh sách tab được cấp quyền hiển thị cho người dùng này (visibleTabs)
  const allowedTabs: TabType[] =
    user.visibleTabs && user.visibleTabs.length > 0
      ? user.visibleTabs
      : DEFAULT_VISIBLE_TABS_BY_ROLE[user.role] || ['violations', 'leave', 'container_tool', 'quiz', 'feedback', 'settings'];

  if (!allowedTabs.includes(tabId)) {
    return false;
  }

  // 4. Kiểm tra quyền nghiệp vụ bắt buộc tương ứng của Tab (nếu có)
  const requiredPerm = TAB_REQUIRED_PERMISSIONS[tabId];
  if (requiredPerm) {
    const userPermissions = user.assignedPermissions || [];
    if (!userPermissions.includes(requiredPerm)) {
      return false;
    }
  }

  return true;
}

/**
 * Lấy Tab đầu tiên mà người dùng được phép truy cập
 */
export function getFirstAllowedTab(user: Employee | null | undefined): TabType {
  if (!user) return 'settings';

  const preferredOrder: TabType[] = [
    'dashboard',
    'violations',
    'leave',
    'container_tool',
    'quiz',
    'feedback',
    'drive',
    'settings',
    'hr',
    'bxxl',
    'zalo',
    'permissions',
  ];

  for (const tab of preferredOrder) {
    if (isTabAllowed(tab, user)) {
      return tab;
    }
  }

  return 'settings';
}

/**
 * Kiểm tra nghiêm ngặt điều kiện đăng nhập của người dùng.
 * TUYỆT ĐỐI TUÂN THỦ NGUYÊN TẮC:
 * "những người dùng không được cấp quyền tuyệt đối không đăng nhập vào được ở bất cứ tình huống nào (trừ khi được cấp quyền hạn)"
 */
export function canUserLogin(user: Employee | null | undefined): { allowed: boolean; reason?: string } {
  if (!user) {
    return {
      allowed: false,
      reason: 'Tài khoản không tồn tại trên hệ thống hoặc chưa được cấp quyền hạn truy cập.',
    };
  }

  // 1. Kiểm tra trạng thái kích hoạt tài khoản
  if (user.status !== 'ACTIVE') {
    return {
      allowed: false,
      reason: `Tài khoản "${user.fullName}" (${user.employeeCode}) hiện đang bị tạm khóa hoặc chưa được kích hoạt quyền truy cập. Vui lòng liên hệ Quản trị viên để được cấp quyền.`,
    };
  }

  // 2. Admin luôn được cấp quyền
  if (user.role === 'ADMIN') {
    return { allowed: true };
  }

  // 3. Kiểm tra xem người dùng đã được cấp quyền hạn nào hay chưa (trực tiếp hoặc theo vai trò hệ thống)
  const hasAssignedPermissions = Array.isArray(user.assignedPermissions) && user.assignedPermissions.length > 0;
  const hasVisibleTabs = Array.isArray(user.visibleTabs) && user.visibleTabs.length > 0;
  const roleDefaultTabs = (user.role && DEFAULT_VISIBLE_TABS_BY_ROLE[user.role]) || [];

  // Nếu người dùng không có quyền trực tiếp, không có tab trực tiếp và vai trò cũng không có quyền/tab mặc định
  if (!hasAssignedPermissions && !hasVisibleTabs && roleDefaultTabs.length === 0) {
    return {
      allowed: false,
      reason: `Tài khoản "${user.fullName}" chưa được cấp bất kỳ quyền hạn nào trong hệ thống. Người dùng không được cấp quyền tuyệt đối không thể đăng nhập. Vui lòng liên hệ Quản trị viên.`,
    };
  }

  return { allowed: true };
}
