import { createClient, type User } from "@supabase/supabase-js";
import { sourceForModule, clearSource } from "./excelProcessing";
import { createRequestQueue } from './request-queue';
import { createRealtimeHub } from './realtime-hub';
import { createApiBackoff } from './api-backoff';
export type { User };
const env = (import.meta as any).env;
export const configured = !!(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
);
export const supabase = createClient(
  env.VITE_SUPABASE_URL || "https://unconfigured.supabase.co",
  env.VITE_SUPABASE_PUBLISHABLE_KEY || "unconfigured",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
const collectionRead = createRequestQueue(3);
const observeChanges = createRealtimeHub(supabase);
const withApiBackoff = createApiBackoff(() => window.dispatchEvent(new CustomEvent('rtg:info', {detail:'Đang tạm giãn tải dữ liệu. Hệ thống sẽ tự cập nhật lại; bạn không cần đăng nhập lại.'})));
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const target = new URL(
    input instanceof Request ? input.url : String(input),
    location.origin,
  );
  if (target.origin !== location.origin || !target.pathname.startsWith("/api/"))
    throw new Error("Chỉ gửi phiên xác thực đến API của ứng dụng.");
  const read = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'GET';
  const res = await withApiBackoff(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
    const timeout = read ? AbortSignal.timeout(20000) : undefined;
    const signal = init.signal && timeout ? AbortSignal.any([init.signal, timeout]) : init.signal || timeout;
    return fetch(input, { ...init, headers, signal });
  }, read, init.signal || undefined);
  if (res.status === 401) {
    await supabase.auth.signOut();
    window.dispatchEvent(
      new CustomEvent("rtg:error", {
        detail: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      }),
    );
  }
  return res;
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch("/api" + path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || "Không thể thực hiện yêu cầu."), {status:res.status});
  return data;
}
export async function loginWithUsername(username: string, password: string, signal?: AbortSignal) {
  if (!configured)
    throw new Error(
      "Chưa cấu hình Supabase. Xem hướng dẫn triển khai trong README.",
    );
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }), cache: 'no-store', signal,
  });
  const session = await response.json().catch(() => ({}));
  if (response.status === 503 || response.status === 504)
    throw new Error('Hệ thống đăng nhập đang bận. Vui lòng chờ một lúc rồi thử lại.');
  if (!response.ok) throw new Error(session.error || 'Không thể đăng nhập.');
  signal?.throwIfAborted();
  const { data, error } = await supabase.auth.setSession(session);
  if (error) throw error;
  return data.user;
}
export async function changeOwnPassword(currentPassword: string, password: string) {
  const result = await api('/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, password }) });
  if (result.session) {
    const { error } = await supabase.auth.setSession(result.session);
    if (error) throw new Error('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
  } else await logoutUser();
}
export async function loginWithGoogle() {
  if (!configured) throw new Error("Chưa cấu hình Supabase.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin },
  });
  if (error) throw error;
}
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}
export function handleDatabaseError(error: unknown) {
  throw error instanceof Error ? error : new Error("Lỗi dữ liệu.");
}
export async function fetchCollectionPage<T>(
  module: string,
  cursor = "",
  limit = 100,
  signal?: AbortSignal,
) {
  return collectionRead(() => api<{ items: T[]; nextCursor: string | null }>(
    `/records/${module}?limit=${limit}&cursor=${encodeURIComponent(cursor)}`,
    { signal },
  ));
}
export async function fetchCollectionOnce<T>(module: string, signal?: AbortSignal): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  do {
    signal?.throwIfAborted();
    const page = await fetchCollectionPage<T>(module, cursor, 200, signal);
    out.push(...page.items);
    cursor = page.nextCursor || "";
  } while (cursor);
  return out;
}
export function subscribeToCollection<T>(
  module: string,
  onData: (data: T[]) => void,
  onError?: (e: Error) => void,
) {
  let active = true,
    running = false,
    again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastStarted = 0, lastSuccess = 0;
  const cancelled = new AbortController();
  const refresh = async () => {
    if (!active) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    lastStarted = Date.now();
    try {
      const data = await fetchCollectionOnce<T>(module, cancelled.signal);
      if (active) { lastSuccess = Date.now(); onData(data); }
    } catch (e) {
      if (active) {
        onError?.(e as Error);
        if ((e as any).status !== 429) window.dispatchEvent(
          new CustomEvent("rtg:error", { detail: (e as Error).message }),
        );
      }
    } finally {
      running = false;
      if (active && again) {
        again = false;
        schedule();
      }
    }
  };
  const schedule = () => {
    if (!active || timer) return;
    timer = setTimeout(() => {timer=undefined;void refresh();}, Math.max(150 + Math.random() * 350, 3000 - (Date.now() - lastStarted)));
  };
  const unsubscribe = observeChanges(module, schedule);
  schedule();
  // Every account subscribes; bounded fallback also covers a temporarily unavailable WebSocket.
  const fallbackTimer = setInterval(() => {if(document.visibilityState!=='hidden')schedule();}, (module === 'zaloMessages' ? 30000 : 60000) + Math.random() * 10000);
  const resume = () => { if (Date.now() - lastSuccess >= 30000) schedule(); };
  const changed = (event:Event) => {if((event as CustomEvent).detail===module)schedule();};
  window.addEventListener('rtg:records-changed',changed);
  window.addEventListener('online',resume);
  window.addEventListener('focus',resume);
  return () => {
    active = false;
    cancelled.abort();
    clearTimeout(timer);
    clearInterval(fallbackTimer);
    window.removeEventListener('online',resume);
    window.removeEventListener('focus',resume);
    window.removeEventListener('rtg:records-changed',changed);
    unsubscribe();
  };
}
export function subscribeToDocument<T>(
  module: string,
  id: string,
  onData: (data: T | null) => void,
  onError?: (e: Error) => void,
) {
  return subscribeToCollection<any>(
    module,
    (items) => onData(items.find((d) => d.id === id) || null),
    onError,
  );
}
export async function saveDocument<T extends { id?: string }>(
  module: string,
  id: string,
  data: Partial<T>,
  merge = true,
): Promise<any> {
  return api(`/records/${module}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ data, merge }),
  });
}
export async function saveDocumentsBatch<T extends { id?: string }>(
  module: string,
  items: { id: string; data: Partial<T> }[],
  merge = true,
) {
  for (let i = 0; i < items.length; i += 500)
    await api(`/records/${module}/batch`, {
      method: "POST",
      body: JSON.stringify({
        items: items.slice(i, i + 500),
        merge,
        source_job_id:
          i + 500 >= items.length ? sourceForModule(module) : undefined,
      }),
    });
  if (items.length) clearSource(module);
}
export const updateDocumentFields = (
  module: string,
  id: string,
  fields: Record<string, any>,
) => saveDocument(module, id, fields, true);
export const deleteDocument = (module: string, id: string) =>
  api(`/records/${module}/${encodeURIComponent(id)}`, { method: "DELETE" });
