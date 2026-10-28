import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce, everyWhileVisible, subscribeOrg } from "../orgLive";
import type { Dataset, Row } from "../data";
import { ZONES, type Zone } from "./iso";
import { loadOverview } from "./opsApi";
import {
  STATUS_LABEL,
  STATUS_TONE,
  asStatus,
  fmt,
  shortPointName,
  type PointStatus,
} from "./points";
import { gatewayState, timeAgo } from "./status";
import { fmtDate } from "./time";
import { Card, PrimaryButton, SecondaryButton, StatusPill } from "./ui";
import { ZoneChip } from "./VibrationStandards";
import { SEV_TONE } from "./AlertsPage";

type Overview = NonNullable<Awaited<ReturnType<typeof loadOverview>>>;
const RANK: Record<string, number> = {
  act: 0,
  watch: 1,
  good: 2,
  offline: 3,
  no_data: 4,
};
const SEV_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  device: 2,
  info: 3,
};
const MODEL: Record<string, string> = {
  "usr-n720": "USR-N720",
  "dragino-lorawan": "Dragino LoRaWAN",
  "generic-mqtt": "MQTT device",
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ago = (iso?: string | null) => (iso ? timeAgo(iso) : "never");
const daysBetween = (a: number, b: number) => (b - a) / 86400000;

/** Linear trend of daily maxima: days until the value reaches `limit`, or null. */
export function daysToLimit(days: { day: string; v: number }[], limit: number) {
  if (days.length < 7 || !limit) return null;
  const xs = days.map((d) => Date.parse(d.day) / 86400000),
    ys = days.map((d) => d.v);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length,
    my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
  const last = ys[ys.length - 1];
  if (slope <= 0.005 || last >= limit) return null;
  const d = (limit - last) / slope;
  return d <= 120 ? Math.round(d) : null;
}

export function PlantCommand({
  orgId,
  data,
  site,
  onOpenAsset,
  navigate,
  onAddGateway,
}: {
  orgId: string;
  data: Dataset;
  site: string;
  onOpenAsset: (id: string) => void;
  navigate: (p: string) => void;
  onAddGateway: () => void;
}) {
  const [ov, setOv] = useState<Overview | null | undefined>(undefined);
  const [daily, setDaily] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const load = useCallback(() => {
    loadOverview(orgId)
      .then(setOv)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [orgId]);
  useEffect(() => {
    load();
    const refresh = debounce(load, 600);
    // New alerts and gateway changes arrive over the shared channel; the timer only catches readings, and rests while the tab is hidden.
    const off = [
      subscribeOrg(orgId, "alerts", refresh),
      subscribeOrg(orgId, "gateways", refresh),
      everyWhileVisible(load, 120_000),
    ];
    const t2 = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      clearInterval(t2);
      refresh.cancel();
      off.forEach((f) => f());
    };
  }, [load]);
  // The 30-day daily maxima arrive in the same response as the rest of the page.
  useEffect(() => {
    setDaily(ov?.daily || []);
  }, [ov]);

  const sites = data.sites || [];
  const plant = sites.find((s) => s.id === site);
  const assetsAll = data.assets || [];
  const inSite = (r: Row) => !site || r.site_id === site;
  const assets = assetsAll.filter(inSite);
  const assetIds = new Set(assets.map((a) => a.id));
  const view = useMemo(() => {
    if (!ov) return null;
    const points = ov.points.filter((p) => assetIds.has(p.asset_id));
    const health = ov.health.filter(
      (h) => assetIds.has(h.asset_id) && h.points > 0,
    );
    const gateways = ov.gateways.filter(inSite);
    const alerts = ov.alerts.filter(
      (a) => inSite(a) || (a.asset_id && assetIds.has(a.asset_id)),
    );
    const orders = ov.orders.filter(
      (o) => inSite(o) || (o.asset_id && assetIds.has(o.asset_id)),
    );
    return { points, health, gateways, alerts, orders };
  }, [ov, site, assets.length]);

  if (ov === null) return null;
  if (!ov || !view)
    return (
      <div className="rv-page">
        <p className="rv-muted">{error || "Loading the plant…"}</p>
      </div>
    );

  const { points, health, gateways, alerts, orders } = view;
  const status = (h: Row) =>
    asStatus(h.status === "no_points" ? "no_data" : h.status) as PointStatus;
  const counts = { act: 0, watch: 0, good: 0, offline: 0 } as Record<
    string,
    number
  >;
  for (const h of health) {
    const s = status(h);
    counts[s === "no_data" ? "offline" : s] =
      (counts[s === "no_data" ? "offline" : s] || 0) + 1;
  }
  const scored = health.filter((h) => typeof h.score === "number");
  const plantScore = scored.length
    ? Math.round(scored.reduce((s, h) => s + h.score, 0) / scored.length)
    : null;

  // Weekly change: the same score formula on daily maxima 7 days ago vs the latest day.
  const byPoint = (id: string) =>
    daily
      .filter((d) => d.point_id === id)
      .map((d) => ({ day: d.day, v: Number(d.v_max) }))
      .filter((d) => Number.isFinite(d.v));
  const scoreAt = (offset: number) => {
    const perAsset = health
      .map((h) => {
        const ps = points.filter((p) => p.asset_id === h.asset_id && p.zone_bc);
        const sc = ps
          .map((p) => {
            const s = byPoint(p.point_id);
            const d = s[s.length - 1 - offset];
            return d
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(100 - (40 * d.v) / Number(p.zone_bc)),
                  ),
                )
              : null;
          })
          .filter((x): x is number => x !== null);
        return sc.length ? Math.min(...sc) : null;
      })
      .filter((x): x is number => x !== null);
    return perAsset.length
      ? perAsset.reduce((s, x) => s + x, 0) / perAsset.length
      : null;
  };
  const nowScore = scoreAt(0),
    weekScore = scoreAt(7);
  const weekly =
    nowScore !== null && weekScore !== null
      ? Math.round(nowScore - weekScore)
      : null;

  const crit = alerts.filter(
    (a) => a.status === "open" && a.severity === "critical",
  );
  const warn = alerts.filter(
    (a) => a.status === "open" && a.severity === "warning",
  );
  const unassigned = alerts.filter(
    (a) => a.status === "open" && !a.work_order_id && !a.acknowledged_at,
  );
  const installed = new Set(ov.installs.map((i) => i.point_id));
  const sensorPoints = points.filter((p) => p.sensor_id);
  const sensorsOnline = sensorPoints.filter((p) => p.fresh).length;
  const gwState = (g: Row) => gatewayState(g);
  const gwOnline = gateways.filter((g) => gwState(g) === "online");
  const silent = gateways.filter(
    (g) => ["stale", "offline"].includes(gwState(g)) && g.last_seen_at,
  );
  const week = Date.now() + 7 * 86400000;
  const due = orders.filter((o) => {
    const t = Date.parse(o.scheduled_end || o.scheduled_start || "");
    return t && t <= week;
  });
  const offlineSensors = sensorPoints.length - sensorsOnline;
  const verdict = [
    counts.act
      ? `${plural(counts.act, "machine")} need${counts.act === 1 ? "s" : ""} action today.`
      : health.length
        ? "No machine needs action today."
        : "No machines with measurement points yet.",
    counts.watch ? `${counts.watch} on watch` : "",
    offlineSensors ? `${plural(offlineSensors, "sensor")} offline` : "",
  ].filter(Boolean);
  const latestData = points
    .map((p) => Date.parse(p.latest_at || ""))
    .filter(Number.isFinite);
  const updated = latestData.length ? Math.max(...latestData) : ov.loadedAt;

  // Needs attention: alarms, then silent gateways and overdue manual readings not already alarmed.
  const attention: {
    key: string;
    sev: string;
    title: string;
    detail: string;
    when: string;
    at: number;
    onClick: () => void;
  }[] = [
    ...alerts
      .filter((a) => a.status !== "resolved")
      .map((a) => {
        const asset = assetsAll.find((x) => x.id === a.asset_id)?.name;
        const point = points.find((p) => p.point_id === a.point_id)?.point_name;
        return {
          key: a.id,
          sev: a.severity,
          title: [asset && point ? `${asset} › ${point}` : asset, a.title]
            .filter(Boolean)
            .join(": "),
          detail: [a.description, a.ai_cause]
            .filter(Boolean)
            .join(" ")
            .slice(0, 180),
          when: fmtDate(a.detected_at),
          at: Date.parse(a.detected_at),
          onClick: () => navigate("alerts/" + a.id),
        };
      }),
    ...silent
      .filter(
        (g) =>
          !alerts.some((a) => a.gateway_id === g.id && a.status !== "resolved"),
      )
      .map((g) => ({
        key: g.id,
        sev: "device",
        title: `${g.name} silent for ${timeAgo(g.last_seen_at).replace(" ago", "")}`,
        detail: `${plural(ov.sensors.filter((s) => s.gateway_id === g.id).length, "sensor")} not monitored. Check gateway power and SIM data.`,
        when: "Today",
        at: Date.parse(g.last_seen_at),
        onClick: () => navigate("devices"),
      })),
  ]
    .sort(
      (x, y) => (SEV_RANK[x.sev] ?? 9) - (SEV_RANK[y.sev] ?? 9) || x.at - y.at,
    )
    .slice(0, 5);

  // ISO zone distribution across the plant's points.
  const zoneCount: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    none: 0,
    ungraded: 0,
  };
  for (const p of points) {
    if (!p.graded) zoneCount.ungraded++;
    else if (!p.fresh || !p.zone) zoneCount.none++;
    else zoneCount[p.zone]++;
  }
  const zoneTotal = points.length || 1;

  // Assets, worst first.
  const rows = health
    .map((h) => {
      const a = assetsAll.find((x) => x.id === h.asset_id)!;
      const ps = points.filter((p) => p.asset_id === h.asset_id);
      const driver =
        ps.find((p) => p.point_id === h.driven_by_point_id) || ps[0];
      return { a, h, ps, driver, s: status(h) };
    })
    .filter((r) => r.a)
    .sort(
      (x, y) =>
        (RANK[x.s] ?? 9) - (RANK[y.s] ?? 9) ||
        (x.h.score ?? 999) - (y.h.score ?? 999),
    );
  const areaName = (id?: string) =>
    (data.areas || []).find((x) => x.id === id)?.name;

  // Coming up.
  const coming: {
    key: string;
    title: string;
    detail: string;
    when: string;
    tone: string;
  }[] = [];
  for (const o of due)
    coming.push({
      key: o.id,
      title: o.title,
      detail: `Work order ${o.work_order_number || ""}`.trim(),
      when: `Due ${fmtDate(o.scheduled_end || o.scheduled_start)}`,
      tone: "act",
    });
  for (const p of points) {
    if (!p.zone_cd || !p.fresh) continue;
    const d = daysToLimit(byPoint(p.point_id).slice(-14), Number(p.zone_cd));
    if (d !== null)
      coming.push({
        key: "f" + p.point_id,
        title: `${assetsAll.find((a) => a.id === p.asset_id)?.name} › ${shortPointName(p.point_name)} reaches C/D`,
        detail: "Forecast from 14-day velocity trend",
        when: d < 14 ? `~${d} days` : `~${Math.round(d / 7)} weeks`,
        tone: "watch",
      });
  }
  for (const m of ov.manual.filter((m) => assetIds.has(m.asset_id))) {
    const next =
      Date.parse(m.last_ts || m.created_at) + intervalMs(m.expected_every);
    if (next < week)
      coming.push({
        key: "m" + m.id,
        title: m.name,
        detail: `Manual data point · ${assetsAll.find((a) => a.id === m.asset_id)?.name}`,
        when:
          next < Date.now()
            ? "Overdue"
            : next < Date.now() + 86400000
              ? "Due today"
              : `Due ${fmtDate(next)}`,
        tone: next < Date.now() ? "act" : "watch",
      });
  }
  const withBaseline = new Set(ov.baselines.map((b) => b.point_id));
  for (const i of ov.installs) {
    const p = points.find((x) => x.point_id === i.point_id);
    if (!p || withBaseline.has(i.point_id) || !byPoint(i.point_id).length)
      continue;
    const first = byPoint(i.point_id)[0].day;
    const ready = Date.parse(first) + 14 * 86400000;
    const left = Math.ceil(daysBetween(Date.now(), ready));
    if (left > 0 && left <= 14)
      coming.push({
        key: "b" + i.point_id,
        title: `Baseline ready: ${assetsAll.find((a) => a.id === p.asset_id)?.name} › ${shortPointName(p.point_name)}`,
        detail: "Alerts on the normal band start then",
        when: `In ${plural(left, "day")}`,
        tone: "info",
      });
  }

  return (
    <div className="rv-page rv-command">
      <header className="rv-page-header">
        <div>
          <p className="rv-crumb">
            Overview · updated {timeAgo(new Date(updated).toISOString())}
          </p>
          <h1>{plant ? `${plant.name} plant` : "All plants"}</h1>
          <p className="rv-verdict">
            <strong className={counts.act ? "rv-text-act" : ""}>
              {verdict[0]}
            </strong>{" "}
            {verdict.slice(1).join(", ")}
            {verdict.length > 1 ? "." : ""}
          </p>
        </div>
        <div className="rv-header-actions">
          <SecondaryButton onClick={() => window.print()}>
            Download report
          </SecondaryButton>
          <PrimaryButton onClick={onAddGateway}>Add gateway</PrimaryButton>
        </div>
      </header>

      <div className="rv-kpis rv-kpis-6">
        <Kpi
          label="Plant health"
          onClick={() => navigate("assets")}
          value={plantScore ?? "—"}
          suffix={plantScore !== null ? "/ 100" : undefined}
          note={
            plantScore === null
              ? "No live scores yet"
              : weekly === null
                ? "Weekly change needs 7 days of data"
                : weekly === 0
                  ? "Same as last week"
                  : `${weekly < 0 ? "Down" : "Up"} ${Math.abs(weekly)} this week`
          }
          noteTone={weekly !== null && weekly < 0 ? "watch" : undefined}
        />
        <Kpi
          label="Open alarms"
          tone={crit.length ? "act" : undefined}
          onClick={() => navigate("alerts")}
          value={crit.length + warn.length}
          note={
            <>
              <strong className={crit.length ? "rv-text-act" : ""}>
                {crit.length} critical
              </strong>{" "}
              · {warn.length} warning · {unassigned.length} unassigned
            </>
          }
        />
        <Kpi
          label="Assets monitored"
          onClick={() => navigate("assets")}
          value={health.length}
          note={
            <>
              {counts.act} act · {counts.watch} watch · {counts.good} good ·{" "}
              {counts.offline} offline
            </>
          }
          extra={
            health.length > 0 && (
              <StackBar
                parts={[
                  ["act", counts.act],
                  ["watch", counts.watch],
                  ["good", counts.good],
                  ["offline", counts.offline],
                ]}
              />
            )
          }
        />
        <Kpi
          label="Sensors online"
          onClick={() => navigate("devices")}
          value={sensorsOnline}
          suffix={`/ ${sensorPoints.length}`}
          note={plural(points.length, "measurement point")}
        />
        <Kpi
          label="Gateways online"
          tone={silent.length ? "watch" : undefined}
          onClick={() => navigate("devices")}
          value={gwOnline.length}
          suffix={`/ ${gateways.length}`}
          note={
            silent.length ? (
              <strong className="rv-text-watch">
                {silent[0].name} silent{" "}
                {timeAgo(silent[0].last_seen_at).replace(" ago", "")}
              </strong>
            ) : gateways.length ? (
              "All reporting"
            ) : (
              "No gateways yet"
            )
          }
        />
        <Kpi
          label="Work orders"
          onClick={() => navigate("work_orders")}
          value={orders.length}
          note={`open · ${due.length} due this week`}
        />
      </div>

      <div className="rv-grid-main">
        <Card>
          <div className="rv-card-head">
            <h2 className="rv-section-title">Needs attention now</h2>
            <button
              type="button"
              className="rv-link"
              onClick={() => navigate("alerts")}
            >
              All alarms
            </button>
          </div>
          {attention.length ? (
            <ul className="rv-attention">
              {attention.map((x) => (
                <li key={x.key} className={"rv-sev-" + x.sev}>
                  <button type="button" onClick={x.onClick}>
                    <span>
                      <strong>{x.title}</strong>
                      <small className="rv-block">{x.detail}</small>
                    </span>
                    <span className="rv-attention-side">
                      <StatusPill tone={SEV_TONE[x.sev]}>
                        {x.sev[0].toUpperCase() + x.sev.slice(1)}
                      </StatusPill>
                      <small className="rv-muted">{x.when}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rv-muted">Nothing needs attention right now.</p>
          )}
        </Card>
        <Card>
          <div className="rv-card-head">
            <h2 className="rv-section-title">ISO 20816-3 zones</h2>
            <button
              type="button"
              className="rv-link"
              onClick={() => navigate("settings/vibration-standards")}
            >
              Limits
            </button>
          </div>
          <p className="rv-muted rv-small">
            {plural(points.length, "measurement point")}, by velocity zone right
            now
          </p>
          <StackBar
            parts={[
              ["A", zoneCount.A],
              ["B", zoneCount.B],
              ["C", zoneCount.C],
              ["D", zoneCount.D],
              ["none", zoneCount.none + zoneCount.ungraded],
            ]}
            zones
          />
          <ul className="rv-zone-counts">
            {ZONES.map((z) => (
              <li key={z.zone}>
                <ZoneChip zone={z.zone as Zone} /> <span>{z.short}</span>
                <strong>{zoneCount[z.zone]}</strong>
              </li>
            ))}
            <li>
              <ZoneChip zone={null} /> <span>No current data</span>
              <strong>{zoneCount.none}</strong>
            </li>
            {zoneCount.ungraded > 0 && (
              <li>
                <ZoneChip zone={null} /> <span>Not graded (no limit set)</span>
                <strong>{zoneCount.ungraded}</strong>
              </li>
            )}
          </ul>
          {points.length === 0 && (
            <p className="rv-hint">
              Zones appear once sensors are mapped to measurement points.
            </p>
          )}
          <span className="rv-sr-only">{zoneTotal}</span>
        </Card>
      </div>

      <Card>
        <div className="rv-card-head">
          <h2 className="rv-section-title">Assets · worst first</h2>
          <span className="rv-muted rv-small">
            Health = worst measurement point on the machine
          </span>
        </div>
        {rows.length ? (
          <table className="rv-table rv-asset-table">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Health</th>
                <th scope="col">Worst point</th>
                <th scope="col">Zone</th>
                <th scope="col">Velocity</th>
                <th scope="col">30 days</th>
                <th scope="col">Last data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, h, ps, driver, s }) => {
                const stale = !driver?.fresh;
                return (
                  <tr
                    key={a.id}
                    className="rv-click-row"
                    tabIndex={0}
                    onClick={() => onOpenAsset(a.id)}
                    onKeyDown={(e) => e.key === "Enter" && onOpenAsset(a.id)}
                  >
                    <td data-label="Asset">
                      <strong>{a.name}</strong>
                      <small className="rv-muted rv-block">
                        {[
                          areaName(a.area_id) ||
                            sites.find((x) => x.id === a.site_id)?.name,
                          plural(ps.length, "point"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </td>
                    <td data-label="Health">
                      <span className="rv-health-cell">
                        <strong>{h.score ?? "—"}</strong>{" "}
                        <StatusPill tone={STATUS_TONE[s]}>
                          {STATUS_LABEL[s]}
                        </StatusPill>
                      </span>
                    </td>
                    <td data-label="Worst point">
                      {s === "offline" || s === "no_data"
                        ? "—"
                        : shortPointName(driver?.point_name || "") || "—"}
                    </td>
                    <td data-label="Zone">
                      {driver?.graded ? (
                        <ZoneChip zone={driver.fresh ? driver.zone : null} />
                      ) : (
                        <span className="rv-muted rv-small">Not graded</span>
                      )}
                    </td>
                    <td data-label="Velocity">
                      {driver?.fresh && driver.velocity != null
                        ? `${fmt(driver.velocity)} mm/s`
                        : "—"}
                    </td>
                    <td data-label="30 days">
                      <Spark
                        rows={byPoint(driver?.point_id)}
                        tone={STATUS_TONE[s]}
                      />
                    </td>
                    <td
                      data-label="Last data"
                      className={
                        stale && driver?.latest_at ? "rv-text-watch" : ""
                      }
                    >
                      {driver?.latest_at
                        ? ago(driver.latest_at)
                        : "No data yet"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="rv-muted">
            No machines with measurement points{plant ? " in this plant" : ""}{" "}
            yet. Map sensors to points in the gateway wizard (step 3).
          </p>
        )}
      </Card>

      {!site && sites.length > 1 && (
        <Card>
          <h2 className="rv-section-title">Plants</h2>
          <table className="rv-table">
            <thead>
              <tr>
                <th scope="col">Plant</th>
                <th scope="col">Machines</th>
                <th scope="col">Need action</th>
                <th scope="col">Open alarms</th>
                <th scope="col">Gateways online</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const ids = new Set(
                  assetsAll.filter((a) => a.site_id === s.id).map((a) => a.id),
                );
                const hs = health.filter((h) => ids.has(h.asset_id));
                const gs = gateways.filter((g) => g.site_id === s.id);
                return (
                  <tr key={s.id}>
                    <td data-label="Plant">
                      <strong>{s.name}</strong>
                    </td>
                    <td data-label="Machines">{hs.length}</td>
                    <td data-label="Need action">
                      {hs.filter((h) => h.status === "act").length}
                    </td>
                    <td data-label="Open alarms">
                      {
                        alerts.filter(
                          (a) => a.site_id === s.id && a.status === "open",
                        ).length
                      }
                    </td>
                    <td data-label="Gateways online">
                      {gs.filter((g) => gwState(g) === "online").length} /{" "}
                      {gs.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="rv-grid-main">
        <Card>
          <div className="rv-card-head">
            <h2 className="rv-section-title">Gateways and sensors</h2>
            <button
              type="button"
              className="rv-link"
              onClick={() => navigate("devices")}
            >
              Manage devices
            </button>
          </div>
          {gateways.length ? (
            <ul className="rv-gw-list">
              {gateways.map((g) => {
                const st = gwState(g);
                const ss = ov.sensors.filter((s) => s.gateway_id === g.id);
                const areas = [
                  ...new Set(
                    ss
                      .map((s) =>
                        areaName(
                          assetsAll.find((a) => a.id === s.asset_id)?.area_id,
                        ),
                      )
                      .filter(Boolean),
                  ),
                ];
                const warnTone = st === "stale" || st === "offline";
                return (
                  <li key={g.id}>
                    <span
                      className={
                        "rv-dot rv-dot-" +
                        (st === "online"
                          ? "good"
                          : warnTone
                            ? "watch"
                            : "offline")
                      }
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{g.name}</strong>
                      <small className="rv-muted rv-block">
                        {[
                          MODEL[g.device_model] || g.model || "Gateway",
                          ...areas,
                        ].join(" · ")}
                      </small>
                    </span>
                    <span>{plural(ss.length, "sensor")}</span>
                    <span className="rv-muted">
                      {g.metadata?.signal || "—"}
                    </span>
                    <span className={warnTone ? "rv-text-watch" : ""}>
                      {st === "pending"
                        ? "Waiting for first message"
                        : ago(g.last_seen_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rv-muted">
              No gateways{plant ? " in this plant" : ""} yet.
            </p>
          )}
        </Card>
        <Card>
          <h2 className="rv-section-title">Coming up</h2>
          {coming.length ? (
            <ul className="rv-coming">
              {coming.slice(0, 6).map((c) => (
                <li key={c.key}>
                  <span>
                    <strong>{c.title}</strong>
                    <small className="rv-muted rv-block">{c.detail}</small>
                  </span>
                  <strong className={"rv-text-" + c.tone}>{c.when}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rv-muted">
              Nothing due this week. Forecasts appear once a point has 7 days of
              rising readings.
            </p>
          )}
          <span className="rv-sr-only">{installed.size}</span>
        </Card>
      </div>
    </div>
  );
}

function intervalMs(v?: string | null) {
  if (!v) return Infinity;
  const m =
    /(\d+)\s*(day|mon|week|hour|year)/i.exec(v) || /(\d+):(\d+):(\d+)/.exec(v);
  if (!m) return Infinity;
  if (m[2] && /^\d+$/.test(m[2]))
    return (Number(m[1]) * 3600 + Number(m[2]) * 60) * 1000;
  const n = Number(m[1]),
    unit = m[2].toLowerCase();
  return (
    n *
    (unit.startsWith("hour")
      ? 3600e3
      : unit.startsWith("day")
        ? 86400e3
        : unit.startsWith("week")
          ? 7 * 86400e3
          : unit.startsWith("mon")
            ? 30 * 86400e3
            : 365 * 86400e3)
  );
}

function Kpi({
  label,
  value,
  suffix,
  note,
  noteTone,
  tone,
  onClick,
  extra,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  note: React.ReactNode;
  noteTone?: string;
  tone?: string;
  onClick: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"rv-kpi" + (tone ? " rv-kpi-" + tone : "")}
      onClick={onClick}
    >
      <span className="rv-card-label">{label}</span>
      <span
        className={"rv-big-number" + (tone === "act" ? " rv-text-act" : "")}
      >
        {value}
        {suffix && <small> {suffix}</small>}
      </span>
      {extra}
      <span
        className={
          "rv-small " + (noteTone ? "rv-text-" + noteTone : "rv-muted")
        }
      >
        {note}
      </span>
    </button>
  );
}

function StackBar({
  parts,
  zones,
}: {
  parts: [string, number][];
  zones?: boolean;
}) {
  const total = parts.reduce((s, [, n]) => s + n, 0);
  if (!total)
    return <div className="rv-stack rv-stack-empty" aria-hidden="true" />;
  return (
    <div
      className="rv-stack"
      role="img"
      aria-label={parts.map(([k, n]) => `${n} ${k}`).join(", ")}
    >
      {parts
        .filter(([, n]) => n > 0)
        .map(([k, n]) => (
          <span
            key={k}
            className={(zones ? "rv-lz-" : "rv-st-") + k.toLowerCase()}
            style={{ flex: n }}
          />
        ))}
    </div>
  );
}

function Spark({
  rows,
  tone,
}: {
  rows: { day: string; v: number }[];
  tone: string;
}) {
  if (rows.length < 2)
    return <span className="rv-spark rv-spark-empty" aria-hidden="true" />;
  const vals = rows.map((r) => r.v);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const pts = rows
    .map(
      (r, i) =>
        `${((i / (rows.length - 1)) * 120).toFixed(1)},${(26 - ((r.v - min) / (max - min || 1)) * 22).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className={"rv-spark rv-spark-" + tone}
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
