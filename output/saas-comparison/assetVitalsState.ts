import type { Row } from "./data";
export const STALE_AFTER_MS = 15 * 60 * 1000;
export function readingAgeState(reading: Row | undefined, now = Date.now()) {
  const at = Date.parse(reading?.timestamp || "");
  if (
    !Number.isFinite(at) ||
    at > now ||
    ["bad", "invalid", "error"].includes(reading?.quality)
  )
    return { fresh: false, label: "No valid reading", age: null };
  const age = now - at;
  return {
    fresh: age <= STALE_AFTER_MS,
    label: age > STALE_AFTER_MS ? "Stale data" : "Receiving data",
    age,
  };
}
export function axisValue(
  reading: Row | undefined,
  field: string,
  sensor?: Row,
): number | null {
  const value = reading?.[field];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (field !== "temperature_c" && value < 0)
  )
    return null;
  if (
    /^[vad][xyz]$/.test(field) &&
    value === 0 &&
    sensor?.configuration?.verified_registers?.[field] !== true
  )
    return null;
  return value;
}
export function sensorBaseline(
  rows: Row[],
  sensorId: string | undefined,
  metric: string,
) {
  if (!sensorId) return null;
  const row = rows
    .filter(
      (row) =>
        row.sensor_id === sensorId &&
        row.metric === metric &&
        !["learning", "insufficient", "invalid", "disabled", "failed"].includes(
          row.status,
        ),
    )
    .sort(
      (a, b) =>
        Date.parse(b.window_end || b.created_at) -
        Date.parse(a.window_end || a.created_at),
    )[0];
  if (
    !row ||
    typeof row.p05 !== "number" ||
    typeof row.p95 !== "number" ||
    !Number.isFinite(row.p05) ||
    !Number.isFinite(row.p95) ||
    row.p05 >= row.p95
  )
    return null;
  return {
    low: row.p05,
    high: row.p95,
    normal:
      typeof row.p50 === "number" && Number.isFinite(row.p50) ? row.p50 : null,
  };
}
