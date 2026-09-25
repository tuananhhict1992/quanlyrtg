import { randomUUID } from "node:crypto";
import { HttpError, transaction } from "./db";
import { audit } from "./records";
import { checksum, hasPermission } from "./security";

export async function assignQuiz(user: any, quizId: string, input: unknown) {
  if (!hasPermission(user, "MANAGE_QUIZ") && !hasPermission(user, "CREATE_QUIZ"))
    throw new HttpError(403, "Bạn không có quyền giao bài kiểm tra.");
  if (!Array.isArray(input) || !input.length || input.length > 500 ||
      input.some(id => typeof id !== "string" || !id.trim() || id.length > 180))
    throw new HttpError(400, "Chọn từ 1 đến 500 nhân viên nhận bài.");
  const recipientIds = [...new Set(input as string[])].sort();
  return transaction(async db => {
    const quiz = (await db.query(
      "select data,owner_id from private.records where module='quizzes' and id=$1 for share", [quizId],
    )).rows[0];
    if (!quiz) throw new HttpError(404, "Không tìm thấy bài kiểm tra đã lưu.");
    if (!hasPermission(user, "MANAGE_QUIZ") && quiz.owner_id !== user.id)
      throw new HttpError(403, "Bạn chỉ được giao bài kiểm tra do mình tạo.");
    const employees = (await db.query(
      "select id,data from private.records where module='employees' and id=any($1::text[]) and data->>'status'='ACTIVE' order by id", [recipientIds],
    )).rows;
    if (employees.length !== recipientIds.length)
      throw new HttpError(409, "Danh sách có nhân viên không tồn tại hoặc đã ngừng hoạt động. Vui lòng tải lại danh sách.");

    // A stable primary key makes retries and concurrent dispatches idempotent.
    const messages = employees.map(({ id, data }) => {
      const message = {
        id: "quiz-assignment-" + checksum({ quizId, recipientId: id }),
        quizId,
        type: "INDIVIDUAL", recipientType: "INDIVIDUAL", recipientIds: [id],
        recipientNames: [data.fullName],
        title: "Bài kiểm tra được giao",
        content: `Bạn được giao bài kiểm tra năng lực: "${quiz.data.title}". Vui lòng vào mục Kiểm tra năng lực để thực hiện bài thi.`,
        status: "DELIVERED", sentAt: new Date().toISOString(),
        sentBy: user.fullName, senderId: user.id, readByIds: [],
      };
      return { id: message.id, data: message, checksum: checksum(message) };
    });
    const inserted = (await db.query(
      `insert into private.records(module,id,data,owner_id,checksum)
       select 'zaloMessages',id,data,$2,checksum
       from jsonb_to_recordset($1::jsonb) as m(id text,data jsonb,checksum text)
       order by id on conflict(module,id) do nothing returning id,data,checksum,revision`,
      [JSON.stringify(messages), user.id],
    )).rows;
    if (inserted.length) {
      const jobs = inserted.map(row => ({
        job_id: randomUUID(), record_id: row.id, payload: row.data,
        checksum: row.checksum + ":" + row.revision,
      }));
      await db.query(
        `insert into private.sync_queue(job_id,kind,module,record_id,checksum,payload,requested_by)
         select job_id,'sheet','zaloMessages',record_id,md5(checksum),payload,$2
         from jsonb_to_recordset($1::jsonb) as j(job_id uuid,record_id text,checksum text,payload jsonb)
         on conflict(kind,module,record_id,checksum) do nothing`, [JSON.stringify(jobs), user.id],
      );
      await audit(db, user.id, "exam.assign", "quizzes", quizId, {
        recipientCount: recipientIds.length, sentCount: inserted.length,
      });
      await db.query("insert into public.record_changes(module) values('zaloMessages')");
    }
    return {
      sentCount: inserted.length, alreadyAssignedCount: recipientIds.length - inserted.length,
      recipientCount: recipientIds.length, messages: inserted.map(row => row.data),
    };
  });
}
