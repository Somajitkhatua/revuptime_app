import { createSeed, DEMO_ORG, DEMO_USER } from "../data/seed";
import { writeFileSync } from "node:fs";
const s = createSeed();
const literal = (v: unknown): string =>
  v === null || v === undefined
    ? "null"
    : typeof v === "number"
      ? String(v)
      : typeof v === "boolean"
        ? String(v)
        : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''")}'`;
const insert = (table: string, rows: Record<string, unknown>[]) =>
  rows
    .map((r) => {
      const keys = Object.keys(r);
      return `insert into public.${table}(${keys.join(",")}) values(${keys.map((k) => literal(r[k])).join(",")}) on conflict do nothing;`;
    })
    .join("\n");
// Provision an Auth account before running SQL; replace this placeholder UUID.
let sql = `-- Replace ${DEMO_USER} with an existing Supabase Auth user UUID before running.\n-- Demo manuals are illustrative metadata, not verified OEM files.\nbegin;\ninsert into public.organizations(id,name) values('${DEMO_ORG}','RevUpTime Demo') on conflict do nothing;\ninsert into public.organization_members(organization_id,user_id,role) values('${DEMO_ORG}','${DEMO_USER}','Maintenance Manager') on conflict do nothing;\ninsert into public.profiles(id,organization_id,name,email) values('${DEMO_USER}','${DEMO_ORG}','Rajesh Kumar','rajesh@revuptime.com') on conflict do nothing;\n`;
for (const [table, rows] of [
  ["sites", s.sites],
  ["assets", s.assets],
  ["alerts", s.alerts],
  ["work_orders", s.workOrders],
] as const)
  sql += insert(table, rows as unknown as Record<string, unknown>[]) + "\n";
sql +=
  insert(
    "sensor_readings",
    s.readings.map(({ id, ...r }) => r),
  ) + "\n";
sql +=
  insert(
    "asset_documents",
    s.documents.map((d) => ({ ...d, status: "Queued" })),
  ) + "\n";
for (const a of s.assets) {
  const r = s.readings.filter((r) => r.asset_id === a.id);
  for (let i = 0; i < 7; i++) {
    const window = r.slice(i * 24, (i + 1) * 24);
    sql +=
      insert("sensor_feature_windows", [
        {
          organization_id: DEMO_ORG,
          asset_id: a.id,
          window_start: window[0].recorded_at,
          window_end: window.at(-1)!.recorded_at,
          rms_average: window.reduce((n, x) => n + x.x_rms, 0) / window.length,
          rms_max: Math.max(...window.map((x) => x.x_rms)),
          temperature_average:
            window.reduce((n, x) => n + x.temperature, 0) / window.length,
          anomaly_score: a.health === "Critical" ? 0.87 : 0.12,
        },
      ]) + "\n";
  }
}
sql += "commit;\n";
writeFileSync("supabase/seed.sql", sql);
