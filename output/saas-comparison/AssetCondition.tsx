import { VitalsHistory } from "./VitalsHistory";
import { useState as e } from "react";
import type { Row } from "./data";
import {
  chartBuckets as t,
  readingZone as n,
  severityLimits as r,
  standardNames as i,
  velocityMax as a,
  zoneDurations as o,
} from "./assetMonitoring";
import { csvDownload as s } from "./assetContext";
const c = (e: unknown) =>
  e && !Number.isNaN(new Date(typeof e === `number` ? e : String(e)).valueOf())
    ? new Date(typeof e === `number` ? e : String(e)).toLocaleString()
    : `Not recorded`;
const l = (e: unknown) =>
  typeof e === `number` && Number.isFinite(e) ? e.toFixed(2) : `—`;
export function Zone({ zone: e }: { zone: string | null }) {
  return (
    <span className={`asset-zone zone-` + (e || `none`)}>
      {e ? `Zone ` + e + ` · indicative` : `No data`}
    </span>
  );
}
export function MonitoringChart({
  readings: e,
  metric: n,
  limits: r,
  events: i = [],
  hourly: a = false,
}: {
  readings: Row[];
  metric: string;
  limits?: Row;
  events?: Row[];
  hourly?: boolean;
}) {
  const o = t(e, a, n);
  if (!o.length)
    return (
      <div className="asset-blank">
        <p>
          No readings in this range. Connect a sensor or select another time
          range.
        </p>
      </div>
    );
  const s =
    n === `v_max` || [`vx`, `vy`, `vz`].includes(n)
      ? [r?.zone_a_max, r?.zone_b_max, r?.zone_c_max]
          .map(Number)
          .filter(Number.isFinite)
      : [];
  const l = Math.min(0, ...o.map((e) => e.value)),
    u = Math.max(l + 1, ...o.map((e) => e.max), ...s) * 1.1,
    d = o[0].at,
    f = o.at(-1)!.at;
  const p = (e: number) => ((e - d) / (f - d || 1)) * 700,
    m = (e: number) => 175 - ((e - l) / (u - l)) * 155;
  const h = i
    .map(
      (e) =>
        ({
          ...e,
          at: Date.parse(e.completed_at || e.started_at || e.created_at),
        }) as Row & { at: number },
    )
    .filter((e) => e.at >= d && e.at <= f);
  return (
    <>
      <div className="asset-signal-chart">
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="none"
          role="img"
          aria-label={n + ` recorded trend with maintenance markers`}
        >
          {[40, 100, 175].map((e) => (
            <path key={e} d={`M0 ` + e + `H700`} stroke="#e5edf5" />
          ))}
          {s.map((e, t) => (
            <g key={t}>
              <path
                d={`M0 ` + m(e) + `H700`}
                stroke={[`#20a988`, `#e2ae3b`, `#ec6f63`][t]}
                strokeDasharray="5 4"
              />
              <text x="6" y={m(e) - 4} fontSize="10" fill="#72859c">
                {[`A/B`, `B/C`, `C/D`][t]} {e} mm/s
              </text>
            </g>
          ))}
          {h.map((e) => (
            <g key={e.id}>
              <title>{e.title + ` · ` + c(e.at)}</title>
              <path
                d={`M` + p(e.at) + ` 10V185`}
                stroke="#9b76db"
                strokeDasharray="3 4"
              />
              <circle cx={p(e.at)} cy="185" r="4" fill="#9b76db" />
            </g>
          ))}
          {a && (
            <polyline
              points={o.map((e) => p(e.at) + `,` + m(e.max)).join(` `)}
              fill="none"
              stroke="#e1a04c"
              strokeWidth="1.5"
            />
          )}
          <polyline
            points={o.map((e) => p(e.at) + `,` + m(e.value)).join(` `)}
            fill="none"
            stroke="#1479ed"
            strokeWidth="2.5"
          />
          {o.length === 1 && (
            <circle cx="0" cy={m(o[0].value)} r="4" fill="#1479ed" />
          )}
        </svg>
        <div className="asset-chart-times">
          <span>{c(d)}</span>
          <span>{c(f)}</span>
        </div>
      </div>
      <p className="asset-small-note">
        {a
          ? `Blue: hourly average · amber: hourly maximum. `
          : `Blue: recorded measurements. `}
        {h.length ? `Purple: maintenance events. ` : ``}Zone limits are
        indicative.
      </p>
    </>
  );
}
export function MonitoringOverview({
  asset,
  readings,
  limits,
  onSetup,
  onTrends,
  sensor,
  baselines = [],
  alerts = [],
  gateway,
  baselineError,
}: {
  asset: Row;
  readings: Row[];
  limits: Row[];
  sampling: number;
  sensor?: Row;
  baselines?: Row[];
  alerts?: Row[];
  gateway?: Row;
  baselineError?: string;
  onSetup: () => void;
  onTrends: () => void;
}) {
  return (
    <>
      <VitalsHistory
        assetScreen
        sensor={sensor}
        baselines={baselines}
        alerts={alerts}
        gateway={gateway}
        baselineError={baselineError}
        asset={asset}
        readings={readings}
        velocityLimit={r(asset, limits)?.zone_b_max}
        velocityLimitCD={r(asset, limits)?.zone_c_max}
        limitLabel={r(asset, limits)?.description}
        from={new Date(Date.now() - 30 * 864e5).toISOString()}
        to={new Date().toISOString()}
      />
      <div className="pm-overview-actions">
        <button className="button secondary compact" onClick={onSetup}>
          Configure monitoring
        </button>
        <button className="text-button" onClick={onTrends}>
          Explore collected trends →
        </button>
      </div>
    </>
  );
}
export type TimeRange = { range: string; from: string; to: string };
export function MonitoringTrends({
  asset: t,
  readings: n,
  limits: i,
  events: o,
  range: c,
  onRange: u,
  sensor,
  baselines = [],
  alerts = [],
  gateway,
}: {
  asset: Row;
  readings: Row[];
  limits: Row[];
  events: Row[];
  sensor?: Row;
  baselines?: Row[];
  alerts?: Row[];
  gateway?: Row;
  range: TimeRange;
  onRange: (e: TimeRange) => void;
}) {
  const [d, f] = e(`v_max`),
    [p, m] = e(``),
    [h, g] = e(``),
    [_, v] = e(``);
  const y = n
    .filter((e) => ![`bad`, `invalid`, `error`].includes(e.quality))
    .map((e) => (d === `v_max` ? a(e) : e[d]))
    .filter((e) => typeof e === `number` && Number.isFinite(e)) as number[];
  const b =
    d === `temperature_c`
      ? `°C`
      : d.startsWith(`d`)
        ? `µm`
        : d.startsWith(`a`)
          ? `m/s²`
          : `mm/s`;
  function x(e: string) {
    if (e === `custom`) {
      u({ ...c, range: e });
      return;
    }
    const t = e === `24h` ? 1 : e === `7d` ? 7 : e === `6m` ? 183 : 30;
    u({
      range: e,
      from: new Date(Date.now() - t * 864e5).toISOString(),
      to: new Date().toISOString(),
    });
  }
  return (
    <section className="panel asset-section">
      <h2>Trends</h2>
      <VitalsHistory
        sensor={sensor}
        baselines={baselines}
        alerts={alerts}
        gateway={gateway}
        asset={t}
        readings={n}
        from={c.from}
        to={c.to}
        velocityLimit={r(t, i)?.zone_b_max}
        velocityLimitCD={r(t, i)?.zone_c_max}
        limitLabel={r(t, i)?.description}
        onDays={(days) =>
          x(
            days === 1
              ? `24h`
              : days === 7
                ? `7d`
                : days === 183
                  ? `6m`
                  : `30d`,
          )
        }
      />
      <div className="asset-data-filters">
        <label>
          Time range
          <select
            aria-label="Trend time range"
            value={c.range}
            onChange={(e) => x(e.target.value)}
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="6m">6 months</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          Metric
          <select
            aria-label="Trend metric"
            value={d}
            onChange={(e) => f(e.target.value)}
          >
            {[
              [`v_max`, `Maximum velocity`],
              [`vx`, `Velocity X`],
              [`vy`, `Velocity Y`],
              [`vz`, `Velocity Z`],
              [`dx`, `Displacement X`],
              [`dy`, `Displacement Y`],
              [`dz`, `Displacement Z`],
              [`ax`, `Acceleration X`],
              [`ay`, `Acceleration Y`],
              [`az`, `Acceleration Z`],
              [`temperature_c`, `Temperature`],
            ].map(([e, t]) => (
              <option key={e} value={e}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary compact"
          disabled={!n.length}
          onClick={() =>
            s(
              `revuptime-trends`,
              [
                `Time`,
                `v_max`,
                `vx`,
                `vy`,
                `vz`,
                `dx`,
                `dy`,
                `dz`,
                `ax`,
                `ay`,
                `az`,
                `temperature_c`,
                `quality`,
              ],
              n.map((e) => [
                e.timestamp,
                a(e),
                ...[
                  `vx`,
                  `vy`,
                  `vz`,
                  `dx`,
                  `dy`,
                  `dz`,
                  `ax`,
                  `ay`,
                  `az`,
                  `temperature_c`,
                  `quality`,
                ].map((t) => e[t]),
              ]),
            )
          }
        >
          Export CSV
        </button>
      </div>
      {c.range === `custom` && (
        <form
          className="asset-data-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const t = Date.parse(p),
              n = Date.parse(h);
            if (
              !Number.isFinite(t) ||
              !Number.isFinite(n) ||
              t >= n ||
              n > Date.now()
            ) {
              v(`Choose a past start and end, with end after start.`);
              return;
            }
            v(``);
            u({
              range: `custom`,
              from: new Date(t).toISOString(),
              to: new Date(n).toISOString(),
            });
          }}
        >
          <label>
            From
            <input
              aria-label="Trend from"
              type="datetime-local"
              required
              value={p}
              onChange={(e) => m(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Trend to"
              type="datetime-local"
              required
              value={h}
              onChange={(e) => g(e.target.value)}
            />
          </label>
          <button className="button compact">Apply range</button>
        </form>
      )}
      {_ && (
        <p role="alert" className="form-error">
          {_}
        </p>
      )}
      <MonitoringChart
        readings={n}
        metric={d}
        limits={r(t, i)}
        events={o}
        hourly={Date.parse(c.to) - Date.parse(c.from) > 864e5}
      />
      <div className="asset-reading-grid">
        {[
          [
            `Average`,
            y.length ? y.reduce((e, t) => e + t, 0) / y.length : null,
          ],
          [`Maximum`, y.length ? Math.max(...y) : null],
          [`Minimum`, y.length ? Math.min(...y) : null],
        ].map(([e, t]) => (
          <article key={String(e)}>
            <small>{String(e)}</small>
            <strong>
              {l(t)} <span>{b}</span>
            </strong>
          </article>
        ))}
      </div>
      <p className="asset-small-note">
        Statistics and hourly averages/maxima use loaded readings only (up to
        10,000).{" "}
        {n.length >= 1e4
          ? `Limit reached: narrow the range to avoid incomplete statistics. `
          : ``}
        Frequency spectrum unavailable: this sensor reports overall values, not
        waveform data.
      </p>
    </section>
  );
}
