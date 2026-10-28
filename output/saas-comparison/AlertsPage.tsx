import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Dataset, Row } from "../data";
import { authorizedDataClient } from "../data";
import { debounce, everyWhileVisible, subscribeOrg } from "../orgLive";
import {
  alertAction,
  loadAlertEvents,
  loadAlertSeries,
  loadAlerts,
  requestInsight,
  saveRule,
  setRuleActive,
} from "./opsApi";
import { pointInsight } from "./points";
import { fmtDate, fmtDateTime } from "./time";
import {
  Card,
  Dialog,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  type Tone,
} from "./ui";
import { GROUPS } from "./iso";
import {
  formatAlertForHumans,
  formatDuration,
} from "../../supabase/functions/_shared/alert-text.ts";
import { getDisplayTimeZone } from "./time";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const SEV_TONE: Record<string, Tone> = {
  critical: "act",
  warning: "watch",
  device: "offline",
  info: "info",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  device: "Device",
  info: "Info",
};
const STATUS_GROUP: Record<string, string> = {
  open: "open",
  snoozed: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
  dismissed: "resolved",
};

export function alertsPath() {
  const [, id] = location.hash.slice(1).split("/");
  return {
    tab: id === "rules" ? "rules" : "inbox",
    id: id && id !== "rules" ? id : "",
  };
}

/** Open critical + warning, for the sidebar badge. */
export const badgeCount = (alerts: Row[] = []) =>
  alerts.filter(
    (a) =>
      a.status === "open" &&
      (a.severity === "critical" || a.severity === "warning"),
  ).length;

export function AlertsPage({
  orgId,
  data,
  site,
  canWrite,
  canManage,
  navigate,
  notify,
  onCreateOrder,
}: {
  orgId: string;
  data: Dataset;
  site: string;
  canWrite: boolean;
  canManage: boolean;
  navigate: (p: string) => void;
  notify: (m: string) => void;
  onCreateOrder: (row: Row) => void;
}) {
  const [path, setPath] = useState(alertsPath);
  useEffect(() => {
    const on = () => setPath(alertsPath());
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const go = (tab: string, id = "") => {
    navigate("alerts" + (tab === "rules" ? "/rules" : id ? "/" + id : ""));
    setPath({ tab, id });
  };
  return (
    <div className="rv-page rv-alerts">
      {path.tab === "rules" ? (
        <>
          <AlertsHeader
            tab="rules"
            go={go}
            summary="Rules decide when an alert opens and who hears about it."
          />
          <AlertRules
            orgId={orgId}
            data={data}
            canManage={canManage}
            notify={notify}
          />
        </>
      ) : (
        <Inbox
          orgId={orgId}
          data={data}
          site={site}
          canWrite={canWrite}
          selected={path.id}
          select={(id) => go("inbox", id)}
          go={go}
          notify={notify}
          onCreateOrder={onCreateOrder}
          navigate={navigate}
        />
      )}
    </div>
  );
}

function AlertsHeader({
  tab,
  go,
  summary,
}: {
  tab: string;
  go: (t: string) => void;
  summary: string;
}) {
  return (
    <PageHeader
      title="Alerts"
      subtitle={summary}
      actions={
        <div className="rv-segmented" role="tablist" aria-label="Alerts view">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inbox"}
            className={tab === "inbox" ? "is-on" : ""}
            onClick={() => go("inbox")}
          >
            Inbox
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={tab === "rules" ? "is-on" : ""}
            onClick={() => go("rules")}
          >
            Rules
          </button>
        </div>
      }
    />
  );
}

function Inbox({
  orgId,
  data,
  site,
  canWrite,
  selected,
  select,
  go,
  notify,
  onCreateOrder,
  navigate,
}: {
  orgId: string;
  data: Dataset;
  site: string;
  canWrite: boolean;
  selected: string;
  select: (id: string) => void;
  go: (t: string, id?: string) => void;
  notify: (m: string) => void;
  onCreateOrder: (row: Row) => void;
  navigate: (p: string) => void;
}) {
  const [state, setState] = useState<{
    alerts: Row[];
    rules: Row[];
    notifications: Row[];
  } | null>(null);
  const [status, setStatus] = useState<"open" | "acknowledged" | "resolved">(
    "open",
  );
  const [plant, setPlant] = useState(site || "");
  const [severity, setSeverity] = useState("");
  const [points, setPoints] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    loadAlerts(orgId)
      .then(setState)
      .catch((e) => setError(errorText(e)));
    authorizedDataClient()
      .from("measurement_points")
      .select("id, name, asset_id")
      .eq("organization_id", orgId)
      .then(({ data: r }) => setPoints(r || []));
  }, [orgId]);
  useEffect(() => {
    load();
    const refresh = debounce(load, 400);
    const off = [
      subscribeOrg(orgId, "alerts", refresh),
      everyWhileVisible(load, 300_000),
    ];
    return () => {
      refresh.cancel();
      off.forEach((f) => f());
    };
  }, [load, orgId]);
  useEffect(() => setPlant(site || ""), [site]);

  const alerts = (state?.alerts || []).filter(
    (a) =>
      (!plant || a.site_id === plant) && (!severity || a.severity === severity),
  );
  const counts = (s: string) =>
    alerts.filter((a) => STATUS_GROUP[a.status] === s).length;
  const list = alerts.filter((a) => STATUS_GROUP[a.status] === status);
  const current =
    (state?.alerts || []).find((a) => a.id === selected) ||
    (!selected && window.innerWidth > 900 ? list[0] : undefined);
  const open = (state?.alerts || []).filter(
    (a) => STATUS_GROUP[a.status] === "open",
  );
  const acks = (state?.alerts || []).filter(
    (a) =>
      a.acknowledged_at &&
      Date.parse(a.acknowledged_at) > Date.now() - 7 * 86400000,
  );
  const ackMinutes = acks
    .map(
      (a) =>
        (Date.parse(a.acknowledged_at) - Date.parse(a.detected_at)) / 60000,
    )
    .sort((x, y) => x - y);
  const median = ackMinutes.length
    ? Math.round(ackMinutes[Math.floor(ackMinutes.length / 2)])
    : null;
  const summary = `${open.length} open · ${open.filter((a) => a.severity === "critical").length} critical${median !== null ? ` · median time to acknowledge ${median} min this week` : ""}`;
  const where = (a: Row) => {
    const asset = (data.assets || []).find((x) => x.id === a.asset_id)?.name;
    const point = points.find((p) => p.id === a.point_id)?.name;
    const gw = (data.gateways || []).find((g) => g.id === a.gateway_id)?.name;
    const plantName = (data.sites || []).find((s) => s.id === a.site_id)?.name;
    return [[asset, point].filter(Boolean).join(" › ") || gw, plantName]
      .filter(Boolean)
      .join(" · ");
  };
  /** Plain words: asset name (or the gateway's machine), durations instead of minutes. */
  const human = (a: Row) => {
    const gwAssets = [
      ...new Set(
        (data.sensors || [])
          .filter((s) => s.gateway_id === a.gateway_id && s.asset_id)
          .map((s) => s.asset_id),
      ),
    ];
    const asset =
      (data.assets || []).find((x) => x.id === a.asset_id)?.name ||
      (gwAssets.length === 1
        ? (data.assets || []).find((x) => x.id === gwAssets[0])?.name
        : undefined);
    const rule = (state?.rules || []).find(
      (r) => r.id === a.alert_rule_id,
    )?.rule_type;
    return formatAlertForHumans(
      {
        ...a,
        rule_type: rule,
        asset,
        point: points.find((p) => p.id === a.point_id)?.name,
        gateway: (data.gateways || []).find((g) => g.id === a.gateway_id)?.name,
      },
      getDisplayTimeZone(),
    );
  };
  const statusLine = (a: Row) => {
    const n = (state?.notifications || []).filter((x) => x.alert_id === a.id);
    const read = n.find((x) => x.status === "read");
    const parts = [
      a.status === "snoozed"
        ? `Snoozed until ${fmtDateTime(a.snoozed_until)}`
        : a.status === "acknowledged"
          ? a.acknowledged_via === "whatsapp"
            ? "Acknowledged on WhatsApp"
            : "Acknowledged"
          : a.status === "resolved"
            ? "Resolved"
            : "Open",
      a.work_order_id
        ? "work order linked"
        : a.status === "open"
          ? "not assigned"
          : "",
      read
        ? `WhatsApp read by ${read.recipient_name || "contact"}`
        : n.some((x) => x.status === "delivered")
          ? "WhatsApp delivered"
          : n.some((x) => x.status === "sent")
            ? "WhatsApp sent"
            : n.some(
                  (x) =>
                    x.status === "queued" ||
                    x.status === "digest" ||
                    x.status === "sending",
                )
              ? "WhatsApp queued"
              : a.notify_status === "failed"
                ? "WhatsApp not delivered"
                : "",
      a.alert_rule_id &&
      (state?.rules || []).find((r) => r.id === a.alert_rule_id)?.rule_type ===
        "no_data" &&
      a.status !== "resolved"
        ? "auto-resolves when data returns"
        : "",
    ];
    return parts.filter(Boolean).join(" · ");
  };

  return (
    <>
      <AlertsHeader tab="inbox" go={go} summary={summary} />
      <div className="rv-alert-filters">
        {(["open", "acknowledged", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            className={"rv-filter" + (status === s ? " is-on" : "")}
            onClick={() => setStatus(s)}
          >
            {s[0].toUpperCase() + s.slice(1)} {counts(s)}
          </button>
        ))}
        <span className="rv-divider" aria-hidden="true" />
        <label>
          Plant{" "}
          <select value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">All plants</option>
            {(data.sites || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity{" "}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">Any</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="device">Device</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
      <div className={"rv-inbox" + (selected ? " has-selection" : "")}>
        <ul className="rv-alert-list" aria-label="Alerts">
          {!state && <li className="rv-muted">Loading alerts…</li>}
          {state && !list.length && (
            <li className="rv-empty">
              No {status} alerts{plant || severity ? " for these filters" : ""}.
            </li>
          )}
          {list.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={
                  "rv-alert-card rv-sev-" +
                  a.severity +
                  (current?.id === a.id ? " is-on" : "")
                }
                onClick={() => select(a.id)}
                aria-current={current?.id === a.id || undefined}
              >
                <span className="rv-alert-top">
                  <StatusPill tone={SEV_TONE[a.severity]}>
                    {SEV_LABEL[a.severity] || a.severity}
                  </StatusPill>
                  <time>{fmtDateTime(a.detected_at)}</time>
                </span>
                <strong>{human(a).headline}</strong>
                <span>{where(a)}</span>
                <small className="rv-muted">{statusLine(a)}</small>
              </button>
            </li>
          ))}
        </ul>
        {current ? (
          <AlertDetail
            key={current.id}
            alert={current}
            human={human(current)}
            rule={(state?.rules || []).find(
              (r) => r.id === current.alert_rule_id,
            )}
            where={where(current)}
            canWrite={canWrite}
            onBack={() => select("")}
            onChanged={load}
            notify={notify}
            onCreateOrder={onCreateOrder}
            navigate={navigate}
          />
        ) : (
          <Card className="rv-alert-detail rv-empty">
            Choose an alert to see its details.
          </Card>
        )}
      </div>
    </>
  );
}

function AlertDetail({
  alert: a,
  human,
  rule,
  where,
  canWrite,
  onBack,
  onChanged,
  notify,
  onCreateOrder,
  navigate,
}: {
  alert: Row;
  human: { headline: string; detail: string };
  rule?: Row;
  where: string;
  canWrite: boolean;
  onBack: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
  onCreateOrder: (row: Row) => void;
  navigate: (p: string) => void;
}) {
  const [events, setEvents] = useState<Row[]>([]);
  const [series, setSeries] = useState<{ t: string; v: number }[]>([]);
  const [siblings, setSiblings] = useState<Row[]>([]);
  const [ai, setAi] = useState<{
    cause?: string;
    action?: string;
    busy?: boolean;
    error?: string;
  }>({ cause: a.ai_cause, action: a.ai_action });
  const [busy, setBusy] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => {
    loadAlertEvents(a.id)
      .then(setEvents)
      .catch(() => setEvents([]));
    loadAlertSeries(a)
      .then(setSeries)
      .catch(() => setSeries([]));
    if (a.asset_id)
      authorizedDataClient()
        .from("point_vitals")
        .select("*")
        .eq("asset_id", a.asset_id)
        .then(({ data }) => setSiblings(data || []));
  }, [a.id]);
  useEffect(load, [load]);
  useEffect(() => {
    // Ask for the AI cause once per alert when it has none and the alert is about a machine.
    if (a.ai_cause || !a.asset_id || a.status === "resolved") return;
    setAi((x) => ({ ...x, busy: true }));
    requestInsight(a.id)
      .then((r) => setAi({ cause: r.ai_cause, action: r.ai_action }))
      .catch((e) => setAi({ error: errorText(e) }));
  }, [a.id]);
  const fallback = siblings.length ? pointInsight(siblings) : null;

  async function act(
    action: "acknowledge" | "snooze" | "resolve" | "reopen" | "comment",
  ) {
    setBusy(action);
    setError("");
    try {
      await alertAction(
        a.id,
        action,
        action === "comment" ? comment : undefined,
      );
      if (action === "comment") setComment("");
      notify(
        action === "comment"
          ? "Comment added."
          : `Alert ${action === "snooze" ? "snoozed for 24 h" : action + "d"}.`,
      );
      onChanged();
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const unit = a.unit || "";
  return (
    <Card className="rv-alert-detail">
      <button type="button" className="rv-back rv-mobile-only" onClick={onBack}>
        <ArrowLeft size={16} /> All alerts
      </button>
      <p className="rv-alert-meta">
        <StatusPill tone={SEV_TONE[a.severity]}>
          {SEV_LABEL[a.severity]}
        </StatusPill>{" "}
        {fmtDateTime(a.detected_at)}
        {rule ? ` · rule: ${rule.name}` : ""}
      </p>
      {a.notify_error && (
        <p className="rv-error-box" role="status">
          {a.notify_error}
        </p>
      )}
      <h2 className="rv-alert-title">{human.headline}</h2>
      <p className="rv-alert-explain">{human.detail}</p>
      {a.asset_id ? (
        <a
          className="rv-link"
          href={`/assets/${encodeURIComponent(a.asset_id)}/overview`}
          onClick={(e) => {
            e.preventDefault();
            history.pushState(
              null,
              "",
              `/assets/${encodeURIComponent(a.asset_id)}/overview`,
            );
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        >
          {where}
        </a>
      ) : (
        <span className="rv-muted">{where}</span>
      )}
      {canWrite && (
        <div className="rv-alert-actions">
          {a.status === "open" && (
            <PrimaryButton
              onClick={() => void act("acknowledge")}
              busy={busy === "acknowledge"}
            >
              Acknowledge
            </PrimaryButton>
          )}
          {!a.work_order_id && a.status !== "resolved" && (
            <SecondaryButton
              onClick={() =>
                onCreateOrder({
                  alert_id: a.id,
                  asset_id: a.asset_id,
                  site_id: a.site_id,
                  title: human.headline,
                  description: [where, human.detail, ai.action]
                    .filter(Boolean)
                    .join("\n"),
                  priority: a.severity === "critical" ? "high" : "medium",
                })
              }
            >
              Create work order
            </SecondaryButton>
          )}
          {a.work_order_id && (
            <SecondaryButton onClick={() => navigate("work_orders")}>
              Open work order
            </SecondaryButton>
          )}
          {a.status !== "resolved" && a.status !== "snoozed" && (
            <SecondaryButton
              onClick={() => void act("snooze")}
              disabled={!!busy}
            >
              Snooze 24 h
            </SecondaryButton>
          )}
          {a.status !== "resolved" ? (
            <SecondaryButton
              onClick={() => void act("resolve")}
              disabled={!!busy}
            >
              Resolve
            </SecondaryButton>
          ) : (
            <SecondaryButton
              onClick={() => void act("reopen")}
              disabled={!!busy}
            >
              Reopen
            </SecondaryButton>
          )}
        </div>
      )}
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
      {series.length > 1 && (
        <MiniChart
          series={series}
          limit={a.threshold == null ? null : Number(a.threshold)}
          label={
            a.point_id ? "Velocity (mm/s)" : unit ? `Value (${unit})` : "Value"
          }
        />
      )}
      {a.asset_id && (
        <div className="rv-grid-2 rv-ai-cards">
          <div className="rv-ai-card">
            <p className="rv-eyebrow rv-text-blue">
              Likely cause · {ai.cause ? "AI" : "rule-based"}
            </p>
            <p>
              {ai.busy
                ? "Working out the likely cause from the readings…"
                : ai.cause ||
                  (fallback
                    ? `${fallback.headline} ${fallback.detail}`
                    : "Not enough readings to compare points yet.")}
            </p>
            {ai.error && !ai.cause && (
              <small className="rv-muted">
                AI not available: {ai.error}. Showing the rule-based pattern.
              </small>
            )}
          </div>
          <div className="rv-ai-card">
            <p className="rv-eyebrow rv-text-good">Recommended action</p>
            <p>
              {ai.action ||
                fallback?.suggestion ||
                (a.severity === "critical"
                  ? "Inspect this machine this week; zone D vibration can cause damage."
                  : "Check the machine at the next round and watch the trend.")}
            </p>
          </div>
        </div>
      )}
      <h3 className="rv-subhead">Timeline</h3>
      <ol className="rv-timeline">
        {events.map((e) => (
          <li key={e.id} className={"rv-ev-" + e.type}>
            <span>{eventText(e, unit)}</span>
            <time className="rv-muted rv-small rv-block">
              {fmtDateTime(e.ts)}
            </time>
          </li>
        ))}
        {!events.length && <li className="rv-muted">No events yet.</li>}
      </ol>
      {canWrite && (
        <div className="rv-comment">
          <label className="rv-sr-only" htmlFor={"c-" + a.id}>
            Add a comment
          </label>
          <input
            id={"c-" + a.id}
            value={comment}
            placeholder="Add a comment"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && comment.trim() && void act("comment")
            }
          />
          <SecondaryButton
            onClick={() => void act("comment")}
            disabled={!comment.trim() || !!busy}
          >
            Add
          </SecondaryButton>
        </div>
      )}
    </Card>
  );
}

/** "No data for 13149 min" → "No data for 9 days". */
const humanMinutes = (text: string) =>
  String(text).replace(/\b(\d{2,}) ?min(ute)?s?\b/gi, (_m, n) =>
    formatDuration(Number(n)),
  );
export function eventText(e: Row, unit = "") {
  const d = e.detail || {};
  switch (e.type) {
    case "opened":
      return `Alert opened: ${humanMinutes(d.message || "")}`.trim();
    case "value_updated": {
      const v =
        (d.unit || unit) === "min"
          ? formatDuration(d.value)
          : `${d.value} ${d.unit || unit}`.trim();
      return d.severity_to
        ? `Severity rose to ${d.severity_to}: ${v}`
        : (d.unit || unit) === "min"
          ? `Still no data after ${v}`
          : `Value updated to ${v}`;
    }
    case "notified":
      return `WhatsApp sent to ${d.to || "contact"}${d.kind === "escalation" ? " (escalation)" : ""}`;
    case "delivered":
      return `WhatsApp delivered to ${d.to || "contact"}`;
    case "read":
      return `WhatsApp read by ${d.to || "contact"}`;
    case "failed":
      return `WhatsApp to ${d.to || "contact"} failed${d.error ? `: ${d.error}` : ""}`;
    case "escalated":
      return `Escalated to ${d.to === "plant_head" ? "Plant Head" : "Maintenance Head"} (${d.reason || "not acknowledged"})`;
    case "acknowledged":
      return `Acknowledged${d.note ? `: ${d.note}` : ""}`;
    case "snoozed":
      return `Snoozed until ${d.until ? fmtDateTime(d.until) : "tomorrow"}`;
    case "resolved":
      return `Resolved${d.reason ? ` (${d.reason})` : d.note ? `: ${d.note}` : ""}`;
    case "reopened":
      return `Reopened${d.reason ? ` (${d.reason})` : ""}`;
    default:
      return d.note || "Comment";
  }
}

function MiniChart({
  series,
  limit,
  label,
}: {
  series: { t: string; v: number }[];
  limit: number | null;
  label: string;
}) {
  const W = 600,
    H = 120;
  const t0 = Date.parse(series[0].t),
    t1 = Date.parse(series[series.length - 1].t) || t0 + 1;
  const vals = series.map((s) => s.v).concat(limit ?? []);
  const lo = Math.min(...vals) * 0.9,
    hi = Math.max(...vals) * 1.08 || 1;
  const x = (t: string) => ((Date.parse(t) - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  return (
    <div className="rv-mini-chart">
      <div className="rv-card-head">
        <strong>{label}</strong>
        <span className="rv-muted rv-small">last 7 days</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} over the last 7 days${limit != null ? `, limit ${limit}` : ""}`}
      >
        {limit != null && (
          <line
            x1="0"
            x2={W}
            y1={y(limit)}
            y2={y(limit)}
            className="rv-chart-cd"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          fill="none"
          className="rv-chart-line"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={series
            .map((s) => `${x(s.t).toFixed(1)},${y(s.v).toFixed(1)}`)
            .join(" ")}
        />
      </svg>
      <div className="rv-chart-x rv-muted rv-small">
        <span>{fmtDate(series[0].t)}</span>
        <span>{fmtDate(series[series.length - 1].t)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rules
const TYPE_TEXT: Record<string, (r: Row) => string> = {
  iso_zone: (r) =>
    `Velocity above ${r.condition?.zone === "C" ? "B/C" : "C/D"} for ${r.duration_minutes} min`,
  outside_baseline: (r) =>
    `Outside the point's normal band for ${r.duration_minutes} min`,
  rate_of_change: (r) =>
    `Temperature rising ${r.condition?.per_day ?? 3} °C a day over ${r.condition?.days ?? 3} days`,
  threshold: (r) =>
    `Above the data point's warning or critical limit${r.duration_minutes ? ` for ${r.duration_minutes} min` : ""}`,
  no_data: (r) => `No message for ${r.duration_minutes} min`,
  manual_overdue: () => "Manual reading past its due date",
};
const SCOPE_TEXT = (r: Row, data: Dataset) => {
  if (r.scope === "all_points") return "All measurement points";
  if (r.scope === "iso_group")
    return GROUPS.find(([g]) => g === r.scope_ref)?.[1] || "ISO group";
  if (r.scope === "asset")
    return (
      (data.assets || []).find((a) => a.id === r.scope_ref)?.name ||
      "One machine"
    );
  if (r.scope === "all_gateways") return "All gateways";
  if (r.scope === "gateway")
    return (
      (data.gateways || []).find((g) => g.id === r.scope_ref)?.name ||
      "One gateway"
    );
  if (r.scope === "all_datapoints") return "All data points with limits";
  if (r.scope === "all_manual") return "All manual data points";
  return r.scope;
};
const notifyText = (n: Row = {}) =>
  [
    ...(n.roles || []).map((r: string) =>
      r === "plant_head" ? "Plant head" : "Maintenance",
    ),
    n.members ? "members who opted in" : "",
  ]
    .filter(Boolean)
    .join(", ") +
  (n.mode === "digest" ? " · morning summary" : " · WhatsApp now");

export function AlertRules({
  orgId,
  data,
  canManage,
  notify,
}: {
  orgId: string;
  data: Dataset;
  canManage: boolean;
  notify: (m: string) => void;
}) {
  const [rules, setRules] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    loadAlerts(orgId)
      .then((r) => setRules(r.rules))
      .catch((e) => setError(errorText(e)));
  }, [orgId]);
  useEffect(load, [load]);
  const visible = (rules || []).filter((r) => TYPE_TEXT[r.rule_type]);

  async function toggle(r: Row) {
    try {
      await setRuleActive(r.id, !r.is_active);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <div className="rv-rules">
      <Card>
        <div className="rv-card-head">
          <h2 className="rv-section-title">Alert rules</h2>
          {canManage && (
            <PrimaryButton onClick={() => setEditing({})}>
              New rule
            </PrimaryButton>
          )}
        </div>
        <table className="rv-table">
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Applies to</th>
              <th scope="col">Opens when</th>
              <th scope="col">Severity</th>
              <th scope="col">Notify</th>
              <th scope="col">On</th>
            </tr>
          </thead>
          <tbody>
            {!rules && (
              <tr>
                <td colSpan={6} className="rv-muted">
                  Loading rules…
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td data-label="Rule">
                  <strong>{r.name}</strong>
                  {canManage && (
                    <button
                      type="button"
                      className="rv-link rv-block"
                      onClick={() => setEditing(r)}
                    >
                      Edit
                    </button>
                  )}
                </td>
                <td data-label="Applies to">{SCOPE_TEXT(r, data)}</td>
                <td data-label="Opens when">{TYPE_TEXT[r.rule_type](r)}</td>
                <td data-label="Severity">
                  <StatusPill tone={SEV_TONE[r.severity]}>
                    {r.rule_type === "threshold"
                      ? "Warning / critical"
                      : SEV_LABEL[r.severity]}
                  </StatusPill>
                </td>
                <td data-label="Notify" className="rv-small">
                  {notifyText(r.notify)}
                </td>
                <td data-label="On">
                  <label className="rv-switch">
                    <input
                      type="checkbox"
                      checked={!!r.is_active}
                      disabled={!canManage}
                      onChange={() => void toggle(r)}
                    />
                    <span className="rv-sr-only">{r.name} enabled</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <p className="rv-error-box" role="alert">
            {error}
          </p>
        )}
      </Card>
      <div className="rv-grid-3 rv-explainers">
        <Card>
          <h3 className="rv-subhead">Escalation</h3>
          <p className="rv-muted">
            A critical alert not acknowledged in 30 minutes goes to the
            maintenance head, then to the plant head at 60 minutes.
          </p>
        </Card>
        <Card>
          <h3 className="rv-subhead">Quiet hours</h3>
          <p className="rv-muted">
            From 22:00 to 06:00 plant time only critical alerts send WhatsApp.
            Warnings go into the 08:00 summary. Change the hours under
            Notifications.
          </p>
        </Card>
        <Card>
          <h3 className="rv-subhead">No repeats</h3>
          <p className="rv-muted">
            One open alert per rule and point. A value that stays high updates
            the same alert; WhatsApp is sent again only when severity rises.
          </p>
        </Card>
      </div>
      {editing && (
        <RuleDialog
          orgId={orgId}
          data={data}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            notify("Rule saved.");
          }}
        />
      )}
    </div>
  );
}

function RuleDialog({
  orgId,
  data,
  initial,
  onClose,
  onSaved,
}: {
  orgId: string;
  data: Dataset;
  initial: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Row>(() => ({
    name: "",
    rule_type: "iso_zone",
    scope: "all_points",
    scope_ref: "",
    duration_minutes: 10,
    severity: "critical",
    is_active: true,
    zone: initial.condition?.zone || "D",
    per_day: initial.condition?.per_day ?? 3,
    days: initial.condition?.days ?? 3,
    roles: initial.notify?.roles || ["plant_head", "maintenance"],
    members: initial.notify?.members ?? true,
    mode: initial.notify?.mode || "instant",
    ...initial,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const pointScopes = [
    "iso_zone",
    "outside_baseline",
    "rate_of_change",
  ].includes(f.rule_type);
  const scopes: [string, string][] = pointScopes
    ? [
        ["all_points", "All measurement points"],
        ["iso_group", "An ISO group"],
        ["asset", "One machine"],
      ]
    : f.rule_type === "threshold"
      ? [
          ["all_datapoints", "All data points with limits"],
          ["asset", "One machine's data points"],
        ]
      : f.rule_type === "no_data"
        ? [
            ["all_gateways", "All gateways"],
            ["gateway", "One gateway"],
          ]
        : [["all_manual", "All manual data points"]];
  useEffect(() => {
    if (!scopes.some(([s]) => s === f.scope)) set("scope", scopes[0][0]);
  }, [f.rule_type]);

  async function save() {
    if (!f.name?.trim()) return setError("Name the rule.");
    if (["iso_group", "asset", "gateway"].includes(f.scope) && !f.scope_ref)
      return setError("Choose what the rule applies to.");
    const condition: Row = { type: f.rule_type };
    if (f.rule_type === "iso_zone") condition.zone = f.zone;
    if (f.rule_type === "outside_baseline") condition.metrics = ["vibration"];
    if (f.rule_type === "rate_of_change")
      Object.assign(condition, {
        metric: "temperature",
        per_day: Number(f.per_day),
        days: Number(f.days),
      });
    if (f.rule_type === "threshold") condition.level = "auto";
    setBusy(true);
    setError("");
    try {
      await saveRule(orgId, {
        ...f,
        condition,
        scope_ref: ["iso_group", "asset", "gateway"].includes(f.scope)
          ? f.scope_ref
          : null,
        notify: {
          roles: f.roles,
          members: !!f.members,
          channels: ["whatsapp"],
          mode: f.mode,
        },
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const toggleRole = (r: string) =>
    set(
      "roles",
      f.roles.includes(r)
        ? f.roles.filter((x: string) => x !== r)
        : [...f.roles, r],
    );
  return (
    <Dialog
      open
      title={f.id ? "Edit rule" : "New rule"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => void save()} busy={busy}>
            Save rule
          </PrimaryButton>
        </>
      }
    >
      <Field label="Rule name">
        {(id) => (
          <input
            id={id}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        )}
      </Field>
      <Field label="1. Opens when">
        {(id) => (
          <select
            id={id}
            value={f.rule_type}
            disabled={!!f.builtin_key}
            onChange={(e) => set("rule_type", e.target.value)}
          >
            <option value="iso_zone">Velocity is in an ISO zone</option>
            <option value="outside_baseline">
              Velocity leaves its normal band
            </option>
            <option value="rate_of_change">
              Bearing temperature keeps rising
            </option>
            <option value="threshold">A data point passes its limit</option>
            <option value="no_data">A gateway stops sending</option>
            <option value="manual_overdue">A manual reading is overdue</option>
          </select>
        )}
      </Field>
      <div className="rv-grid-2">
        <Field label="2. Applies to">
          {(id) => (
            <select
              id={id}
              value={f.scope}
              onChange={(e) => set("scope", e.target.value)}
            >
              {scopes.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        {f.scope === "iso_group" && (
          <Field label="ISO group">
            {(id) => (
              <select
                id={id}
                value={f.scope_ref || ""}
                onChange={(e) => set("scope_ref", e.target.value)}
              >
                <option value="">Choose</option>
                {GROUPS.slice(0, 2).map(([g, l]) => (
                  <option key={g} value={g}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {f.scope === "asset" && (
          <Field label="Machine">
            {(id) => (
              <select
                id={id}
                value={f.scope_ref || ""}
                onChange={(e) => set("scope_ref", e.target.value)}
              >
                <option value="">Choose</option>
                {(data.assets || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {f.scope === "gateway" && (
          <Field label="Gateway">
            {(id) => (
              <select
                id={id}
                value={f.scope_ref || ""}
                onChange={(e) => set("scope_ref", e.target.value)}
              >
                <option value="">Choose</option>
                {(data.gateways || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>
      <div className="rv-grid-3">
        {f.rule_type === "iso_zone" && (
          <Field label="3. Zone">
            {(id) => (
              <select
                id={id}
                value={f.zone}
                onChange={(e) => set("zone", e.target.value)}
              >
                <option value="D">D (above C/D)</option>
                <option value="C">C (above B/C)</option>
              </select>
            )}
          </Field>
        )}
        {f.rule_type === "rate_of_change" && (
          <>
            <Field label="3. Rise per day (°C)">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  step="0.5"
                  value={f.per_day}
                  onChange={(e) => set("per_day", e.target.value)}
                />
              )}
            </Field>
            <Field label="Over days">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={14}
                  value={f.days}
                  onChange={(e) => set("days", e.target.value)}
                />
              )}
            </Field>
          </>
        )}
        {!["rate_of_change", "manual_overdue"].includes(f.rule_type) && (
          <Field label="4. For at least (min)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                max={10080}
                value={f.duration_minutes}
                onChange={(e) => set("duration_minutes", e.target.value)}
              />
            )}
          </Field>
        )}
        {f.rule_type !== "threshold" && (
          <Field label="5. Severity">
            {(id) => (
              <select
                id={id}
                value={f.severity}
                onChange={(e) => set("severity", e.target.value)}
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="device">Device</option>
              </select>
            )}
          </Field>
        )}
      </div>
      <fieldset className="rv-checks">
        <legend>6. Notify on WhatsApp</legend>
        <label>
          <input
            type="checkbox"
            checked={f.roles.includes("plant_head")}
            onChange={() => toggleRole("plant_head")}
          />{" "}
          Plant head
        </label>
        <label>
          <input
            type="checkbox"
            checked={f.roles.includes("maintenance")}
            onChange={() => toggleRole("maintenance")}
          />{" "}
          Maintenance contacts
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!f.members}
            onChange={(e) => set("members", e.target.checked)}
          />{" "}
          Members who opted in
        </label>
        <label>
          <input
            type="checkbox"
            checked={f.mode === "digest"}
            onChange={(e) =>
              set("mode", e.target.checked ? "digest" : "instant")
            }
          />{" "}
          Only in the morning summary
        </label>
      </fieldset>
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
