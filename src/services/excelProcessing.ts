import { api } from "./supabase";
const pendingSources = new Map<string, string>();
export const sourceForModule = (module: string) => pendingSources.get(module);
export const clearSource = (module: string) => pendingSources.delete(module);
export async function parseWorkbook(file: File, module: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("module", module);
  const result = await api("/operations/excel/preview", {
    method: "POST",
    body,
  });
  pendingSources.set(module, result.source_job_id);
  return result.workbook;
}
