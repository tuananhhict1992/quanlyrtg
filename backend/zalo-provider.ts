export type ZaloDeliveryResult = {
  status: "success" | "failed" | "unknown";
  messageId?: string;
  errorCode?: string;
};

export function zaloConfiguration() {
  return {
    configured: Boolean(
      process.env.ZALO_OA_ID?.trim() &&
      process.env.ZALO_OA_ACCESS_TOKEN?.trim(),
    ),
    oaId: process.env.ZALO_OA_ID?.trim() || "",
  };
}

// Official API v3: UID is scoped to the OA; a telephone number is not a UID.
// Never automatically retry an ambiguous result: the provider may have accepted it.
export async function sendZaloText(
  kind: "user" | "group",
  targetId: string,
  text: string,
  request: typeof fetch = fetch,
): Promise<ZaloDeliveryResult> {
  if (!zaloConfiguration().configured)
    return { status: "failed", errorCode: "not_configured" };
  try {
    const response = await request(
      kind === "group"
        ? "https://openapi.zalo.me/v3.0/oa/group/message"
        : "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          access_token: process.env.ZALO_OA_ACCESS_TOKEN!,
        },
        body: JSON.stringify({
          recipient:
            kind === "group" ? { group_id: targetId } : { user_id: targetId },
          message: { text },
        }),
      },
    );
    const body = await response.json().catch(() => null);
    if (
      response.ok &&
      body?.error === 0 &&
      typeof body?.data?.message_id === "string" &&
      body.data.message_id
    )
      return { status: "success", messageId: body.data.message_id };
    if (typeof body?.error === "number" && body.error !== 0)
      return { status: "failed", errorCode: "zalo_" + body.error };
    if (response.status >= 400 && response.status < 500)
      return { status: "failed", errorCode: "http_" + response.status };
    return { status: "unknown", errorCode: "unconfirmed_response" };
  } catch {
    return { status: "unknown", errorCode: "connection_unconfirmed" };
  }
}
