import type { Asset, AssetAlert, WorkOrder } from "../types/models";
import type {
  AssetHealth,
  OperationsOverview,
  OperationalGateway,
} from "../types/operations";
export const operationLabels: Record<string, string> = {
  act: "Needs action",
  watch: "Needs attention",
  good: "Normal",
  offline: "Offline",
  no_data: "No data",
  no_points: "Not assessed",
};
export const operationColor = (status: string) =>
  status === "act"
    ? "#DC3545"
    : status === "watch"
      ? "#D78200"
      : status === "good"
        ? "#159447"
        : "#71839A";
export function ago(value?: string, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)} min ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}
export function gatewayState(gateway: OperationalGateway, now = Date.now()) {
  if (["revoked", "pending"].includes(gateway.status)) return gateway.status;
  const at = Date.parse(gateway.last_seen_at || "");
  if (!Number.isFinite(at)) return "No data";
  if (now - at > 15 * 60000) return "Stale";
  return ["online", "stale"].includes(gateway.status) ? "Online" : "Offline";
}
export function applyComputedHealth(asset: Asset, health?: AssetHealth): Asset {
  if (!health) return asset;
  const label = { act: "Critical", watch: "Warning", good: "Healthy" }[
    health.status
  ];
  return {
    ...asset,
    health: (label || "Not assessed") as Asset["health"],
    health_score:
      typeof health.score === "number" && Number.isFinite(health.score)
        ? health.score
        : 0,
  };
}
export function scopedOperations(
  overview: OperationsOverview | undefined,
  assets: Asset[],
  site: string,
  alerts: AssetAlert[],
  orders: WorkOrder[],
) {
  const selectedAssets = assets.filter((a) => !site || a.site_id === site),
    ids = new Set(selectedAssets.map((a) => a.id));
  const health = (overview?.health || []).filter(
    (h) => ids.has(h.asset_id) && h.points > 0,
  );
  const points = (overview?.points || []).filter((p) => ids.has(p.asset_id));
  const gateways = (overview?.gateways || []).filter(
    (g) => !site || g.site_id === site,
  );
  const activeAlerts = alerts.filter(
    (a) =>
      a.status !== "Resolved" &&
      (ids.has(a.asset_id) || (!a.asset_id && (!site || a.site_id === site))),
  );
  const activeOrders = orders.filter(
    (o) =>
      o.status !== "Completed" &&
      !["cancelled", "closed"].includes(o.raw_status || "") &&
      (ids.has(o.asset_id) || (!o.asset_id && (!site || o.site_id === site))),
  );
  const scored = health.filter(
    (h) => typeof h.score === "number" && Number.isFinite(h.score),
  );
  const sensors = new Map(
    points.filter((p) => p.sensor_id).map((p) => [p.sensor_id!, p]),
  );
  return {
    assets: selectedAssets,
    health,
    points,
    gateways,
    alerts: activeAlerts,
    orders: activeOrders,
    score: scored.length
      ? Math.round(scored.reduce((sum, h) => sum + h.score!, 0) / scored.length)
      : null,
    sensorsOnline: [...sensors.values()].filter((p) => p.fresh).length,
    sensorCount: sensors.size,
    gatewaysOnline: gateways.filter((g) => gatewayState(g) === "Online").length,
  };
}
export function isOverdue(
  order: WorkOrder,
  today = new Date().toLocaleDateString("en-CA"),
) {
  // Compare local calendar dates, without parsing midnight UTC.
  const local = today.match(/^\d{4}-\d{2}-\d{2}$/)
    ? today
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  return (
    order.status !== "Completed" &&
    !!order.due_date &&
    order.due_date.slice(0, 10) < local
  );
}
