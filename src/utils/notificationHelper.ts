/**
 * Utility helpers for In-App Internal Notifications and Scheduling
 */
import { InternalMessage, Employee } from '../types';

export function formatNotificationTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return timeStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return timeStr;
  }
}

export function getTimeUntilScheduled(scheduledAt?: string): string {
  if (!scheduledAt) return '';
  try {
    const target = new Date(scheduledAt.replace(' ', 'T')).getTime();
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) return 'Đã đến giờ phát';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Còn ${diffDays} ngày ${diffHours % 24} giờ`;
    }
    if (diffHours > 0) {
      return `Còn ${diffHours} giờ ${diffMins % 60} phút`;
    }
    return `Còn ${diffMins} phút`;
  } catch {
    return '';
  }
}

export function isUserRecipientOfMessage(msg: InternalMessage, user?: Employee | null): boolean {
  if (!user) return false;
  // 1. Toàn thể
  if (msg.recipientType === 'ALL') return true;

  // 2. Ca trực / Phòng ban
  if (msg.recipientType === 'DEPARTMENT') {
    return msg.department?.trim().toLowerCase() === user.department?.trim().toLowerCase();
  }

  // 3. Cá nhân
  if (msg.recipientType === 'INDIVIDUAL') {
    if (msg.recipientIds && msg.recipientIds.includes(user.id)) return true;
    if (msg.recipientNames && msg.recipientNames.includes(user.fullName)) return true;
  }

  return false;
}
