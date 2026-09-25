import { randomUUID } from "node:crypto";
import { transaction, HttpError } from "./db";
import { assertPermission, checksum, redact } from "./security";
import { writeRecord } from "./records";

export async function finalizeRanking(
  user: any,
  input: any,
  employeeIds: unknown,
) {
  assertPermission(user, "MANAGE_BXXL");
  if (
    !input ||
    !/^(0[1-9]|1[0-2])\/\d{4}$/.test(input.evaluationMonth) ||
    typeof input.departmentName !== "string" ||
    !input.departmentName.trim() ||
    typeof input.groupName !== "string" ||
    !input.groupName.trim() ||
    !Array.isArray(employeeIds) ||
    !employeeIds.length ||
    employeeIds.length > 10000 ||
    employeeIds.some((id) => typeof id !== "string" || !id)
  )
    throw new HttpError(
      400,
      "Kỳ bình xét hoặc danh sách nhân sự không hợp lệ.",
    );
  const ids = [...new Set<string>(employeeIds)].sort();
  const record = redact(input);
  const assignments = new Map<string, { rating: string; reason?: string }>();
  for (const [field, rating] of [
    ["listA", "A"],
    ["listB", "B"],
    ["listSmallB", "b"],
    ["listC", "C"],
  ]) {
    if (!Array.isArray(record[field]))
      throw new HttpError(400, "Danh sách xếp loại không hợp lệ.");
    for (const item of record[field]) {
      if (!ids.includes(item.employeeId))
        throw new HttpError(400, "Nhân viên xếp loại phải thuộc kỳ bình xét.");
      assignments.set(item.employeeId, {
        rating,
        ...(rating !== "A" && item.reason?.trim()
          ? { reason: item.reason.trim() }
          : {}),
      });
    }
  }
  if (!Array.isArray(record.listGpt))
    throw new HttpError(400, "Danh sách GPT không hợp lệ.");
  const gpt = new Set(record.listGpt.map((item: any) => item.employeeId));
  const semantic = { ...record };
  for (const key of [
    "id",
    "createdAt",
    "createdBy",
    "creatorName",
    "finalizeJobId",
    "finalizeChecksum",
    "finalizeStatus",
  ])
    delete semantic[key];
  const hash = checksum({ record: semantic, employeeIds: ids });
  return transaction(async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "ranking:" +
        record.evaluationMonth +
        ":" +
        record.departmentName +
        ":" +
        record.groupName,
    ]);
    const previous = (
      await db.query(
        "select data from private.records where module='bxxlRecords' and data->>'evaluationMonth'=$1 and data->>'departmentName'=$2 and data->>'groupName'=$3 for update",
        [record.evaluationMonth, record.departmentName, record.groupName],
      )
    ).rows[0]?.data;
    if (
      previous?.finalizeChecksum === hash &&
      previous.finalizeStatus === "success"
    )
      return { record: previous, duplicate: true, updatedCount: ids.length };
    for (const id of ids)
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        "employees:" + id,
      ]);
    const employees = (
      await db.query(
        "select id,data from private.records where module='employees' and id=any($1::text[]) order by id for update",
        [ids],
      )
    ).rows;
    if (employees.length !== ids.length)
      throw new HttpError(
        409,
        "Danh sách nhân sự đã thay đổi. Hãy tải lại trước khi chốt.",
      );
    const now = new Date().toISOString();
    const saved = {
      ...record,
      id: previous?.id || record.id || randomUUID(),
      createdAt: previous?.createdAt || now,
      createdBy: user.id,
      creatorName: user.fullName || user.id,
      finalizeJobId: randomUUID(),
      finalizeChecksum: hash,
      finalizeStatus: "success",
    };
    await writeRecord(db, user, "bxxlRecords", saved.id, saved);
    // The ranking permission permits this narrow monthly evaluation update only.
    const writer = {
      ...user,
      assignedPermissions: [...(user.assignedPermissions || []), "MANAGE_HR"],
    };
    for (const employee of employees) {
      const assigned = assignments.get(employee.id) || {
        rating: "a",
        reason: "Mặc định hoàn thành tốt nhiệm vụ (loại a)",
      };
      const evaluation = {
        month: record.evaluationMonth,
        ...assigned,
        isGpt: ["A", "a"].includes(assigned.rating) && gpt.has(employee.id),
        date: `${record.createdDate}/${record.createdMonth}/${record.createdYear}`,
        recordId: saved.id,
        updatedAt: now,
      };
      const monthlyEvaluations = [
        evaluation,
        ...(employee.data.monthlyEvaluations || []).filter(
          (entry: any) => entry.month !== record.evaluationMonth,
        ),
      ];
      await writeRecord(db, writer, "employees", employee.id, {
        monthlyEvaluations,
      });
    }
    return { record: saved, duplicate: false, updatedCount: employees.length };
  });
}
