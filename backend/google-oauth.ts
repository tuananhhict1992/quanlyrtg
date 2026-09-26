import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { CodeChallengeMethod } from "google-auth-library";
import {
  createGoogleOAuthClient,
  googleAppOrigin,
  sealGoogleValue,
  openGoogleValue,
  saveGoogleConnection,
} from "./google-connection";
import { pool, HttpError } from "./db";
import { assertPermission } from "./security";
import { audit } from "./records";
import { ensureStructure } from "./google";
const cookieName = "__Secure-rtg-google-setup";
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/google/oauth/callback",
};
type OAuthState = {
  state: string;
  verifier: string;
  actorId: string;
  authUserId: string;
  email: string;
  expires: number;
};
export function validateGoogleState(
  sealed: string,
  state: unknown,
  now = Date.now(),
): OAuthState {
  const saved = JSON.parse(
    openGoogleValue(sealed, "oauth-state"),
  ) as OAuthState;
  if (
    typeof state !== "string" ||
    !saved.state ||
    state.length !== saved.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state)) ||
    saved.expires < now ||
    !saved.actorId ||
    !saved.authUserId ||
    !saved.email ||
    !saved.verifier
  )
    throw new HttpError(
      400,
      "Phiên kết nối Google không hợp lệ hoặc đã hết hạn.",
    );
  return saved;
}
export async function startGoogleOAuth(req: any, res: Response) {
  assertPermission(req.user, "MANAGE_PERMISSIONS");
  const origin = googleAppOrigin();
  if (req.headers.origin !== origin)
    throw new HttpError(403, "Hãy kết nối Google từ website chính thức.");
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const email = req.authUser.email;
  if (!email)
    throw new HttpError(409, "Tài khoản admin cần có email xác thực.");
  res.cookie(
    cookieName,
    sealGoogleValue(
      JSON.stringify({
        state,
        verifier,
        actorId: req.user.id,
        authUserId: req.authUser.id,
        email,
        expires: Date.now() + 600000,
      }),
      "oauth-state",
    ),
    { ...cookieOptions, maxAge: 600000 },
  );
  res.setHeader("Cache-Control", "no-store");
  res.json({
    url: createGoogleOAuthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      login_hint: email,
      scope: ["openid", "email", "https://www.googleapis.com/auth/drive.file"],
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  });
}
export async function finishGoogleOAuth(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.clearCookie(cookieName, cookieOptions);
  try {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!cookie || req.query.error || typeof req.query.code !== "string")
      throw new Error("Invalid callback");
    const saved = validateGoogleState(
      decodeURIComponent(cookie),
      req.query.state,
    );
    const user = (
      await pool.query(
        "select r.data from private.records r join private.accounts a on a.employee_id=r.id where r.module='employees' and r.id=$1 and a.auth_user_id=$2",
        [saved.actorId, saved.authUserId],
      )
    ).rows[0]?.data;
    assertPermission(user, "MANAGE_PERMISSIONS");
    const auth = createGoogleOAuthClient();
    const { tokens } = await auth.getToken({
      code: req.query.code,
      codeVerifier: saved.verifier,
    });
    if (!tokens.id_token) throw new Error("Missing Google identity");
    const ticket = await auth.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const identity = ticket.getPayload();
    if (
      !identity?.email_verified ||
      !identity.sub ||
      identity.email?.toLowerCase() !== saved.email.toLowerCase()
    )
      throw new Error("Google account mismatch");
    if (
      !tokens.scope
        ?.split(" ")
        .includes("https://www.googleapis.com/auth/drive.file")
    )
      throw new Error("Drive permission missing");
    auth.setCredentials(tokens);
    await saveGoogleConnection(
      auth,
      { sub: identity.sub, email: identity.email! },
      saved.actorId,
    );
    await ensureStructure();
    await audit(pool, saved.actorId, "google.connection.connect");
    res.redirect(303, googleAppOrigin() + "/?google_connection=success");
  } catch {
    // Do not expose authorization codes, tokens, client secrets or provider response bodies.
    res
      .status(400)
      .type("html")
      .send(
        '<!doctype html><meta charset="utf-8"><title>Kết nối Google</title><h1>Chưa kết nối được Google</h1><p>Hãy quay lại Google Sync trên web RTG, đăng nhập đúng tài khoản admin và đồng ý quyền lưu trữ. Dữ liệu trong PostgreSQL vẫn được giữ.</p><a href="/">Quay lại RTG</a>',
      );
  }
}
