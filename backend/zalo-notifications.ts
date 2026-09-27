// Zalo dispatch has been removed. No network requests may originate here.
import { Router } from "express";
export const zaloRouter = Router();
zaloRouter.use((_req, res) =>
  res
    .status(410)
    .json({ error: "Kênh Zalo đã ngừng. Sử dụng thông báo nội bộ." }),
);
export async function processZaloDelivery() {
  return false;
}
