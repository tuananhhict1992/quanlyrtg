import { google } from "googleapis";
import { Readable } from "node:stream";
import { FOLDERS, SHEET_TABS } from "./security";
import { HttpError } from "./db";
export function googleClients() {
  google.options({ timeout: 30000, retry: false });
  const email = process.env.GOOGLE_CLIENT_EMAIL,
    key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (
    !email ||
    !key ||
    !process.env.GOOGLE_DRIVE_ROOT_ID ||
    !process.env.GOOGLE_SPREADSHEET_ID
  )
    throw new HttpError(503, "Chưa cấu hình Google Workspace trên server.");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return {
    drive: google.drive({ version: "v3", auth }),
    sheets: google.sheets({ version: "v4", auth }),
  };
}
export const spreadsheetId = () => process.env.GOOGLE_SPREADSHEET_ID!;
const escaped = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
export async function ensureStructure() {
  const { drive, sheets } = googleClients();
  const root = process.env.GOOGLE_DRIVE_ROOT_ID!;
  const rootInfo = await drive.files.get({
    fileId: root,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  if (
    rootInfo.data.mimeType !== "application/vnd.google-apps.folder" ||
    rootInfo.data.name !== "RTG_SYSTEM"
  )
    throw new HttpError(
      409,
      "GOOGLE_DRIVE_ROOT_ID phải trỏ đến thư mục RTG_SYSTEM.",
    );
  const folders: Record<string, string> = {};
  for (const name of FOLDERS) {
    const found = await drive.files.list({
      q: `'${escaped(root)}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    folders[name] =
      found.data.files?.[0]?.id ||
      (
        await drive.files.create({
          requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [root],
          },
          fields: "id",
          supportsAllDrives: true,
        })
      ).data.id!;
  }
  const meta = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId(),
      fields: "sheets.properties.title",
    }),
    names = new Set(meta.data.sheets?.map((s) => s.properties?.title));
  const missing = [...Object.values(SHEET_TABS), "SYNC_LOG"].filter(
    (n) => !names.has(n),
  );
  if (missing.length)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: {
        requests: missing.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  return folders;
}
export async function assertInRoot(fileId: string) {
  const { drive } = googleClients();
  const root = process.env.GOOGLE_DRIVE_ROOT_ID;
  let id = fileId;
  for (let i = 0; i < 30; i++) {
    if (id === root) return;
    const { data } = await drive.files.get({
      fileId: id,
      fields: "parents,trashed",
      supportsAllDrives: true,
    });
    if (data.trashed || !data.parents?.[0]) break;
    id = data.parents[0];
  }
  throw new HttpError(403, "Tệp không thuộc RTG_SYSTEM.");
}
export async function archiveToDrive(
  id: string,
  name: string,
  mime: string,
  folder: string,
  body: Buffer,
) {
  const { drive } = googleClients();
  try {
    const existing = await drive.files.get({
      fileId: id,
      fields: "id,webViewLink,size",
      supportsAllDrives: true,
    });
    if (existing.data.id) return existing.data;
  } catch (e: any) {
    if (e.code !== 404 && e.response?.status !== 404) throw e;
  }
  const { data } = await drive.files.create({
    requestBody: { id, name, parents: [folder] },
    media: { mimeType: mime, body: Readable.from(body) },
    fields: "id,webViewLink,size",
    supportsAllDrives: true,
  });
  if (!data.id) throw new Error("Drive chưa xác nhận file ID.");
  return data;
}
export async function reserveDriveId() {
  return (
    await googleClients().drive.files.generateIds({
      count: 1,
      space: "drive",
      type: "files",
    })
  ).data.ids![0];
}
export async function ensureSheetRows(tab: string, row: number) {
  const { sheets } = googleClients();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    fields: "sheets.properties",
  });
  const found = data.sheets?.find(
    (s) => s.properties?.title === tab,
  )?.properties;
  if (!found) throw new HttpError(409, "Chưa khởi tạo tab báo cáo.");
  if ((found.gridProperties?.rowCount || 0) < row)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: found.sheetId,
                gridProperties: { rowCount: Math.ceil(row / 1000) * 1000 },
              },
              fields: "gridProperties.rowCount",
            },
          },
        ],
      },
    });
}
