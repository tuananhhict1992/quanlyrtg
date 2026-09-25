import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool, transaction, HttpError, asyncRoute } from "./db";
import { stageEmbeddedFiles } from "./embedded-files";
import {
  MODULE_PERMISSIONS,
  SHEET_TABS,
  hasPermission,
  readScope,
  redact,
  checksum,
  authorizeWrite,
  auditActions,
  validModule,
  assertPermission,
} from "./security";
export async function audit(
  db: any,
  actor: string,
  action: string,
  module?: string,
  id?: string,
  detail: any = {},
) {
  await db.query(
    "insert into private.audit_log(actor_id,action,module,record_id,detail) values($1,$2,$3,$4,$5)",
    [actor, action, module, id, JSON.stringify(redact(detail))],
  );
}
export async function enqueue(
  db: any,
  module: string,
  id: string,
  data: any,
  actor: string,
) {
  if (!SHEET_TABS[module]) return;
  const safe = JSON.parse(
      JSON.stringify(redact(data, true), (_key, value) =>
        typeof value === "string" && value.startsWith("data:")
          ? "(pending Drive archive)"
          : value,
      ),
    ),
    hash = checksum(safe);
  await db.query(
    "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'sheet',$2,$3,md5($4||':'||coalesce((select revision::text from private.records where module=$2 and id=$3),'deleted')),$5,$6) on conflict(kind,module,record_id,checksum) do nothing",
    [randomUUID(), module, id, hash, JSON.stringify(safe), actor],
  );
}
export async function writeRecord(
  db: any,
  user: any,
  module: string,
  id: string,
  input: any,
  merge = true,
) {
  if (
    !id ||
    id.length > 180 ||
    !input ||
    Array.isArray(input) ||
    typeof input !== "object"
  )
    throw new HttpError(400, "Bản ghi không hợp lệ.");
  await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
    module + ":" + id,
  ]);
  const old = (
    await db.query(
      "select data from private.records where module=$1 and id=$2 for update",
      [module, id],
    )
  ).rows[0]?.data;
  const next = { ...(merge ? old : {}), ...redact(input), id };
  authorizeWrite(user, module, next, old);
  if (
    module === "feedbacks" &&
    old?.images?.some(
      (image: string) =>
        image.startsWith("data:") && !next.images?.includes(image),
    )
  )
    throw new HttpError(
      409,
      "Lưu trữ ảnh bằng tác vụ Drive trước khi xóa dữ liệu gốc.",
    );
  if (
    module === "quizzes" &&
    (!next.questions?.length ||
      next.questions.some(
        (q: any) =>
          !q.correctOptionId ||
          !q.options?.some((o: any) => o.id === q.correctOptionId),
      ))
  )
    throw new HttpError(400, "Đề thi cần câu hỏi và đáp án hợp lệ.");
  const hash = checksum(next);
  if (old && checksum(old) === hash) return old;
  const owner =
    module === "employees"
      ? id
      : next.employeeId || next.authorId || old?.createdBy || user.id;
  await db.query(
    "insert into private.records(module,id,data,owner_id,checksum) values($1,$2,$3,$4,$5) on conflict(module,id) do update set data=excluded.data,owner_id=excluded.owner_id,checksum=excluded.checksum,updated_at=now()",
    [module, id, JSON.stringify(next), owner, hash],
  );
  await stageEmbeddedFiles(db, module, id, next, user.id);
  for (const action of auditActions(module, next, old))
    await audit(db, user.id, action, module, id, { checksum: hash });
  await enqueue(db, module, id, next, user.id);
  await db.query("insert into public.record_changes(module) values($1)", [
    module,
  ]);
  return next;
}
export const recordsRouter = Router();
recordsRouter.post(
  "/messages/:id/read",
  asyncRoute(async (req, res) => {
    const scope = readScope(req.user, "zaloMessages"),
      params = ["zaloMessages", ...scope.params, req.params.id];
    await transaction(async (db) => {
      const row = (
        await db.query(
          `select data from private.records where module=$1 and (${scope.clause}) and id=$${params.length} for update`,
          params,
        )
      ).rows[0];
      if (!row) throw new HttpError(404, "Không tìm thấy thông báo.");
      const data = {
        ...row.data,
        readByIds: [...new Set([...(row.data.readByIds || []), req.user.id])],
      };
      await db.query(
        "update private.records set data=$2,checksum=$3,updated_at=now() where module='zaloMessages' and id=$1",
        [req.params.id, JSON.stringify(data), checksum(data)],
      );
      await db.query(
        "insert into public.record_changes(module) values('zaloMessages')",
      );
    });
    res.json({ success: true });
  }),
);
recordsRouter.get(
  "/me",
  asyncRoute(async (req, res) => res.json(redact(req.user))),
);
recordsRouter.post(
  "/session",
  asyncRoute(async (req, res) => {
    const stamp = String(req.authUser.last_sign_in_at || "");
    await pool.query(
      "insert into private.audit_log(actor_id,action,detail,dedupe_key) values($1,'login',$2,$3) on conflict(dedupe_key) do nothing",
      [
        req.user.id,
        JSON.stringify({ provider: req.authUser.app_metadata?.provider }),
        req.authUser.id + ":" + stamp,
      ],
    );
    res.json({ success: true });
  }),
);
recordsRouter.get(
  "/records/:module",
  asyncRoute(async (req, res) => {
    const module = validModule(req.params.module),
      limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100)),
      cursor = String(req.query.cursor || "");
    const scope = readScope(req.user, module),
      params = [module, ...scope.params, cursor, limit + 1];
    const result = await pool.query(
      `select id,data from private.records where module=$1 and (${scope.clause}) and id>$${params.length - 1} order by id limit $${params.length}`,
      params,
    );
    const rows = result.rows
      .slice(0, limit)
      .map((r) => redact(r.data, !hasPermission(req.user, "MANAGE_QUIZ")));
    res.json({
      items: rows,
      nextCursor: result.rows.length > limit ? result.rows[limit - 1].id : null,
    });
  }),
);
recordsRouter.get(
  "/records/:module/:id",
  asyncRoute(async (req, res) => {
    const module = validModule(req.params.module),
      scope = readScope(req.user, module),
      params = [module, ...scope.params, req.params.id];
    const { rows } = await pool.query(
      `select data from private.records where module=$1 and (${scope.clause}) and id=$${params.length}`,
      params,
    );
    if (!rows[0]) throw new HttpError(404, "Không tìm thấy bản ghi.");
    res.json(redact(rows[0].data, !hasPermission(req.user, "MANAGE_QUIZ")));
  }),
);
recordsRouter.post(
  "/records/:module/batch",
  asyncRoute(async (req, res) => {
    const module = validModule(req.params.module),
      items = req.body.items;
    if (!Array.isArray(items) || items.length > 500)
      throw new HttpError(400, "Tối đa 500 bản ghi mỗi lần.");
    const result = await transaction(async (db) => {
      const out = [];
      for (const item of [...items].sort((a, b) =>
        String(a.id).localeCompare(String(b.id)),
      ))
        out.push(
          await writeRecord(
            db,
            req.user,
            module,
            item.id,
            item.data,
            req.body.merge !== false,
          ),
        );
      if (req.body.source_job_id) {
        const changed = await db.query(
          "update private.temporary_files set business_saved_at=now() where job_id=$1 and exists(select 1 from private.sync_queue where job_id=$1 and requested_by=$2 and module=$3)",
          [req.body.source_job_id, req.user.id, module],
        );
        if (!changed.rowCount)
          throw new HttpError(409, "Không tìm thấy tệp nguồn của lần nhập.");
      }
      return out;
    });
    res.json(result);
  }),
);
recordsRouter.put(
  "/records/:module/:id",
  asyncRoute(async (req, res) =>
    res.json(
      await transaction((db) =>
        writeRecord(
          db,
          req.user,
          validModule(req.params.module),
          req.params.id,
          req.body.data,
          req.body.merge !== false,
        ),
      ),
    ),
  ),
);
recordsRouter.delete(
  "/records/:module/:id",
  asyncRoute(async (req, res) => {
    const module = validModule(req.params.module);
    assertPermission(req.user, MODULE_PERMISSIONS[module]);
    await transaction(async (db) => {
      const result = await db.query(
        "delete from private.records where module=$1 and id=$2 returning id",
        [module, req.params.id],
      );
      if (!result.rowCount) throw new HttpError(404, "Không tìm thấy bản ghi.");
      await audit(db, req.user.id, module + ".delete", module, req.params.id);
      await enqueue(
        db,
        module,
        req.params.id,
        { id: req.params.id, deleted: true },
        req.user.id,
      );
      await db.query("insert into public.record_changes(module) values($1)", [
        module,
      ]);
    });
    res.json({ success: true });
  }),
);
recordsRouter.get(
  "/admin/audit",
  asyncRoute(async (req, res) => {
    assertPermission(req.user, "MANAGE_PERMISSIONS");
    const page = Math.max(0, Number(req.query.page) || 0);
    res.json(
      (
        await pool.query(
          "select * from private.audit_log order by created_at desc,id desc limit 50 offset $1",
          [page * 50],
        )
      ).rows,
    );
  }),
);
