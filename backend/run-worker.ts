import { startWorker } from "./worker";
import { pool } from "./db";
const stop = startWorker();
process.on("SIGTERM", () => {
  stop();
  void pool.end();
});
process.on("SIGINT", () => {
  stop();
  void pool.end();
});
