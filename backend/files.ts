import { Router } from "express";
import multer from "multer";

import { randomUUID, createHash } from "node:crypto";
import { pool, transaction, HttpError, asyncRoute } from "./db";
import {
  assertPermission,
  MODULE_PERMISSIONS,
  validModule,
  FOLDER_MODULE,
  readScope,
} from "./security";
import { googleClients } from "./google";
import { audit } from "./records";
import { validateFile } from "./file-validation";
export { validateFile } from "./file-validation";
const MAX_SIZE = 20 * 1024 * 1024;
// Durable temporary bytes in PostgreSQL; never served as public static files.
export async function stageFile(
  user: any,
  buffer: Buffer,
  name: string,
  mime: string,
  module: string,
  recordId: string,
) {
  await validateFile(buffer, mime, name);
  if (!FOLDER_MODULE[module])
    throw new HttpError(400, "Phân hệ tệp không hợp lệ.");
  const hash = createHash("sha256").update(buffer).digest("hex");
  return transaction(async (db) => {
    if (module !== "backup") {
      validModule(module);
      const row = (
        await db.query(
          "select owner_id from private.records where module=$1 and id=$2",
          [module, recordId],
        )
      ).rows[0];
      if (!row)
        throw new HttpError(404, "Lưu bản ghi nghiệp vụ trước khi lưu tệp.");
      if (row.owner_id !== user.id)
        assertPermission(user, MODULE_PERMISSIONS[module]);
    } else assertPermission(user, "MANAGE_PERMISSIONS");
    const jobId = randomUUID();
    const row = (
      await db.query(
        "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive',$2,$3,$4,$5,$6) on conflict(kind,module,record_id,checksum) do update set updated_at=private.sync_queue.updated_at returning *",
        [
          jobId,
          module,
          recordId,
          hash,
          JSON.stringify({
            fileName: name,
            mimeType: mime,
            size: buffer.length,
          }),
          user.id,
        ],
      )
    ).rows[0];
    await db.query(
      "insert into private.temporary_files(job_id,bytes,processed_at,business_saved_at) select $1,$2,now(),now() where exists(select 1 from private.sync_queue where job_id=$1 and status<>'success') on conflict(job_id) do nothing",
      [row.job_id, buffer],
    );
    await audit(db, user.id, "file.stage", module, recordId, {
      job_id: row.job_id,
      checksum: hash,
    });
    return { job_id: row.job_id, status: row.status };
  });
}
export const filesRouter = Router();
export async function findAccessibleArchive(user: any, driveFileId: string) {
  const metadata = (
    await pool.query(
      "select module,record_id,mime_type from private.file_metadata where drive_file_id=$1",
      [driveFileId],
    )
  ).rows[0];
  if (!metadata) throw new HttpError(404, "Không tìm thấy tệp đã lưu trữ.");
  if (metadata.module === "backup")
    assertPermission(user, "MANAGE_PERMISSIONS");
  else {
    const scope = readScope(user, metadata.module);
    const params = [metadata.module, ...scope.params, metadata.record_id];
    const record = await pool.query(
      `select id from private.records where module=$1 and (${scope.clause}) and id=$${params.length}`,
      params,
    );
    if (!record.rows.length)
      throw new HttpError(404, "Không tìm thấy tệp được cấp quyền.");
  }
  return metadata;
}
filesRouter.get(
  "/:driveFileId/content",
  asyncRoute(async (req, res) => {
    const metadata = await findAccessibleArchive(
      req.user,
      req.params.driveFileId,
    );
    const result = await googleClients().drive.files.get(
      { fileId: req.params.driveFileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );
    res.setHeader("Content-Type", metadata.mime_type);
    res.setHeader("Cache-Control", "private, no-store");
    result.data.on("error", () => res.destroy());
    result.data.pipe(res);
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1, fields: 5 },
});
filesRouter.post(
  "/",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Chưa chọn tệp.");
    const module = String(req.body.module || "internalDocuments"),
      recordId = String(req.body.record_id || "");
    res
      .status(202)
      .json(
        await stageFile(
          req.user,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          module,
          recordId,
        ),
      );
  }),
);
filesRouter.post(
  "/feedback/:id/archive",
  asyncRoute(async (req, res) => {
    const row = (
      await pool.query(
        "select data,owner_id from private.records where module='feedbacks' and id=$1",
        [req.params.id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, "Không tìm thấy góp ý.");
    if (row.owner_id !== req.user.id)
      assertPermission(req.user, "MANAGE_FEEDBACK");
    const jobs = [];
    for (const [index, value] of (row.data.images || []).entries()) {
      const match = String(value).match(
        /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s,
      );
      if (!match) continue;
      const ext = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
      jobs.push(
        await stageFile(
          req.user,
          Buffer.from(match[2], "base64"),
          `feedback-${req.params.id}-${index}.${ext}`,
          match[1],
          "feedbacks",
          req.params.id,
        ),
      );
    }
    res.status(202).json({ jobs });
  }),
);
filesRouter.get(
  "/:jobId",
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      "select job_id,status,requested_by from private.sync_queue where job_id=$1",
      [req.params.jobId],
    );
    if (!rows[0]) throw new HttpError(404, "Không tìm thấy tác vụ.");
    if (rows[0].requested_by !== req.user.id)
      assertPermission(req.user, "MANAGE_PERMISSIONS");
    const meta = (
      await pool.query("select * from private.file_metadata where job_id=$1", [
        req.params.jobId,
      ])
    ).rows[0];
    res.json({ ...rows[0], file: meta || null });
  }),
);
