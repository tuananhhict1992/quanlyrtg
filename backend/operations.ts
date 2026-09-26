import { Router } from "express";
import { randomUUID } from "node:crypto";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { pool, transaction, asyncRoute, HttpError } from "./db";
import { assertPermission, checksum, redact } from "./security";
import { audit } from "./records";
import multer from "multer";
import * as XLSX from "xlsx";
import { validateFile } from "./files";
import { validModule, MODULE_PERMISSIONS } from "./security";
import { generateBxxlHtml } from "../src/services/bxxlTemplate";
import { finalizeRanking } from './rankings';
export const operationsRouter = Router();
operationsRouter.post('/ranking/finalize',asyncRoute(async(req,res)=>{
  res.json(await finalizeRanking(req.user,req.body.record,req.body.employeeIds));
}));
operationsRouter.post(
  "/ranking/word",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_BXXL");
    const record = req.body.record;
    if (
      !record ||
      !Array.isArray(record.listA) ||
      !Array.isArray(record.listB) ||
      !Array.isArray(record.listC)
    )
      throw new HttpError(400, "Biên bản không hợp lệ.");
    res.setHeader("Content-Type", "application/msword; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="RTG-ranking.doc"',
    );
    res.send("\ufeff" + generateBxxlHtml(record, true));
  }),
);
operationsRouter.post(
  "/excel/preview",
  (multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 2 },
  }).single("file") as any),
  asyncRoute(async (req, res) => {
    const module = validModule(req.body.module);
    assertPermission(req.user, MODULE_PERMISSIONS[module]);
    if (!req.file) throw new HttpError(400, "Chưa chọn Excel.");
    await validateFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );
    if (!req.file.originalname.toLowerCase().endsWith(".xlsx"))
      throw new HttpError(415, "Sử dụng tệp XLSX.");
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      sheetRows: 2001,
      cellFormula: false,
      cellHTML: false,
      bookVBA: false,
    });
    if (workbook.SheetNames.length > 20)
      throw new HttpError(413, "Tối đa 20 sheet mỗi tệp.");
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name],
        range = XLSX.utils.decode_range(
          sheet["!fullref"] || sheet["!ref"] || "A1",
        );
      if (range.e.r >= 2000 || range.e.c >= 100)
        throw new HttpError(413, "Mỗi sheet tối đa 2.000 dòng và 100 cột.");
    }
    const id = randomUUID();
    await transaction(async (db) => {
      await db.query(
        "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive',$2,$3,$4,$5,$6)",
        [
          id,
          module,
          "import:" + id,
          checksum(req.file.buffer.toString("base64")),
          JSON.stringify({
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
          }),
          req.user.id,
        ],
      );
      await db.query(
        "insert into private.temporary_files(job_id,bytes,processed_at) values($1,$2,now())",
        [id, req.file.buffer],
      );
      await audit(db, req.user.id, "excel.preview", module, id);
    });
    res.json({ workbook, source_job_id: id });
  }),
);
operationsRouter.post(
  "/backup",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const result = await transaction(async (db) => {
      const rows = (
        await db.query(
          "select module,id,data from private.records order by module,id",
        )
      ).rows;
      const snapshot = Buffer.from(
        JSON.stringify({
          created_at: new Date().toISOString(),
          records: rows.map((r) => ({ ...r, data: redact(r.data) })),
        }),
      );
      if (snapshot.length > 20 * 1024 * 1024)
        throw new HttpError(
          413,
          "Backup vượt 20 MB; dùng pg_dump theo hướng dẫn triển khai.",
        );
      const id = randomUUID();
      await db.query(
        "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1::uuid,'drive','backup',$1::text,$2,$3,$4)",
        [
          id,
          checksum(rows),
          JSON.stringify({
            fileName: `RTG-backup-${id}.json`,
            mimeType: "application/json",
            size: snapshot.length,
          }),
          req.user.id,
        ],
      );
      await db.query(
        "insert into private.temporary_files(job_id,bytes,processed_at,business_saved_at) values($1,$2,now(),now())",
        [id, snapshot],
      );
      await audit(db, req.user.id, "backup", undefined, id);
      return { job_id: id, status: "pending" };
    });
    res.status(202).json(result);
  }),
);
operationsRouter.post(
  "/word/:module/:id",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_BXXL");
    const { rows } = await pool.query(
      "select data from private.records where module=$1 and id=$2",
      [req.params.module, req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, "Không tìm thấy hồ sơ.");
    const exportRecord = redact(rows[0].data);
    if (req.params.module === 'bxxlRecords') {
      delete exportRecord.listSmallA;
      delete exportRecord.includeDefaultSmallAInDoc;
    }
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: "BIÊN BẢN RTG", bold: true })],
            }),
            new Paragraph(JSON.stringify(exportRecord)),
          ],
        },
      ],
    });
    const bytes = await Packer.toBuffer(document);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="RTG-record.docx"',
    );
    res.send(bytes);
  }),
);
