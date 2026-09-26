import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { parse } from "pg-connection-string";

process.env.NODE_ENV = "test";
process.env.TRUST_PROXY_HOPS = "1";

test("one trusted ingress ignores a spoofed leftmost forwarded address", async () => {
  const { app } = await import("../server");
  app.get("/__test/proxy", (req, res) => res.json({ ip: req.ip }));
  const result = await request(app)
    .get("/__test/proxy")
    .set("X-Forwarded-For", "192.0.2.99, 198.51.100.23");
  assert.equal(result.body.ip, "198.51.100.23");
  assert.equal((await request(app).get("/api/me")).status, 401);
});

test("Supabase CA is loaded without disabling certificate or hostname verification", () => {
  const pem = readFileSync("supabase/certs/prod-ca-2021.txt", "utf8");
  const cert = new X509Certificate(pem);
  assert.equal(cert.ca, true);
  assert.equal(cert.fingerprint256, "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA");
  assert(Date.parse(cert.validTo) > Date.now());
  const parsed = parse("postgresql://sample:sample@localhost/postgres?sslmode=verify-full&sslrootcert=supabase%2Fcerts%2Fprod-ca-2021.txt");
  const ssl = parsed.ssl as { ca?: string; rejectUnauthorized?: boolean; checkServerIdentity?: unknown };
  assert.equal(ssl.ca, pem);
  assert.notEqual(ssl.rejectUnauthorized, false);
  assert.equal(ssl.checkServerIdentity, undefined);
});
