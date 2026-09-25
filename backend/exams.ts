import { Router } from "express";
import { randomUUID, randomInt } from "node:crypto";
import { transaction, HttpError, asyncRoute } from "./db";
import { redact, checksum } from "./security";
import { audit, enqueue } from "./records";
import { assignQuiz } from "./quiz-notifications";
export function gradeExam(quiz: any, answers: Record<string, string>) {
  if (!quiz.questions?.length)
    throw new HttpError(409, "Đề thi chưa có câu hỏi.");
  if (
    quiz.questions.some(
      (q: any) =>
        !q.correctOptionId ||
        !q.options?.some((o: any) => o.id === q.correctOptionId),
    )
  )
    throw new HttpError(409, "Đề thi thiếu đáp án hợp lệ.");
  const correctCount = quiz.questions.filter(
      (q: any) => answers[q.id] === q.correctOptionId,
    ).length,
    totalQuestions = quiz.questions.length,
    score = Math.round((correctCount / totalQuestions) * 100),
    passed = score >= quiz.passScore;
  return {
    score,
    correctCount,
    totalQuestions,
    passed,
    competencyLevel:
      score >= 90 ? "Xuất sắc" : passed ? "Đạt" : "Cần đào tạo lại",
  };
}
function checkSchedule(quiz: any, user: any) {
  const now = Date.now(),
    parse = (v: string) =>
      Date.parse(/(Z|[+-]\d\d:\d\d)$/.test(v) ? v : v + "+07:00");
  if (
    (quiz.scheduledStartTime && now < parse(quiz.scheduledStartTime)) ||
    (quiz.scheduledEndTime && now > parse(quiz.scheduledEndTime))
  )
    throw new HttpError(403, "Bài thi chưa mở hoặc đã hết hạn.");
  if (
    quiz.targetDepartments?.length &&
    !quiz.targetDepartments.includes("ALL") &&
    !quiz.targetDepartments.includes(user.department)
  )
    throw new HttpError(403, "Bài thi không thuộc bộ phận của bạn.");
}
export const examsRouter = Router();
examsRouter.post(
  "/:id/assign",
  asyncRoute(async (req, res) => {
    res.json(await assignQuiz(req.user, req.params.id, req.body.recipientIds));
  }),
);
examsRouter.post(
  "/:id/start",
  asyncRoute(async (req, res) => {
    const result = await transaction(async (db) => {
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        "exam:" + req.params.id + ":" + req.user.id,
      ]);
      const prior = (
        await db.query(
          "select * from private.exam_attempts where quiz_id=$1 and employee_id=$2 and status='processing'",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (prior) {
        if (new Date(prior.expires_at).getTime() < Date.now()) {
          await db.query(
            "update private.exam_attempts set status='expired' where id=$1",
            [prior.id],
          );
        } else return prior;
      }
      const quiz = (
        await db.query(
          "select data from private.records where module='quizzes' and id=$1",
          [req.params.id],
        )
      ).rows[0]?.data;
      if (!quiz) throw new HttpError(404, "Không tìm thấy bài thi.");
      checkSchedule(quiz, req.user);
      const questions = [...quiz.questions];
      if (quiz.isRandomQuestions) {
        for (let i = questions.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        quiz.questions = questions.slice(
          0,
          quiz.randomQuestionCount || questions.length,
        );
      }
      let end = Date.now() + Math.max(1, quiz.durationMinutes) * 60000;
      if (quiz.scheduledEndTime)
        end = Math.min(
          end,
          Date.parse(
            /(Z|[+-]\d\d:\d\d)$/.test(quiz.scheduledEndTime)
              ? quiz.scheduledEndTime
              : quiz.scheduledEndTime + "+07:00",
          ),
        );
      const expiresAt = new Date(end);
      return (
        await db.query(
          "insert into private.exam_attempts(id,quiz_id,employee_id,quiz,expires_at) values($1,$2,$3,$4,$5) returning *",
          [randomUUID(), quiz.id, req.user.id, JSON.stringify(quiz), expiresAt],
        )
      ).rows[0];
    });
    res.json({
      attemptId: result.id,
      quiz: redact(result.quiz, true),
      expiresAt: result.expires_at,
    });
  }),
);
examsRouter.post(
  "/attempts/:id/submit",
  asyncRoute(async (req, res) => {
    const result = await transaction(async (db) => {
      const attempt = (
        await db.query(
          "select * from private.exam_attempts where id=$1 and employee_id=$2 for update",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (!attempt) throw new HttpError(404, "Không tìm thấy lượt thi.");
      if (attempt.status === "success") return attempt.result;
      if (Date.now() > new Date(attempt.expires_at).getTime() + 10000)
        throw new HttpError(409, "Lượt thi đã hết thời gian.");
      const answers = req.body.answers;
      if (!answers || Array.isArray(answers) || typeof answers !== "object")
        throw new HttpError(400, "Đáp án không hợp lệ.");
      const quiz = attempt.quiz,
        sub = {
          id: attempt.id,
          quizId: quiz.id,
          quizTitle: quiz.title,
          employeeId: req.user.id,
          employeeName: req.user.fullName,
          department: req.user.department,
          answers,
          ...gradeExam(quiz, answers),
          submittedAt: new Date().toISOString(),
        };
      await db.query(
        "insert into private.records(module,id,data,owner_id,checksum) values('quizSubmissions',$1,$2,$3,$4)",
        [sub.id, JSON.stringify(sub), req.user.id, checksum(sub)],
      );
      await db.query(
        "update private.exam_attempts set status='success',result=$2 where id=$1",
        [attempt.id, JSON.stringify(sub)],
      );
      await db.query(
        "update private.records set data=jsonb_set(jsonb_set(data,'{quizzesCompleted}',(select to_jsonb(count(*)) from private.records where module='quizSubmissions' and owner_id=$1)),'{competencyScore}',(select to_jsonb(round(avg((data->>'score')::numeric))) from private.records where module='quizSubmissions' and owner_id=$1)),updated_at=now() where module='employees' and id=$1",
        [req.user.id],
      );
      await audit(db, req.user.id, "exam.submit", "quizSubmissions", sub.id);
      await enqueue(db, "quizSubmissions", sub.id, sub, req.user.id);
      await db.query(
        "insert into public.record_changes(module) values('quizSubmissions'),('employees')",
      );
      return sub;
    });
    res.json(result);
  }),
);
