import { transaction } from "./db";
import { audit, enqueue } from "./records";
import { checksum } from "./security";
export async function scheduledMaintenance() {
  await transaction(async (db) => {
    const rows = (
      await db.query(
        "select id,data,owner_id from private.records where module='zaloMessages' and data->>'status'='SCHEDULED' for update skip locked",
      )
    ).rows;
    for (const row of rows) {
      const date = String(row.data.scheduledAt || "").replace(" ", "T");
      const timestamp = Date.parse(
        /(Z|[+-]\d\d:\d\d)$/.test(date) ? date : date + "+07:00",
      );
      if (!Number.isFinite(timestamp) || timestamp > Date.now()) continue;
      const data = {
        ...row.data,
        status: "DELIVERED",
        sentAt: new Date().toISOString(),
      };
      await db.query(
        "update private.records set data=$2,checksum=$3,updated_at=now() where module='zaloMessages' and id=$1",
        [row.id, JSON.stringify(data), checksum(data)],
      );
      await audit(
        db,
        row.owner_id,
        "notification.dispatch",
        "zaloMessages",
        row.id,
      );
      await enqueue(db, "zaloMessages", row.id, data, row.owner_id);
      await db.query(
        "insert into public.record_changes(module) values('zaloMessages')",
      );
    }
    await db.query(
      "delete from public.record_changes where created_at<now()-interval '7 days'",
    );
    await db.query(
      "delete from private.import_previews where status<>'success' and expires_at<now()-interval '7 days'",
    );
  });
}
