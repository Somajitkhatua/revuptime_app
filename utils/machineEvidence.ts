export const metrics = [
  "x_rms",
  "y_rms",
  "z_rms",
  "overall_rms",
  "temperature",
  "rpm",
] as const;
export function metricName(value: unknown): string | undefined {
  const name = String(value || "")
    .toLowerCase()
    .replace(/[ -]/g, "_");
  const aliases: Record<string, string> = {
    vibration_x: "x_rms",
    x_axis_vibration: "x_rms",
    vibration_y: "y_rms",
    y_axis_vibration: "y_rms",
    vibration_z: "z_rms",
    z_axis_vibration: "z_rms",
    vibration_rms: "overall_rms",
    rms: "overall_rms",
    motor_temperature: "temperature",
    rotational_speed: "rpm",
  };
  return metrics.includes(name as any) ? name : aliases[name];
}
export function finiteValue(value: unknown): number | undefined {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim()) ||
    typeof value === "boolean"
  )
    return;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
// Keep different sensors and units separate. A timestamp is never a substitute for sensor identity.
export function calculateMeasurements(rows: any[]) {
  const groups = new Map<
    string,
    {
      metric: string;
      sensor_id: string | null;
      unit: string;
      points: { value: number; timestamp: string }[];
    }
  >();
  for (const r of rows) {
    if (
      !Number.isFinite(Date.parse(r.timestamp)) ||
      (r.quality && !["good", "valid"].includes(r.quality))
    )
      continue;
    const scalar = metricName(
      r.metadata?.metric ||
        r.sensors?.measurement_type ||
        r.sensors?.sensor_type,
    );
    const values = new Map<string, number>();
    const v = finiteValue(r.value);
    if (scalar && v !== undefined) values.set(scalar, v);
    for (const key of metrics) {
      const n = finiteValue(r.metadata?.[key]);
      if (n !== undefined) values.set(key, n);
    }
    for (const [metric, value] of values) {
      const unit =
        metric === scalar
          ? r.unit || "unit not recorded"
          : r.metadata?.units?.[metric] || "unit not recorded";
      const key = `${r.sensor_id || "unknown"}:${metric}:${unit}`;
      const group = groups.get(key) || {
        metric,
        sensor_id: r.sensor_id || null,
        unit,
        points: [] as { value: number; timestamp: string }[],
      };
      group.points.push({ value, timestamp: r.timestamp });
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((g) => {
    g.points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = g.points[0],
      latest = g.points.at(-1)!;
    const average =
      g.points.reduce((sum, p) => sum + p.value, 0) / g.points.length;
    return {
      metric: g.metric,
      sensor_id: g.sensor_id,
      unit: g.unit,
      count: g.points.length,
      first,
      latest,
      average,
      minimum: Math.min(...g.points.map((p) => p.value)),
      maximum: Math.max(...g.points.map((p) => p.value)),
      change: g.points.length > 1 ? latest.value - first.value : null,
      change_percent:
        g.points.length > 1 && first.value !== 0
          ? ((latest.value - first.value) / Math.abs(first.value)) * 100
          : null,
      stale: Date.now() - Date.parse(latest.timestamp) > 24 * 3600000,
    };
  });
}
export function validateDraft(value: any) {
  if (
    !value ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    typeof value.description !== "string" ||
    !value.description.trim() ||
    !["High", "Medium", "Low"].includes(value.priority)
  )
    throw new Error("Invalid work-order draft");
  return {
    title: value.title.trim().slice(0, 160),
    description: value.description.trim().slice(0, 4000),
    priority: value.priority as "High" | "Medium" | "Low",
  };
}
export function thresholdIndicators(
  measurements: ReturnType<typeof calculateMeasurements>,
  rules: any[],
) {
  const indicators: any[] = [];
  for (const rule of rules) {
    const c = rule.condition,
      metric = metricName(c?.metric),
      threshold = finiteValue(c?.threshold);
    if (
      !metric ||
      threshold === undefined ||
      ![">", ">=", "<", "<="].includes(c?.operator) ||
      typeof c.unit !== "string"
    )
      continue;
    for (const m of measurements.filter(
      (m) =>
        m.metric === metric &&
        m.unit === c.unit &&
        (!rule.sensor_id || m.sensor_id === rule.sensor_id),
    )) {
      const v = m.latest.value,
        exceeded =
          c.operator === ">"
            ? v > threshold
            : c.operator === ">="
              ? v >= threshold
              : c.operator === "<"
                ? v < threshold
                : v <= threshold;
      indicators.push({
        rule_id: rule.id,
        name: rule.name,
        sensor_id: m.sensor_id,
        metric,
        value: v,
        unit: m.unit,
        operator: c.operator,
        threshold,
        exceeded,
        timestamp: m.latest.timestamp,
      });
    }
  }
  return indicators;
}
