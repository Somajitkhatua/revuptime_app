import type { SupabaseClient } from "@supabase/supabase-js";

export async function assignedSensors(db: SupabaseClient, org: string, asset: string) {
  const result = await db.from("sensors").select("id,name,unit,measurement_type,sensor_type,configuration")
    .eq("organization_id", org).eq("asset_id", asset);
  if (result.error) throw result.error;
  return result.data || [];
}

/** Read legacy ingestion rows through their verified, workspace-scoped sensor assignment. */
export async function linkedReadings(db: SupabaseClient, org: string, asset: string, sensors: any[], range?: { from: string; to: string }) {
  const batches = await Promise.all(sensors.map(async (sensor) => {
    const readings: any[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from("sensor_readings").select("*").eq("organization_id", org)
        .eq("sensor_id", sensor.id);
      // Current sensor assignment supplies the link for older ingestion rows.
      // Explicit links to another asset are never included.
      query = range
        ? query.is("asset_id", null).or("quality.is.null,quality.in.(good,valid)")
        : query.or(`and(asset_id.is.null,or(quality.is.null,quality.in.(good,valid))),and(asset_id.eq.${asset},or(quality.is.null,quality.in.(good,valid)))`);
      query = query
        .order("timestamp", { ascending: false }).order("id", { ascending: false });
      if (range) query = query.gte("timestamp", range.from).lte("timestamp", range.to).range(offset, offset + 499);
      else query = query.limit(1);
      const result = await query;
      if (result.error) throw result.error;
      const page = result.data || [];
      readings.push(...page.map((row) => ({ ...row, asset_id: asset, sensors: sensor })));
      if (!range || page.length < 500) return readings;
      if (readings.length >= 50000) throw new Error("This sensor has too many readings for this view. Choose a shorter date range.");
    }
  }));
  return batches.flat();
}

export function attachSensors(readings: any[], sensors: any[]) {
  const assigned = new Map(sensors.map((sensor) => [sensor.id, sensor]));
  return readings.map((row) => ({ ...row, sensors: assigned.get(row.sensor_id) || row.sensors }));
}

export function unavailableChartFunction(error: { code?: string; message?: string } | null) {
  return !!error && (["42883", "PGRST202"].includes(error.code || "") ||
    (error.code === "42501" && /permission denied for function revuptime_chart_readings\b/i.test(error.message || "")));
}

export async function assetHistory(db: SupabaseClient, org: string, asset: string, from: string, to: string) {
  const readings: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("sensor_readings").select("*").eq("organization_id", org).eq("asset_id", asset)
      .or("quality.is.null,quality.in.(good,valid)").gte("timestamp", from).lte("timestamp", to)
      .order("timestamp", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
    if (result.error) throw result.error;
    const page = result.data || [];
    readings.push(...page);
    if (page.length < 500) return readings;
    if (readings.length >= 50000) throw new Error("This period contains too many readings. Choose a shorter date range.");
  }
}
