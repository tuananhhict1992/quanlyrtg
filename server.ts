import mammoth from "mammoth";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./backend/auth";
import { publicAccountsRouter, accountsRouter } from "./backend/accounts";
import { recordsRouter } from "./backend/records";
import { googleRouter } from "./backend/google-routes";
import { finishGoogleOAuth } from "./backend/google-oauth";
import { filesRouter, validateFile } from "./backend/files";
import { internalNotificationsRouter } from "./backend/internal-notifications";
import { examsRouter } from "./backend/exams";
import { operationsRouter } from "./backend/operations";
import { startWorker } from "./backend/worker";
import { runAutomaticWorker } from "./backend/automatic-worker";
import { authenticatedApiLimiter } from './backend/rate-limits';
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
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (
  !Number.isInteger(trustedProxyHops) ||
  trustedProxyHops < 0 ||
  trustedProxyHops > 10
)
  throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10.");
app.set("trust proxy", trustedProxyHops);
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
app.get("/privacy", (_req, res) =>
  res.sendFile(path.resolve("public/privacy.html")),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    // Coarse ingress guard supports 76 employees behind the same workplace NAT.
    // Protected business APIs retain 120/minute independently per verified account.
    limit: 3000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.get("/api/google/oauth/callback", asyncRoute(finishGoogleOAuth));
app.post('/api/internal/worker', express.json({limit:'1kb'}), asyncRoute(async (req, res) => {
  res.set('Cache-Control','no-store');
  res.json(await runAutomaticWorker(req.headers.authorization));
}));
app.use('/api/auth', publicAccountsRouter);
app.use("/api", requireAuth);
app.use('/api', authenticatedApiLimiter());
const PORT = Number(process.env.PORT) || 3000;

// Body parser
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use('/api', accountsRouter);

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
app.use("/api/internal-notifications/send", rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (req: any) => req.user.id }));
app.use("/api/internal-notifications", internalNotificationsRouter);
app.use("/api/zalo", (_req, res) => res.status(410).json({error: "Kênh Zalo đã ngừng. Sử dụng thông báo nội bộ trong ứng dụng."}));
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
      const textToAnalyze = String(fileText || '');
      if(textToAnalyze.length>30000)return res.status(400).json({error:'Tài liệu quá dài cho một lần biên soạn AI. Chia tài liệu nhỏ hơn hoặc chọn Nhập toàn bộ câu hỏi có sẵn để đọc bộ câu hỏi theo mẫu.'});
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
  if (status === 500) {
    const rawCode = typeof err?.code === "string" ? err.code : "";
    const code = /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : "UNKNOWN";
    console.error("RTG_BACKEND_ERROR", { code });
  }
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
