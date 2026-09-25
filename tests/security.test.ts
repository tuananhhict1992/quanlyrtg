import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeWrite,
  redact,
  readScope,
  checksum,
} from "../backend/security";
import { gradeExam } from "../backend/exams";
import { validateFile } from "../backend/files";
import { formatDate } from "../src/utils/date";
const user = {
  id: "employee-1",
  role: "USER",
  status: "ACTIVE",
  department: "RTG ca 1",
  assignedPermissions: [],
};
test("self profile update cannot grant role, permissions or scores", () => {
  assert.throws(() =>
    authorizeWrite(user, "employees", { ...user, role: "ADMIN" }, user),
  );
  assert.throws(() =>
    authorizeWrite(
      user,
      "employees",
      { ...user, assignedPermissions: ["MANAGE_PERMISSIONS"] },
      user,
    ),
  );
  assert.throws(() =>
    authorizeWrite(user, "employees", { ...user, competencyScore: 100 }, user),
  );
  assert.doesNotThrow(() =>
    authorizeWrite(user, "employees", { ...user, fullName: "New name" }, user),
  );
});
test("own leave and feedback cannot approve themselves or impersonate another employee", () => {
  assert.doesNotThrow(() =>
    authorizeWrite(
      user,
      "leaveRequests",
      { employeeId: user.id, status: "PENDING" },
      null,
    ),
  );
  assert.throws(() =>
    authorizeWrite(
      user,
      "leaveRequests",
      { employeeId: user.id, status: "APPROVED" },
      null,
    ),
  );
  assert.throws(() =>
    authorizeWrite(
      user,
      "leaveRequests",
      { employeeId: "someone-else", status: "PENDING" },
      null,
    ),
  );
  assert.throws(() =>
    authorizeWrite(
      user,
      "feedbacks",
      { authorId: user.id, status: "APPROVED" },
      null,
    ),
  );
  assert.throws(() =>
    authorizeWrite(user, "quizSubmissions", { score: 100 }, null),
  );
});
test("answer keys and secrets never leave public response projection", () => {
  const safe = redact(
    {
      password: "secret",
      googleAccessToken: "token",
      questions: [
        { id: "q1", correctOptionId: "a", explanation: "answer", options: [] },
      ],
      nested: { privateKey: "key" },
    },
    true,
  );
  assert.deepEqual(safe, {
    questions: [{ id: "q1", options: [] }],
    nested: {},
  });
  assert.equal(readScope(user, "questionBank").clause, "false");
  assert.deepEqual(readScope(user, "employees").params, [user.id]);
});
test("grading uses answer key and does not accept client scores", () => {
  const result = gradeExam(
    {
      passScore: 70,
      questions: [
        { id: "q1", correctOptionId: "a", options: [{ id: "a" }] },
        { id: "q2", correctOptionId: "b", options: [{ id: "b" }] },
      ],
    },
    { q1: "a", q2: "a" },
  );
  assert.equal(result.score, 50);
  assert.equal(result.passed, false);
  assert.throws(() =>
    gradeExam({ passScore: 70, questions: [{ id: "q1" }] }, {}),
  );
});
test("checksum ignores object key order but detects changed data", () => {
  assert.equal(checksum({ a: 1, b: 2 }), checksum({ b: 2, a: 1 }));
  assert.notEqual(checksum({ a: 1 }), checksum({ a: 2 }));
});
test("MIME, extension and size must agree", async () => {
  const pdf = Buffer.from("%PDF-1.7\nhello world");
  await validateFile(pdf, "application/pdf", "report.pdf");
  await assert.rejects(() => validateFile(pdf, "image/png", "report.png"));
  await assert.rejects(() =>
    validateFile(Buffer.from("<script>"), "application/pdf", "report.pdf"),
  );
  await assert.rejects(() =>
    validateFile(
      Buffer.alloc(20 * 1024 * 1024 + 1),
      "application/pdf",
      "big.pdf",
    ),
  );
});
test("Vietnam timezone is stable across UTC day boundary", () => {
  assert.equal(formatDate("2026-09-24T18:30:00Z", true), "01:30 25/09/2026");
  assert.equal(formatDate("2026-09-25"), "25/09/2026");
});
