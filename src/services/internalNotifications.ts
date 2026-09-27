import { api } from "./supabase";
import type { ZaloMessage } from "../types";
export type InternalDraft = {
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
export type InternalRecipient = {
  id: string;
  name: string;
  department: string;
};
export type InternalPreview = {
  checksum: string;
  recipients: InternalRecipient[];
  title: string;
  content: string;
  scheduledAt: string | null;
};
export const canNotify = (user: any, permission: string) =>
  user?.status === "ACTIVE" &&
  (user.role === "ADMIN" || user.assignedPermissions?.includes(permission));
export async function postInternalMessage(message: ZaloMessage) {
  const input = {
    title: message.title,
    content: message.content,
    recipientType: message.recipientType,
    recipientIds: message.recipientIds,
    department: message.department,
    priority: message.priority,
    scheduledAt:
      message.status === "SCHEDULED" ? message.scheduledAt : undefined,
  };
  const preview = await api<InternalPreview>(
    "/internal-notifications/preview",
    { method: "POST", body: JSON.stringify(input) },
  );
  return api<ZaloMessage>("/internal-notifications/send", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      jobId: message.id,
      previewChecksum: preview.checksum,
    }),
  });
}
