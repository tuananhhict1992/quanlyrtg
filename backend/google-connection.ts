import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { google } from "googleapis";
import { pool, HttpError } from "./db";
let cachedOAuth:
  { key: string; auth: ReturnType<typeof createGoogleOAuthClient> } | undefined;

export function googleOAuthConfigured() {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.PUBLIC_APP_URL
  );
}
export function googleAppOrigin() {
  const url = new URL(
    process.env.PUBLIC_APP_URL || "https://unconfigured.invalid",
  );
  if (
    !googleOAuthConfigured() ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new HttpError(
      503,
      "Chưa cấu hình Google OAuth và PUBLIC_APP_URL HTTPS trên server.",
    );
  return url.origin;
}
export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleAppOrigin() + "/api/google/oauth/callback",
  );
}
function encryptionKey(purpose: string) {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 24)
    throw new HttpError(503, "Chưa cấu hình khóa Google OAuth hợp lệ.");
  return createHash("sha256")
    .update("rtg-google-v1\0" + purpose + "\0" + secret)
    .digest();
}
export function sealGoogleValue(value: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(purpose), iv);
  cipher.setAAD(Buffer.from(process.env.GOOGLE_OAUTH_CLIENT_ID || ""));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    bytes.toString("base64url"),
  ].join(".");
}
export function openGoogleValue(value: string, purpose: string) {
  if (typeof value !== "string" || value.length > 12000)
    throw new Error("Invalid encrypted Google value");
  const [version, iv, tag, data, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data || extra)
    throw new Error("Invalid encrypted Google value");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(purpose),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(process.env.GOOGLE_OAUTH_CLIENT_ID || ""));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export async function readGoogleConnection() {
  return (
    await pool.query(
      "select * from private.google_connections where id='primary'",
    )
  ).rows[0];
}
export async function googleConnection() {
  if (googleOAuthConfigured()) {
    const row = await readGoogleConnection();
    if (!row?.root_id || !row?.spreadsheet_id)
      throw new HttpError(
        503,
        "Admin cần kết nối Google Drive tại mục Google Sync.",
      );
    const cacheKey = createHash("sha256")
      .update(
        row.encrypted_refresh_token +
          process.env.GOOGLE_OAUTH_CLIENT_ID +
          process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      )
      .digest("hex");
    if (cachedOAuth?.key !== cacheKey) {
      const auth = createGoogleOAuthClient();
      auth.setCredentials({
        refresh_token: openGoogleValue(
          row.encrypted_refresh_token,
          "refresh-token",
        ),
      });
      cachedOAuth = { key: cacheKey, auth };
    }
    const auth = cachedOAuth.auth;
    return {
      auth,
      rootId: row.root_id as string,
      spreadsheetId: row.spreadsheet_id as string,
      email: row.email as string,
      mode: "oauth",
    };
  }
  const email = process.env.GOOGLE_CLIENT_EMAIL,
    key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const rootId = process.env.GOOGLE_DRIVE_ROOT_ID,
    spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!email || !key || !rootId || !spreadsheetId)
    throw new HttpError(503, "Chưa cấu hình Google Workspace trên server.");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return { auth, rootId, spreadsheetId, email, mode: "service_account" };
}
export async function saveGoogleConnection(
  auth: ReturnType<typeof createGoogleOAuthClient>,
  identity: { sub: string; email: string },
  actorId: string,
) {
  const lock = await pool.connect();
  try {
    await lock.query("select pg_advisory_lock(726447)");
    const previous = await readGoogleConnection();
    if (previous && previous.google_subject !== identity.sub)
      throw new HttpError(
        409,
        "Kho RTG đã thuộc tài khoản Google khác. Không tự đổi chủ kho.",
      );
    const token =
      auth.credentials.refresh_token ||
      (previous &&
        openGoogleValue(previous.encrypted_refresh_token, "refresh-token"));
    if (!token)
      throw new HttpError(
        409,
        "Google chưa cấp quyền truy cập offline. Hãy kết nối lại và đồng ý quyền lưu trữ.",
      );
    await pool.query(
      "insert into private.google_connections(id,google_subject,email,encrypted_refresh_token,connected_by) values('primary',$1,$2,$3,$4) on conflict(id) do update set email=excluded.email,encrypted_refresh_token=excluded.encrypted_refresh_token,connected_by=excluded.connected_by,updated_at=now()",
      [
        identity.sub,
        identity.email,
        sealGoogleValue(token, "refresh-token"),
        actorId,
      ],
    );
    auth.setCredentials({ ...auth.credentials, refresh_token: token });
    const drive = google.drive({ version: "v3", auth });
    const appId = createHash("sha256")
      .update(googleAppOrigin())
      .digest("hex")
      .slice(0, 24);
    // appProperties plus the server lock reuse app-owned files after an interrupted callback.
    async function findOrCreate(
      kind: string,
      name: string,
      mimeType: string,
      parent?: string,
    ) {
      const found = await drive.files.list({
        q: `trashed=false and appProperties has { key='rtgApp' and value='${appId}' } and appProperties has { key='rtgKind' and value='${kind}' }`,
        fields: "files(id)",
        pageSize: 10,
      });
      if (found.data.files?.[0]?.id) return found.data.files[0].id;
      const created = await drive.files.create({
        requestBody: {
          name,
          mimeType,
          ...(parent ? { parents: [parent] } : {}),
          appProperties: { rtgApp: appId, rtgKind: kind },
        },
        fields: "id",
      });
      if (!created.data.id) throw new Error("Google did not return a file ID");
      return created.data.id;
    }
    const root =
      previous?.root_id ||
      (await findOrCreate(
        "root",
        "RTG_SYSTEM",
        "application/vnd.google-apps.folder",
      ));
    await pool.query(
      "update private.google_connections set root_id=$1 where id='primary'",
      [root],
    );
    const sheet =
      previous?.spreadsheet_id ||
      (await findOrCreate(
        "reports",
        "RTG_ARCHIVE",
        "application/vnd.google-apps.spreadsheet",
        root,
      ));
    await pool.query(
      "update private.google_connections set spreadsheet_id=$1,updated_at=now() where id='primary'",
      [sheet],
    );
    return { rootId: root, spreadsheetId: sheet };
  } finally {
    await lock.query("select pg_advisory_unlock(726447)");
    lock.release();
  }
}
