import { createHash } from "node:crypto";
import { pool, transaction } from "./db";
import { SHEET_TABS, FOLDER_MODULE, checksum } from "./security";
import {
  googleClients,
  spreadsheetId,
  ensureStructure,
  archiveToDrive,
  reserveDriveId,
  ensureSheetRows,
} from "./google";
import { audit, enqueue } from "./records";
import { scheduledMaintenance } from "./scheduler";
const services = {
  googleClients,
  spreadsheetId,
  ensureStructure,
  archiveToDrive,
  reserveDriveId,
  ensureSheetRows,
};
export async function processNextJob(adapters = services) {
  const {
    googleClients,
    spreadsheetId,
    ensureStructure,
    archiveToDrive,
    reserveDriveId,
    ensureSheetRows,
  } = adapters;
  // One session lock serializes all workers, including recovery after process termination.
  const lock = await pool.connect();
  try {
    if (
      !(await lock.query("select pg_try_advisory_lock(726447) as acquired"))
        .rows[0].acquired
    )
      return false;
    await lock.query(
      "update private.sync_queue set status='failed',last_error='Worker dừng trước khi xác nhận kết quả',updated_at=now() where status='processing'",
    );
    const job = await transaction(
      async (db) =>
        (await db.query("select * from private.claim_sync_job()")).rows[0],
    );
    if (!job?.job_id) return false;
    try {
      const folders = await ensureStructure();
      const { sheets } = googleClients();
      await ensureSheetRows("SYNC_LOG", Number(job.sequence) + 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId(),
        range: "'SYNC_LOG'!A1:F1",
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              "job_id",
              "module",
              "record_id",
              "status",
              "timestamp",
              "file_metadata",
            ],
          ],
        },
      });
      if (job.kind === "drive") {
        let id = job.drive_file_id;
        if (!id) {
          id = await reserveDriveId();
          await pool.query(
            "update private.sync_queue set drive_file_id=$2 where job_id=$1",
            [job.job_id, id],
          );
        }
        const temp = (
          await pool.query(
            "select * from private.temporary_files where job_id=$1",
            [job.job_id],
          )
        ).rows[0];
        if (!temp?.processed_at || !temp.business_saved_at)
          throw new Error("Chưa xác nhận xử lý và lưu dữ liệu nghiệp vụ.");
        const result = await archiveToDrive(
          id,
          job.payload.fileName,
          job.payload.mimeType,
          folders[FOLDER_MODULE[job.module]],
          temp.bytes,
        );
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId(),
          range: `'SYNC_LOG'!A${Number(job.sequence) + 1}:F${Number(job.sequence) + 1}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                job.job_id,
                job.module,
                job.record_id,
                "success",
                new Date().toISOString(),
                JSON.stringify({
                  drive_file_id: result.id,
                  drive_url: result.webViewLink,
                  file_name: job.payload.fileName,
                  mime_type: job.payload.mimeType,
                  size: job.payload.size,
                  uploaded_by: job.requested_by,
                }),
              ],
            ],
          },
        });
        await transaction(async (db) => {
          await db.query(
            "insert into private.file_metadata(job_id,drive_file_id,drive_url,file_name,mime_type,size,module,record_id,uploaded_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(job_id) do nothing",
            [
              job.job_id,
              result.id,
              result.webViewLink ||
                `https://drive.google.com/file/d/${result.id}/view`,
              job.payload.fileName,
              job.payload.mimeType,
              job.payload.size,
              job.module,
              job.record_id,
              job.requested_by,
            ],
          );
          if (job.module === "internalDocuments") {
            const row = (
              await db.query(
                "select data from private.records where module='internalDocuments' and id=$1 for update",
                [job.record_id],
              )
            ).rows[0];
            if (
              row?.data.fileUrl?.startsWith("data:") &&
              createHash("sha256")
                .update(Buffer.from(row.data.fileUrl.split(",")[1], "base64"))
                .digest("hex") === job.checksum
            ) {
              const data = {
                ...row.data,
                fileUrl:
                  result.webViewLink ||
                  `https://drive.google.com/file/d/${result.id}/view`,
                driveFileId: result.id,
              };
              await db.query(
                "update private.records set data=$2,checksum=$3,updated_at=now() where module='internalDocuments' and id=$1",
                [job.record_id, JSON.stringify(data), checksum(data)],
              );
              await db.query(
                "insert into public.record_changes(module) values('internalDocuments')",
              );
            }
          }
          if (job.module === "feedbacks") {
            const row = (
              await db.query(
                "select data from private.records where module='feedbacks' and id=$1 for update",
                [job.record_id],
              )
            ).rows[0];
            if (row) {
              const data = row.data;
              data.images = (data.images || []).map((value: string) =>
                value.startsWith("data:") &&
                createHash("sha256")
                  .update(Buffer.from(value.split(",")[1], "base64"))
                  .digest("hex") === job.checksum
                  ? result.webViewLink ||
                    `https://drive.google.com/file/d/${result.id}/view`
                  : value,
              );
              data.imagesArchived = !data.images.some((value: string) =>
                value.startsWith("data:"),
              );
              await db.query(
                "update private.records set data=$2,checksum=$3,updated_at=now() where module='feedbacks' and id=$1",
                [job.record_id, JSON.stringify(data), checksum(data)],
              );
              await enqueue(
                db,
                "feedbacks",
                job.record_id,
                data,
                job.requested_by,
              );
              await db.query(
                "insert into public.record_changes(module) values('feedbacks')",
              );
            }
          }
          await db.query(
            "update private.temporary_files set archived_at=now() where job_id=$1",
            [job.job_id],
          );
          await db.query(
            "update private.sync_queue set status='success',last_error=null,updated_at=now() where job_id=$1",
            [job.job_id],
          );
          await audit(
            db,
            job.requested_by,
            "google.sync.success",
            job.module,
            job.record_id,
            { job_id: job.job_id },
          );
          await db.query(
            "delete from private.temporary_files where job_id=$1 and processed_at is not null and business_saved_at is not null and archived_at is not null and exists(select 1 from private.file_metadata where job_id=$1 and drive_file_id is not null)",
            [job.job_id],
          );
        });
      } else {
        // Each job has a permanent row slot. Retrying after an ambiguous response overwrites that slot.
        const tab = SHEET_TABS[job.module];
        if (!tab) throw new Error("Phân hệ không có tab báo cáo.");
        if (!job.sheet_row) {
          const slot = await transaction(async (db) => {
            await db.query(
              "insert into private.sheet_counters(tab,next_row) values($1,2) on conflict do nothing",
              [tab],
            );
            const n = (
              await db.query(
                "update private.sheet_counters set next_row=next_row+1 where tab=$1 returning next_row-1 as n",
                [tab],
              )
            ).rows[0].n;
            await db.query(
              "update private.sync_queue set sheet_row=$2 where job_id=$1",
              [job.job_id, n],
            );
            return n;
          });
          job.sheet_row = slot;
        }
        await ensureSheetRows(tab, Number(job.sheet_row));
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId(),
          range: `'${tab}'!A1:F1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                "job_id",
                "record_id",
                "checksum",
                "snapshot_json",
                "requested_by",
                "created_at",
              ],
            ],
          },
        });
        const payload = JSON.stringify(job.payload);
        if (payload.length > 45000)
          throw new Error(
            "Bản ghi vượt giới hạn ô Sheets. Xuất tệp báo cáo lên Drive.",
          );
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId(),
          range: `'${tab}'!A${job.sheet_row}:F${job.sheet_row}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                job.job_id,
                job.record_id,
                job.checksum,
                payload,
                job.requested_by,
                job.created_at.toISOString(),
              ],
            ],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId(),
          range: `'SYNC_LOG'!A${Number(job.sequence) + 1}:E${Number(job.sequence) + 1}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                job.job_id,
                tab,
                job.record_id,
                "success",
                new Date().toISOString(),
              ],
            ],
          },
        });
        await transaction(async (db) => {
          await db.query(
            "update private.sync_queue set status='success',last_error=null,updated_at=now() where job_id=$1",
            [job.job_id],
          );
          await audit(
            db,
            job.requested_by,
            "google.sync.success",
            job.module,
            job.record_id,
            { job_id: job.job_id },
          );
        });
      }
    } catch (e: any) {
      await transaction(async (db) => {
        await db.query(
          "update private.sync_queue set status='failed',last_error=$2,updated_at=now() where job_id=$1",
          [
            job.job_id,
            "Google đồng bộ thất bại; kiểm tra cấu hình, quota và quyền thư mục.",
          ],
        );
        await audit(
          db,
          job.requested_by,
          "google.sync.failed",
          job.module,
          job.record_id,
          {
            job_id: job.job_id,
            error_code: e.code || e.status || "external_error",
          },
        );
      });
    }
    return true;
  } finally {
    await lock.query("select pg_advisory_unlock(726447)");
    lock.release();
  }
}
export function startWorker() {
  let stopped = false,
    timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try {
      await scheduledMaintenance();
      await processNextJob();
    } catch {
      console.error("Sync worker unavailable; retained pending jobs.");
    }
    if (!stopped) timer = setTimeout(tick, 5000);
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
