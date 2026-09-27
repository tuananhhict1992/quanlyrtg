// Retired channel. Kept as a fail-closed compatibility module for older deployments.
export type ZaloDeliveryResult = { status: "failed"; errorCode: string };
export const zaloConfiguration = () => ({ configured: false, oaId: "" });
export async function sendZaloText(
  ..._args: any[]
): Promise<ZaloDeliveryResult> {
  return { status: "failed", errorCode: "channel_disabled" };
}
