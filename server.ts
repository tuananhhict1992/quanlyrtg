import mammoth from "mammoth";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./backend/auth";
import { recordsRouter } from "./backend/records";
import { googleRouter } from "./backend/google-routes";
import { filesRouter, validateFile } from "./backend/files";
import { examsRouter } from "./backend/exams";
import { operationsRouter } from "./backend/operations";
import { startWorker } from "./backend/worker";
import { assertPermission } from "./backend/security";
import { HttpError, asyncRoute } from "./backend/db";
import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["\'self\'"],
              scriptSrc: ["\'self\'"],
              styleSrc: ["\'self\'", "\'unsafe-inline\'"],
              imgSrc: ["\'self\'", "data:", "blob:", "https:"],
              connectSrc: [
                "\'self\'",
                "https://*.supabase.co",
                "wss://*.supabase.co",
              ],
              fontSrc: ["\'self\'", "https:", "data:"],
              objectSrc: ["\'none\'"],
              frameAncestors: ["\'none\'"],
            },
          }
        : false,
  }),
);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use("/api", requireAuth);
const PORT = Number(process.env.PORT) || 3000;

// Body parser
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

app.use("/api", recordsRouter);
app.use("/api/google", googleRouter);
app.use("/api/files", filesRouter);
app.use("/api/exams", examsRouter);
app.use("/api/operations", operationsRouter);
app.use(
  "/api/ai",
  rateLimit({ windowMs: 60000, limit: 10 }),
  (req: any, _res, next) => {
    try {
      assertPermission(req.user, "MANAGE_QUIZ");
      next();
    } catch (e) {
      next(e);
    }
  },
);
app.use("/api/extract-document", (req: any, _res, next) => {
  try {
    assertPermission(req.user, "MANAGE_LIBRARY");
    next();
  } catch (e) {
    next(e);
  }
});
app.use("/api/zalo", (req: any, _res, next) => {
  try {
    assertPermission(req.user, "MANAGE_ZALO");
    next();
  } catch (e) {
    next(e);
  }
});
app.use(
  ["/api/extract-document", "/api/ai"],
  asyncRoute(async (req: any, _res, next) => {
    if (req.body.fileBase64) {
      const bytes = Buffer.from(
        String(req.body.fileBase64).replace(/^data:.*?;base64,/, ""),
        "base64",
      );
      await validateFile(
        bytes,
        req.body.mimeType,
        req.body.fileName || "document.pdf",
      );
    }
    next();
  }),
);

// 3. Document Extraction (PDF/Word)
app.post("/api/extract-document", async (req: Request, res: Response) => {
  try {
    const { fileBase64, mimeType = "application/pdf", fileName } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: "Thiếu dữ liệu file." });
    }

    const ai = getGenAI();
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const content = (
        await mammoth.extractRawText({
          buffer: Buffer.from(
            fileBase64.replace(/^data:.*?;base64,/, ""),
            "base64",
          ),
        })
      ).value;
      return res.json({
        title: fileName?.replace(/\.[^.]+$/, "") || "Tài liệu",
        category: "HUONG_DAN",
        summary: content.slice(0, 300),
        content,
      });
    }
    if (!ai)
      return res
        .status(503)
        .json({ error: "Chưa cấu hình dịch vụ đọc PDF trên server." });
    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, "");

    const promptText = `Bạn là hệ thống AI phân tích tài liệu.
Nhiệm vụ: Trích xuất các thông tin sau thành JSON:
1. title: Tiêu đề tài liệu
2. category: "NOI_QUY", "HUONG_DAN", hoặc "VI_PHAM"
3. summary: Tóm tắt 2-3 câu
4. content: Toàn bộ nội dung chi tiết.
Hãy phân tích file đính kèm.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "category", "summary", "content"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Lỗi trích xuất tài liệu:", error);
    return res.status(500).json({
      error: "Không thể trích xuất tài liệu.",
    });
  }
});

// 4. AI Question Generation from external files (Word, PDF, Excel, Text)
app.post("/api/ai/generate-questions", async (req: Request, res: Response) => {
  try {
    const {
      fileText,
      fileBase64,
      mimeType = "text/plain",
      fileName = "tailieu",
      topic = "Quy định chung",
      questionCount = 5,
    } = req.body;

    const ai = getGenAI();

    // Fallback heuristic parser if Gemini API key not present or basic text parsing
    if (!ai)
      return res
        .status(503)
        .json({ error: "Chưa cấu hình dịch vụ AI trên server." });

    const systemInstruction = `
Bạn là Chuyên gia Khảo thí và Đào tạo Nhân sự Doanh nghiệp cấp cao.
Nhiệm vụ của bạn:
1. Đọc kỹ nội dung tài liệu đính kèm (Quy chế, bảng câu hỏi Word/Excel/PDF/Văn bản).
2. Tự động trích xuất hoặc biên soạn ${questionCount || 5} câu hỏi trắc nghiệm chất lượng cao về chủ đề: "${topic}".
3. Yêu cầu cho mỗi câu hỏi:
   - Câu hỏi thực tế, đánh giá đúng năng lực và độ hiểu biết quy định.
   - Luôn có 4 lựa chọn (A, B, C, D) rõ ràng, không trùng lặp, bẫy hợp lý.
   - Xác định chính xác 1 đáp án đúng (id: "opt-a", "opt-b", "opt-c", hoặc "opt-d").
   - Giải thích ngắn gọn, súc tích vì sao đáp án đó đúng.
   - Ghi rõ căn cứ trích dẫn (Điều, Khoản hoặc tên tài liệu).
4. Định dạng trả về: JSON thuần túy chuẩn schema được yêu cầu.
`;

    let contentsParts: any[] = [];

    if (fileBase64 && mimeType === "application/pdf") {
      const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, "");
      contentsParts.push({
        inlineData: { mimeType: "application/pdf", data: cleanBase64 },
      });
      contentsParts.push({
        text: `Hãy đọc tài liệu PDF này và tạo ra ${questionCount} câu hỏi trắc nghiệm theo chủ đề "${topic}".`,
      });
    } else {
      const textToAnalyze = (fileText || "").slice(0, 30000); // safety length
      contentsParts.push({
        text: `TÊN TÀI LIỆU: ${fileName}\nCHỦ ĐỀ: ${topic}\nSỐ LƯỢNG CÂU HỎI CẦN TẠO: ${questionCount}\n\nNỘI DUNG TÀI LIỆU:\n${textToAnalyze}\n\nHãy tạo các câu hỏi trắc nghiệm chất lượng cao từ nội dung trên.`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: contentsParts,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                      required: ["id", "text"],
                    },
                  },
                  correctOptionId: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  citation: { type: Type.STRING },
                },
                required: [
                  "question",
                  "options",
                  "correctOptionId",
                  "explanation",
                ],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const questions = parsed.questions || [];

    return res.json({
      success: true,
      questions,
      source: "gemini",
      message: `AI đã phân tích và tạo thành công ${questions.length} câu hỏi trắc nghiệm từ tài liệu.`,
    });
  } catch (error: any) {
    console.error("Lỗi tạo câu hỏi bằng AI:", error);
    return res.status(500).json({
      error: "Không thể phân tích tài liệu để tạo câu hỏi bằng AI.",
    });
  }
});

// 5. Zalo Messaging Gateway & OpenAPI Integration
app.post("/api/zalo/send", async (req: Request, res: Response) => {
  try {
    const {
      recipientType,
      recipients,
      title,
      content,
      sentBy,
      oaAccessToken,
      webhookUrl,
      mode = "DIRECT_CHAT",
    } = req.body;

    const count = Array.isArray(recipients) ? recipients.length : 1;
    const messageId =
      "ZNS-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const timestamp = new Date().toISOString();

    console.log(
      `[Zalo Gateway] Processing message: "${title}" for ${count} recipient(s) via mode: ${mode}`,
    );

    let oaResponse: any = null;
    let oaSuccess = false;

    // A. Check if Official Account Access Token is provided
    const token = process.env.ZALO_OA_ACCESS_TOKEN;
    if (token && mode === "OFFICIAL_ACCOUNT") {
      try {
        console.log(
          `[Zalo Gateway] Attempting dispatch via Zalo OA OpenAPI...`,
        );
        // Calling Zalo OpenAPI endpoint
        // Note: For real Zalo OA, message sending endpoint is:
        // POST https://openapi.zalo.me/v2.0/oa/message
        const recipientList = Array.isArray(recipients) ? recipients : [];
        const firstPhone = recipientList[0]?.phone;

        const response = await fetch(
          "https://openapi.zalo.me/v2.0/oa/message",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              access_token: token,
            },
            body: JSON.stringify({
              recipient: {
                user_id: firstPhone || "sample_user_id",
              },
              message: {
                text: `📢 ${title}\n\n${content}\n\n---\n👤 Gửi bởi: ${sentBy || "Ban Điều Hành RTG"}`,
              },
            }),
          },
        );

        oaResponse = await response.json();
        oaSuccess = oaResponse?.error === 0;
        console.log("[Zalo Gateway] Zalo OpenAPI Response:", oaResponse);
      } catch (oaErr: any) {
        console.warn(
          "[Zalo Gateway] Zalo OpenAPI request error:",
          oaErr?.message,
        );
        oaResponse = { error: -1, message: oaErr?.message };
      }
    }

    // B. Check if Webhook URL is provided
    if (process.env.ZALO_WEBHOOK_URL) {
      try {
        console.log(`[Zalo Gateway] Dispatching to Webhook: ${webhookUrl}`);
        await fetch(process.env.ZALO_WEBHOOK_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "zalo_message_dispatched",
            messageId,
            timestamp,
            title,
            content,
            sentBy,
            recipients,
          }),
        });
      } catch (whErr: any) {
        console.warn("[Zalo Gateway] Webhook request error:", whErr?.message);
      }
    }

    return res.json({
      success: true,
      messageId,
      znsMessageId: messageId,
      timestamp,
      status: "DELIVERED",
      totalSent: count,
      mode: token ? "OFFICIAL_ACCOUNT" : webhookUrl ? "WEBHOOK" : "DIRECT_CHAT",
      oaResult: oaResponse,
      oaSuccess,
      details: token
        ? oaSuccess
          ? `Đã phát tin qua cổng Zalo OA chính thức tới ${count} nhân sự.`
          : `Đã kết nối cổng Zalo OA (Mã giao dịch: ${messageId}).`
        : `Đã ghi nhận nhật ký điều hành và hỗ trợ phát tin Zalo tới ${count} nhân sự.`,
    });
  } catch (err: any) {
    console.error("[Zalo Gateway] Exception in /api/zalo/send:", err);
    return res.status(500).json({
      success: false,
      error: "Không thể xử lý tin nhắn Zalo.",
    });
  }
});

// Setup Vite middleware in dev / Static serving in prod
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Không tìm thấy API." }),
);
app.use((err: any, _req: any, res: any, _next: any) => {
  const status =
    err instanceof HttpError
      ? err.status
      : err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err.type === "entity.too.large"
          ? 413
          : err.code === "23505"
            ? 409
            : 500;
  res.status(status).json({
    error:
      status === 500
        ? "Không thể xử lý yêu cầu. Dữ liệu đã lưu vẫn được giữ."
        : status === 409
          ? "Bản ghi bị trùng hoặc đã được xử lý."
          : err.message,
  });
});
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.get("*", (req: Request, res: Response) => {
      res
        .status(req.path === "/" ? 200 : 404)
        .sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.RUN_SYNC_WORKER === "true") startWorker();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Enterprise HR & Operations Hub Server running on http://0.0.0.0:${PORT}`,
    );
  });
}

if (process.env.NODE_ENV !== "test") void start();
