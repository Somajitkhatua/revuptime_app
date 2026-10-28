import type { Row } from "./data";
export const assetTabs = [
  `Overview`,
  `Details`,
  `Alerts`,
  `Maintenance`,
  `Sensors`,
  `Trends`,
  `Documents`,
  `Timeline`,
];
export const standardNames: Record<string, string> = {
  iso_20816_3: `ISO 20816-3`,
  iso_2372: `ISO 2372 (legacy)`,
};
export function parseAssetRoute(e: string, t = ``) {
  const n = (e.startsWith(`/assets`) ? e : t.replace(/^#/, `/`))
    .split(`/`)
    .filter(Boolean);
  const r: Record<string, string> = {
    "data-explorer": `trends`,
    alarms: `alerts`,
    attachments: `documents`,
    relations: `sensors`,
  };
  const i = r[n[2]] || n[2] || `overview`;
  return {
    id: n[0] === `assets` ? decodeURIComponent(n[1] || ``) : ``,
    section: assetTabs.find((e) => e.toLowerCase() === i) || `Overview`,
  };
}
export function severityLimits(e: Row, t: Row[]) {
  return t.find(
    (t) =>
      t.standard === e.vibration_standard &&
      t.machine_class === e.vibration_class &&
      [e.foundation_type, `any`].includes(t.foundation),
  );
}
export function velocityMax(e?: Row) {
  if (!e) return null;
  if (typeof e.v_max === `number` && Number.isFinite(e.v_max) && e.v_max >= 0)
    return e.v_max;
  const t = [`vx`, `vy`, `vz`].map((t) => e[t]);
  return t.every((e) => typeof e === `number` && Number.isFinite(e) && e >= 0)
    ? Math.max(...t)
    : null;
}
export function readingZone(
  e: Row | undefined,
  t: Row,
  n: Row[],
  r = false,
  i = Date.now(),
  a = 60,
) {
  const o = velocityMax(e),
    s = severityLimits(t, n),
    c = Date.parse(e?.timestamp || ``);
  if (
    !t.vibration_standard ||
    !t.vibration_class ||
    !t.foundation_type ||
    o === null ||
    !s ||
    !Number.isFinite(c) ||
    c > i ||
    [`bad`, `invalid`, `error`].includes(e?.quality) ||
    (r && i - c > Math.max(3e5, a * 3e3))
  )
    return null;
  const l = [s.zone_a_max, s.zone_b_max, s.zone_c_max].map(Number);
  if (!l.every(Number.isFinite) || !(l[0] < l[1] && l[1] < l[2])) return null;
  return o <= l[0] ? `A` : o <= l[1] ? `B` : o <= l[2] ? `C` : `D`;
}
export function chartBuckets(e: Row[], t: boolean, n: string) {
  const r = new Map<
    number,
    { at: number; sum: number; count: number; max: number }
  >();
  for (const i of e) {
    const e = n === `v_max` ? velocityMax(i) : i[n];
    const a = Date.parse(i.timestamp);
    if (
      typeof e !== `number` ||
      !Number.isFinite(e) ||
      !Number.isFinite(a) ||
      [`bad`, `invalid`, `error`].includes(i.quality)
    )
      continue;
    const o = t ? Math.floor(a / 36e5) * 36e5 : a;
    const s = r.get(o) || { at: o, sum: 0, count: 0, max: -Infinity };
    s.sum += e;
    s.count++;
    s.max = Math.max(s.max, e);
    r.set(o, s);
  }
  return [...r.values()]
    .sort((e, t) => e.at - t.at)
    .map((e) => ({ at: e.at, value: e.sum / e.count, max: e.max }));
}
export function worseZoneCandidate(e: Row[], t: Row, n: Row[], r = 60) {
  const i = [...e]
    .sort((e, t) => Date.parse(t.timestamp) - Date.parse(e.timestamp))
    .slice(0, 3);
  if (
    i.length !== 3 ||
    Date.now() - Date.parse(i[0].timestamp) > Math.max(3e5, r * 3e3)
  )
    return null;
  const a = i.map((e) => readingZone(e, t, n));
  if (
    !a.every((e) => e === `C` || e === `D`) ||
    i.some(
      (e, t) =>
        t > 0 &&
        Date.parse(i[t - 1].timestamp) - Date.parse(e.timestamp) >
          Math.max(3e5, r * 3e3),
    )
  )
    return null;
  return {
    zone: a.includes(`D`) ? `D` : `C`,
    readings: i.map((e) => e.id),
    v_max: velocityMax(i[0]),
    at: i[0].timestamp,
  };
}
export function zoneDurations(e: Row[], t: Row, n: Row[], r = 60) {
  const i: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const a = [...e].sort(
    (e, t) => Date.parse(e.timestamp) - Date.parse(t.timestamp),
  );
  for (let e = 0; e < a.length - 1; e++) {
    const o = readingZone(a[e], t, n),
      s = (Date.parse(a[e + 1].timestamp) - Date.parse(a[e].timestamp)) / 1e3;
    if (o && s >= 0 && s <= Math.max(300, r * 3)) i[o] += s;
  }
  return i;
}
export function zoneSince(e: Row[], t: Row, n: Row[], r = 60) {
  const i = [...e].sort(
      (e, t) => Date.parse(t.timestamp) - Date.parse(e.timestamp),
    ),
    a = readingZone(i[0], t, n, true, Date.now(), r);
  if (!a) return null;
  let o = i[0].timestamp;
  for (let e = 1; e < i.length; e++) {
    if (
      readingZone(i[e], t, n) !== a ||
      Date.parse(i[e - 1].timestamp) - Date.parse(i[e].timestamp) >
        Math.max(3e5, r * 3e3)
    )
      break;
    o = i[e].timestamp;
  }
  return o;
}
