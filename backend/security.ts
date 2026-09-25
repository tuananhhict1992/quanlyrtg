import { createHash } from "node:crypto";
import { HttpError } from "./db";
export const MODULE_PERMISSIONS: Record<string, string> = {
  employees: "MANAGE_HR",
  internalDocuments: "MANAGE_LIBRARY",
  questionFolders: "MANAGE_QUIZ",
  questionBank: "MANAGE_QUIZ",
  quizzes: "MANAGE_QUIZ",
  quizSubmissions: "MANAGE_QUIZ",
  feedbacks: "MANAGE_FEEDBACK",
  zaloMessages: "MANAGE_ZALO",
  settings: "MANAGE_PERMISSIONS",
  bxxlRecords: "MANAGE_BXXL",
  leaveRequests: "MANAGE_LEAVE",
  incidents: "MANAGE_VIOLATIONS",
  competencyEvents: "MANAGE_PERMISSIONS",
  shipProductivity: "MANAGE_CONTAINER_TOOL",
};
export const SHEET_TABS: Record<string, string> = {
  employees: "EMPLOYEES",
  incidents: "VIOLATIONS",
  bxxlRecords: "RANKINGS",
  leaveRequests: "LEAVE",
  shipProductivity: "SHIP_PRODUCTIVITY",
  quizzes: "EXAMS",
  quizSubmissions: "EXAM_RESULTS",
  feedbacks: "FEEDBACK",
  zaloMessages: "NOTIFICATIONS",
  competencyEvents: "COMPETENCY_EVENTS",
};
export const FOLDERS = [
  "01_NHAN_SU",
  "02_VI_PHAM",
  "03_BINH_XET",
  "04_NGHI_PHEP",
  "05_SAN_LUONG",
  "06_KIEM_TRA",
  "07_GOP_Y",
  "08_THONG_BAO",
  "09_TAI_LIEU",
  "10_BACKUP",
];
export const FOLDER_MODULE: Record<string, string> = {
  employees: FOLDERS[0],
  incidents: FOLDERS[1],
  bxxlRecords: FOLDERS[2],
  leaveRequests: FOLDERS[3],
  shipProductivity: FOLDERS[4],
  quizzes: FOLDERS[5],
  quizSubmissions: FOLDERS[5],
  questionBank: FOLDERS[5],
  feedbacks: FOLDERS[6],
  zaloMessages: FOLDERS[7],
  internalDocuments: FOLDERS[8],
  backup: FOLDERS[9],
};
export function hasPermission(user: any, permission: string) {
  return (
    user?.status === "ACTIVE" &&
    (user.role === "ADMIN" || user.assignedPermissions?.includes(permission))
  );
}
export function assertPermission(user: any, permission: string) {
  if (!hasPermission(user, permission))
    throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
}
export function validModule(module: string) {
  if (!Object.hasOwn(MODULE_PERMISSIONS, module))
    throw new HttpError(404, "Không tìm thấy phân hệ.");
  return module;
}
export function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const checksum = (value: any) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function redact(value: any, answers = false): any {
  if (Array.isArray(value)) return value.map((v) => redact(v, answers));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            !/(password|secret|accessToken|refreshToken|apiKey|privateKey|webhookUrl)/i.test(
              k,
            ) &&
            (!answers ||
              ![
                "correctOptionId",
                "explanation",
                "correctAnswer",
                "isCorrect",
              ].includes(k)),
        )
        .map(([k, v]) => [k, redact(v, answers)]),
    );
  return value;
}
export function readScope(
  user: any,
  module: string,
): { clause: string; params: any[] } {
  validModule(module);
  if (hasPermission(user, MODULE_PERMISSIONS[module]))
    return { clause: "true", params: [] };
  if (["internalDocuments", "questionFolders", "quizzes"].includes(module))
    return { clause: "true", params: [] };
  if (module === "questionBank") return { clause: "false", params: [] };
  if (module === "settings") return { clause: "id='global'", params: [] };
  if (module === "employees") return { clause: "id=$2", params: [user.id] };
  if (module === "feedbacks")
    return {
      clause: "(owner_id=$2 or data->>'status'='APPROVED')",
      params: [user.id],
    };
  if (module === "zaloMessages")
    return {
      clause:
        "(owner_id=$2 or data->'recipientIds' ? $2 or data->>'recipientType'='ALL' or (data->>'recipientType'='DEPARTMENT' and data->>'department'=$3))",
      params: [user.id, user.department],
    };
  return { clause: "owner_id=$2", params: [user.id] };
}
export function authorizeWrite(
  user: any,
  module: string,
  next: any,
  previous: any | null,
) {
  validModule(module);
  if (module === "quizSubmissions")
    throw new HttpError(403, "Nộp bài qua API chấm điểm.");
  if (module === "employees") {
    const guarded = ["role", "assignedPermissions", "visibleTabs", "status"];
    if (guarded.some((k) => canonical(next[k]) !== canonical(previous?.[k])))
      assertPermission(user, "MANAGE_PERMISSIONS");
    if (hasPermission(user, "MANAGE_HR")) return;
    if (
      previous &&
      hasPermission(user, "MANAGE_PERMISSIONS") &&
      Object.keys(next).every(
        (k) =>
          guarded.includes(k) || canonical(next[k]) === canonical(previous[k]),
      )
    )
      return;
    if (next.id === user.id && previous) {
      const allowed = [
        "fullName",
        "dateOfBirth",
        "phone",
        "zaloPhone",
        "zaloSynced",
        "avatar",
        "onboardingCompleted",
      ];
      if (
        Object.keys(next).every(
          (k) =>
            allowed.includes(k) ||
            canonical(next[k]) === canonical(previous[k]),
        )
      )
        return;
    }
    assertPermission(user, "MANAGE_HR");
  }
  if (hasPermission(user, MODULE_PERMISSIONS[module])) return;
  if (
    module === "leaveRequests" &&
    next.employeeId === user.id &&
    (!previous ||
      (previous.employeeId === user.id && previous.status === "PENDING")) &&
    next.status === "PENDING" &&
    !next.approvedBy &&
    !next.approvedAt
  )
    return;
  if (
    module === "feedbacks" &&
    next.authorId === user.id &&
    (!previous ||
      (previous.authorId === user.id && previous.status === "PENDING")) &&
    next.status === "PENDING" &&
    !next.pointsDeductedApplied &&
    !next.adminResponse
  )
    return;
  if (module === "quizzes" && !previous && hasPermission(user, "CREATE_QUIZ"))
    return;
  if (
    module === "internalDocuments" &&
    previous &&
    next.viewCount === Number(previous.viewCount || 0) + 1 &&
    Object.keys(next).every(
      (k) => k === "viewCount" || canonical(next[k]) === canonical(previous[k]),
    )
  )
    return;
  throw new HttpError(403, "Bạn không có quyền thay đổi bản ghi này.");
}
export function auditActions(
  module: string,
  next: any,
  previous: any,
): string[] {
  const out = [module + "." + (previous ? "edit" : "create")];
  if (module === "employees") {
    if (next.role !== previous?.role) out.push("role.change");
    if (
      canonical(next.assignedPermissions) !==
        canonical(previous?.assignedPermissions) ||
      canonical(next.visibleTabs) !== canonical(previous?.visibleTabs)
    )
      out.push("permission.change");
  }
  if (
    module === "leaveRequests" &&
    next.status !== previous?.status &&
    ["APPROVED", "REJECTED"].includes(next.status)
  )
    out.push(next.status === "APPROVED" ? "leave.approve" : "leave.reject");
  if (
    module === "feedbacks" &&
    next.status === "APPROVED" &&
    previous?.status !== "APPROVED"
  )
    out.push("feedback.approve");
  if (module === "quizzes") out.push("exam.publish");
  if (
    module === "settings" &&
    canonical(next.competencyRules) !== canonical(previous?.competencyRules)
  )
    out.push("competency_rule.change");
  if (module === "bxxlRecords") out.push("ranking.finalize");
  if (module === "incidents") out.push("violation.import");
  return out;
}
