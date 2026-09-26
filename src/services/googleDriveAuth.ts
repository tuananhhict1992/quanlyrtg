import { api, apiFetch, saveDocument } from "./supabase";
import type { DriveFileItem } from "../types";
let connected = false;
let googleUser: any = null;
const listeners = new Set<(user: any) => void>();
// This is connection status, never a Google OAuth access token.
export const getCachedToken = () => (connected ? "backend-managed" : null);
export const auth = {
  onAuthStateChanged: (fn: (user: any) => void) => {
    listeners.add(fn);
    queueMicrotask(() => fn(googleUser));
    return () => {
      listeners.delete(fn);
    };
  },
};
export async function signInWithGoogleDrive() {
  const status = await api("/google/status");
  connected = true;
  googleUser = status.user;
  listeners.forEach((fn) => fn(googleUser));
  return { user: googleUser, accessToken: "backend-managed" };
}
export async function connectGoogleDriveStorage() {
  const connection = await api<{ oauthAppUrl: string | null }>("/google/connection");
  if (connection.oauthAppUrl) {
    const appUrl = new URL(connection.oauthAppUrl);
    if (appUrl.protocol !== "https:" || appUrl.origin !== connection.oauthAppUrl)
      throw new Error("Địa chỉ website kết nối Google không hợp lệ.");
    // Google may reject a hosting alias as an OAuth redirect URI.
    // Establish the browser session and cookie on the registered app origin.
    if (window.location.origin !== appUrl.origin) {
      window.location.assign(appUrl.origin);
      return;
    }
  }
  const { url } = await api<{ url: string }>("/google/oauth/start", {
    method: "POST",
  });
  const target = new URL(url);
  if (target.origin !== "https://accounts.google.com")
    throw new Error("Địa chỉ xác thực Google không hợp lệ.");
  window.location.assign(url);
}
export async function signOutGoogleDrive() {
  connected = false;
  googleUser = null;
  listeners.forEach((fn) => fn(null));
}
export const initGoogleDriveAuth = (
  onSuccess?: (user: any, token: string) => void,
  onFailure?: () => void,
) =>
  auth.onAuthStateChanged((user) =>
    user ? onSuccess?.(user, "backend-managed") : onFailure?.(),
  );
export async function fetchSpreadsheetData(_id: string, range: string) {
  const module = range.includes("EMPLOYEES") ? "employees" : "incidents";
  return api<any[][]>("/google/sheets/rows?module=" + module);
}
export async function fetchDriveFiles(
  parentId = "root",
  search = "",
): Promise<DriveFileItem[]> {
  const all: DriveFileItem[] = [];
  let cursor = "";
  do {
    const page = await api(
      "/google/files?parent=" +
        encodeURIComponent(parentId) +
        "&cursor=" +
        encodeURIComponent(cursor),
    );
    all.push(...page.items);
    cursor = page.nextCursor || "";
  } while (cursor);
  return search
    ? all.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : all;
}
export async function findDriveSpreadsheetByName(
  _name: string,
): Promise<DriveFileItem | null> {
  const s = await api("/google/status");
  return {
    id: s.spreadsheetId,
    name: "RTG_SYSTEM",
    mimeType: "application/vnd.google-apps.spreadsheet",
    webViewLink: s.spreadsheetUrl,
  };
}
export async function createDriveFolder(
  name: string,
  parentId = "root",
): Promise<DriveFileItem> {
  return api("/google/folders", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  });
}
export async function uploadFileToDrive(
  file: File,
  _parentId = "root",
): Promise<DriveFileItem> {
  const recordId = crypto.randomUUID();
  await saveDocument("internalDocuments", recordId, {
    id: recordId,
    title: file.name,
    category: "HUONG_DAN",
    createdAt: new Date().toISOString(),
    archiveStatus: "pending",
  } as any);
  const body = new FormData();
  body.append("file", file);
  body.append("module", "internalDocuments");
  body.append("record_id", recordId);
  const job = await api("/files", { method: "POST", body });
  // Only a confirmed Drive ID is returned to callers that may subsequently clear local data.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await api("/files/" + job.job_id);
    if (result.status === "failed")
      throw new Error(
        "Upload Drive chưa thành công. Tệp tạm vẫn được giữ; Admin có thể Retry Sync.",
      );
    if (result.status === "success" && result.file?.drive_file_id)
      return {
        id: result.file.drive_file_id,
        name: file.name,
        mimeType: file.type,
        webViewLink: result.file.drive_url,
      };
  }
  throw new Error(
    "Tệp đang chờ lưu trữ. Tệp tạm vẫn được giữ; xem trạng thái Google Sync.",
  );
}
export const deleteDriveFile = (id: string) =>
  api("/google/files/" + encodeURIComponent(id), { method: "DELETE" });
export async function downloadDriveFileBlob(id: string, _mime?: string) {
  const res = await apiFetch(
    "/api/google/files/" + encodeURIComponent(id) + "/download",
  );
  if (!res.ok) throw new Error("Không thể tải tệp.");
  return { blob: await res.blob() };
}
