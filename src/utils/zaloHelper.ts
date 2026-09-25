/**
 * Zalo Messaging & Gateway Utilities
 * Supports direct 1-1 chat links, clipboard auto-copying, phone normalization, and message formatting.
 */

export function cleanZaloPhone(phone: any): string {
  if (!phone) return '';
  // Remove spaces, dots, dashes, parentheses
  let cleaned = String(phone).trim().replace(/[\s.\-()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 10) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

export function isValidVietnamesePhone(phone: string): boolean {
  const cleaned = cleanZaloPhone(phone);
  return /^0[3|5|7|8|9][0-9]{8}$/.test(cleaned);
}

export function getZaloDirectUrl(phone: string): string {
  const cleaned = cleanZaloPhone(phone);
  return cleaned ? `https://zalo.me/${cleaned}` : 'https://chat.zalo.me';
}

export function formatZaloContent(title: string, content: string, sender?: string): string {
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  const cleanSender = sender?.trim() || 'Ban Điều Hành RTG';

  return `📢 ${cleanTitle.toUpperCase()}\n\n${cleanContent}\n\n---\n👤 Người gửi: ${cleanSender}\n🏢 Hệ thống Quản trị & Điều hành RTG`;
}

export async function copyMessageToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure or iframe contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.warn('Clipboard copy error:', err);
    return false;
  }
}
