import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool, transaction, HttpError, asyncRoute } from "./db";
import {
  googleClients,
  spreadsheetId,
  ensureStructure,
  assertInRoot,
  driveRootId,
} from "./google";
import {
  googleConnection,
  googleOAuthConfigured,
  googleAppOrigin,
  readGoogleConnection,
} from "./google-connection";
import { startGoogleOAuth } from "./google-oauth";
import { processNextJob } from "./worker";
import {
  assertPermission,
  checksum,
  MODULE_PERMISSIONS,
  SHEET_TABS,
  redact,
  validModule,
} from "./security";
import { enqueue, audit, writeRecord } from "./records";
import { parseReportRows } from "./report-import";
export const googleRouter = Router();
googleRouter.post("/oauth/start", asyncRoute(startGoogleOAuth));
googleRouter.get(
  "/connection",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const ready = googleOAuthConfigured();
    const row = ready
      ? await readGoogleConnection()
      : process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
        ? {
            root_id: process.env.GOOGLE_DRIVE_ROOT_ID,
            spreadsheet_id: process.env.GOOGLE_SPREADSHEET_ID,
            email: process.env.GOOGLE_CLIENT_EMAIL,
          }
        : null;
    res.json({
      oauthAvailable: ready,
      oauthAppUrl: ready ? googleAppOrigin() : null,
      connected: !!(row?.root_id && row?.spreadsheet_id),
      email: row?.email || null,
      folderUrl: row?.root_id
        ? `https://drive.google.com/drive/folders/${row.root_id}`
        : null,
      spreadsheetUrl: row?.spreadsheet_id
        ? `https://docs.google.com/spreadsheets/d/${row.spreadsheet_id}/edit`
        : null,
    });
  }),
);
// Await a whole job while the HTTP request is active; Cloud Run may suspend idle CPU.
googleRouter.post(
  "/process-next",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    await googleClients();
    res.json({ processed: await processNextJob() });
  }),
);
googleRouter.get(
  "/status",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_DRIVE");
    const connection = await googleConnection();
    await (
      await googleClients()
    ).drive.files.get({
      fileId: connection.rootId,
      fields: "id",
      supportsAllDrives: true,
    });
    res.json({
      connected: true,
      user: {
        displayName: "RTG Workspace",
        email: connection.email,
      },
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${await spreadsheetId()}/edit`,
      spreadsheetId: await spreadsheetId(),
    });
  }),
);
googleRouter.post(
  "/setup",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const db = await pool.connect();
    try {
      await db.query("select pg_advisory_lock(726447)");
      res.json({
        folders: await ensureStructure(),
        id: await spreadsheetId(),
        url: `https://docs.google.com/spreadsheets/d/${await spreadsheetId()}/edit`,
        title: "RTG_SYSTEM",
      });
    } finally {
      await db.query("select pg_advisory_unlock(726447)");
      db.release();
    }
  }),
);
googleRouter.get(
  "/jobs",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const page = Math.max(0, Number(req.query.page) || 0);
    res.json(
      (
        await pool.query(
          "select job_id,kind,module,record_id,status,attempts,last_error,created_at from private.sync_queue order by sequence desc limit 50 offset $1",
          [page * 50],
        )
      ).rows,
    );
  }),
);
googleRouter.post(
  "/jobs/:id/retry",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    await transaction(async (db) => {
      const result = await db.query(
        "update private.sync_queue set status='pending',last_error=null,updated_at=now() where job_id=$1 and status='failed' returning job_id",
        [req.params.id],
      );
      if (!result.rowCount)
        throw new HttpError(409, "Chỉ thử lại tác vụ thất bại.");
      await audit(
        db,
        req.user.id,
        "google.sync.retry",
        undefined,
        req.params.id,
      );
    });
    res.json({ success: true });
  }),
);
googleRouter.post(
  "/sync",
  asyncRoute(async (req, res) => {
    const modules = req.body.module
      ? [validModule(req.body.module)]
      : Object.keys(SHEET_TABS);
    if (req.body.module)
      assertPermission(req.user, MODULE_PERMISSIONS[modules[0]]);
    else assertPermission(req.user, "MANAGE_PERMISSIONS");
    let total = 0;
    await transaction(async (db) => {
      for (const module of modules) {
        const { rows } = await db.query(
          "select id,data from private.records where module=$1 order by id",
          [module],
        );
        for (const r of rows) {
          await enqueue(db, module, r.id, r.data, req.user.id);
          total++;
        }
      }
      await audit(db, req.user.id, "google.sync.request");
    });
    res.status(202).json({
      success: true,
      totalRows: total,
      updatedRows: total,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${await spreadsheetId()}/edit`,
      sheetStats: [],
      message:
        "Đã đưa dữ liệu PostgreSQL vào hàng đợi. Xem trạng thái tại Google Sync.",
    });
  }),
);
googleRouter.post(
  "/import/preview",
  asyncRoute(async (req, res) => {
    const module = validModule(req.body.module);
    assertPermission(req.user, MODULE_PERMISSIONS[module]);
    const tab = SHEET_TABS[module];
    if (!tab) throw new HttpError(400, "Phân hệ không hỗ trợ nhập báo cáo.");
    const { data } = await (
      await googleClients()
    ).sheets.spreadsheets.values.get({
      spreadsheetId: await spreadsheetId(),
      range: `'${tab}'!A1:F10002`,
    });
    const deduped = parseReportRows(data.values || []);
    const hash = checksum(deduped);
    const result = (
      await pool.query(
        "insert into private.import_previews(job_id,actor_id,module,checksum,rows) values($1,$2,$3,$4,$5) on conflict(actor_id,module,checksum) do update set expires_at=now()+interval '30 minutes' returning job_id,status,checksum",
        [randomUUID(), req.user.id, module, hash, JSON.stringify(deduped)],
      )
    ).rows[0];
    res.json({ ...result, rows: deduped });
  }),
);
googleRouter.post(
  "/import/:id/confirm",
  asyncRoute(async (req, res) => {
    const result = await transaction(async (db) => {
      const preview = (
        await db.query(
          "select * from private.import_previews where job_id=$1 and actor_id=$2 for update",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (!preview) throw new HttpError(404, "Không có bản xem trước.");
      assertPermission(req.user, MODULE_PERMISSIONS[preview.module]);
      if (req.body.checksum !== preview.checksum)
        throw new HttpError(409, "Bản xem trước đã thay đổi.");
      if (preview.status === "success")
        return { success: true, duplicate: true };
      if (new Date(preview.expires_at).getTime() < Date.now())
        throw new HttpError(409, "Bản xem trước đã hết hạn.");
      for (const row of preview.rows)
        await writeRecord(db, req.user, preview.module, row.id, row, true);
      await db.query(
        "update private.import_previews set status='success' where job_id=$1",
        [preview.job_id],
      );
      await audit(
        db,
        req.user.id,
        preview.module === "incidents" ? "violation.import" : "sheet.import",
        preview.module,
        preview.job_id,
        { checksum: preview.checksum },
      );
      return { success: true };
    });
    res.json(result);
  }),
);
googleRouter.get(
  "/sheets/rows",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const module = validModule(String(req.query.module));
    const tab = SHEET_TABS[module];
    if (!tab) throw new HttpError(400, "Tab không hợp lệ.");
    const result = await (
      await googleClients()
    ).sheets.spreadsheets.values.get({
      spreadsheetId: await spreadsheetId(),
      range: `'${tab}'!A1:F1001`,
    });
    res.json(result.data.values || []);
  }),
);
googleRouter.get(
  "/files",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_DRIVE");
    const parent =
      req.query.parent === "root" || !req.query.parent
        ? await driveRootId()
        : String(req.query.parent);
    await assertInRoot(parent);
    const q = `'${parent.replace(/'/g, "\\'")}' in parents and trashed=false`;
    const { data } = await (
      await googleClients()
    ).drive.files.list({
      q,
      pageSize: 100,
      pageToken: req.query.cursor ? String(req.query.cursor) : undefined,
      fields:
        "files(id,name,mimeType,size,webViewLink,modifiedTime),nextPageToken",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    res.json({
      items: (data.files || []).map((f) => ({
        ...f,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
      })),
      nextCursor: data.nextPageToken,
    });
  }),
);
googleRouter.post(
  "/folders",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_DRIVE");
    const parent =
      req.body.parentId === "root" ? await driveRootId() : req.body.parentId;
    await assertInRoot(parent);
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 100)
      throw new HttpError(400, "Tên thư mục không hợp lệ.");
    const { data } = await (
      await googleClients()
    ).drive.files.create({
      requestBody: {
        name,
        parents: [parent],
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });
    await audit(
      pool,
      req.user.id,
      "drive.folder.create",
      "internalDocuments",
      data.id!,
    );
    res.json({ ...data, isFolder: true });
  }),
);
googleRouter.get(
  "/files/:id/download",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_DRIVE");
    await assertInRoot(req.params.id);
    const { drive } = await googleClients();
    const meta = (
      await drive.files.get({
        fileId: req.params.id,
        fields: "mimeType",
        supportsAllDrives: true,
      })
    ).data;
    const type =
      meta.mimeType === "application/vnd.google-apps.document"
        ? "application/pdf"
        : meta.mimeType === "application/vnd.google-apps.spreadsheet"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : undefined;
    const result = type
      ? await drive.files.export(
          { fileId: req.params.id, mimeType: type },
          { responseType: "stream" },
        )
      : await drive.files.get(
          { fileId: req.params.id, alt: "media", supportsAllDrives: true },
          { responseType: "stream" },
        );
    res.setHeader(
      "Content-Type",
      type || meta.mimeType || "application/octet-stream",
    );
    result.data.on("error", () => res.destroy());
    result.data.pipe(res);
  }),
);
googleRouter.delete(
  "/files/:id",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_DRIVE");
    await assertInRoot(req.params.id);
    if (req.params.id === (await driveRootId()))
      throw new HttpError(403, "Không xóa thư mục gốc.");
    await (
      await googleClients()
    ).drive.files.update({
      fileId: req.params.id,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
    await audit(
      pool,
      req.user.id,
      "drive.file.trash",
      "internalDocuments",
      req.params.id,
    );
    res.json({ success: true });
  }),
);
