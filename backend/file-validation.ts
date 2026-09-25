import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "./db";
const MAX_SIZE = 20 * 1024 * 1024;
export async function validateFile(
  buffer: Buffer,
  claimed: string,
  name: string,
) {
  if (!buffer.length || buffer.length > MAX_SIZE)
    throw new HttpError(413, "Tệp phải từ 1 byte đến 20 MB.");
  const detected = await fileTypeFromBuffer(buffer);
  const allowed: Record<string, string[]> = {
    "application/pdf": ["pdf"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      "xlsx",
    ],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      "docx",
    ],
  };
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (
    !detected ||
    detected.mime !== claimed ||
    !allowed[detected.mime]?.includes(ext)
  )
    throw new HttpError(
      415,
      "Loại tệp, MIME hoặc nội dung không hợp lệ. Hỗ trợ PDF, DOCX, XLSX, PNG, JPG, WebP.",
    );
  return detected.mime;
}
