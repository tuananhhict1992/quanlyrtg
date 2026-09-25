import { HttpError } from "./db";
import { redact } from "./security";

export function parseReportRows(values: any[][] = []) {
  if (values[0]?.[3] !== "snapshot_json")
    throw new HttpError(
      400,
      "Bảng nhập cần đúng định dạng báo cáo RTG (snapshot_json).",
    );
  if (values.length > 10001)
    throw new HttpError(
      400,
      "Báo cáo vượt 10.000 dòng lịch sử; cần tách kỳ trước khi nhập.",
    );
  const latest = new Map<string, any>();
  for (const row of values.slice(1)) {
    if (!row[3]) continue;
    let value: any;
    try {
      value = JSON.parse(row[3]);
    } catch {
      throw new HttpError(400, "Báo cáo chứa snapshot_json không hợp lệ.");
    }
    if (
      !value ||
      Array.isArray(value) ||
      typeof value.id !== "string" ||
      !value.id
    )
      throw new HttpError(400, "Bản ghi báo cáo thiếu ID hợp lệ.");
    latest.set(value.id, redact(value));
  }
  // Apply tombstones after choosing the latest snapshot, never revive older versions.
  const rows = [...latest.values()].filter((row) => !row.deleted);
  if (rows.length > 500)
    throw new HttpError(400, "Mỗi lần xem trước tối đa 500 bản ghi hiện hành.");
  if (!rows.length) throw new HttpError(400, "Không có bản ghi hợp lệ.");
  return rows;
}
