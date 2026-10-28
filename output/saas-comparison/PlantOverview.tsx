import { useEffect, useMemo, useState } from "react";
import { everyWhileVisible } from "../orgLive";
import type { Dataset, Row } from "../data";
import {
  STATUS_LABEL,
  STATUS_TONE,
  asStatus,
  fmt,
  shortPointName,
  type PointStatus,
} from "./points";
import { loadPlantHealth, loadPointReadings } from "./pointsApi";
import { timeAgo } from "./status";
import { Card, StatusPill } from "./ui";

type Filter = "all" | PointStatus;
const ORDER: Record<string, number> = {
  act: 0,
  watch: 1,
  good: 2,
  offline: 3,
  no_data: 4,
};

/**
 * Plant overview: KPI row and one tile per asset, worst first. Each tile says how many
 * measurement points the asset has and which one drives its score. Hidden until the
 * organisation has measurement points.
 */
export function PlantOverview({
  data,
  site,
  onOpenAsset,
}: {
  data: Dataset;
  site: string;
  onOpenAsset: (assetId: string) => void;
}) {
  const org =
    (data.assets || [])[0]?.organization_id ||
    (data.sites || [])[0]?.organization_id ||
    "";
  const [health, setHealth] = useState<Row[]>([]);
  const [points, setPoints] = useState<Row[]>([]);
  const [spark, setSpark] = useState<Row[]>([]);
  const [missing, setMissing] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!org) return;
    let alive = true;
    const load = () =>
      loadPlantHealth(org)
        .then((r) => {
          if (!alive) return;
          setMissing(r.missing);
          setHealth(r.health);
          setPoints(r.points);
        })
        .catch(() => alive && setMissing(true));
    void load();
    const stop = everyWhileVisible(load, 120_000);
    return () => {
      alive = false;
      stop();
    };
  }, [org]);

  const assets = (data.assets || []).filter((a) => !site || a.site_id === site);
  const rows = useMemo(
    () =>
      assets
        .map((a) => {
          const h = health.find((x) => x.asset_id === a.id);
          const pts = points.filter((p) => p.asset_id === a.id);
          const driver = pts.find((p) => p.point_id === h?.driven_by_point_id);
          return {
            asset: a,
            h,
            pts,
            driver,
            status: asStatus(h?.status === "no_points" ? "no_data" : h?.status),
          };
        })
        .filter((r) => r.pts.length)
        .sort(
          (x, y) =>
            (ORDER[x.status] ?? 9) - (ORDER[y.status] ?? 9) ||
            (x.h?.score ?? 999) - (y.h?.score ?? 999),
        ),
    [assets.map((a) => a.id).join(","), health, points],
  );

  const driverIds = rows
    .map((r) => r.driver?.point_id)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    if (!org || !driverIds) return;
    loadPointReadings(
      org,
      driverIds.split(","),
      new Date(Date.now() - 7 * 86400000).toISOString(),
    )
      .then(setSpark)
      .catch(() => setSpark([]));
  }, [org, driverIds]);

  if (missing || !rows.length) return null;

  const scored = rows.filter((r) => typeof r.h?.score === "number");
  const plantScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.h!.score, 0) / scored.length)
    : null;
  const act = rows.filter((r) => r.status === "act");
  const watch = rows.filter((r) => r.status === "watch");
  const withSensor = rows.flatMap((r) => r.pts.filter((p) => p.sensor_id));
  const online = withSensor.filter((p) => p.fresh);
  const offlinePoint = withSensor.find((p) => !p.fresh);
  const counts = (s: Filter) =>
    s === "all" ? rows.length : rows.filter((r) => r.status === s).length;
  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const plantName = (data.sites || []).find((s) => s.id === site)?.name;

  return (
    <section
      className="rv-page rv-embedded rv-plant-overview"
      aria-label="Plant overview"
    >
      <header className="rv-page-header">
        <div>
          <p className="rv-crumb">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
          <h1>
            {plantName ? `${plantName} plant` : "All plants"} · {rows.length}{" "}
            asset{rows.length === 1 ? "" : "s"}, {withSensor.length} sensor
            {withSensor.length === 1 ? "" : "s"}
          </h1>
        </div>
      </header>
      <div className="rv-kpis">
        <Card>
          <p className="rv-card-label">Plant health</p>
          <p className="rv-big-number">
            {plantScore ?? "—"} <small>/ 100</small>
          </p>
          <p className="rv-muted rv-small">
            Average of machine scores (indicative)
          </p>
        </Card>
        <Card className={act.length ? "rv-kpi-act" : ""}>
          <p className="rv-card-label">Need action</p>
          <p className={"rv-big-number" + (act.length ? " rv-text-act" : "")}>
            {act.length}
          </p>
          <p className="rv-muted rv-small">
            {act.map((r) => r.asset.name).join(", ") || "None"}
          </p>
        </Card>
        <Card className={watch.length ? "rv-kpi-watch" : ""}>
          <p className="rv-card-label">On watch</p>
          <p
            className={"rv-big-number" + (watch.length ? " rv-text-watch" : "")}
          >
            {watch.length}
          </p>
          <p className="rv-muted rv-small">
            {watch.map((r) => r.asset.name).join(", ") || "None"}
          </p>
        </Card>
        <Card>
          <p className="rv-card-label">Sensors online</p>
          <p className="rv-big-number">
            {online.length} <small>/ {withSensor.length}</small>
          </p>
          <p className="rv-muted rv-small">
            {offlinePoint
              ? `${offlinePoint.point_name} silent ${timeAgo(offlinePoint.latest_at).replace(" ago", "")}`
              : "All reporting"}
          </p>
        </Card>
      </div>

      <div className="rv-section-head">
        <h2 className="rv-section-title">Assets · worst first</h2>
        <div
          className="rv-filter-pills"
          role="group"
          aria-label="Filter by status"
        >
          {(["all", "act", "watch", "good", "offline"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={
                "rv-filter rv-filter-" + f + (filter === f ? " is-on" : "")
              }
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : STATUS_LABEL[f as PointStatus]} {counts(f)}
            </button>
          ))}
        </div>
      </div>
      <div className="rv-asset-grid">
        {shown.map(({ asset, h, pts, driver, status }) => {
          const tone = STATUS_TONE[status];
          const series = spark.filter(
            (r) =>
              r.point_id === driver?.point_id && typeof r.v_max === "number",
          );
          const footer =
            status === "offline" || status === "no_data"
              ? h?.latest_at
                ? `No data for ${timeAgo(h.latest_at).replace(" ago", "")} · check the gateway`
                : "No readings yet"
              : status === "good"
                ? `${pts.length} point${pts.length === 1 ? "" : "s"} · all within normal`
                : `${pts.length} point${pts.length === 1 ? "" : "s"} · worst: ${shortPointName(driver?.point_name || "")}${driver?.velocity != null ? ` · ${fmt(driver.velocity)} mm/s` : ""}`;
          return (
            <button
              key={asset.id}
              type="button"
              className={"rv-asset-tile rv-tile-" + tone}
              onClick={() => onOpenAsset(asset.id)}
            >
              <span className="rv-tile-head">
                <MiniRing score={h?.score ?? null} tone={tone} />
                <span>
                  <strong>{asset.name}</strong>
                  <small>
                    {pts.length} point{pts.length === 1 ? "" : "s"} ·{" "}
                    {h?.sensors ?? 0} sensor{h?.sensors === 1 ? "" : "s"}
                  </small>
                  <StatusPill tone={tone}>{STATUS_LABEL[status]}</StatusPill>
                </span>
              </span>
              <Spark rows={series} tone={tone} />
              <span className="rv-tile-foot">{footer}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MiniRing({ score, tone }: { score: number | null; tone: string }) {
  const r = 22,
    c = 2 * Math.PI * r;
  const frac = score === null ? 0 : Math.max(0.02, Math.min(1, score / 100));
  return (
    <svg
      className={"rv-ring rv-ring-small rv-ring-" + tone}
      viewBox="0 0 56 56"
      role="img"
      aria-label={score === null ? "No score" : `Score ${score}`}
    >
      <circle cx="28" cy="28" r={r} className="rv-ring-track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className="rv-ring-value"
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function Spark({ rows, tone }: { rows: Row[]; tone: string }) {
  if (rows.length < 2)
    return <span className="rv-spark rv-spark-empty" aria-hidden="true" />;
  const t0 = Date.parse(rows[0].timestamp),
    t1 = Date.parse(rows[rows.length - 1].timestamp) || t0 + 1;
  const vals = rows.map((r) => r.v_max as number);
  const min = Math.min(...vals),
    max = Math.max(...vals) || 1;
  const pts = rows
    .map(
      (r) =>
        `${(((Date.parse(r.timestamp) - t0) / (t1 - t0 || 1)) * 300).toFixed(1)},${(36 - ((r.v_max - min) / (max - min || 1)) * 30).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className={"rv-spark rv-spark-" + tone}
      viewBox="0 0 300 40"
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
