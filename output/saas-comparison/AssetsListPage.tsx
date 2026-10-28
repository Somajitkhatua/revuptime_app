// Assets list (Phase 11): which machine needs attention, which stopped sending data, which is not monitored yet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Cog,
  Download,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import type { Row } from "../data";
import { debounce, everyWhileVisible, subscribeOrg } from "../orgLive";
import { csvDownload } from "../assetContext";
import {
  formatDuration,
  shortDateTime,
} from "../../supabase/functions/_shared/alert-text.ts";
import { getDisplayTimeZone } from "./time";
import { assetsFromCsv } from "./assetCsv";
import {
  loadAllAssetRows,
  loadAssetPage,
  PAGE_SIZE,
  type AssetListRow,
  type Condition,
  type ListFilter,
  type SortKey,
} from "./assetListApi";

const CARDS: {
  key: "all" | Condition;
  label: string;
  hint: string;
  color: string;
  rule: string;
}[] = [
  {
    key: "all",
    label: "All assets",
    hint: "Sorted worst first",
    color: "#0F1E3A",
    rule: "Every asset in this view.",
  },
  {
    key: "act",
    label: "Act now",
    hint: "Zone D or rising fast",
    color: "#B91C1C",
    rule: "Worst point in ISO zone D, or velocity rising faster than 25% in 7 days.",
  },
  {
    key: "watch",
    label: "Watch",
    hint: "Zone C or outside normal",
    color: "#D97706",
    rule: "Zone C, or outside its own normal band, or a temperature-trend alert.",
  },
  {
    key: "good",
    label: "Good",
    hint: "Zone A–B, steady",
    color: "#15803D",
    rule: "Zone A or B and inside its normal band.",
  },
  {
    key: "offline",
    label: "No data",
    hint: "Gateway or sensor silent",
    color: "#94A3B8",
    rule: "Readings stopped arriving.",
  },
  {
    key: "setup",
    label: "Not set up",
    hint: "No sensor or manual only",
    color: "#CBD5E4",
    rule: "No sensor-backed data point yet.",
  },
];
const LABEL: Record<Condition, string> = {
  act: "Act now",
  watch: "Watch",
  good: "Good",
  offline: "No data",
  setup: "Not set up",
};
const COLOR: Record<Condition, string> = {
  act: "#B91C1C",
  watch: "#B45309",
  good: "#15803D",
  offline: "#64748B",
  setup: "#64748B",
};
const SPARK: Record<Condition, string> = {
  act: "#B91C1C",
  watch: "#D97706",
  good: "#15803D",
  offline: "#94A3B8",
  setup: "#CBD5E4",
};
const ZONE: Record<string, { bg: string; fg: string }> = {
  A: { bg: "#15803D", fg: "#FFFFFF" },
  B: { bg: "#65A30D", fg: "#0F1E3A" },
  C: { bg: "#D97706", fg: "#0F1E3A" },
  D: { bg: "#B91C1C", fg: "#FFFFFF" },
};
const SCORE_STYLE: Record<string, { bg: string; fg: string }> = {
  act: { bg: "#B91C1C", fg: "#FFFFFF" },
  watch: { bg: "#FDE68A", fg: "#78350F" },
  good: { bg: "#BBF7D0", fg: "#14532D" },
};
const SCORE_TIP =
  "0–100. Comes from vibration against ISO 20816-3 limits and against this machine's own normal band. The worst measurement point sets the score.";

const tz = () => getDisplayTimeZone();
const fullTime = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: tz(),
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : "";
const minutesSince = (iso: string) =>
  Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
function relative(iso: string) {
  const m = minutesSince(iso);
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

function trend(
  spark: (number | null)[] | null,
): "rising" | "falling" | "steady" | null {
  const v = (spark || []).map((x) =>
    x === null || x === undefined ? null : Number(x),
  );
  const avg = (xs: (number | null)[]) => {
    const n = xs.filter((x): x is number => x !== null);
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : null;
  };
  const a = avg(v.slice(0, 3)),
    b = avg(v.slice(-3));
  if (a === null || b === null || a <= 0) return null;
  return b / a > 1.1 ? "rising" : b / a < 0.9 ? "falling" : "steady";
}

function Sparkline({
  values,
  condition,
}: {
  values: (number | null)[] | null;
  condition: Condition;
}) {
  const nums = (values || []).map((x) =>
    x === null || x === undefined ? null : Number(x),
  );
  const present = nums.filter((x): x is number => x !== null);
  const t = trend(values);
  const label = !present.length
    ? "No readings in the last 7 days"
    : t === "rising"
      ? "Rising steadily over 7 days"
      : t === "falling"
        ? "Falling over 7 days"
        : "Steady over 7 days";
  if (condition === "setup" || !present.length)
    return (
      <span className="rv-al-spark is-empty" role="img" aria-label={label}>
        –
      </span>
    );
  const W = 100,
    H = 32,
    pad = 4,
    lo = Math.min(...present),
    hi = Math.max(...present);
  // A floor on the range keeps tiny day-to-day noise from looking like a swing.
  const span = Math.max(hi - lo, hi * 0.3, 0.01),
    mid = (hi + lo) / 2;
  const x = (i: number) =>
    pad + (i * (W - pad * 2)) / Math.max(1, nums.length - 1);
  const y = (v: number) => H / 2 - ((v - mid) / span) * (H - pad * 2);
  let d = "",
    pen = false;
  nums.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  const last = nums
    .map((v, i) => [v, i] as const)
    .filter(([v]) => v !== null)
    .pop()!;
  return (
    <svg
      className="rv-al-spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
    >
      <path
        d={d.trim()}
        fill="none"
        stroke={SPARK[condition]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(last[1])}
        cy={y(last[0] as number)}
        r="2.6"
        fill={SPARK[condition]}
      />
    </svg>
  );
}

function DataCell({ r }: { r: AssetListRow }) {
  const at = r.last_reading_at;
  if (r.data_state === "live")
    return (
      <div title={fullTime(at)}>
        <span className="rv-al-dot" style={{ background: "#15803D" }} />{" "}
        <strong style={{ color: "#15803D" }}>Live</strong>
        <small>{at ? relative(at) : ""}</small>
      </div>
    );
  if (r.data_state === "late")
    return (
      <div title={fullTime(at)}>
        <span className="rv-al-dot" style={{ background: "#D97706" }} />{" "}
        <strong style={{ color: "#B45309" }}>Late</strong>
        <small>{at ? `last ${relative(at)}` : ""}</small>
      </div>
    );
  if (r.data_state === "no_data") {
    return (
      <div title={fullTime(at)}>
        <span className="rv-al-dot" style={{ background: "#B91C1C" }} />{" "}
        <strong style={{ color: "#B91C1C" }}>
          {at ? `No data ${formatDuration(minutesSince(at))}` : "No data yet"}
        </strong>
        <small>
          {at
            ? `since ${shortDateTime(at, tz())}`
            : "Waiting for the first reading"}
        </small>
      </div>
    );
  }
  if (r.data_state === "manual") {
    const due = r.next_manual_due
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: tz(),
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(r.next_manual_due))
      : "";
    return (
      <div title={fullTime(r.next_manual_due)}>
        <span className="rv-al-dot" style={{ background: "#94A3B8" }} />{" "}
        <strong style={{ color: "#475569" }}>Manual</strong>
        <small>{due ? `next reading due ${due}` : "no reading yet"}</small>
      </div>
    );
  }
  return (
    <div>
      <span className="rv-al-dot" style={{ background: "#CBD5E4" }} />{" "}
      <strong style={{ color: "#475569" }}>Not connected</strong>
      <small>No data points</small>
    </div>
  );
}

function VibrationCell({ r }: { r: AssetListRow }) {
  const v = r.max_velocity_mm_s;
  if (r.condition === "setup") return <span className="rv-al-muted">–</span>;
  if (r.condition === "offline")
    return (
      <div>
        <span className="rv-al-muted">–</span>
        <small>
          {v !== null && v !== undefined
            ? `last ${Math.round(v * 100) / 100} mm/s`
            : "no readings"}
        </small>
      </div>
    );
  if (!r.iso_graded || !r.iso_zone)
    return (
      <div>
        <span className="rv-al-muted">–</span>
        <small>
          {r.rated_power_kw !== null && Number(r.rated_power_kw) < 15
            ? "below 15 kW, not ISO graded"
            : "not ISO graded"}
        </small>
      </div>
    );
  const z = ZONE[r.iso_zone];
  const steady = r.condition === "good" && trend(r.spark_7d) === "steady";
  return (
    <div className="rv-al-vib">
      <span
        className="rv-al-zone"
        style={{ background: z.bg, color: z.fg }}
        aria-label={`ISO zone ${r.iso_zone}`}
      >
        {r.iso_zone}
      </span>
      <div>
        <strong>
          {v === null || v === undefined
            ? "–"
            : `${Math.round(v * 100) / 100} mm/s`}
        </strong>
        <small>{steady ? "steady" : r.zone_limit_label || ""}</small>
      </div>
    </div>
  );
}

function ConditionCell({ r }: { r: AssetListRow }) {
  const s = SCORE_STYLE[r.condition];
  return (
    <div className="rv-al-cond">
      <span
        className="rv-al-score"
        style={s ? { background: s.bg, color: s.fg } : undefined}
        aria-label={
          r.health_score === null
            ? "No score"
            : `Score ${r.health_score} out of 100`
        }
      >
        {r.health_score === null || !s ? "–" : r.health_score}
      </span>
      <div>
        <strong style={{ color: COLOR[r.condition] }}>
          {LABEL[r.condition]}
        </strong>
        <small>{r.condition_driver}</small>
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const PARAMS = ["cond", "q", "area", "type", "sort", "life", "page"];
function readUrl() {
  const p = new URLSearchParams(location.search);
  const cond = p.get("cond") as Condition | "";
  return {
    cond: (["act", "watch", "good", "offline", "setup"].includes(cond || "")
      ? cond
      : "") as "" | Condition,
    q: p.get("q") || "",
    area: p.get("area") || "",
    type: p.get("type") || "",
    sort: (["worst", "name", "last_data"].includes(p.get("sort") || "")
      ? p.get("sort")
      : "worst") as SortKey,
    life: (["all", "decommissioned"].includes(p.get("life") || "")
      ? p.get("life")
      : "") as "" | "all" | "decommissioned",
    page: Math.max(0, Number(p.get("page")) || 0),
  };
}

export function AssetsListPage(props: {
  orgId: string;
  siteId: string;
  sites: Row[];
  canWrite: boolean;
  demo: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onAddSensor: (siteId: string) => void;
  onImport: (rows: Row[]) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const initial = useMemo(readUrl, []);
  const [cond, setCond] = useState(initial.cond);
  const [q, setQ] = useState(initial.q);
  const [area, setArea] = useState(initial.area);
  const [type, setType] = useState(initial.type);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [life, setLife] = useState(initial.life);
  const [page, setPage] = useState(initial.page);
  const dq = useDebounced(q, 250);
  const [rows, setRows] = useState<AssetListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({
    all: 0,
    act: 0,
    watch: 0,
    good: 0,
    offline: 0,
    setup: 0,
  });
  const [facets, setFacets] = useState({
    total: 0,
    act: 0,
    offline: 0,
    areas: [] as string[],
    types: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const filter: ListFilter = useMemo(
    () => ({
      orgId: props.orgId,
      siteId: props.siteId,
      q: dq,
      cond,
      area,
      type,
      life,
    }),
    [props.orgId, props.siteId, dq, cond, area, type, life],
  );

  // Filter, sort, search and page live in the query string so a link can be shared. The keys are removed when leaving the page.
  useEffect(() => {
    const url = new URL(location.href);
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
    set("cond", cond);
    set("q", dq);
    set("area", area);
    set("type", type);
    set("sort", sort === "worst" ? "" : sort);
    set("life", life);
    set("page", page ? String(page) : "");
    history.replaceState(history.state, "", url);
  }, [cond, dq, area, type, sort, life, page]);
  useEffect(
    () => () => {
      if (location.pathname.startsWith("/assets/")) return;
      const url = new URL(location.href);
      PARAMS.forEach((k) => url.searchParams.delete(k));
      history.replaceState(history.state, "", url);
    },
    [],
  );

  const refetch = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const list = await loadAssetPage(filter, sort, page);
      if (mine !== seq.current) return;
      setRows(list.rows);
      setTotal(list.total);
      setCounts(list.counts);
      setFacets(list.facets);
      setFailed("");
    } catch (e) {
      if (mine === seq.current)
        setFailed(e instanceof Error ? e.message : "Could not load assets.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [filter, sort, page]);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPage(0);
  }, [dq, cond, area, type, sort, life, props.siteId]);

  // New alerts and gateway changes refresh the page; a 60 s timer covers the rest.
  useEffect(() => {
    if (props.demo || !props.orgId) return;
    const refresh = debounce(() => void refetch(), 600);
    const off = [
      subscribeOrg(props.orgId, "alerts", refresh),
      subscribeOrg(props.orgId, "gateways", refresh),
      everyWhileVisible(() => void refetch(), 300_000),
    ];
    return () => {
      refresh.cancel();
      off.forEach((f) => f());
    };
  }, [props.orgId, props.demo, refetch]);

  const plant = props.sites.find((s) => s.id === props.siteId)?.name;
  const filtered = !!(q || cond || area || type || life);
  const empty = !loading && !failed && !facets.total && !filtered;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = (
    <p className="rv-al-summary" aria-live="polite">
      {facets.total} machine{facets.total === 1 ? "" : "s"} at{" "}
      {plant || "all plants"}
      {facets.act > 0 && (
        <>
          {" "}
          ·{" "}
          <strong className="is-red">
            {facets.act} need{facets.act === 1 ? "s" : ""} action now
          </strong>
        </>
      )}
      {facets.offline > 0 && (
        <>
          {" "}
          · {facets.offline} {facets.offline === 1 ? "has" : "have"} stopped
          sending data
        </>
      )}
    </p>
  );

  async function exportCsv() {
    try {
      const all = await loadAllAssetRows(filter, sort);
      csvDownload(
        "revuptime-assets",
        [
          "Name",
          "Code",
          "Type",
          "Area",
          "Parent",
          "Condition",
          "Driver",
          "Score",
          "Zone",
          "Max velocity mm/s",
          "Data",
          "Last reading",
          "Points",
          "Sensors",
          "Gateway",
          "Open alerts",
        ],
        all.map((r) => [
          r.name,
          r.code,
          r.type,
          r.area_name,
          r.parent_name || "Top level",
          LABEL[r.condition],
          r.condition_driver,
          r.health_score,
          r.iso_zone,
          r.max_velocity_mm_s,
          r.data_state,
          r.last_reading_at ? fullTime(r.last_reading_at) : "",
          r.point_count,
          r.sensor_count,
          r.gateway_name,
          r.open_alert_count,
        ]),
      );
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Could not export.", true);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const { rows: parsed, error } = assetsFromCsv(await file.text());
    if (fileRef.current) fileRef.current.value = "";
    if (error) {
      props.notify(error, true);
      return;
    }
    if (!parsed.length) {
      props.notify("No assets found in that file.", true);
      return;
    }
    if (
      !window.confirm(
        `Import ${parsed.length} asset${parsed.length === 1 ? "" : "s"} into ${plant || "the first plant"}?`,
      )
    )
      return;
    setImporting(true);
    try {
      await props.onImport(parsed);
      props.notify(
        `Imported ${parsed.length} asset${parsed.length === 1 ? "" : "s"}.`,
      );
      await refetch();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Import failed.", true);
    } finally {
      setImporting(false);
    }
  }

  const clear = () => {
    setQ("");
    setCond("");
    setArea("");
    setType("");
    setLife("");
  };
  const open = (id: string) => props.onOpen(id);
  const addSensor = (r: AssetListRow, e: { stopPropagation(): void }) => {
    e.stopPropagation();
    props.onAddSensor(r.plant_id || props.siteId);
  };

  const header = (
    <div className="rv-al-head">
      <div>
        <h1>Assets</h1>
        {summary}
      </div>
      {props.canWrite && (
        <div className="rv-al-actions">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-label="Choose a CSV file of assets"
          />
          <button
            type="button"
            className="rv-al-btn"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload size={16} aria-hidden="true" />{" "}
            {importing ? "Importing…" : "Import from CSV"}
          </button>
          <button
            type="button"
            className="rv-al-btn is-primary"
            onClick={props.onAdd}
          >
            <Plus size={16} aria-hidden="true" /> Add asset
          </button>
        </div>
      )}
    </div>
  );

  if (empty) {
    return (
      <div className="rv-al">
        {header}
        <section className="rv-al-empty">
          <Cog size={32} aria-hidden="true" />
          <h2>Add your first machine</h2>
          <p>
            An asset is a motor, pump, fan or gearbox you want to watch. You can
            add sensors to it next.
          </p>
          {props.canWrite && (
            <div className="rv-al-actions">
              <button
                type="button"
                className="rv-al-btn is-primary"
                onClick={props.onAdd}
              >
                <Plus size={16} aria-hidden="true" /> Add asset
              </button>
              <button
                type="button"
                className="rv-al-btn"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" /> Import from CSV
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="rv-al">
      {header}

      <div
        className="rv-al-cards"
        role="group"
        aria-label="Filter by condition"
      >
        {CARDS.map((c) => {
          const selected = (c.key === "all" && !cond) || c.key === cond;
          return (
            <button
              type="button"
              key={c.key}
              className={"rv-al-card" + (selected ? " is-selected" : "")}
              aria-pressed={selected}
              title={c.rule}
              onClick={() =>
                setCond(
                  c.key === "all" || c.key === cond ? "" : (c.key as Condition),
                )
              }
            >
              <span className="rv-al-card-top">
                <span
                  className="rv-al-sq"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                {c.label}
              </span>
              <strong>{counts[c.key] ?? 0}</strong>
              <small>{c.hint}</small>
            </button>
          );
        })}
      </div>

      <section className="rv-al-panel">
        <div className="rv-al-toolbar">
          <label className="rv-al-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search assets"
              placeholder="Search name, code, area or sensor serial"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">All areas</option>
            {facets.areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            aria-label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {facets.types.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            aria-label="Lifecycle"
            value={life}
            onChange={(e) =>
              setLife(e.target.value as "" | "all" | "decommissioned")
            }
          >
            <option value="">Hide decommissioned</option>
            <option value="all">Show all</option>
            <option value="decommissioned">Decommissioned only</option>
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="worst">Worst condition first</option>
            <option value="name">Name A–Z</option>
            <option value="last_data">Last data (oldest first)</option>
          </select>
          <button
            type="button"
            className="rv-al-btn"
            onClick={() => void exportCsv()}
          >
            <Download size={16} aria-hidden="true" /> Export
          </button>
        </div>

        {failed && (
          <p className="rv-al-error" role="alert">
            {failed}{" "}
            <button
              type="button"
              className="rv-al-link"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </p>
        )}

        <div className="rv-al-scroll">
          <table className="rv-al-table">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col" title={SCORE_TIP}>
                  Condition
                </th>
                <th scope="col">Vibration · ISO zone</th>
                <th scope="col" className="rv-al-col-spark">
                  Last 7 days
                </th>
                <th scope="col">Data</th>
                <th scope="col">Where</th>
                <th scope="col" className="rv-al-col-mon">
                  Monitoring
                </th>
                <th scope="col">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={"s" + i} className="rv-al-skel" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, j) => (
                      <td key={j}>
                        <span />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.asset_id}
                    className={
                      "rv-al-row" + (r.condition === "act" ? " is-act" : "")
                    }
                    tabIndex={0}
                    onClick={() => open(r.asset_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.target === e.currentTarget)
                        open(r.asset_id);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="rv-al-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(r.asset_id);
                        }}
                      >
                        <span className="rv-al-tile" aria-hidden="true">
                          <Cog size={20} />
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {[r.code, r.type].filter(Boolean).join(" · ") ||
                              "No code"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <ConditionCell r={r} />
                    </td>
                    <td>
                      <VibrationCell r={r} />
                    </td>
                    <td className="rv-al-col-spark">
                      <Sparkline values={r.spark_7d} condition={r.condition} />
                    </td>
                    <td>
                      <DataCell r={r} />
                    </td>
                    <td>
                      <div>
                        <strong className={r.area_name ? "" : "rv-al-muted"}>
                          {r.area_name || "No area"}
                        </strong>
                        <small>{r.parent_name || "Top level"}</small>
                      </div>
                    </td>
                    <td className="rv-al-col-mon">
                      <div>
                        <strong>
                          {r.point_count} point{r.point_count === 1 ? "" : "s"}{" "}
                          · {r.sensor_count} sensor
                          {r.sensor_count === 1 ? "" : "s"}
                        </strong>
                        {r.sensor_count === 0 && props.canWrite ? (
                          <small>
                            <button
                              type="button"
                              className="rv-al-link"
                              onClick={(e) => addSensor(r, e)}
                            >
                              Add a sensor
                            </button>
                          </small>
                        ) : (
                          <small>
                            {r.gateway_name
                              ? `${r.gateway_name}${r.gateway_online ? "" : " · offline"}`
                              : "No gateway"}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="rv-al-alerts">
                        {r.open_alert_count > 0 ? (
                          <span className="rv-al-pill">
                            {r.open_alert_count} open
                          </span>
                        ) : (
                          <span className="rv-al-muted">None</span>
                        )}
                        <ChevronRight size={16} aria-hidden="true" />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <ul className="rv-al-list" aria-label="Assets">
            {!loading &&
              rows.map((r) => (
                <li key={r.asset_id}>
                  <button
                    type="button"
                    className={
                      "rv-al-mcard" + (r.condition === "act" ? " is-act" : "")
                    }
                    onClick={() => open(r.asset_id)}
                  >
                    <span className="rv-al-mtop">
                      <strong>{r.name}</strong>
                      <span
                        className="rv-al-mpill"
                        style={{ color: COLOR[r.condition] }}
                      >
                        {LABEL[r.condition]}
                      </span>
                    </span>
                    <small>{r.condition_driver}</small>
                    <span className="rv-al-mbot">
                      <DataCell r={r} />
                      {r.open_alert_count > 0 ? (
                        <span className="rv-al-pill">
                          {r.open_alert_count} open
                        </span>
                      ) : (
                        <span className="rv-al-muted">No alerts</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>

        {!loading && !rows.length && !failed && filtered && (
          <p className="rv-al-none">
            No assets match.{" "}
            <button type="button" className="rv-al-link" onClick={clear}>
              Clear filters
            </button>
          </p>
        )}

        <footer className="rv-al-foot">
          <span>
            Showing {rows.length} of {total} asset{total === 1 ? "" : "s"}
          </span>
          {total > PAGE_SIZE && (
            <span className="rv-al-pager">
              <button
                type="button"
                className="rv-al-btn"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                type="button"
                className="rv-al-btn"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </span>
          )}
          <span className="rv-al-note">
            Condition uses ISO 20816-3 Group 2 limits unless a machine has its
            own.{" "}
            <a href="#settings/vibration-standards">
              How condition is worked out
            </a>
          </span>
        </footer>
      </section>
    </div>
  );
}
