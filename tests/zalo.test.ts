import test from "node:test";
import assert from "node:assert/strict";
import { sendZaloText, zaloConfiguration } from "../backend/zalo-provider";
test("Retired Zalo channel cannot dispatch even when old credentials remain configured", async () => {
  process.env.ZALO_OA_ID = "obsolete";
  process.env.ZALO_OA_ACCESS_TOKEN = "obsolete";
  let calls = 0;
  const response = await sendZaloText("user", "uid", "test", () => {
    calls++;
    throw Error("external request forbidden");
  });
  assert.equal(calls, 0);
  assert.equal(response.errorCode, "channel_disabled");
  assert.equal(zaloConfiguration().configured, false);
  delete process.env.ZALO_OA_ID;
  delete process.env.ZALO_OA_ACCESS_TOKEN;
});
