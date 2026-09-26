import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { testDatabase } from "../scripts/check-migrations";
process.env.NODE_ENV = "test";
process.env.PUBLIC_APP_URL = "https://rtg.example.test";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET =
  "test-only-client-secret-with-adequate-length";
const { sealGoogleValue, openGoogleValue } =
  await import("../backend/google-connection");
const { startGoogleOAuth, validateGoogleState } =
  await import("../backend/google-oauth");

test("Google refresh tokens are authenticated ciphertext bound to purpose and client", () => {
  const encrypted = sealGoogleValue("test-refresh-token", "refresh-token");
  assert(!encrypted.includes("test-refresh-token"));
  assert.equal(
    openGoogleValue(encrypted, "refresh-token"),
    "test-refresh-token",
  );
  assert.throws(() => openGoogleValue(encrypted, "oauth-state"));
  const parts = encrypted.split(".");
  const bytes = Buffer.from(parts[3], "base64url");
  bytes[0] ^= 1;
  parts[3] = bytes.toString("base64url");
  assert.throws(() => openGoogleValue(parts.join("."), "refresh-token"));
  const original = process.env.GOOGLE_OAUTH_CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_ID = "another-client";
  assert.throws(() => openGoogleValue(encrypted, "refresh-token"));
  process.env.GOOGLE_OAUTH_CLIENT_ID = original;
});

test("Google connection requires active admin, same origin, cookie state, expiry and PKCE", async () => {
  let cookie = "",
    payload: any,
    options: any;
  const res: any = {
    cookie: (_name: string, value: string, flags: any) => {
      cookie = value;
      options = flags;
    },
    setHeader() {},
    json: (v: any) => {
      payload = v;
    },
  };
  const req: any = {
    user: { id: "admin", role: "ADMIN", status: "ACTIVE" },
    authUser: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.test",
    },
    headers: { origin: process.env.PUBLIC_APP_URL },
  };
  await assert.rejects(() =>
    startGoogleOAuth(
      { ...req, user: { role: "EMPLOYEE", status: "ACTIVE" } },
      res,
    ),
  );
  await assert.rejects(() =>
    startGoogleOAuth(
      { ...req, headers: { origin: "https://wrong.example.test" } },
      res,
    ),
  );
  await startGoogleOAuth(req, res);
  const url = new URL(payload.url),
    state = url.searchParams.get("state")!;
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://rtg.example.test/api/google/oauth/callback",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert(url.searchParams.get("code_challenge"));
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(
    url.searchParams.get("scope"),
    "openid email https://www.googleapis.com/auth/drive.file",
  );
  assert(options.httpOnly && options.secure && options.sameSite === "lax");
  assert.equal(validateGoogleState(cookie, state).actorId, "admin");
  assert.throws(() => validateGoogleState(cookie, "wrong-state"));
  assert.throws(() => validateGoogleState(cookie, state, Date.now() + 601000));
});

test("OAuth callback rejects missing browser state and Google control APIs remain private", async () => {
  const { app } = await import("../server");
  const result = await request(app).get(
    "/api/google/oauth/callback?code=fake&state=fake",
  );
  assert.equal(result.status, 400);
  assert.equal(result.headers["cache-control"], "no-store");
  assert(!result.text.includes("fake"));
  for (const route of ["/api/google/oauth/start", "/api/google/process-next"]) {
    assert.equal((await request(app).post(route).send({})).status, 401);
  }
  assert.equal((await request(app).get("/api/google/connection")).status, 401);
});

test("Google credentials table has RLS and cannot be read by authenticated clients", async () => {
  const db = await testDatabase();
  try {
    const row = await db.query<{ rowsecurity: boolean }>(
      "select rowsecurity from pg_tables where schemaname='private' and tablename='google_connections'",
    );
    assert.equal(row.rows[0].rowsecurity, true);
    await db.exec("set role authenticated");
    await assert.rejects(
      () => db.query("select * from private.google_connections"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
