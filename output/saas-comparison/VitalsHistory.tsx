import { axisValue, readingAgeState, sensorBaseline } from "./assetVitalsState";
import { useEffect, useState } from "react";
import { Sparkles, ArrowUpRight, Activity, Info } from "lucide-react";
import type { Row } from "./data";
import { vitalReference, vitalValue } from "./vitalReadability";
import "./premium-machine.css";

type Props = {
  readings: Row[];
  from: string;
  to: string;
  velocityLimit?: number;
  velocityLimitCD?: number;
  limitLabel?: string;
  onDays?: (days: number) => void;
  asset?: Row;
  alerts?: Row[];
  onAsk?: () => void;
  onWorkOrder?: () => void;
  assetScreen?: boolean;
  sensor?: Row;
  gateway?: Row;
  baselines?: Row[];
  baselineError?: string;
};
const definitions = [
  ["vy", "Vibration velocity", "mm/s RMS · Y"],
  ["ay", "Acceleration", "m/s² · Y"],
  ["dy", "Displacement", "µm · Y"],
  ["temperature_c", "Bearing temperature", "°C"],
];
const format = (value: number | null, digits = 2) =>
  value === null ? "—" : value.toFixed(digits);
export function VitalsHistory({
  readings,
  from,
  to,
  velocityLimit,
  velocityLimitCD,
  limitLabel,
  onDays,
  asset,
  alerts = [],
  onAsk,
  onWorkOrder,
  assetScreen = false,
  sensor,
  gateway,
  baselines = [],
  baselineError,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [days, setDays] = useState(() =>
    Math.max(
      1,
      Math.round((Date.parse(to) - Date.parse(from)) / 86400000) || 30,
    ),
  );
  useEffect(() => {
    if (onDays)
      setDays(
        Math.max(
          1,
          Math.round((Date.parse(to) - Date.parse(from)) / 86400000) || 30,
        ),
      );
  }, [from, to, Boolean(onDays)]);
  const [selected, setSelected] = useState<number | null>(null);
  const anchor =
    onDays && Number.isFinite(Date.parse(to)) ? Date.parse(to) : now;
  const start =
    onDays && Number.isFinite(Date.parse(from))
      ? Date.parse(from)
      : anchor - days * 86400000;
  const rows = readings
    .filter((row) => {
      const at = Date.parse(row.timestamp);
      return (
        at >= start &&
        at <= anchor &&
        !["bad", "invalid", "error"].includes(row.quality)
      );
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const latest = [...readings].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  )[0];
  const ageState = readingAgeState(latest, now);
  const displayValue = (row: Row | undefined, field: string) =>
    axisValue(row, field, sensor);
  const referenceFor = (field: string) =>
    sensorBaseline(baselines, sensor?.id, field);
  const limit = velocityLimit;
  const velocity = displayValue(latest, "vy");
  const fresh = ageState.fresh;
  const score = !fresh
    ? null
    : fresh && velocity !== null && limit && limit > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (40 * velocity) / limit)))
      : null;
  const status = !fresh
    ? ageState.age === null
      ? "No data"
      : "Stale"
    : score === null
      ? "Not assessed"
      : score >= 75
        ? "Normal"
        : score >= 40
          ? "Watch"
          : "Act";
  const points = rows
    .map((row) => ({
      at: Date.parse(row.timestamp),
      value: displayValue(row, "vy"),
    }))
    .filter(
      (point): point is { at: number; value: number } => point.value !== null,
    );
  const reference = referenceFor("vy");
  const max = Math.max(
    7.2,
    ...points.map((point) => point.value),
    limit || 0,
    reference?.high || 0,
  );
  const x = (at: number) => 45 + ((at - start) / (anchor - start)) * 950;
  const y = (value: number) => 220 - (value / max) * 195;
  const date = (at: number) =>
    new Date(at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  const events: Row[] = [...alerts]
    .sort(
      (a, b) =>
        Date.parse(b.detected_at || b.created_at) -
        Date.parse(a.detected_at || a.created_at),
    )
    .slice(0, 4);
  const active = points.find((point) => point.at === selected);
  return (
    <section className="premium-machine">
      <header className="pm-header">
        <div>
          <div className="pm-breadcrumb">
            Assets / {asset?.site_name || "Selected site"}
          </div>
          <h1>{asset?.name || "Selected machine"}</h1>
          <p>
            <span className={"pm-pill " + (fresh ? "green" : "amber")}>
              {ageState.label} ·{" "}
              {ageState.age === null
                ? "not recorded"
                : `${Math.floor(ageState.age / 60000)} min ago`}
            </span>{" "}
            {asset?.vibration_standard?.replaceAll("_", " ").toUpperCase() ||
              "Machine standard not configured"}{" "}
            · {sensor?.name || "No sensor linked"} {gateway?.name || ""}
          </p>
        </div>
        <div className="pm-actions">
          {onAsk && <button onClick={onAsk}>Ask about this machine</button>}
          {onWorkOrder && (
            <button className="primary" onClick={onWorkOrder}>
              Create work order
            </button>
          )}
        </div>
      </header>
      <div className="pm-top-grid">
        <article className="pm-card pm-health">
          <div className="pm-ring">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#edf1f6"
                strokeWidth="8"
              />
              <circle
                style={{ visibility: score === null ? "hidden" : "visible" }}
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#d77c00"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(score || 0) * 2.7} 270`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div>
              <strong>{score ?? "—"}</strong>
              <small>of 100</small>
            </div>
          </div>
          <div>
            <span className="pm-muted">Machine health</span>
            <h2 className="pm-amber">{status}</h2>
            <p>
              {!fresh
                ? "Current machine condition is unknown. The last reading is older than 15 minutes or unavailable."
                : score === null
                  ? "A fresh reading and configured velocity limit are needed."
                  : "Indicative score based on current velocity and the configured limit."}
            </p>
            <span
              tabIndex={0}
              className="pm-info"
              title="Collected health score is 100 minus 40 times velocity Y divided by the B/C limit, clamped to 0–100. This is an indicative display score, not an ISO score."
            >
              <Info size={14} />
            </span>
          </div>
        </article>
        <article className="pm-insight">
          <span>
            <Sparkles size={15} />{" "}
            {!fresh ? "STALE DATA" : "MEASUREMENT INSIGHT"}
          </span>
          <h3>
            {!fresh
              ? "Live insight paused. The latest reading is older than 15 minutes or unavailable; current machine health cannot be assessed."
              : velocity !== null
                ? `Latest Y-axis velocity is ${format(velocity)} mm/s${limit ? `, ${velocity > limit ? "above" : "within"} the configured B/C limit.` : ". Configure machine limits to assess severity."}`
                : "No Y-axis velocity measurements are available in this period."}
          </h3>
          <p>
            {!fresh
              ? "Check sensor power, gateway connectivity, and ingestion. Historical measurements remain available below."
              : "Review the measurements and machine operating conditions before deciding on maintenance."}
          </p>
          <a
            href="#pm-evidence"
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById("pm-evidence")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            See the evidence
          </a>
        </article>
        <div className="pm-stats">
          {[
            ["Days to C/D limit", "—", "No validated forecast"],
            [
              "Open alerts",
              String(
                alerts.filter(
                  (row) =>
                    !["resolved", "closed", "dismissed"].includes(row.status),
                ).length,
              ),
              "in available records",
            ],
            ["Run-hours today", "—", "Running history unavailable"],
            ["Uptime this week", "—", "Running history unavailable"],
          ].map(([label, value, note]) => (
            <article className="pm-card" key={label}>
              <span>{label}</span>
              <strong
                className={
                  label === "Open alerts" && value !== "0" ? "pm-red" : ""
                }
              >
                {value}
              </strong>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </div>
      <div className="pm-section-title">
        <h2>Machine vitals</h2>
        <span>
          {"Blue band = sensor baseline p05–p95"}{" "}
          <span
            tabIndex={0}
            title="the band uses sensor_baselines p05 and p95 for the selected sensor and metric. Zero-axis readings stay hidden until that register is verified. Values support investigation, not fault diagnosis."
          >
            ⓘ
          </span>
        </span>
      </div>
      <div className="pm-vitals">
        {definitions.map(([field, label, unit], index) => {
          const value = displayValue(latest, field);
          const ref = referenceFor(field);
          const state = !fresh
            ? "Stale"
            : value === null
              ? "No data"
              : index === 0 && limit && value > limit
                ? "Act"
                : ref
                  ? value > ref.high || value < ref.low
                    ? "Watch"
                    : "Normal"
                  : "Unassessed";
          const tone =
            state === "Act"
              ? "red"
              : state === "Watch"
                ? "amber"
                : state === "Normal"
                  ? "green"
                  : "neutral";
          const deviation =
            value !== null && ref && ref.normal !== null && ref.normal !== 0
              ? ((value - ref.normal) / Math.abs(ref.normal)) * 100
              : null;
          return (
            <article className={"pm-card pm-vital " + tone} key={field}>
              <div>
                <h3>{label}</h3>
                <span className={"pm-pill " + tone}>{state}</span>
              </div>
              <p className="pm-value">
                <strong className={"pm-value-" + tone}>
                  {format(value, index > 1 ? 1 : 2)}
                </strong>
                <span>{unit}</span>
              </p>
              <div className="pm-gauge">
                <span style={{ display: ref ? undefined : "none" }} />
                {index === 0 && ref && limit && (
                  <em
                    className="pm-limit-marker"
                    style={{
                      left: `${Math.max(5, Math.min(95, 30 + ((limit - ref.low) / (ref.high - ref.low)) * 30))}%`,
                    }}
                  />
                )}
                <i
                  style={{
                    display: !ref || value === null ? "none" : undefined,
                    left:
                      value !== null && ref
                        ? `${Math.max(5, Math.min(95, 30 + ((value - ref.low) / (ref.high - ref.low || 1)) * 30))}%`
                        : "50%",
                  }}
                />
              </div>
              <div className="pm-range-labels">
                {ref ? (
                  <>
                    <span>{format(ref.low, 1)}</span>
                    <span>{format(ref.high, 1)}</span>
                    {index === 0 && limit && <b>{limit} limit</b>}
                  </>
                ) : (
                  <span>Baseline not available</span>
                )}
              </div>
              <p>
                {deviation === null
                  ? "Normal range not established"
                  : `${Math.abs(deviation).toFixed(0)}% ${deviation >= 0 ? "above" : "below"} baseline median (${format(ref!.low)}–${format(ref!.high)})`}
              </p>
            </article>
          );
        })}
      </div>
      {baselineError && (
        <p className="pm-baseline-error" role="status">
          {baselineError} Baseline ranges are unavailable.
        </p>
      )}
      <article className="pm-card pm-chart" id="pm-evidence">
        <div className="pm-chart-heading">
          <div>
            <h2>Velocity trend · Y axis</h2>
            <p>
              Last {days === 1 ? "24 hours" : days + " days"} · mm/s RMS ·
              shaded band = {"sensor baseline p05–p95"}
            </p>
          </div>
          <div className="pm-periods">
            {[
              [1, "24 h"],
              [7, "7 d"],
              [30, "30 d"],
            ].map(([count, label]) => (
              <button
                key={label}
                aria-pressed={days === count}
                onClick={() => {
                  setDays(Number(count));
                  setSelected(null);
                  onDays?.(Number(count));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="pm-chart-legend">
          <span>━ Velocity Y</span>
          {reference && (
            <span>
              ▰ Normal band ({format(reference.low, 1)}–
              {format(reference.high, 1)})
            </span>
          )}
          {limit && <span className="pm-amber">┄ B/C {limit}</span>}
          {velocityLimitCD && (
            <span className="pm-red">┄ C/D {velocityLimitCD}</span>
          )}
          {limitLabel && <span>{limitLabel}</span>}
        </div>
        {points.length ? (
          <div className="pm-plot-viewport">
            <svg
              viewBox="0 0 1040 265"
              className="pm-chart-svg"
              role="img"
              aria-label="Y-axis velocity measurements over time with observed reference band and configured limit"
            >
              {reference && (
                <rect
                  x="45"
                  y={y(reference.high)}
                  width="950"
                  height={Math.max(2, y(reference.low) - y(reference.high))}
                  fill="#dce6fc"
                />
              )}
              {[0, max / 2, max].map((value) => (
                <g key={value}>
                  <text
                    x="35"
                    y={y(value) + 4}
                    textAnchor="end"
                    fill="#637695"
                    fontSize="11"
                  >
                    {value.toFixed(1)}
                  </text>
                  <path d={`M45 ${y(value)}H995`} stroke="#edf1f7" />
                </g>
              ))}
              {limit && limit > 0 && (
                <g>
                  <path
                    d={`M45 ${y(limit)}H995`}
                    stroke="#b45309"
                    strokeDasharray="5 5"
                  />
                  <text
                    x="987"
                    y={y(limit) - 6}
                    textAnchor="end"
                    fill="#92400e"
                    fontSize="12"
                  >
                    B/C {limit}
                  </text>
                </g>
              )}
              {velocityLimitCD &&
                velocityLimitCD > 0 &&
                y(velocityLimitCD) > 0 && (
                  <g>
                    <path
                      d={`M45 ${y(velocityLimitCD)}H995`}
                      stroke="#c12735"
                      strokeDasharray="5 5"
                    />
                    <text
                      x="987"
                      y={y(velocityLimitCD) - 6}
                      textAnchor="end"
                      fill="#bd2332"
                      fontSize="12"
                    >
                      C/D {velocityLimitCD}
                    </text>
                  </g>
                )}
              <polyline
                points={points
                  .map((point) => `${x(point.at)},${y(point.value)}`)
                  .join(" ")}
                fill="none"
                stroke="#2864ed"
                strokeWidth="2.4"
              />
              {points.map((point) => (
                <circle
                  key={point.at}
                  cx={x(point.at)}
                  cy={y(point.value)}
                  r={points.length === 1 ? 4 : 7}
                  fill={points.length === 1 ? "#2864ed" : "transparent"}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    date(point.at) + " " + format(point.value) + " mm/s"
                  }
                  onFocus={() => setSelected(point.at)}
                  onClick={() => setSelected(point.at)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSelected(point.at);
                  }}
                >
                  <title>
                    {date(point.at)} · {format(point.value)} mm/s
                  </title>
                </circle>
              ))}
              {Array.from(
                { length: days === 7 ? 8 : 5 },
                (_, index) => index,
              ).map((index, _, ticks) => {
                const fraction = index / (ticks.length - 1),
                  at = start + fraction * (anchor - start);
                return (
                  <text
                    key={index}
                    x={45 + fraction * 950}
                    y="250"
                    textAnchor={
                      index === 0
                        ? "start"
                        : index === ticks.length - 1
                          ? "end"
                          : "middle"
                    }
                    fontSize="11"
                    fill="#637695"
                  >
                    {days === 1
                      ? new Date(at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : date(at)}
                  </text>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="pm-empty">
            No valid Y-axis readings in this period. Choose a longer range or
            check sensor ingestion.
          </div>
        )}
        {active && (
          <p className="pm-point-detail" aria-live="polite">
            {new Date(active.at).toLocaleString()} · {format(active.value)} mm/s
            RMS
          </p>
        )}
      </article>
      <article className="pm-card pm-events">
        <h2>Recent events</h2>
        {events.length ? (
          events.map((event) => (
            <div className="pm-event" key={event.id}>
              <span
                className={
                  "pm-event-dot " +
                  (event.severity === "critical"
                    ? "red"
                    : event.severity === "warning"
                      ? "amber"
                      : "green")
                }
              />
              <div>
                <strong>{event.title}</strong>
                <small>
                  {new Date(
                    event.detected_at || event.created_at,
                  ).toLocaleString()}
                  {event.detail ? " · " + event.detail : ""}
                </small>
              </div>
            </div>
          ))
        ) : (
          <p className="pm-muted">No recorded alerts for this machine.</p>
        )}
      </article>
      <footer className="pm-footer">
        {
          "Collected sensor measurements · missing values are shown as — · historical readings are not a live health assessment"
        }
      </footer>
    </section>
  );
}
