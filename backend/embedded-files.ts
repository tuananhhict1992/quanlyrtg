import { randomUUID, createHash } from "node:crypto";
import { validateFile } from "./file-validation";
export async function stageEmbeddedFiles(
  db: any,
  module: string,
  id: string,
  data: any,
  actor: string,
) {
  const files: { value: string; name: string }[] = [];
  if (module === "feedbacks")
    for (const [i, value] of (data.images || []).entries())
      files.push({ value, name: `feedback-${id}-${i}` });
  if (module === "internalDocuments" && data.fileUrl)
    files.push({ value: data.fileUrl, name: data.fileName || "document" });
  for (const file of files) {
    const match = String(file.value).match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) continue;
    const bytes = Buffer.from(match[2], "base64"),
      mime = match[1];
    const ext: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
    };
    const name = /\.[a-z0-9]+$/i.test(file.name)
      ? file.name
      : file.name + "." + ext[mime];
    await validateFile(bytes, mime, name);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const row = (
      await db.query(
        "insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by) values($1,'drive',$2,$3,$4,$5,$6) on conflict(kind,module,record_id,checksum) do update set updated_at=private.sync_queue.updated_at returning job_id,status",
        [
          randomUUID(),
          module,
          id,
          hash,
          JSON.stringify({
            fileName: name,
            mimeType: mime,
            size: bytes.length,
          }),
          actor,
        ],
      )
    ).rows[0];
    if (row.status !== "success")
      await db.query(
        "insert into private.temporary_files(job_id,bytes,processed_at,business_saved_at) values($1,$2,now(),now()) on conflict(job_id) do nothing",
        [row.job_id, bytes],
      );
  }
}
