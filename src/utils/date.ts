export const TIMEZONE = "Asia/Ho_Chi_Minh";
export function formatDate(value: string | Date, withTime = false) {
  if (!value) return "—";
  const d =
    typeof value === "string"
      ? new Date(
          /^\d{4}-\d\d-\d\d$/.test(value) ? value + "T00:00:00+07:00" : value,
        )
      : value;
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${withTime ? p.hour + ":" + p.minute + " " : ""}${p.day}/${p.month}/${p.year}`;
}
