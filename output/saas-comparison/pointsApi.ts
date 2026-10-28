import { authorizedDataClient, type Row } from "../data";

/** True when the measurement-point migration is not applied to this database yet. */
export const isMissingRelation = (
  e: { code?: string; message?: string } | null,
) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    e.code === "42703" ||
    /does not exist|schema cache/i.test(e.message || ""));

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String((e as Row)?.message || e);

export type AssetPoints = {
  missing: boolean;
  points: Row[];
  health: Row | null;
  installations: Row[];
  sensors: Row[];
  gateways: Row[];
  alerts: Row[];
  /** Sensors with an open installation anywhere in the organisation. */
  installedSensorIds: Set<string>;
};

const EMPTY: AssetPoints = {
  missing: true,
  points: [],
  health: null,
  installations: [],
  sensors: [],
  gateways: [],
  alerts: [],
  installedSensorIds: new Set(),
};

/** Everything the asset page needs about its measurement points. */
export async function loadAssetPoints(asset: Row): Promise<AssetPoints> {
  const db = authorizedDataClient();
  const org = asset.organization_id;
  const [vitals, health] = await Promise.all([
    db
      .from("point_vitals")
      .select("*")
      .eq("organization_id", org)
      .eq("asset_id", asset.id)
      .order("sort_order")
      .order("point_name"),
    db
      .from("asset_health")
      .select("*")
      .eq("organization_id", org)
      .eq("asset_id", asset.id)
      .maybeSingle(),
  ]);
  if (isMissingRelation(vitals.error) || isMissingRelation(health.error))
    return EMPTY;
  if (vitals.error) throw vitals.error;
  if (health.error) throw health.error;
  const points = vitals.data || [];
  const pointIds = points.map((p) => p.point_id);

  const [installs, sensors, gateways, alerts, open] = await Promise.all([
    pointIds.length
      ? db
          .from("sensor_installations")
          .select("*")
          .eq("organization_id", org)
          .in("point_id", pointIds)
          .order("installed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // Sensors that could be installed here: on a gateway in this plant, or already on this asset.
    db
      .from("sensors")
      .select(
        "id, name, sensor_code, gateway_id, modbus_address, asset_id, site_id, status, model, serial_number",
      )
      .eq("organization_id", org)
      .neq("status", "decommissioned")
      .order("name"),
    db
      .from("gateways")
      .select("id, name, site_id, status, last_seen_at, client_id")
      .eq("organization_id", org)
      .neq("status", "revoked"),
    db
      .from("alerts")
      .select("*")
      .eq("organization_id", org)
      .eq("asset_id", asset.id)
      .order("detected_at", { ascending: false })
      .limit(20),
    db
      .from("sensor_installations")
      .select("sensor_id")
      .eq("organization_id", org)
      .is("removed_at", null),
  ]);
  for (const r of [installs, sensors, gateways, alerts, open])
    if (r.error) throw r.error;
  return {
    missing: false,
    points,
    health: health.data,
    installations: installs.data || [],
    sensors: (sensors.data || []).filter(
      (s) => s.site_id === asset.site_id || s.asset_id === asset.id,
    ),
    gateways: gateways.data || [],
    alerts: alerts.data || [],
    installedSensorIds: new Set((open.data || []).map((r) => r.sensor_id)),
  };
}

/** Velocity history per point for the trend and the compare chart. */
export async function loadPointReadings(
  org: string,
  pointIds: string[],
  fromIso: string,
): Promise<Row[]> {
  if (!pointIds.length) return [];
  const { data, error } = await authorizedDataClient()
    .from("sensor_readings")
    .select("point_id, sensor_id, timestamp, vx, vy, vz, v_max, quality")
    .eq("organization_id", org)
    .in("point_id", pointIds)
    .gte("timestamp", fromIso)
    .order("timestamp", { ascending: true })
    .limit(10000);
  if (error) throw error;
  return (data || []).filter(
    (r) => !["bad", "invalid", "error"].includes(r.quality),
  );
}

export async function addPoint(
  asset: Row,
  input: {
    name: string;
    position: string;
    radial_axis: string;
    axial_axis: string;
    sort_order: number;
  },
) {
  const { data, error } = await authorizedDataClient()
    .from("measurement_points")
    .insert({
      organization_id: asset.organization_id,
      asset_id: asset.id,
      name: input.name.trim(),
      position: input.position,
      radial_axis: input.radial_axis || null,
      axial_axis: input.axial_axis || null,
      sort_order: input.sort_order,
    })
    .select("id")
    .single();
  if (error)
    throw error.code === "23505"
      ? new Error("This machine already has a point with that name.")
      : error;
  return data.id as string;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await authorizedDataClient().rpc(name, args);
  if (error) throw new Error(errorText(error));
  return data as T;
}

export const installSensor = (pointId: string, sensorId: string) =>
  rpc<string>("revuptime_install_sensor", {
    p_point_id: pointId,
    p_sensor_id: sensorId,
  });
export const replaceSensor = (pointId: string, sensorId: string) =>
  rpc<string>("revuptime_replace_sensor", {
    p_point_id: pointId,
    p_new_sensor_id: sensorId,
  });
export const removeSensor = (pointId: string) =>
  rpc<void>("revuptime_remove_sensor", { p_point_id: pointId });
export const mapGatewayAddress = (
  gatewayId: string,
  address: number,
  pointId: string,
) =>
  rpc<string>("revuptime_map_gateway_address", {
    p_gateway_id: gatewayId,
    p_address: address,
    p_point_id: pointId,
  });

/** Addresses a gateway has reported, with the outcome of the last message per address. */
export async function loadGatewayAddresses(
  org: string,
  gatewayId: string,
): Promise<{ missing: boolean; rows: Row[] }> {
  const { data, error } = await authorizedDataClient()
    .from("gateway_addresses")
    .select("*")
    .eq("organization_id", org)
    .eq("gateway_id", gatewayId)
    .order("modbus_address");
  if (isMissingRelation(error)) return { missing: true, rows: [] };
  if (error) throw error;
  return { missing: false, rows: data || [] };
}

/** Points of a plant's assets, for mapping lists. */
export async function loadPlantPoints(
  org: string,
  siteId: string,
): Promise<{ missing: boolean; points: Row[] }> {
  const { data, error } = await authorizedDataClient()
    .from("point_vitals")
    .select(
      "point_id, point_name, asset_id, position, sensor_id, sensor_name, modbus_address, gateway_id, sort_order",
    )
    .eq("organization_id", org)
    .order("sort_order");
  if (isMissingRelation(error)) return { missing: true, points: [] };
  if (error) throw error;
  const { data: assets } = await authorizedDataClient()
    .from("assets")
    .select("id, site_id")
    .eq("organization_id", org)
    .eq("site_id", siteId);
  const ids = new Set((assets || []).map((a) => a.id));
  return {
    missing: false,
    points: (data || []).filter((p) => ids.has(p.asset_id)),
  };
}

/** Health per asset plus every point's vitals, for the plant overview. */
export async function loadPlantHealth(
  org: string,
): Promise<{ missing: boolean; health: Row[]; points: Row[] }> {
  const db = authorizedDataClient();
  const [health, points] = await Promise.all([
    db.from("asset_health").select("*").eq("organization_id", org),
    db
      .from("point_vitals")
      .select("*")
      .eq("organization_id", org)
      .order("sort_order"),
  ]);
  if (isMissingRelation(health.error) || isMissingRelation(points.error))
    return { missing: true, health: [], points: [] };
  if (health.error) throw health.error;
  if (points.error) throw points.error;
  return {
    missing: false,
    health: health.data || [],
    points: points.data || [],
  };
}
