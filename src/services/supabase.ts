import { createClient, type User } from "@supabase/supabase-js";
import { sourceForModule, clearSource } from "./excelProcessing";
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
    },
  },
);
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  const res = await fetch(input, { ...init, headers });
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
  if (!res.ok) throw new Error(data.error || "Không thể thực hiện yêu cầu.");
  return data;
}
export async function loginWithEmail(email: string, password: string) {
  if (!configured)
    throw new Error(
      "Chưa cấu hình Supabase. Xem hướng dẫn triển khai trong README.",
    );
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
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
) {
  return api<{ items: T[]; nextCursor: string | null }>(
    `/records/${module}?limit=${limit}&cursor=${encodeURIComponent(cursor)}`,
  );
}
export async function fetchCollectionOnce<T>(module: string): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  do {
    const page = await fetchCollectionPage<T>(module, cursor, 200);
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
  let timer: ReturnType<typeof setTimeout>;
  const refresh = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const data = await fetchCollectionOnce<T>(module);
      if (active) onData(data);
    } catch (e) {
      if (active) {
        onError?.(e as Error);
        window.dispatchEvent(
          new CustomEvent("rtg:error", { detail: (e as Error).message }),
        );
      }
    } finally {
      running = false;
      if (active && again) {
        again = false;
        void refresh();
      }
    }
  };
  const channel = supabase
    .channel(`${module}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "record_changes",
        filter: `module=eq.${module}`,
      },
      () => {
        clearTimeout(timer);
        timer = setTimeout(refresh, 150);
      },
    )
    .subscribe();
  void refresh();
  return () => {
    active = false;
    clearTimeout(timer);
    void supabase.removeChannel(channel);
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
