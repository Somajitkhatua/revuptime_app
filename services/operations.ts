import { client, isDemo, isCanonical } from "./supabase";
import type { OperationsOverview, PointVital } from "../types/operations";
const missing = (e: { code?: string } | null) =>
  !!e && ["42883", "PGRST202", "42P01", "PGRST205"].includes(e.code || "");
export async function getOperations(org: string): Promise<OperationsOverview> {
  if (!org) throw new Error("Sign in to a workspace first.");
  if (isDemo || !isCanonical)
    return {
      available: false,
      health: [],
      points: [],
      gateways: [],
      daily: [],
      loadedAt: Date.now(),
    };
  const { data, error } = await client().rpc("page_overview", { p_org: org });
  if (error && !missing(error)) throw error;
  const available = !error && !!data && !Array.isArray(data);
  const own = <T extends { organization_id?: string }>(rows: unknown): T[] =>
    Array.isArray(rows) ? rows.filter((r) => r.organization_id === org) : [];
  const points = own<PointVital>(data?.points);
  const ids = new Set(points.map((p) => p.point_id));
  return {
    available,
    health: own(data?.health),
    points,
    gateways: own(data?.gateways),
    daily: Array.isArray(data?.daily)
      ? data.daily.filter((d: any) => ids.has(d.point_id))
      : [],
    loadedAt: Date.now(),
  };
}
export async function getPointHistory(
  org: string,
  asset: string,
  pointIds: string[],
  hours: number,
) {
  if (!pointIds.length || isDemo) return [];
  const authorized = await client()
    .from("point_vitals")
    .select("point_id")
    .eq("organization_id", org)
    .eq("asset_id", asset)
    .in("point_id", pointIds);
  if (authorized.error) throw authorized.error;
  const ids = (authorized.data || []).map((p) => p.point_id);
  if (!ids.length) return [];
  const { data, error } = await client()
    .from("sensor_readings")
    .select("id,point_id,timestamp,v_max,vx,vy,vz,temperature_c,quality")
    .eq("organization_id", org)
    .in("point_id", ids)
    .gte("timestamp", new Date(Date.now() - hours * 3600000).toISOString())
    .lte("timestamp", new Date().toISOString())
    .order("timestamp", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || [])
    .filter((r) => !["bad", "invalid", "error"].includes(r.quality))
    .reverse();
}
export async function getInstallations(org: string, points: string[]) {
  if (!points.length || isDemo) return [];
  const { data, error } = await client()
    .from("sensor_installations")
    .select("id,sensor_id,point_id,installed_at,removed_at,note")
    .eq("organization_id", org)
    .in("point_id", points)
    .order("installed_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
