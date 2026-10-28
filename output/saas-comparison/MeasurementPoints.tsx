import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { everyWhileVisible } from "../orgLive";
import { Plus, Sparkles } from "lucide-react";
import type { Row } from "../data";
import {
  POSITIONS,
  STATUS_LABEL,
  STATUS_TONE,
  asStatus,
  bandPosition,
  fmt,
  pointInsight,
  positionLabel,
  worstPoint,
  type PointStatus,
} from "./points";
import {
  addPoint,
  installSensor,
  loadAssetPoints,
  loadPointReadings,
  removeSensor,
  replaceSensor,
  type AssetPoints,
} from "./pointsApi";
import { timeAgo } from "./status";
import { loadAssetDatapoints } from "./opsApi";
import { fmtDateTime } from "./time";
import {
  Card,
  Dialog,
  Field,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "./ui";

const RANGES: [string, number][] = [
  ["24 h", 1],
  ["7 d", 7],
  ["30 d", 30],
];
const COMPARE_COLOURS = [
  "#2563EB",
  "#0E7490",
  "#7C3AED",
  "#475569",
  "#0F766E",
  "#9333EA",
];
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String((e as Row)?.message || e);

/**
 * Asset page section for measurement points. Renders `fallback` (the existing
 * sensor-based overview) until the asset has points, or when the database does
 * not have measurement points yet.
 */
export function AssetPointsSection({
  asset,
  canWrite,
  fallback,
  onAsk,
  onWorkOrder,
}: {
  asset: Row;
  canWrite: boolean;
  fallback: ReactNode;
  onAsk?: () => void;
  onWorkOrder?: () => void;
}) {
  const [data, setData] = useState<AssetPoints | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await loadAssetPoints(asset));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, [asset.id, asset.organization_id]);

  useEffect(() => {
    void refresh();
    return everyWhileVisible(() => void refresh(), 60_000);
  }, [refresh]);

  if (!data || data.missing) return <>{fallback}</>;
  if (!data.points.length)
    return (
      <>
        <div className="rv-page rv-embedded">
          <Card className="rv-setup-points">
            <div>
              <h2 className="rv-section-title">Measurement points</h2>
              <p className="rv-muted">
                Add the spots where sensors are mounted (for example motor
                drive-end bearing). History, normal ranges and alerts then
                belong to the point, so replacing a sensor never breaks the
                trend.
              </p>
            </div>
            {canWrite && (
              <PrimaryButton onClick={() => setAdding(true)}>
                <Plus size={16} /> Add point
              </PrimaryButton>
            )}
            {error && <p className="rv-error-box">{error}</p>}
          </Card>
          <AddPointDialog
            open={adding}
            asset={asset}
            data={data}
            onClose={() => setAdding(false)}
            onDone={refresh}
          />
        </div>
        {fallback}
      </>
    );
  return (
    <PointsPanel
      asset={asset}
      data={data}
      canWrite={canWrite}
      refresh={refresh}
      onAsk={onAsk}
      onWorkOrder={onWorkOrder}
      error={error}
    />
  );
}

function PointsPanel({
  asset,
  data,
  canWrite,
  refresh,
  onAsk,
  onWorkOrder,
  error,
}: {
  asset: Row;
  data: AssetPoints;
  canWrite: boolean;
  refresh: () => Promise<void>;
  onAsk?: () => void;
  onWorkOrder?: () => void;
  error: string;
}) {
  const points = data.points;
  const [extra, setExtra] = useState<{ defs: Row[]; values: Row[] }>({
    defs: [],
    values: [],
  });
  useEffect(() => {
    loadAssetDatapoints(asset)
      .then(setExtra)
      .catch(() => setExtra({ defs: [], values: [] }));
  }, [asset.id]);
  const [selectedId, setSelectedId] = useState(
    () => worstPoint(points)?.point_id,
  );
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);
  const [readings, setReadings] = useState<Row[]>([]);
  const [dialog, setDialog] = useState<
    null | "add" | "install" | "replace" | "remove"
  >(null);
  const selected =
    points.find((p) => p.point_id === selectedId) || worstPoint(points)!;
  const health = data.health;
  const insight = useMemo(() => pointInsight(points), [points]);
  const openAlerts = data.alerts.filter(
    (a) => a.status === "open" || a.status === "acknowledged",
  );
  const gatewayNames = [
    ...new Set(
      points
        .map((p) => data.gateways.find((g) => g.id === p.gateway_id)?.name)
        .filter(Boolean),
    ),
  ];
  const sensorsCount = points.filter((p) => p.sensor_id).length;

  useEffect(() => {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    loadPointReadings(
      asset.organization_id,
      points.map((p) => p.point_id),
      from,
    )
      .then(setReadings)
      .catch(() => setReadings([]));
  }, [days, points.map((p) => p.point_id).join(","), health?.latest_at]);

  const status = asStatus(
    health?.status === "no_points" ? "no_data" : health?.status,
  );
  const iso = asset.vibration_standard
    ? `${asset.vibration_standard === "iso_20816_3" ? "ISO 20816-3" : "ISO 2372"} ${asset.vibration_class || ""}${asset.foundation_type ? `, ${asset.foundation_type}` : ""}`
    : "ISO class not set";

  return (
    <div className="rv-page rv-embedded rv-points">
      <div className="rv-asset-meta">
        <StatusPill tone={health?.points_reporting ? "good" : "offline"}>
          {health?.points_reporting
            ? `Reporting · last reading ${timeAgo(health.latest_at).toLowerCase()}`
            : `No live data · last reading ${timeAgo(health?.latest_at).toLowerCase()}`}
        </StatusPill>
        <span className="rv-muted">
          {[
            asset.rated_power_kw ? `${asset.rated_power_kw} kW` : "",
            asset.asset_type,
            iso,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="rv-muted">
          {sensorsCount} sensor{sensorsCount === 1 ? "" : "s"}
          {gatewayNames.length ? ` via ${gatewayNames.join(", ")}` : ""}
        </span>
        <span className="rv-spacer" />
        {onAsk && (
          <SecondaryButton onClick={onAsk}>
            Ask about this machine
          </SecondaryButton>
        )}
        {onWorkOrder && (
          <PrimaryButton onClick={onWorkOrder}>Create work order</PrimaryButton>
        )}
      </div>

      <div className="rv-points-top">
        <Card className="rv-health-card">
          <div className="rv-health-row">
            <ScoreRing
              score={health?.score ?? null}
              tone={STATUS_TONE[status]}
            />
            <div>
              <p className="rv-card-label">Machine health</p>
              <p className={"rv-health-status rv-text-" + STATUS_TONE[status]}>
                {STATUS_LABEL[status]}
              </p>
              <p className="rv-health-driver">
                {health?.driven_by_point_name ? (
                  <>
                    Driven by <strong>{health.driven_by_point_name}</strong>,
                    the worst of {health.points} point
                    {health.points === 1 ? "" : "s"}.
                  </>
                ) : (
                  "Waiting for readings."
                )}
              </p>
            </div>
          </div>
          <p className="rv-hint">
            Indicative score from velocity against the ISO zone B limit. The
            machine score is its worst point, never an average.
          </p>
        </Card>

        <section className="rv-insight" aria-label="Insight across points">
          <p className="rv-insight-label">
            <Sparkles size={14} aria-hidden="true" /> Insight · across{" "}
            {points.length} point{points.length === 1 ? "" : "s"}
          </p>
          <p className="rv-insight-headline">{insight.headline}</p>
          <p className="rv-insight-detail">{insight.detail}</p>
          {insight.suggestion && (
            <p className="rv-insight-detail">Suggested: {insight.suggestion}</p>
          )}
          <p className="rv-insight-foot">
            Rule-based pattern from the latest readings. Confirm on site before
            acting.
          </p>
        </section>

        <Card className="rv-mini-card">
          <p className="rv-card-label">Open alerts</p>
          <p
            className={
              "rv-big-number" + (openAlerts.length ? " rv-text-act" : "")
            }
          >
            {openAlerts.length}
          </p>
          <p className="rv-muted">
            {openAlerts[0]
              ? `since ${new Date(openAlerts[openAlerts.length - 1].detected_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
              : "none open"}
          </p>
        </Card>
      </div>

      <div className="rv-section-head">
        <h2 className="rv-section-title">Measurement points</h2>
        {canWrite && (
          <button
            type="button"
            className="rv-chip rv-chip-add"
            onClick={() => setDialog("add")}
          >
            + Add point
          </button>
        )}
      </div>
      <div
        className="rv-point-tabs"
        role="tablist"
        aria-label="Measurement points"
      >
        {points.map((p) => {
          const st = asStatus(p.status);
          return (
            <button
              key={p.point_id}
              type="button"
              role="tab"
              aria-selected={p.point_id === selected.point_id}
              className={
                "rv-point-tab" +
                (p.point_id === selected.point_id ? " is-selected" : "")
              }
              onClick={() => setSelectedId(p.point_id)}
            >
              <span
                className={"rv-dot rv-dot-" + STATUS_TONE[st]}
                aria-hidden="true"
              />
              <span>
                <strong>{p.point_name}</strong>
                <small>
                  {STATUS_LABEL[st]}
                  {p.velocity !== null && p.velocity !== undefined
                    ? ` · ${fmt(p.velocity)} mm/s`
                    : ""}{" "}
                  · {p.sensor_name || "no sensor"}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rv-section-head">
        <h2 className="rv-section-title">Vitals · {selected.point_name}</h2>
        <span className="rv-muted rv-small">
          {selected.sensor_name
            ? `${selected.sensor_name}${selected.modbus_address ? ` · addr ${selected.modbus_address}` : ""} · blue band = this point's normal range`
            : "No sensor installed on this point"}
        </span>
        {canWrite && (
          <span className="rv-point-actions">
            {selected.sensor_id ? (
              <>
                <SecondaryButton onClick={() => setDialog("replace")}>
                  Replace sensor
                </SecondaryButton>
                <SecondaryButton onClick={() => setDialog("remove")}>
                  Remove sensor
                </SecondaryButton>
              </>
            ) : (
              <PrimaryButton onClick={() => setDialog("install")}>
                Install sensor
              </PrimaryButton>
            )}
          </span>
        )}
      </div>
      <div className="rv-vital-grid">
        <VitalCard
          title="Vibration velocity"
          unit="mm/s RMS"
          value={selected.velocity}
          axis={selected.velocity_axis}
          low={selected.velocity_p05}
          high={selected.velocity_p95}
          ratio={selected.velocity_ratio}
          zone={selected.zone}
          limit={selected.zone_b_limit}
          fresh={selected.fresh}
        />
        <VitalCard
          title="Acceleration"
          unit="m/s²"
          value={selected.acceleration}
          low={selected.acceleration_p05}
          high={selected.acceleration_p95}
          ratio={selected.acceleration_ratio}
          fresh={selected.fresh}
        />
        <VitalCard
          title="Displacement"
          unit="µm"
          value={selected.displacement}
          digits={0}
          low={selected.displacement_p05}
          high={selected.displacement_p95}
          ratio={selected.displacement_ratio}
          fresh={selected.fresh}
        />
        <VitalCard
          title="Bearing temperature"
          digits={1}
          unit="°C"
          value={selected.temperature}
          low={selected.temperature_p05}
          high={selected.temperature_p95}
          ratio={selected.temperature_ratio}
          fresh={selected.fresh}
        />
        {extra.defs
          .filter(
            (d) =>
              d.show_as === "vital" &&
              (!d.point_id || d.point_id === selected.point_id),
          )
          .map((d) => {
            const vs = extra.values.filter((v) => v.datapoint_id === d.id);
            const last = vs[vs.length - 1];
            const value = last ? Number(last.value) : null;
            const fresh =
              !!last &&
              (d.source === "manual" ||
                Date.parse(last.ts) > Date.now() - 15 * 60000);
            return (
              <DatapointCard
                key={d.id}
                d={d}
                value={value}
                at={last?.ts}
                fresh={fresh}
              />
            );
          })}
      </div>

      <Card>
        <div className="rv-card-head">
          <div>
            <h2 className="rv-section-title">
              {compare
                ? "Velocity · all points"
                : `Velocity trend · ${selected.point_name}`}
            </h2>
            <p className="rv-muted rv-small">
              Last {days === 1 ? "24 hours" : `${days} days`} · mm/s RMS · worst
              axis
              {selected.zone_cd
                ? ` · B/C ${fmt(selected.zone_bc)} · C/D ${fmt(selected.zone_cd)} (${selected.limit_set_name})`
                : selected.zone_b_limit
                  ? ` · B/C ${fmt(selected.zone_b_limit)}`
                  : selected.graded === false
                    ? " · not graded"
                    : ""}
            </p>
          </div>
          <div className="rv-chart-controls">
            <SecondaryButton onClick={() => setCompare((c) => !c)}>
              {compare ? "Single point" : "Compare points"}
            </SecondaryButton>
            <div className="rv-segmented" role="group" aria-label="Time range">
              {RANGES.map(([label, d]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={days === d}
                  className={days === d ? "is-on" : ""}
                  onClick={() => setDays(d)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <TrendChart
          points={points}
          selected={selected}
          readings={readings}
          days={days}
          compare={compare}
        />
      </Card>

      {extra.defs.some((d) => d.show_as === "chart") && (
        <Card>
          <h2 className="rv-section-title">More data</h2>
          <div className="rv-more-data">
            {extra.defs
              .filter((d) => d.show_as === "chart")
              .map((d) => (
                <MiniSeries
                  key={d.id}
                  d={d}
                  rows={extra.values.filter((v) => v.datapoint_id === d.id)}
                />
              ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="rv-section-title">Recent events</h2>
        {extra.values.some(
          (v) =>
            v.source === "manual" ||
            extra.defs.find((d) => d.id === v.datapoint_id)?.show_as ===
              "timeline",
        ) && (
          <ul className="rv-events">
            {extra.values
              .filter(
                (v) =>
                  v.source === "manual" ||
                  extra.defs.find((d) => d.id === v.datapoint_id)?.show_as ===
                    "timeline",
              )
              .slice(-6)
              .reverse()
              .map((v) => {
                const d = extra.defs.find((x) => x.id === v.datapoint_id);
                return (
                  <li key={v.id}>
                    <span className="rv-dot rv-dot-info" aria-hidden="true" />
                    <span>
                      <strong>
                        {d?.name}: {Number(v.value).toFixed(d?.decimals ?? 1)}{" "}
                        {d?.unit}
                      </strong>
                      <small>
                        {fmtDateTime(v.ts)} ·{" "}
                        {v.source === "manual" ? "entered by hand" : v.source}
                        {v.note ? ` · ${v.note}` : ""}
                      </small>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
        {!data.alerts.length ? (
          <p className="rv-muted">No alerts yet for this machine.</p>
        ) : (
          <ul className="rv-events">
            {data.alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <span
                  className={
                    "rv-dot rv-dot-" +
                    (a.severity === "critical"
                      ? "act"
                      : a.status === "resolved"
                        ? "good"
                        : "watch")
                  }
                  aria-hidden="true"
                />
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    {fmtDateTime(a.detected_at)} · {a.status}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p className="rv-error-box">{error}</p>}
      <AddPointDialog
        open={dialog === "add"}
        asset={asset}
        data={data}
        onClose={() => setDialog(null)}
        onDone={refresh}
      />
      <SensorDialog
        mode={
          dialog === "install" || dialog === "replace" || dialog === "remove"
            ? dialog
            : null
        }
        point={selected}
        data={data}
        onClose={() => setDialog(null)}
        onDone={refresh}
      />
    </div>
  );
}

function DatapointCard({
  d,
  value,
  at,
  fresh,
}: {
  d: Row;
  value: number | null;
  at?: string;
  fresh: boolean;
}) {
  const level =
    value === null
      ? "offline"
      : d.crit_above != null && value > d.crit_above
        ? "act"
        : d.warn_above != null && value > d.warn_above
          ? "watch"
          : fresh
            ? "good"
            : "offline";
  const label = {
    act: "Critical",
    watch: "Warning",
    good: "Normal",
    offline: value === null ? "No data" : "Stale",
  }[level];
  return (
    <Card className={"rv-vital rv-vital-" + level}>
      <div className="rv-card-head">
        <p className="rv-card-label">{d.name}</p>
        <StatusPill tone={level as any}>{label}</StatusPill>
      </div>
      <p className="rv-big-number">
        {value === null ? "—" : value.toFixed(d.decimals)}{" "}
        <small>{d.unit}</small>
      </p>
      <p className="rv-muted rv-small">
        {[
          d.warn_above != null ? `Warning above ${d.warn_above}` : "",
          d.crit_above != null ? `critical above ${d.crit_above}` : "",
          at ? fmtDateTime(at) : "",
        ]
          .filter(Boolean)
          .join(" · ") || d.source}
      </p>
    </Card>
  );
}

function MiniSeries({ d, rows }: { d: Row; rows: Row[] }) {
  const vals = rows.map((r) => Number(r.value));
  const last = vals[vals.length - 1];
  const min = Math.min(...vals),
    max = Math.max(...vals, d.warn_above ?? -Infinity);
  const pts = rows
    .map(
      (r, i) =>
        `${((i / Math.max(1, rows.length - 1)) * 300).toFixed(1)},${(56 - ((Number(r.value) - min) / (max - min || 1)) * 50).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className="rv-mini-series">
      <p>
        <strong>{d.name}</strong>{" "}
        <span className="rv-muted">
          {last === undefined
            ? "No values yet"
            : `${last.toFixed(d.decimals)} ${d.unit}`}
        </span>
      </p>
      {rows.length > 1 ? (
        <svg
          viewBox="0 0 300 60"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${d.name} over 30 days`}
        >
          {d.warn_above != null && (
            <line
              x1="0"
              x2="300"
              y1={56 - ((d.warn_above - min) / (max - min || 1)) * 50}
              y2={56 - ((d.warn_above - min) / (max - min || 1)) * 50}
              className="rv-chart-limit"
            />
          )}
          <polyline
            points={pts}
            fill="none"
            className="rv-chart-line"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="rv-spark rv-spark-empty" aria-hidden="true" />
      )}
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number | null; tone: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = score === null ? 0 : Math.max(0, Math.min(1, score / 100));
  return (
    <svg
      className={"rv-ring rv-ring-" + tone}
      viewBox="0 0 64 64"
      role="img"
      aria-label={score === null ? "No score" : `Score ${score} of 100`}
    >
      <circle cx="32" cy="32" r={r} className="rv-ring-track" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className="rv-ring-value"
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle">
        {score ?? "—"}
      </text>
    </svg>
  );
}

function VitalCard({
  title,
  unit,
  value,
  axis,
  low,
  high,
  ratio,
  zone,
  limit,
  fresh,
  digits = 2,
}: {
  title: string;
  unit: string;
  value: number | null;
  axis?: string | null;
  low: number | null;
  high: number | null;
  ratio: number | null;
  zone?: string | null;
  limit?: number | null;
  fresh: boolean;
  digits?: number;
}) {
  let status: PointStatus = !fresh || value === null ? "offline" : "good";
  if (fresh && value !== null) {
    if (zone === "D") status = "act";
    else if (zone === "C" || (ratio !== null && ratio > 1)) status = "watch";
  }
  const pos = bandPosition(value, low, high);
  const bandLeft = bandPosition(low, low, high);
  const bandRight = bandPosition(high, low, high);
  const limitPos =
    limit !== null && limit !== undefined
      ? bandPosition(limit, low, high)
      : null;
  const above =
    ratio !== null && ratio > 1 && high
      ? Math.round(((value! - high) / high) * 100)
      : null;
  return (
    <Card className={"rv-vital-card" + (status === "act" ? " is-act" : "")}>
      <div className="rv-card-head">
        <p className="rv-vital-title">{title}</p>
        <StatusPill tone={STATUS_TONE[status]}>
          {!fresh || value === null ? "No live data" : STATUS_LABEL[status]}
        </StatusPill>
      </div>
      <p
        className={
          "rv-vital-value rv-text-" +
          (status === "good" || status === "offline" ? "" : STATUS_TONE[status])
        }
      >
        {value === null || value === undefined ? "—" : value.toFixed(digits)}{" "}
        <small>
          {unit}
          {axis ? ` · ${axis.toUpperCase()}` : ""}
        </small>
      </p>
      {pos !== null && bandLeft !== null && bandRight !== null ? (
        <>
          <div className="rv-band" aria-hidden="true">
            <span
              className="rv-band-normal"
              style={{
                left: `${bandLeft * 100}%`,
                width: `${(bandRight - bandLeft) * 100}%`,
              }}
            />
            {limitPos !== null && (
              <span
                className="rv-band-limit"
                style={{ left: `${limitPos * 100}%` }}
              />
            )}
            <span
              className={"rv-band-dot rv-dot-" + STATUS_TONE[status]}
              style={{ left: `${pos * 100}%` }}
            />
          </div>
          <p className="rv-muted rv-small">
            Normal {fmt(low, digits === 0 ? 0 : 1)}–
            {fmt(high, digits === 0 ? 0 : 1)}
            {above !== null && above > 0
              ? ` · ${above}% above normal`
              : ratio !== null && ratio <= 1
                ? " · within normal"
                : ""}
          </p>
        </>
      ) : (
        <p className="rv-muted rv-small">
          Normal range is learned after about 14 days of readings.
        </p>
      )}
    </Card>
  );
}

function TrendChart({
  points,
  selected,
  readings,
  days,
  compare,
}: {
  points: Row[];
  selected: Row;
  readings: Row[];
  days: number;
  compare: boolean;
}) {
  const W = 1000,
    H = 240,
    L = 44,
    R = 12,
    T = 12,
    B = 28;
  const end = Date.now();
  const start = end - days * 86400000;
  const series = (compare ? points : [selected]).map((p, i) => ({
    point: p,
    colour: compare ? COMPARE_COLOURS[i % COMPARE_COLOURS.length] : "#2563EB",
    rows: readings.filter(
      (r) => r.point_id === p.point_id && typeof r.v_max === "number",
    ),
  }));
  const values = series.flatMap((s) => s.rows.map((r) => r.v_max as number));
  const max =
    Math.max(
      1,
      ...values,
      selected.velocity_p95 || 0,
      selected.zone_b_limit || 0,
      selected.zone_cd || 0,
    ) * 1.15;
  const x = (t: number) => L + ((t - start) / (end - start)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  if (!values.length)
    return (
      <p className="rv-muted rv-chart-empty">
        No readings in this period
        {compare ? " for any point" : ` for ${selected.point_name}`}.
      </p>
    );
  const ticks = [0, 0.5, 1].map((f) => start + f * (end - start));
  return (
    <figure className="rv-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Velocity trend, ${compare ? "all points" : selected.point_name}`}
        preserveAspectRatio="none"
      >
        {!compare &&
          selected.velocity_p05 !== null &&
          selected.velocity_p95 !== null && (
            <rect
              x={L}
              width={W - L - R}
              y={y(selected.velocity_p95)}
              height={Math.max(
                1,
                y(selected.velocity_p05) - y(selected.velocity_p95),
              )}
              className="rv-chart-band"
            />
          )}
        {selected.zone_b_limit && (
          <line
            x1={L}
            x2={W - R}
            y1={y(selected.zone_b_limit)}
            y2={y(selected.zone_b_limit)}
            className="rv-chart-limit"
          />
        )}
        {selected.zone_cd && (
          <line
            x1={L}
            x2={W - R}
            y1={y(selected.zone_cd)}
            y2={y(selected.zone_cd)}
            className="rv-chart-cd"
          />
        )}
        {[0, max / 2].map((v) => (
          <text
            key={v}
            x={L - 6}
            y={y(v) + 4}
            textAnchor="end"
            className="rv-chart-axis"
          >
            {v.toFixed(1)}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.point.point_id}
            fill="none"
            stroke={s.colour}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={s.rows
              .map(
                (r) =>
                  `${x(Date.parse(r.timestamp)).toFixed(1)},${y(r.v_max).toFixed(1)}`,
              )
              .join(" ")}
          />
        ))}
        {ticks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 8}
            textAnchor={
              i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"
            }
            className="rv-chart-axis"
          >
            {new Date(t).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </text>
        ))}
      </svg>
      <figcaption className="rv-chart-legend">
        {series.map((s) => (
          <span key={s.point.point_id}>
            <i style={{ background: s.colour }} aria-hidden="true" />{" "}
            {s.point.point_name}
          </span>
        ))}
        {!compare && selected.velocity_p95 !== null && (
          <span>
            <i className="rv-legend-band" aria-hidden="true" /> Normal band
          </span>
        )}
        {selected.zone_b_limit && (
          <span>
            <i className="rv-legend-limit" aria-hidden="true" /> B/C{" "}
            {fmt(selected.zone_b_limit)}
          </span>
        )}
        {selected.zone_cd && (
          <span>
            <i className="rv-legend-cd" aria-hidden="true" /> C/D{" "}
            {fmt(selected.zone_cd)} · {selected.limit_set_name}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function freeSensors(data: AssetPoints) {
  return data.sensors.filter((s) => !data.installedSensorIds.has(s.id));
}

function sensorLabel(s: Row, data: AssetPoints) {
  const gw = data.gateways.find((g) => g.id === s.gateway_id)?.name;
  return [
    s.name,
    s.sensor_code,
    gw ? `${gw}${s.modbus_address ? ` · addr ${s.modbus_address}` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function AddPointDialog({
  open,
  asset,
  data,
  onClose,
  onDone,
}: {
  open: boolean;
  asset: Row;
  data: AssetPoints;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("motor_de");
  const [radial, setRadial] = useState("y");
  const [axial, setAxial] = useState("z");
  const [sensorId, setSensorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    setSensorId("");
  }, [open]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!name.trim())
      return setError("Name the point, for example Motor drive-end bearing.");
    if (radial === axial)
      return setError("Radial and axial must be different axes.");
    setBusy(true);
    setError("");
    try {
      const id = await addPoint(asset, {
        name,
        position,
        radial_axis: radial,
        axial_axis: axial,
        sort_order: data.points.length + 1,
      });
      if (sensorId) await installSensor(id, sensorId);
      await onDone();
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const free = freeSensors(data);
  return (
    <Dialog
      open={open}
      title="Add measurement point"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => void submit()} busy={busy}>
            {busy ? "Saving…" : "Add point"}
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={submit} className="rv-form" noValidate>
        <Field label="Name">
          {(id) => (
            <input
              id={id}
              value={name}
              placeholder="Motor drive-end bearing"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Position">
          {(id) => (
            <select
              id={id}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              {POSITIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="rv-grid-2">
          <Field
            label="Radial axis"
            hint="Sensor axis pointing across the shaft."
          >
            {(id) => (
              <select
                id={id}
                value={radial}
                onChange={(e) => setRadial(e.target.value)}
              >
                <option value="x">X</option>
                <option value="y">Y</option>
              </select>
            )}
          </Field>
          <Field label="Axial axis" hint="Sensor axis along the shaft.">
            {(id) => (
              <select
                id={id}
                value={axial}
                onChange={(e) => setAxial(e.target.value)}
              >
                <option value="x">X</option>
                <option value="y">Y</option>
                <option value="z">Z</option>
              </select>
            )}
          </Field>
        </div>
        <Field
          label="Install sensor (optional)"
          hint={
            free.length
              ? "Unassigned sensors on gateways in this plant."
              : "No unassigned sensor. Map one from Devices > Add gateway, step 3."
          }
        >
          {(id) => (
            <select
              id={id}
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value)}
              disabled={!free.length}
            >
              <option value="">Not now</option>
              {free.map((s) => (
                <option key={s.id} value={s.id}>
                  {sensorLabel(s, data)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {error && (
          <p className="rv-error-box" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function SensorDialog({
  mode,
  point,
  data,
  onClose,
  onDone,
}: {
  mode: null | "install" | "replace" | "remove";
  point: Row;
  data: AssetPoints;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [sensorId, setSensorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setSensorId("");
    setError("");
  }, [mode]);
  const free = freeSensors(data);

  async function run() {
    setBusy(true);
    setError("");
    try {
      if (mode === "remove") await removeSensor(point.point_id);
      else {
        if (!sensorId) throw new Error("Choose a sensor.");
        if (mode === "install") await installSensor(point.point_id, sensorId);
        else await replaceSensor(point.point_id, sensorId);
      }
      await onDone();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "install"
      ? `Install a sensor on ${point.point_name}`
      : mode === "replace"
        ? `Replace the sensor on ${point.point_name}`
        : `Remove ${point.sensor_name || "the sensor"} from ${point.point_name}?`;
  return (
    <Dialog
      open={!!mode}
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => void run()} busy={busy}>
            {busy
              ? "Saving…"
              : mode === "remove"
                ? "Remove sensor"
                : mode === "replace"
                  ? "Replace sensor"
                  : "Install sensor"}
          </PrimaryButton>
        </>
      }
    >
      {mode === "remove" ? (
        <p>
          The point keeps its history and normal range. Readings from this
          sensor are not stored again until it is installed on a point.
        </p>
      ) : (
        <>
          {mode === "replace" && (
            <p>
              The current sensor ({point.sensor_name}) is closed off now.
              History, the normal range and open episodes stay with this point.
            </p>
          )}
          <Field
            label="Sensor"
            hint={
              free.length
                ? undefined
                : "No unassigned sensor. Map one from Devices > Add gateway, step 3."
            }
          >
            {(id) => (
              <select
                id={id}
                value={sensorId}
                onChange={(e) => setSensorId(e.target.value)}
                disabled={!free.length}
              >
                <option value="">Choose a sensor</option>
                {free.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sensorLabel(s, data)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      )}
      {error && (
        <p className="rv-error-box" role="alert">
          {error}
        </p>
      )}
      <p className="rv-muted rv-small">
        Position: {positionLabel(point.position)}
      </p>
    </Dialog>
  );
}
