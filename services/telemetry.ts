import { Reading } from "../types/models";
import { client, isDemo, isCanonical } from "./supabase";
import { rows } from "./repository";
import { normalizeReadings, mergeLatestReadings } from "../utils/telemetryReadings";
import { assignedSensors, linkedReadings, attachSensors, unavailableChartFunction, assetHistory } from "./linkedTelemetry";
export async function getReadings(
  org: string,
  asset: string,
  hours = 168,
  from?: string,
  to?: string,
): Promise<Reading[]> {
  if (isDemo) {
    const all = await rows<Reading>("sensor_readings", "readings", org, {
      asset_id: asset,
    });
    const end = to
      ? new Date(to).getTime()
      : Math.max(...all.map((r) => Date.parse(r.recorded_at)));
    const start = from ? Date.parse(from) : end - hours * 3600000;
    return all
      .filter(
        (r) =>
          Date.parse(r.recorded_at) >= start &&
          Date.parse(r.recorded_at) <= end,
      )
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }
  const end = to || new Date().toISOString();
  const start =
    from || new Date(Date.parse(end) - hours * 3600000).toISOString();
  if (isCanonical) {
    const { data, error } = await client().rpc("revuptime_chart_readings", {
      p_organization: org, p_asset: asset, p_from: start, p_to: end,
    });
    if (error && !unavailableChartFunction(error)) throw error;
    const sensors = await assignedSensors(client(), org, asset);
    const linked = await linkedReadings(client(), org, asset, sensors, { from: start, to: end });
    const history = error ? await assetHistory(client(), org, asset, start, end) : data?.readings || [];
    return canonicalReadings(attachSensors([...history, ...linked], sensors));
  }
  const { data, error } = await client()
    .from("sensor_readings")
    .select(isCanonical ? "*,sensors(measurement_type,sensor_type)" : "*")
    .eq("organization_id", org)
    .eq("asset_id", asset)
    .gte(isCanonical ? "timestamp" : "recorded_at", start)
    .lte(isCanonical ? "timestamp" : "recorded_at", end)
    .order(isCanonical ? "timestamp" : "recorded_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return isCanonical
    ? canonicalReadings(data || [])
    : (data as unknown as Reading[]).reverse();
}
export async function getLatest(org: string, asset: string) {
  if (isCanonical) {
    const sensors = await assignedSensors(client(), org, asset);
    const [direct, linked] = await Promise.all([
      client().from("sensor_readings").select("*").eq("organization_id", org).eq("asset_id", asset)
        .or("quality.is.null,quality.in.(good,valid)").order("timestamp", { ascending: false }).limit(100),
      linkedReadings(client(), org, asset, sensors),
    ]);
    if (direct.error) throw direct.error;
    const unique = [...new Map([...(direct.data || []), ...linked].map((row) => [row.id, row])).values()];
    return mergeLatestReadings(canonicalReadings(attachSensors(unique, sensors)));
  }

  if (isDemo) {
    const r = await getReadings(org, asset, 1);
    return r.at(-1) || null;
  }
  const { data, error } = await client()
    .from("sensor_readings")
    .select("*")
    .eq("organization_id", org)
    .eq("asset_id", asset)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Reading | null;
}
export const canonicalReadings = normalizeReadings;
