import { authorizedDataClient, type Row } from "../data";
import { isMissingRelation } from "./pointsApi";

const db = () => authorizedDataClient();
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String((e as Row)?.message || e);

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new Error(errorText(error));
  return data as T;
}
async function rows(
  q: PromiseLike<{
    data: Row[] | null;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message || "Could not load data.");
  return data || [];
}

// ---------------------------------------------------------------- organisation and profile
export async function loadOrganization(orgId: string) {
  const { data, error } = await db()
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}
export async function saveOrganization(orgId: string, patch: Row) {
  const { error } = await db()
    .from("organizations")
    .update(patch)
    .eq("id", orgId);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only owners and admins can change organisation settings."
        : error.message,
    );
}
export async function loadProfile(userId: string) {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}
export async function saveProfile(userId: string, patch: Row) {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export type SetupStep = {
  key: string;
  title: string;
  why: string;
  state: string;
  done: boolean;
  link: string;
  to: string;
};

/** The six setup steps, each with a plain sentence about where it stands. Everything comes from the database. */
export async function loadSetupSteps(orgId: string): Promise<SetupStep[]> {
  const c = db();
  const [sites, contacts, gateways, sensors, installs, baselines, members] =
    await Promise.all([
      c
        .from("sites")
        .select("name")
        .eq("organization_id", orgId)
        .order("created_at"),
      c
        .from("site_contacts")
        .select("id")
        .eq("organization_id", orgId)
        .eq("whatsapp_opt_in", true)
        .not("whatsapp", "is", null),
      c
        .from("gateways")
        .select("name, last_seen_at, last_payload_at, status")
        .eq("organization_id", orgId)
        .neq("status", "revoked")
        .order("created_at"),
      c
        .from("sensors")
        .select("id")
        .eq("organization_id", orgId)
        .neq("status", "decommissioned"),
      c
        .from("sensor_installations")
        .select("sensor_id")
        .eq("organization_id", orgId)
        .is("removed_at", null),
      c
        .from("sensor_baselines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "active"),
      c
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "active"),
    ]);
  const plantNames = (sites.data || []).map((x) => x.name as string);
  const nContacts = (contacts.data || []).length;
  const gw = gateways.data || [];
  const gwWithData = gw.filter((g) => g.last_payload_at || g.last_seen_at);
  const nSensors = (sensors.data || []).length;
  const placed = new Set((installs.data || []).map((i) => i.sensor_id)).size;
  const nBase = (baselines.data || []).length;
  const nMembers = (members.data || []).length;
  const plural = (n: number, one: string, many = one + "s") =>
    `${n} ${n === 1 ? one : many}`;
  return [
    {
      key: "plant",
      title: "Add your first plant",
      why: "Plants group your machines, gateways and alert contacts.",
      done: plantNames.length > 0,
      state: plantNames.length
        ? plantNames.length === 1
          ? `${plantNames[0]} added`
          : `${plural(plantNames.length, "plant")} added`
        : "No plant yet",
      link: plantNames.length ? "View" : "Add",
      to: "settings/plants",
    },
    {
      key: "contacts",
      title: "Choose who gets alerts",
      why: "Alerts go to WhatsApp, so someone needs to be opted in to receive them.",
      done: nContacts > 0,
      state: nContacts
        ? `${plural(nContacts, "contact")} ${nContacts === 1 ? "receives" : "receive"} alerts`
        : "Nobody receives alerts yet",
      link: nContacts ? "Manage" : "Add",
      to: "settings/notifications",
    },
    {
      key: "gateway",
      title: "Connect a gateway",
      why: "The gateway carries sensor readings to RevUptime, so nothing can be monitored until one is online.",
      done: gwWithData.length > 0,
      state: !gw.length
        ? "No gateway yet"
        : gwWithData.length
          ? `${gwWithData[0].name} sending data`
          : `${gw[0].name} gateway added, no data yet`,
      link: !gw.length ? "Add" : gwWithData.length ? "View" : "Finish",
      to: !gw.length ? "settings/gateways/new" : "settings/gateways",
    },
    {
      key: "points",
      title: "Place sensors on machines",
      why: "A sensor only counts once it is placed on a measurement point, so readings land on the right machine.",
      done: nSensors > 0 && placed >= nSensors,
      state: nSensors
        ? `${placed} of ${plural(nSensors, "sensor")} placed on a point`
        : "No sensors yet",
      link: nSensors ? "Map" : "Add",
      to: "settings/gateways",
    },
    {
      key: "baselines",
      title: "Let RevUptime learn normal",
      why: "After about 14 days of data each machine gets its own normal range, so unusual readings stand out.",
      done: nBase > 0,
      state: nBase
        ? `Learned normal for ${plural(nBase, "point")}`
        : "Starts by itself once data flows for 14 days",
      link: "How it works",
      to: "settings/vibration-standards",
    },
    {
      key: "team",
      title: "Invite your maintenance team",
      why: "People you invite can see alerts, acknowledge them and update machines.",
      done: nMembers >= 2,
      state:
        nMembers >= 2
          ? `${plural(nMembers, "person", "people")} in this workspace`
          : "Only you so far",
      link: "Invite",
      to: "settings/team",
    },
  ];
}

// ---------------------------------------------------------------- vibration standards
export async function loadLimitSets(orgId: string) {
  const { data, error } = await db()
    .from("vibration_limit_sets")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .order("sort_order");
  if (isMissingRelation(error)) return null;
  if (error) throw new Error(error.message);
  return data || [];
}
export async function saveLimitSet(orgId: string, set: Row) {
  const body = {
    organization_id: orgId,
    standard_id: "custom",
    name: set.name,
    machine_group: set.machine_group || "other",
    foundation: set.foundation || null,
    ab: Number(set.ab),
    bc: Number(set.bc),
    cd: Number(set.cd),
    source: set.source || "Custom limits set by the organisation",
    description: set.description || null,
  };
  const q = set.id
    ? db().from("vibration_limit_sets").update(body).eq("id", set.id)
    : db().from("vibration_limit_sets").insert(body);
  const { error } = await q;
  if (error)
    throw new Error(
      error.code === "23514"
        ? "Limits must rise: A/B below B/C below C/D."
        : error.message,
    );
}
export async function loadAssetLimits(assets: Row[]) {
  const out: Record<string, Row> = {};
  await Promise.all(
    assets.map(async (a) => {
      const { data } = await db().rpc("asset_limits", { p_asset_id: a.id });
      out[a.id] = (data || [])[0] || {};
    }),
  );
  return out;
}
export const previewClassification = (
  assetId: string,
  group: string,
  foundation: string,
  limitSetId?: string | null,
) =>
  rpc<Row>("revuptime_preview_classification", {
    p_asset_id: assetId,
    p_machine_group: group,
    p_foundation: foundation,
    p_limit_set_id: limitSetId || null,
  });
export const applyClassification = (
  assetId: string,
  group: string,
  foundation: string,
  limitSetId?: string | null,
  ratedKw?: number | null,
) =>
  rpc<Row>("revuptime_apply_classification", {
    p_asset_id: assetId,
    p_machine_group: group,
    p_foundation: foundation,
    p_limit_set_id: limitSetId || null,
    p_rated_kw: ratedKw ?? null,
  });

// ---------------------------------------------------------------- data points
export async function loadDatapoints(orgId: string) {
  const c = db();
  const [defs, latest, templates, groups] = await Promise.all([
    c
      .from("datapoint_definitions")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("sort_order")
      .order("name"),
    c.from("datapoint_latest").select("*").eq("organization_id", orgId),
    c.from("sensor_templates").select("*"),
    c
      .from("datapoint_groups")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at"),
  ]);
  if (isMissingRelation(defs.error)) return null;
  for (const r of [defs, latest, templates])
    if (r.error) throw new Error(r.error.message);
  // Groups arrived with a later database update; without it the page still lists every data point.
  if (groups.error && !isMissingRelation(groups.error))
    throw new Error(groups.error.message);
  return {
    defs: defs.data || [],
    latest: latest.data || [],
    templates: templates.data || [],
    groups: groups.data || [],
  };
}
/** Saves a group and its full parameter list in one transaction; parameters left out are removed. */
export const saveDatapointGroup = (group: Row, params: Row[]) =>
  rpc<string>("revuptime_save_datapoint_group", {
    p_group: group,
    p_params: params,
  });
export async function deleteDatapointGroup(id: string) {
  const { error } = await db().from("datapoint_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function saveDatapoint(orgId: string, d: Row, userId?: string) {
  const body: Row = { ...d, organization_id: orgId };
  delete body.id;
  if (!d.id && userId) body.created_by = userId;
  const q = d.id
    ? db()
        .from("datapoint_definitions")
        .update(body)
        .eq("id", d.id)
        .select("*")
        .single()
    : db().from("datapoint_definitions").insert(body).select("*").single();
  const { data, error } = await q;
  if (error)
    throw new Error(
      error.code === "23505"
        ? "This machine already has a data point with that key."
        : error.message,
    );
  return data as Row;
}
export async function deleteDatapoint(id: string) {
  const { error } = await db()
    .from("datapoint_definitions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
export const previewDatapoint = (args: {
  gateway_id: string;
  source: string;
  key: string;
  modbus_address?: number | null;
  payload_path?: string | null;
  data_type?: string;
  scale?: number;
  value_offset?: number;
}) =>
  rpc<Row>("revuptime_datapoint_preview", {
    p_gateway_id: args.gateway_id,
    p_source: args.source,
    p_key: args.key,
    p_modbus_address: args.modbus_address ?? null,
    p_payload_path: args.payload_path ?? null,
    p_data_type: args.data_type || "uint16",
    p_scale: args.scale ?? 1,
    p_offset: args.value_offset ?? 0,
  });
export const logManualReading = (
  datapointId: string,
  value: number,
  ts: string,
  note?: string,
) =>
  rpc<number>("revuptime_log_manual_reading", {
    p_datapoint_id: datapointId,
    p_value: value,
    p_ts: ts,
    p_note: note || null,
  });
export async function loadAssetDatapoints(asset: Row) {
  const c = db();
  const defs = await c
    .from("datapoint_definitions")
    .select("*")
    .eq("organization_id", asset.organization_id)
    .eq("asset_id", asset.id)
    .neq("show_as", "hidden")
    .order("sort_order");
  if (isMissingRelation(defs.error)) return { defs: [], values: [] };
  if (defs.error) throw new Error(defs.error.message);
  const ids = (defs.data || []).map((d) => d.id);
  const values = ids.length
    ? await rows(
        c
          .from("datapoint_values")
          .select("*")
          .in("datapoint_id", ids)
          .gte("ts", new Date(Date.now() - 30 * 86400000).toISOString())
          .order("ts", { ascending: true })
          .limit(5000),
      )
    : [];
  return { defs: defs.data || [], values };
}

// ---------------------------------------------------------------- alerts
export async function loadAlerts(orgId: string) {
  const c = db();
  const [alerts, rules] = await Promise.all([
    c
      .from("alerts")
      .select("*")
      .eq("organization_id", orgId)
      .order("detected_at", { ascending: false })
      .limit(300),
    c
      .from("alert_rules")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at"),
  ]);
  if (alerts.error) throw new Error(alerts.error.message);
  if (rules.error) throw new Error(rules.error.message);
  const ids = (alerts.data || [])
    .filter((a) => a.status !== "resolved")
    .map((a) => a.id)
    .slice(0, 100);
  const notes = ids.length
    ? await db()
        .from("notification_log")
        .select(
          "alert_id, status, recipient_name, recipient_role, read_at, delivered_at",
        )
        .in("alert_id", ids)
    : { data: [], error: null };
  return {
    alerts: alerts.data || [],
    rules: rules.data || [],
    notifications: (notes.data as Row[]) || [],
  };
}
export const loadAlertEvents = (alertId: string) =>
  rows(
    db()
      .from("alert_events")
      .select("*")
      .eq("alert_id", alertId)
      .order("ts", { ascending: true }),
  );
export const alertAction = (
  alertId: string,
  action: "acknowledge" | "snooze" | "resolve" | "reopen" | "comment",
  note?: string,
) =>
  rpc<void>("revuptime_alert_action", {
    p_alert_id: alertId,
    p_action: action,
    p_note: note || null,
  });
export async function saveRule(orgId: string, rule: Row) {
  const body: Row = {
    organization_id: orgId,
    name: rule.name,
    description: rule.description || null,
    rule_type: rule.rule_type,
    condition: rule.condition,
    severity: rule.severity,
    scope: rule.scope,
    scope_ref: rule.scope_ref || null,
    duration_minutes: Number(rule.duration_minutes) || 0,
    notify: rule.notify,
    is_active: rule.is_active !== false,
  };
  const q = rule.id
    ? db().from("alert_rules").update(body).eq("id", rule.id)
    : db().from("alert_rules").insert(body);
  const { error } = await q;
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only owners, admins and managers can change alert rules."
        : error.message,
    );
}
export async function setRuleActive(id: string, active: boolean) {
  const { error } = await db()
    .from("alert_rules")
    .update({ is_active: active })
    .eq("id", id);
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Only owners, admins and managers can change alert rules."
        : error.message,
    );
}
/** Velocity (or data point values) for the alert's mini chart. */
export async function loadAlertSeries(a: Row) {
  const from = new Date(Date.now() - 7 * 86400000).toISOString();
  if (a.point_id)
    return rows(
      db()
        .from("sensor_readings")
        .select("timestamp, v_max")
        .eq("organization_id", a.organization_id)
        .eq("point_id", a.point_id)
        .gte("timestamp", from)
        .order("timestamp")
        .limit(5000),
    ).then((r) => r.map((x) => ({ t: x.timestamp, v: x.v_max })));
  if (a.datapoint_id)
    return rows(
      db()
        .from("datapoint_values")
        .select("ts, value")
        .eq("datapoint_id", a.datapoint_id)
        .gte("ts", from)
        .order("ts")
        .limit(5000),
    ).then((r) => r.map((x) => ({ t: x.ts, v: Number(x.value) })));
  return [];
}
export async function requestInsight(alertId: string): Promise<Row> {
  const { data, error } = await db().functions.invoke("alert-insight", {
    body: { alert_id: alertId },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await (error as any).context?.json())?.error || message;
    } catch {}
    throw new Error(message);
  }
  return data as Row;
}

// ---------------------------------------------------------------- overview
export async function loadOverview(orgId: string) {
  // One request (RPC page_overview) instead of eleven; row level security still applies to the caller.
  const { data, error } = await db().rpc("page_overview", { p_org: orgId });
  if (isMissingRelation(error)) return null;
  if (error) throw new Error(error.message);
  const d = (data || {}) as Record<string, Row[]>;
  return {
    health: d.health || [],
    points: d.points || [],
    gateways: d.gateways || [],
    sensors: d.sensors || [],
    alerts: d.alerts || [],
    orders: d.orders || [],
    manual: d.manual || [],
    baselines: d.baselines || [],
    installs: d.installs || [],
    daily: d.daily || [],
    loadedAt: Date.now(),
  };
}
export const pointDaily = (pointIds: string[], days = 30) =>
  pointIds.length
    ? rpc<Row[]>("point_daily", { p_point_ids: pointIds, p_days: days })
    : Promise.resolve([] as Row[]);
