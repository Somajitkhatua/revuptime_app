// Measurement-point helpers. Pure (no imports) so they can be unit-tested with node --test.
type Row = Record<string, any>;

export type PointStatus = "act" | "watch" | "good" | "offline" | "no_data";

export const POSITIONS: [string, string][] = [
  ["motor_de", "Motor drive end (DE)"],
  ["motor_nde", "Motor non-drive end (NDE)"],
  ["pump_de", "Pump drive end (DE)"],
  ["pump_nde", "Pump non-drive end (NDE)"],
  ["gearbox_in", "Gearbox input"],
  ["gearbox_out", "Gearbox output"],
  ["fan_de", "Fan drive end (DE)"],
  ["fan_nde", "Fan non-drive end (NDE)"],
  ["other", "Other"],
];

export const positionLabel = (p?: string) =>
  POSITIONS.find(([k]) => k === p)?.[1] || "Other";

/** Positions next to the coupling between driver and driven machine. */
const COUPLING_SIDE = new Set(["motor_de", "pump_de", "fan_de", "gearbox_in"]);

export const STATUS_LABEL: Record<PointStatus, string> = {
  act: "Act",
  watch: "Watch",
  good: "Normal",
  offline: "Offline",
  no_data: "No data",
};

export const STATUS_TONE: Record<
  PointStatus,
  "act" | "watch" | "good" | "offline"
> = {
  act: "act",
  watch: "watch",
  good: "good",
  offline: "offline",
  no_data: "offline",
};

export const asStatus = (s: unknown): PointStatus =>
  s === "act" || s === "watch" || s === "good" || s === "offline"
    ? s
    : "no_data";

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const fmt = (v: unknown, digits = 1) =>
  num(v) === null ? "—" : (v as number).toFixed(digits);

/** A point counts as "high" when it is fresh and in ISO zone C/D, above its normal band, or scored below 75. */
export function isHigh(p: Row): boolean {
  if (!p.fresh || num(p.velocity) === null) return false;
  if (p.zone === "C" || p.zone === "D") return true;
  if (num(p.velocity_ratio) !== null && p.velocity_ratio > 1) return true;
  if (num(p.score) !== null && p.score < 75) return true;
  return false;
}

export type Insight = {
  kind: "misalignment" | "bearing" | "looseness" | "normal" | "insufficient";
  headline: string;
  detail: string;
  suggestion?: string;
  evidence: { point: string; velocity: number | null; high: boolean }[];
};

const valueText = (p: Row) => `${p.point_name} ${fmt(p.velocity)}`;
const list = (names: string[]) =>
  names.length <= 1
    ? names.join("")
    : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

/**
 * Rule-based comparison of points on one asset. It names the points and values it used
 * and always frames the result as a pattern to confirm on site, not a diagnosis.
 */
export function pointInsight(points: Row[]): Insight {
  const live = points.filter((p) => p.fresh && num(p.velocity) !== null);
  const evidence = live.map((p) => ({
    point: p.point_name,
    velocity: num(p.velocity),
    high: isHigh(p),
  }));
  if (live.length < 2) {
    return {
      kind: "insufficient",
      headline: live.length
        ? `Only ${live[0].point_name} is reporting right now.`
        : "No point is reporting right now.",
      detail:
        "Comparing points needs live readings from at least two measurement points on this machine.",
      evidence,
    };
  }
  const high = live.filter(isHigh);
  const normal = live.filter((p) => !isHigh(p));
  const highNames = high.map(valueText);
  const normalNames = normal.map((p) => `${p.point_name} is normal`);

  if (!high.length) {
    return {
      kind: "normal",
      headline: `All ${live.length} points are within normal (${list(live.map(valueText))} mm/s).`,
      detail: "No point stands out from its normal range or ISO zone.",
      evidence,
    };
  }
  if (high.length === live.length) {
    return {
      kind: "looseness",
      headline: `Vibration is up at every point (${list(highNames)} mm/s).`,
      detail:
        "A rise everywhere at once often points to looseness, a base or foundation problem, or resonance rather than one bearing.",
      suggestion:
        "Check base bolts, soft foot and the frame; compare with a reading taken at a different speed if possible.",
      evidence,
    };
  }
  const couplingHigh = high.filter((p) => COUPLING_SIDE.has(p.position));
  if (couplingHigh.length >= 2 && couplingHigh.length === high.length) {
    return {
      kind: "misalignment",
      headline: `Vibration is up at both coupling-side points (${list(couplingHigh.map(valueText))} mm/s)${
        normal.length ? ` while ${list(normalNames)}` : ""
      }.`,
      detail:
        "High readings on both sides of the coupling, with the far bearings normal, often point to misalignment at the coupling.",
      suggestion:
        "Check coupling alignment (laser if available) and the base bolts.",
      evidence,
    };
  }
  if (high.length === 1) {
    const p = high[0];
    return {
      kind: "bearing",
      headline: `Only ${p.point_name} is high (${fmt(p.velocity)} mm/s)${normal.length ? ` while ${list(normalNames)}` : ""}.`,
      detail:
        "A rise at a single bearing, with the others normal, often points to a defect or lubrication issue at that bearing.",
      suggestion: `Inspect ${p.point_name}: lubrication, temperature trend and bearing condition.`,
      evidence,
    };
  }
  return {
    kind: "looseness",
    headline: `Vibration is up at ${list(highNames)} mm/s${normal.length ? ` while ${list(normalNames)}` : ""}.`,
    detail:
      "Several points are high without a clear single-bearing or coupling pattern.",
    suggestion:
      "Check mounting, base bolts and alignment, and watch the trend over the next readings.",
    evidence,
  };
}

/** The point the asset page opens on: the asset's worst point, else the first by sort order. */
export function worstPoint(points: Row[]): Row | undefined {
  const rank: Record<string, number> = {
    act: 0,
    watch: 1,
    good: 2,
    offline: 3,
    no_data: 4,
  };
  return [...points].sort(
    (a, b) =>
      (rank[a.status] ?? 5) - (rank[b.status] ?? 5) ||
      (num(a.score) ?? 999) - (num(b.score) ?? 999) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )[0];
}

/** Short label for alerts and tiles: "Motor001 › Motor DE bearing: velocity 5.4 mm/s". */
export function pointAlertLabel(
  assetName: string,
  pointName: string,
  velocity: number | null,
) {
  return `${assetName} › ${pointName}${velocity === null ? "" : `: velocity ${velocity.toFixed(1)} mm/s`}`;
}

/** Short point name for tiles: "Motor drive-end bearing" -> "Motor DE". */
export function shortPointName(name: string) {
  return name
    .replace(/non-drive[- ]end/gi, "NDE")
    .replace(/drive[- ]end/gi, "DE")
    .replace(/\s*bearing$/i, "")
    .trim();
}

/** Value position inside a band, for the vitals bars: 0..1 maps p05..p95. */
export function bandPosition(
  value: number | null,
  low: number | null,
  high: number | null,
) {
  if (value === null || low === null || high === null || high <= low)
    return null;
  const span = high - low;
  const min = Math.max(0, low - span);
  const max = high + span * 1.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
