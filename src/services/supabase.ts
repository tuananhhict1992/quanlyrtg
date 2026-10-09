import { createClient, type User } from "@supabase/supabase-js";
import { sourceForModule, clearSource } from "./excelProcessing";
import { createRequestQueue } from './request-queue';
import { createRealtimeHub } from './realtime-hub';
import { createApiBackoff } from './api-backoff';
import { safeAbortSignalAny, safeTimeoutSignal } from '../utils/polyfills';
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

export function getApiBaseUrl(): string {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('rtg_server_url') : null;
    if (stored) return stored.trim().replace(/\/$/, '');
  } catch {}
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl) return String(envUrl).trim().replace(/\/$/, '');
  return '';
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const baseUrl = getApiBaseUrl();
  let rawUrl = input instanceof Request ? input.url : String(input);
  if (baseUrl && rawUrl.startsWith('/api/')) {
    rawUrl = `${baseUrl}${rawUrl}`;
  }
  const target = new URL(
    rawUrl,
    baseUrl ? new URL(baseUrl).origin : location.origin,
  );
  const isAllowedOrigin = target.origin === location.origin || (Boolean(baseUrl) && target.origin === new URL(baseUrl).origin);
  if (!isAllowedOrigin || !target.pathname.startsWith("/api/"))
    throw new Error("Chỉ gửi phiên xác thực đến API của ứng dụng.");
  const read = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'GET';
  const res = await withApiBackoff(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
    const timeout = read ? safeTimeoutSignal(20000) : undefined;
    const signal = safeAbortSignalAny([init.signal, timeout]);
    return fetch(rawUrl, { ...init, headers, signal });
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
  const baseUrl = getApiBaseUrl();
  const loginUrl = baseUrl ? `${baseUrl}/api/auth/login` : '/api/auth/login';
  const response = await fetch(loginUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }), cache: 'no-store', signal,
  });
  const session = await response.json().catch(() => ({}));
  if (response.status === 503 || response.status === 504)
    throw new Error('Hệ thống đăng nhập đang bận. Vui lòng chờ một lúc rồi thử lại.');
  if (!response.ok) throw new Error(session.error || 'Không thể đăng nhập.');
  if (signal?.aborted) {
    const err = (signal as any).reason || new Error('Yêu cầu đăng nhập đã bị hủy.');
    err.name = 'AbortError';
    throw err;
  }
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
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: location.origin,
      skipBrowserRedirect: isInIframe,
    },
  });
  if (error) throw error;
  if (isInIframe && data?.url) {
    const popup = window.open(data.url, 'google_login', 'width=540,height=680,left=250,top=100');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.open(data.url, '_blank');
    }
  }
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
