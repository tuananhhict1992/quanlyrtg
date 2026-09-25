import { api } from "./supabase";
const request = async (module: string) => {
  await api("/google/sync", {
    method: "POST",
    body: JSON.stringify({ module }),
  });
  return true;
};
export const syncQuizSubmissionToSheet = (_url: string, _data: any) =>
  request("quizSubmissions");
export const syncFeedbackToSheet = (_url: string, _data: any) =>
  request("feedbacks");
export const syncBxxlRecordToSheet = (_url: string, _data: any) =>
  request("bxxlRecords");
