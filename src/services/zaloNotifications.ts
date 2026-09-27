import { api } from "./supabase";
export type ZaloDraft = {
  source?: {
    module: "incidents" | "quizzes" | "leaveRequests" | "feedbacks";
    id: string;
  };
  title: string;
  content: string;
  recipientType?: "INDIVIDUAL" | "DEPARTMENT" | "ALL";
  recipientIds?: string[];
  department?: string;
};
export type ZaloRecipient = {
  id: string;
  name: string;
  department: string;
  linked: boolean;
};
export type ZaloPreview = {
  checksum: string;
  configured: boolean;
  text: string;
  recipients: ZaloRecipient[];
  missing: string[];
  deliveryCount: number;
  sendAt: string | null;
};
export type ZaloJob = {
  job_id: string;
  title: string;
  content: string;
  recipient_type: string;
  department: string | null;
  created_at: string;
  send_at: string;
  cancelled_at: string | null;
  total: number;
  success: number;
  failed: number;
  unknown: number;
  pending: number;
};
export type ZaloDelivery = {
  id: string;
  recipient_label: string;
  status: string;
  attempts: number;
  provider_message_id: string | null;
  error_code: string | null;
};
export async function runZaloBatch(
  jobId: string,
  progress?: (count: number) => void,
) {
  for (let i = 0; i < 500; i++) {
    progress?.(i + 1);
    const result = await api<{ processed: boolean }>(
      `/zalo/notifications/${jobId}/process`,
      { method: "POST" },
    );
    if (!result.processed) break;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}
export const deliveryLabel: Record<string, string> = {
  pending: "Chờ gửi",
  processing: "Đang gửi",
  success: "Zalo đã tiếp nhận",
  failed: "Gửi thất bại",
  unknown: "Chưa xác định — cần đối chiếu",
  cancelled: "Đã hủy",
};
export function canNotify(user: any, permission: string) {
  return (
    user?.status === "ACTIVE" &&
    (user.role === "ADMIN" || user.assignedPermissions?.includes(permission))
  );
}
