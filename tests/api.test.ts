import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
process.env.NODE_ENV = "test";
test("health is public, all business, Google and AI APIs require authentication", async () => {
  const { app } = await import("../server");
  assert.equal((await request(app).get("/api/health")).status, 200);
  for (const path of [
    "/api/me",
    "/api/records/employees",
    "/api/google/jobs",
    "/api/proxy/appsscript?url=http://localhost",
  ])
    assert.equal((await request(app).get(path)).status, 401);
  for (const path of [
    "/api/ai/generate-questions",
    "/api/zalo/send",
    "/api/files",
    "/api/operations/backup",
  ])
    assert.equal((await request(app).post(path).send({})).status, 401);
  const health = await request(app).get("/api/health");
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  assert(!health.headers["x-powered-by"]);
});
