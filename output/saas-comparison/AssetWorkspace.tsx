import { AssetPointsSection } from "./onboarding/MeasurementPoints";
import {
  useEffect as e,
  useMemo as t,
  useRef as n,
  useState as r,
} from "react";
import {
  LayoutDashboard,
  Info,
  Clock3,
  Wrench,
  Activity,
  ArrowLeft,
  ArrowDownToLine,
  Bell,
  Building2,
  ChevronRight,
  Cpu,
  FileText,
  Link2,
  Plus,
  Radio,
  RefreshCw,
  Search,
} from "lucide-react";
import type { Dataset, Row } from "./data";
import { human as i, label as a } from "./data";
import {
  assetConnection as o,
  assetContext as s,
  csvDownload as c,
  sensorConnection as l,
  sensorDefaults as u,
} from "./assetContext";
import "./asset-workspace.css";
import {
  assetTabs as p,
  parseAssetRoute as m,
  readingZone as h,
  severityLimits as g,
  standardNames as _,
  velocityMax as v,
  worseZoneCandidate as y,
  zoneSince as b,
} from "./assetMonitoring";
import { AssetClassification } from "./AssetClassification";
import { AssetSetup } from "./AssetSetup";
import { AssetDetailLoader } from "./AssetDetailLoader";
import { AssetsListPage } from "./onboarding/AssetsListPage";
import {
  Zone,
  MonitoringChart,
  MonitoringOverview,
  MonitoringTrends,
  type TimeRange,
} from "./AssetCondition";
const x = p;
const S = (e: unknown) =>
  e && !Number.isNaN(Date.parse(String(e)))
    ? new Date(String(e)).toLocaleString()
    : `Not recorded`;
const w = (e: Row) => ![`resolved`, `dismissed`, `closed`].includes(e.status);
function State({ value: e }: { value: unknown }) {
  const t = String(e || `unknown`);
  return <span className={`asset-state state-` + t}>{i(t)}</span>;
}
function Blank({ text: e }: { text: string }) {
  return (
    <div className="asset-blank">
      <Activity size={27} />
      <p>{e}</p>
    </div>
  );
}
function T() {
  return m(location.pathname, location.hash);
}
type Props = {
  data: Dataset;
  demo: boolean;
  onSave: (e: string, t: Row, n?: Row) => Promise<Row>;
  onAcknowledge: (e: Row) => Promise<void>;
  onDemoReadings: (e: Row[]) => void;
  onInspect: (e: string, t: Row) => void;
  onEdit: (e: string, t: Row) => void;
  onRefresh: () => void;
  onUpload: (e: File, t: Row) => void;
  onOpenDocument: (e: Row) => void;
  uploading: boolean;
  loading: boolean;
  canWrite?: boolean;
  orgId?: string;
  siteId?: string;
  notify?: (text: string, error?: boolean) => void;
  onAddSensor?: (siteId: string) => void;
};
export function AssetWorkspace(n: Props) {
  const { onEdit: a, onRefresh: l } = n;
  const u = n.data;
  const [p, m] = r(false);
  const [h, g] = r(T),
    [_, v] = r(``),
    [y, b] = r(`all`),
    [x, w] = r(`name`),
    [E, O] = r(0),
    [k, j] = r(10);
  e(() => {
    const e = () => g(T());
    window.addEventListener(`popstate`, e);
    window.addEventListener(`hashchange`, e);
    return () => {
      window.removeEventListener(`popstate`, e);
      window.removeEventListener(`hashchange`, e);
    };
  }, []);
  e(() => O(0), [_, y, k, u]);
  function M(e = ``, t = `Overview`) {
    const n = e
      ? `/assets/` + encodeURIComponent(e) + `/` + t.toLowerCase()
      : `/mvp#assets`;
    history.pushState(null, ``, n);
    g({ id: e, section: t });
    window.scrollTo({ top: 0 });
  }
  const N = t(
    () =>
      (u.assets || [])
        .filter((e) => {
          const t = s(e, u);
          return (
            (y === `all` || e.status === y) &&
            [
              e.name,
              e.asset_code,
              e.asset_type,
              t.site?.name,
              t.parent?.name,
            ].some((e) =>
              String(e || ``)
                .toLowerCase()
                .includes(_.toLowerCase()),
            )
          );
        })
        .sort((e, t) =>
          x === `updated_at`
            ? (Date.parse(t.updated_at || t.created_at) || 0) -
              (Date.parse(e.updated_at || e.created_at) || 0)
            : String(e[x] || ``).localeCompare(String(t[x] || ``)),
        ),
    [u, y, _, x],
  );
  const P = (u.assets || []).find((e) => e.id === h.id);
  if (h.id && !P)
    return (
      <section className="panel asset-unavailable">
        <button className="button secondary" onClick={() => M()}>
          <ArrowLeft size={16} /> All assets
        </button>
        <h1>
          {n.loading ? `Loading asset…` : `Asset unavailable in this view`}
        </h1>
        <p>
          Change the site filter or choose an asset from your current workspace.
        </p>
      </section>
    );
  if (p)
    return (
      <AssetSetup
        data={u}
        onSave={n.onSave}
        onClose={() => m(false)}
        onDone={(e) => {
          m(false);
          M(e);
        }}
      />
    );
  if (P)
    return (
      <AssetDetailLoader
        key={P.id}
        asset={P}
        data={u}
        demo={n.demo}
        section={h.section}
      >
        {(e, t, r) => (
          <AssetDetail
            {...n}
            data={e}
            asset={P}
            section={h.section}
            range={t}
            onRange={r}
            onRoute={M}
          />
        )}
      </AssetDetailLoader>
    );
  const rvSite = n.siteId || ``;
  return (
    <div className="asset-workspace">
      <AssetsListPage
        orgId={n.orgId || ``}
        siteId={rvSite}
        sites={u.sites || []}
        canWrite={!!n.canWrite}
        demo={n.demo}
        onOpen={(id) => M(id)}
        onAdd={() => a(`assets`, {})}
        onAddSensor={(id) => n.onAddSensor?.(id)}
        notify={(text, error) => n.notify?.(text, error)}
        onImport={async (rows) => {
          const site = rvSite || (u.sites || [])[0]?.id;
          if (!site) throw new Error(`Add a plant first.`);
          for (const row of rows)
            await n.onSave(`assets`, {
              ...row,
              organization_id: n.orgId,
              site_id: site,
              status: `active`,
            });
        }}
      />
    </div>
  );
}
function AssetDetail({
  asset: e,
  section: t,
  onRoute: c,
  data: d,
  onInspect: f,
  onEdit: p,
  onRefresh: m,
  onUpload: _,
  onOpenDocument: v,
  uploading: T,
  loading: E,
  onSave: O,
  onAcknowledge: k,
  onDemoReadings: j,
  range: M,
  onRange: N,
  demo: P,
  canWrite: rvCanWrite,
}: Props & {
  asset: Row;
  section: string;
  range: TimeRange;
  onRange: (e: TimeRange) => void;
  onRoute: (e?: string, t?: string) => void;
}) {
  const loadState = d.asset_load_state?.[0];
  const pending = Boolean(loadState?.blocked);
  const F = s(e, d),
    I = F.alerts.filter((e) => e.status === `open`),
    L = d.vibration_severity_limits || [];
  const [ee, R] = r(false),
    [z, B] = r(``),
    [te, V] = r(false);
  const H = n(false);
  const [ne, U] = r(``),
    [W, re] = r(`all`),
    [G, ie] = r(`all`),
    [K, ae] = r(`all`);
  const q = F.sensors.find((e) => e.id === ne) || F.sensors[0],
    J = F.readings.filter((e) => !q || e.sensor_id === q.id),
    oe = J[0],
    Y = q?.sampling_interval_seconds || 60;
  const se = F.readings.filter(
    (e) =>
      (!q || e.sensor_id === q.id) &&
      (W === `all` ||
        Date.parse(e.timestamp) >=
          Date.now() - (W === `24h` ? 24 : 168) * 36e5),
  );
  const ce = se.filter(
      (e) => typeof e.value === `number` && Number.isFinite(e.value),
    ),
    X = ce[0];
  function le(e: string, t: Row) {
    e === `assets` ? c(t.id) : f(e, t);
  }
  function ue(e: string, t: Row[]) {
    return t.length ? (
      <div className="asset-related-list">
        {t.map((t) => (
          <button key={t.id} onClick={() => le(e, t)}>
            <span className="asset-mini-icon">
              {e === `sensors` ? (
                <Radio size={17} />
              ) : e === `asset_documents` ? (
                <FileText size={17} />
              ) : (
                <Link2 size={17} />
              )}
            </span>
            <span>
              <strong>{a(t)}</strong>
              <small>
                {t.sensor_code ||
                  t.asset_code ||
                  i(t.status || t.document_type || e)}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    ) : (
      <Blank text="No linked records yet." />
    );
  }
  const Q = async (e: () => Promise<unknown>) => {
    if (H.current) return;
    H.current = true;
    V(true);
    B(``);
    try {
      await e();
      m();
    } catch (e) {
      B(e instanceof Error ? e.message : `Could not save this change.`);
    } finally {
      H.current = false;
      V(false);
    }
  };
  const $ = F.sensors
    .map((t) => ({
      sensor: t,
      evidence: y(
        F.readings.filter((e) => e.sensor_id === t.id),
        e,
        L,
        t.sampling_interval_seconds || 60,
      ),
    }))
    .find(
      (e) =>
        e.evidence &&
        !F.alerts.some(
          (t) =>
            t.sensor_id === e.sensor.id &&
            w(t) &&
            t.evidence?.zone === e.evidence!.zone,
        ),
    );
  const de = () => p(`sensors`, u(e, F.gateways));
  function fe() {
    const e = ce.slice(0, 100).reverse(),
      t = Math.min(...e.map((e) => e.value)),
      n = Math.max(...e.map((e) => e.value)),
      r = n - t || 1;
    return e.length > 1 ? (
      <div className="asset-signal-chart">
        <div className="asset-chart-range">
          <span>
            {n.toFixed(2)} {q?.unit}
          </span>
          <span>
            {t.toFixed(2)} {q?.unit}
          </span>
        </div>
        <svg
          viewBox="0 0 700 180"
          role="img"
          aria-label={
            `Recorded ` + (q?.measurement_type || `sensor`) + ` trend`
          }
          preserveAspectRatio="none"
        >
          <path
            d="M0 30H700 M0 90H700 M0 150H700"
            stroke="#e4ebf4"
            fill="none"
          />
          <polyline
            points={e
              .map(
                (n, i) =>
                  (i / (e.length - 1)) * 700 +
                  `,` +
                  (155 - ((n.value - t) / r) * 130),
              )
              .join(` `)}
            fill="none"
            stroke="#1479ed"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="asset-chart-times">
          <span>{S(e[0]?.timestamp)}</span>
          <span>{S(e.at(-1)?.timestamp)}</span>
        </div>
      </div>
    ) : (
      <Blank
        text={
          e.length
            ? `One reading recorded. A trend appears after a second measurement.`
            : `No measurements recorded for this sensor and time range.`
        }
      />
    );
  }
  const pe = [
    {
      id: e.id,
      title: `Asset registered`,
      at: e.created_at,
      table: `assets`,
      row: e,
    },
    ...F.maintenance.map((e) => ({
      id: e.id,
      title: e.title || `Maintenance event`,
      at: e.completed_at || e.started_at || e.created_at,
      table: `maintenance_events`,
      row: e,
    })),
    ...F.orders.map((e) => ({
      id: e.id,
      title: e.title || `Work order`,
      at: e.updated_at || e.created_at,
      table: `work_orders`,
      row: e,
    })),
    ...F.updates.map((e) => ({
      id: e.id,
      title: e.message || i(e.update_type || `Work order update`),
      at: e.created_at,
      table: `work_order_updates`,
      row: e,
    })),
    ...F.alerts.map((e) => ({
      id: e.id,
      title: e.title || `Alert detected`,
      at: e.detected_at || e.created_at,
      table: `alerts`,
      row: e,
    })),
    ...F.alerts.flatMap((e) => [
      ...(e.acknowledged_at
        ? [
            {
              id: e.id + `-ack`,
              title: `Acknowledged: ` + e.title,
              at: e.acknowledged_at,
              table: `alerts`,
              row: e,
            },
          ]
        : []),
      ...(e.resolved_at
        ? [
            {
              id: e.id + `-resolved`,
              title: `Resolved: ` + e.title,
              at: e.resolved_at,
              table: `alerts`,
              row: e,
            },
          ]
        : []),
    ]),
    ...F.deviceStatus.map((e) => ({
      id: e.id,
      title: `Device ` + e.status,
      at: e.recorded_at,
      table: `device_status`,
      row: e,
    })),
  ].sort((e, t) => (Date.parse(t.at) || 0) - (Date.parse(e.at) || 0));
  if (ee)
    return (
      <AssetSetup
        data={d}
        asset={e}
        onSave={O}
        onClose={() => R(false)}
        onDone={(e) => {
          R(false);
          c(e, `Overview`);
          m();
        }}
      />
    );
  return (
    <div className="asset-detail-page">
      <header className="asset-detail-header">
        <button className="text-button" onClick={() => c()}>
          <ArrowLeft size={17} /> All assets
        </button>
        <span className="asset-header-divider" />
        <div className="asset-header-title">
          <span>ASSET WORKSPACE</span>
          <strong>{e.name}</strong>
        </div>
        <div className="asset-header-actions">
          <button className="button secondary compact" onClick={m} disabled={E}>
            <RefreshCw size={15} />
            {E ? `Refreshing…` : `Refresh`}
          </button>
          <button className="button compact" onClick={() => p(`assets`, e)}>
            Edit asset
          </button>
        </div>
      </header>
      <div className="asset-detail-layout asset-detail-fullwidth">
        <section className="asset-detail-main">
          <nav
            className="asset-detail-tabs"
            aria-label="Asset sections"
            role="tablist"
            onKeyDown={(event) => {
              const tabs = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const index = tabs.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              tabs[next]?.focus();
              tabs[next]?.click();
              tabs[next]?.scrollIntoView({
                block: "nearest",
                inline: "nearest",
              });
            }}
          >
            {x.map((n) => {
              const icons: Record<string, typeof Activity> = {
                Overview: LayoutDashboard,
                Details: Info,
                Alerts: Bell,
                Maintenance: Wrench,
                Sensors: Radio,
                Trends: Activity,
                Documents: FileText,
                Timeline: Clock3,
              };
              const Icon = icons[n];
              return (
                <button
                  type="button"
                  key={n}
                  id={"asset-tab-" + n.toLowerCase()}
                  aria-controls="asset-section-panel"
                  tabIndex={t === n ? 0 : -1}
                  role="tab"
                  aria-selected={t === n}
                  className={t === n ? `active` : ``}
                  onClick={() => c(e.id, n)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="asset-tab-label">{n}</span>
                  {n === `Sensors` && (
                    <span
                      className="asset-tab-count"
                      aria-label={F.sensors.length + " sensors"}
                    >
                      {F.sensors.length}
                    </span>
                  )}
                  {n === `Alerts` && (
                    <span
                      className={
                        "asset-tab-count " + (I.length ? "has-alerts" : "")
                      }
                      aria-label={I.length + " open alerts"}
                    >
                      {I.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div
            className="asset-tab-body"
            id="asset-section-panel"
            role="tabpanel"
            aria-labelledby={"asset-tab-" + t.toLowerCase()}
          >
            {F.sensors.length > 1 && (
              <label className="asset-monitor-selector">
                Monitoring sensor
                <select
                  aria-label="Monitoring sensor"
                  value={q?.id || ``}
                  onChange={(e) => U(e.target.value)}
                >
                  {F.sensors.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.sensor_code || e.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {loadState?.loading && (
              <div
                className="asset-loading-state"
                role="status"
                aria-live="polite"
              >
                <span className="asset-loading-spinner" />
                <strong>Loading {t.toLowerCase()}…</strong>
                <p>Fetching this asset’s records.</p>
              </div>
            )}
            {loadState?.error && (
              <div className="copilot-save-error" role="alert">
                {loadState.error}
                <button
                  className="text-button"
                  onClick={() => loadState.retry?.()}
                >
                  Retry loading
                </button>
              </div>
            )}
            {te && (
              <p className="asset-small-note" role="status">
                Saving changes…
              </p>
            )}
            {z && (
              <p className="form-error" role="alert">
                {z}
              </p>
            )}
            {!pending && t === `Overview` && (
              <AssetPointsSection
                key={e.id}
                asset={e}
                canWrite={rvCanWrite !== false}
                onWorkOrder={() =>
                  p(`work_orders`, { asset_id: e.id, site_id: e.site_id })
                }
                fallback={
                  <MonitoringOverview
                    sensor={q}
                    baselines={d.sensor_baselines || []}
                    alerts={F.alerts}
                    gateway={F.gateways[0]}
                    baselineError={d.baseline_errors?.[0]?.message}
                    asset={{ ...e, site_name: F.site?.name }}
                    readings={J}
                    limits={L}
                    sampling={Y}
                    onSetup={() => R(true)}
                    onTrends={() => c(e.id, `Trends`)}
                  />
                }
              />
            )}
            {!pending && t === `Details` && (
              <>
                <AssetClassification
                  key={e.updated_at}
                  asset={e}
                  onSave={async (t) => {
                    await O(`assets`, t, e);
                    m();
                  }}
                />
                <section className="panel asset-section">
                  <h2>Asset details</h2>
                  <dl className="asset-properties">
                    {Object.entries(e)
                      .filter(
                        ([e, t]) =>
                          ![`id`, `organization_id`].includes(e) &&
                          t !== null &&
                          t !== undefined,
                      )
                      .map(([e, t]) => (
                        <div key={e}>
                          <dt>{i(e)}</dt>
                          <dd>
                            {e === `site_id` ? (
                              F.site?.name || `Not linked`
                            ) : e === `parent_asset_id` ? (
                              F.parent?.name || `Not linked`
                            ) : typeof t === `object` ? (
                              <pre>{JSON.stringify(t, null, 2)}</pre>
                            ) : /_at$/.test(e) ? (
                              S(t)
                            ) : (
                              String(t)
                            )}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </section>
              </>
            )}
            {!pending && t === `Sensors` && (
              <>
                <div className="asset-section-heading">
                  <div>
                    <h2>Linked sensors</h2>
                    <p>Devices monitoring {e.name}.</p>
                  </div>
                  <button className="button compact" onClick={de}>
                    <Plus size={16} /> Add sensor
                  </button>
                </div>
                {F.sensors.length ? (
                  <>
                    <div className="asset-sensor-grid">
                      {F.sensors.map((e) => {
                        const t = l(e, F.deviceStatus),
                          n = F.gateways.find((t) => t.id === e.gateway_id);
                        return (
                          <button
                            className={
                              `panel asset-sensor-card ` +
                              (q?.id === e.id ? `selected` : ``)
                            }
                            key={e.id}
                            onClick={() => U(e.id)}
                          >
                            <span className="asset-thumb">
                              <Radio size={25} />
                            </span>
                            <strong>{e.name}</strong>
                            <small>
                              {e.sensor_code ||
                                e.serial_number ||
                                `No device code`}
                            </small>
                            <State value={t.status} />
                            <span>
                              {i(
                                e.measurement_type || e.sensor_type || `Sensor`,
                              )}{" "}
                              · {e.unit || `No unit`}
                            </span>
                            <small>Gateway: {n?.name || `Not linked`}</small>
                            <small>
                              Registration: {i(e.status || `unknown`)}
                            </small>
                            <small>
                              Mount: {e.installation_location || `Not recorded`}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                    {q && (
                      <section className="panel asset-section">
                        <div className="asset-section-heading">
                          <div>
                            <h3>{q.name}</h3>
                            <p>
                              {q.sensor_code} · Status recorded{" "}
                              {S(l(q, F.deviceStatus).recordedAt)}
                            </p>
                          </div>
                          <div className="heading-buttons">
                            <button
                              className="button secondary compact"
                              onClick={() => f(`sensors`, q)}
                            >
                              Details
                            </button>
                            <button
                              className="button secondary compact"
                              onClick={() => p(`sensors`, q)}
                            >
                              Edit sensor
                            </button>
                            <button
                              className="button compact"
                              onClick={() => c(e.id, `Trends`)}
                            >
                              Explore data
                            </button>
                            <button
                              className="text-button"
                              disabled={q.status === `inactive`}
                              onClick={() =>
                                void Q(() =>
                                  O(`sensors`, { status: `inactive` }, q),
                                )
                              }
                            >
                              Deactivate sensor
                            </button>
                          </div>
                        </div>
                        <div className="asset-reading-summary">
                          <strong>
                            {X
                              ? X.value + ` ` + (X.unit || q.unit || ``)
                              : `No reading yet`}
                          </strong>
                          <span>
                            {X
                              ? S(X.timestamp)
                              : `Connect your ingestion pipeline to receive measurements.`}
                          </span>
                        </div>
                        <dl className="asset-properties">
                          {[
                            [`Model`, q.model],
                            [`Manufacturer`, q.manufacturer],
                            [`Serial number`, q.serial_number],
                            [`Mount location`, q.installation_location],
                            [
                              `Sampling interval`,
                              q.sampling_interval_seconds + ` s`,
                            ],
                            [`Modbus address`, q.configuration?.modbus_address],
                            [
                              `Last reading`,
                              S(
                                F.readings.find((e) => e.sensor_id === q.id)
                                  ?.timestamp,
                              ),
                            ],
                          ].map(([e, t]) => (
                            <div key={String(e)}>
                              <dt>{String(e)}</dt>
                              <dd>{String(t || `Not recorded`)}</dd>
                            </div>
                          ))}
                        </dl>
                        {F.gateways
                          .filter((e) => e.id === q.gateway_id)
                          .map((e) => (
                            <section
                              key={e.id}
                              className="asset-gateway-details"
                            >
                              <h3>Gateway: {e.name}</h3>
                              <dl className="asset-properties">
                                {[
                                  `gateway_code`,
                                  `model`,
                                  `status`,
                                  `last_seen_at`,
                                  `firmware_version`,
                                  `ip_address`,
                                  `mac_address`,
                                  `serial_number`,
                                ].map((t) => (
                                  <div key={t}>
                                    <dt>{i(t)}</dt>
                                    <dd>
                                      {t === `last_seen_at`
                                        ? S(e[t])
                                        : e[t] || `Not recorded`}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                              <p className="asset-small-note">
                                LTE signal:{" "}
                                {F.deviceStatus.find(
                                  (t) => t.gateway_id === e.id,
                                )?.signal_strength ??
                                  `Not reported (sys_csq required)`}{" "}
                                · Error code:{" "}
                                {F.deviceStatus.find(
                                  (t) => t.gateway_id === e.id,
                                )?.error_code || `Not reported`}
                              </p>
                              <button
                                className="text-button"
                                onClick={() => f(`gateways`, e)}
                              >
                                Open gateway details →
                              </button>
                            </section>
                          ))}
                      </section>
                    )}
                  </>
                ) : (
                  <Blank text="No sensors linked. Add a sensor to connect this asset to your device records." />
                )}
              </>
            )}
            {!pending && t === `Alerts` && (
              <section className="panel asset-section">
                <div className="asset-section-heading">
                  <h2>Alerts</h2>
                  <div className="asset-data-filters">
                    <select
                      aria-label="Alert status"
                      value={K}
                      onChange={(e) => ae(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      {[`open`, `acknowledged`, `resolved`, `dismissed`].map(
                        (e) => (
                          <option key={e}>{e}</option>
                        ),
                      )}
                    </select>
                    <select
                      aria-label="Alert severity"
                      value={G}
                      onChange={(e) => ie(e.target.value)}
                    >
                      <option value="all">All severities</option>
                      {[
                        `critical`,
                        `warning`,
                        `info`,
                        `high`,
                        `medium`,
                        `low`,
                      ].map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {F.alerts
                  .filter(
                    (e) =>
                      (G === `all` || e.severity === G) &&
                      (K === `all` || e.status === K),
                  )
                  .map((t) => (
                    <article className="asset-alert-card" key={t.id}>
                      <div className="asset-section-heading">
                        <button
                          className="text-button"
                          onClick={() => f(`alerts`, t)}
                        >
                          {t.title}
                        </button>
                        <State value={t.severity} />
                        <State value={t.status} />
                      </div>
                      <p>{t.description}</p>
                      <small>
                        {i(t.source || `Unknown source`)} · {S(t.detected_at)} ·{" "}
                        {F.sensors.find((e) => e.id === t.sensor_id)?.name ||
                          `Asset alert`}
                      </small>
                      <p className="asset-small-note">
                        Acknowledged: {S(t.acknowledged_at)} · Resolved:{" "}
                        {S(t.resolved_at)}
                      </p>
                      {t.evidence && (
                        <details>
                          <summary>Reading and zone evidence</summary>
                          <pre>{JSON.stringify(t.evidence, null, 2)}</pre>
                        </details>
                      )}
                      <div className="heading-buttons">
                        {t.status === `open` && (
                          <button
                            className="button secondary compact"
                            onClick={() => void Q(() => k(t))}
                          >
                            Acknowledge
                          </button>
                        )}
                        {w(t) && (
                          <>
                            <button
                              className="button secondary compact"
                              onClick={() =>
                                void Q(() =>
                                  O(
                                    `alerts`,
                                    {
                                      status: `resolved`,
                                      resolved_at: new Date().toISOString(),
                                    },
                                    t,
                                  ),
                                )
                              }
                            >
                              Resolve
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                void Q(() =>
                                  O(`alerts`, { status: `dismissed` }, t),
                                )
                              }
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                        <button
                          className="button compact"
                          onClick={() =>
                            p(`work_orders`, {
                              asset_id: e.id,
                              site_id: e.site_id,
                              alert_id: t.id,
                              title: t.title,
                              priority:
                                t.severity === `critical`
                                  ? `critical`
                                  : `medium`,
                              status: `open`,
                            })
                          }
                        >
                          Create work order
                        </button>
                        {F.orders
                          .filter((e) => e.alert_id === t.id)
                          .map((e) => (
                            <button
                              key={e.id}
                              className="text-button"
                              onClick={() => f(`work_orders`, e)}
                            >
                              {e.work_order_number || e.title}
                            </button>
                          ))}
                      </div>
                    </article>
                  ))}
                {!F.alerts.filter(
                  (e) =>
                    (G === `all` || e.severity === G) &&
                    (K === `all` || e.status === K),
                ).length && (
                  <>
                    <Blank text="No alerts. Alerts appear when a reading enters zone C or D for three consecutive readings." />
                    <button
                      className="button secondary compact"
                      onClick={() => c(e.id, `Details`)}
                    >
                      Review vibration settings
                    </button>
                  </>
                )}
                {$?.evidence && (
                  <div className="asset-zone-candidate">
                    <strong>
                      Three consecutive readings in zone {$.evidence.zone}
                    </strong>
                    <p>
                      {$.sensor.name} · {$.evidence.v_max} mm/s · indicative
                    </p>
                    <button
                      className="button compact"
                      onClick={() =>
                        void Q(() =>
                          O(`alerts`, {
                            asset_id: e.id,
                            site_id: e.site_id,
                            sensor_id: $.sensor.id,
                            title:
                              `Vibration in zone ` +
                              $.evidence!.zone +
                              ` for three readings`,
                            severity:
                              $.evidence!.zone === `D` ? `critical` : `warning`,
                            status: `open`,
                            source: `rule`,
                            detected_at: $.evidence!.at,
                            evidence: {
                              ...$.evidence,
                              indicative: true,
                              standard: e.vibration_standard,
                              machine_class: e.vibration_class,
                              foundation: e.foundation_type,
                            },
                          }),
                        )
                      }
                    >
                      Raise zone alert
                    </button>
                  </div>
                )}
                <p className="asset-small-note">
                  New zone alerts require three consecutive C/D readings from
                  the same sensor. A single reading never creates an alert.
                  Background ingestion must evaluate this rule for monitoring
                  when the browser is closed.
                </p>
              </section>
            )}
            {!pending && t === `Trends` && (
              <MonitoringTrends
                sensor={q}
                baselines={d.sensor_baselines || []}
                alerts={F.alerts}
                gateway={F.gateways[0]}
                asset={e}
                readings={J}
                limits={L}
                events={F.maintenance}
                range={M}
                onRange={N}
              />
            )}
            {!pending && t === `Maintenance` && (
              <>
                <div className="asset-section-heading">
                  <h2>Maintenance</h2>
                  <div className="heading-buttons">
                    <button
                      className="button secondary compact"
                      onClick={() =>
                        p(`maintenance_events`, {
                          asset_id: e.id,
                          site_id: e.site_id,
                          event_type: `inspection`,
                          maintenance_type: `inspection`,
                          outcome: { before_note: ``, after_note: `` },
                        })
                      }
                    >
                      Record maintenance
                    </button>
                    <button
                      className="button compact"
                      onClick={() =>
                        p(`work_orders`, {
                          asset_id: e.id,
                          site_id: e.site_id,
                          status: `open`,
                          priority: `medium`,
                        })
                      }
                    >
                      Create work order
                    </button>
                  </div>
                </div>
                <section className="panel asset-section">
                  <h3>Work orders</h3>
                  {F.orders.map((e) => (
                    <article key={e.id} className="asset-alert-card">
                      <button
                        className="text-button"
                        onClick={() => f(`work_orders`, e)}
                      >
                        {e.work_order_number} · {e.title}
                      </button>
                      <p>
                        <State value={e.priority} /> <State value={e.status} />
                      </p>
                      <dl className="asset-properties">
                        {[
                          `assigned_to`,
                          `scheduled_start`,
                          `scheduled_end`,
                          `completed_at`,
                          `estimated_downtime_minutes`,
                          `actual_downtime_minutes`,
                          `estimated_cost`,
                          `actual_cost`,
                        ].map((t) => (
                          <div key={t}>
                            <dt>{i(t)}</dt>
                            <dd>
                              {t.endsWith(`_at`) || t.startsWith(`scheduled_`)
                                ? S(e[t])
                                : t === `assigned_to`
                                  ? (d.profiles || []).find(
                                      (n) => n.id === e[t],
                                    )?.full_name || `Unassigned`
                                  : (e[t] ?? `Not recorded`)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <h4>Tasks</h4>
                      {(d.work_order_tasks || [])
                        .filter((t) => t.work_order_id === e.id)
                        .map((e) => (
                          <button
                            key={e.id}
                            className="asset-task"
                            onClick={() => f(`work_order_tasks`, e)}
                          >
                            {e.task_number}. {e.title}{" "}
                            <State value={e.status} />
                          </button>
                        ))}
                      <button
                        className="text-button"
                        onClick={() =>
                          p(`work_order_tasks`, {
                            work_order_id: e.id,
                            task_number:
                              (d.work_order_tasks || [])
                                .filter((t) => t.work_order_id === e.id)
                                .reduce(
                                  (e, t) =>
                                    Math.max(e, Number(t.task_number) || 0),
                                  0,
                                ) + 1,
                            status: `pending`,
                          })
                        }
                      >
                        Add task
                      </button>
                      <h4>Updates</h4>
                      {(d.work_order_updates || [])
                        .filter((t) => t.work_order_id === e.id)
                        .map((e) => (
                          <p key={e.id}>
                            {e.message} <small>{S(e.created_at)}</small>
                          </p>
                        ))}
                      <button
                        className="text-button"
                        onClick={() =>
                          p(`work_order_updates`, {
                            work_order_id: e.id,
                            update_type: `comment`,
                          })
                        }
                      >
                        Add update
                      </button>
                    </article>
                  ))}
                  {!F.orders.length && (
                    <Blank text="No work orders. Create one to plan an inspection or repair." />
                  )}
                </section>
                <section className="panel asset-section">
                  <h3>Maintenance events and before/after notes</h3>
                  <MonitoringChart
                    readings={J}
                    metric="v_max"
                    limits={g(e, L)}
                    events={F.maintenance}
                  />
                  {F.maintenance.map((e) => (
                    <article className="asset-alert-card" key={e.id}>
                      <button
                        className="text-button"
                        onClick={() => f(`maintenance_events`, e)}
                      >
                        {e.title || i(e.maintenance_type || `Maintenance`)}
                      </button>
                      <p>
                        {S(e.completed_at || e.started_at)} ·{" "}
                        {e.downtime_minutes ?? `—`} minutes downtime · Cost:{" "}
                        {e.total_cost ?? `not recorded`}
                      </p>
                      <p>{e.action_taken || e.description}</p>
                      <p>
                        Failure mode: {e.failure_mode || `Not recorded`} · Root
                        cause: {e.root_cause || `Not recorded`}
                      </p>
                      <p>Before: {e.outcome?.before_note || `Not recorded`}</p>
                      <p>After: {e.outcome?.after_note || `Not recorded`}</p>
                      <button
                        className="text-button"
                        onClick={() =>
                          p(`maintenance_events`, {
                            ...e,
                            outcome: {
                              ...e.outcome,
                              before_note: e.outcome?.before_note || ``,
                              after_note: e.outcome?.after_note || ``,
                            },
                          })
                        }
                      >
                        Edit repair and before/after notes
                      </button>
                    </article>
                  ))}
                  {!F.maintenance.length && (
                    <Blank text="No maintenance events. Record a repair with before and after notes to compare the outcome." />
                  )}
                  <button
                    className="text-button"
                    onClick={() => c(e.id, `Trends`)}
                  >
                    Compare readings with maintenance markers →
                  </button>
                </section>
              </>
            )}
            {!pending && t === `Timeline` && (
              <section className="panel asset-section">
                <h2>Asset timeline</h2>
                <p className="asset-small-note">
                  Recorded alerts, work orders, maintenance and device events. A
                  permanent history of zone and configuration changes is not
                  available yet.
                </p>
                <div className="asset-timeline">
                  {pe.slice(0, 40).map((e) => (
                    <button
                      key={e.table + e.id}
                      onClick={() => le(e.table, e.row)}
                    >
                      <span className="asset-timeline-dot" />
                      <div>
                        <small>
                          {i(e.table)} · {S(e.at)}
                        </small>
                        <strong>{e.title}</strong>
                        {e.row.status && <State value={e.row.status} />}
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {!pending && t === `Documents` && (
              <section className="panel asset-section">
                <div className="asset-section-heading">
                  <div>
                    <h2>Documents</h2>
                    <p>Manuals and documents linked to this asset.</p>
                  </div>
                  <label className="button compact upload-button">
                    {T ? (
                      `Uploading…`
                    ) : (
                      <>
                        <Plus size={16} /> Upload document
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.log,.png,.jpg,.jpeg"
                      disabled={T}
                      onChange={(t) => {
                        if (t.target.files?.[0]) _(t.target.files[0], e);
                        t.target.value = ``;
                      }}
                    />
                  </label>
                </div>
                {F.documents.length ? (
                  <div className="asset-document-list">
                    {F.documents.map((e) => (
                      <article key={e.id}>
                        <FileText size={22} />
                        <div>
                          <strong>{e.name}</strong>
                          <small>
                            {i(e.document_type || `Document`)} · v
                            {e.version || `1`} ·{" "}
                            {e.file_size_bytes
                              ? Math.round(e.file_size_bytes / 1024) + ` KB`
                              : `Size not recorded`}
                            <br />
                            {S(e.uploaded_at)} ·{" "}
                            {(d.profiles || []).find(
                              (t) => t.id === e.uploaded_by,
                            )?.full_name || `Uploader not recorded`}
                            <br />
                            {e.description || ``}
                          </small>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => f(`asset_documents`, e)}
                        >
                          Details
                        </button>
                        <button
                          className="button secondary compact"
                          onClick={() => v(e)}
                        >
                          Open
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Blank text="No attachments linked. Upload a document to keep its reference with this asset." />
                )}
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
