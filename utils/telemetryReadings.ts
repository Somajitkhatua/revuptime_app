import type { Reading } from "../types/models";
import { finiteValue, metricName } from "./machineEvidence";

/** Adapt stored scalar and multi-axis rows without replacing missing values with measurements. */
export function normalizeReadings(data: any[]): Reading[] {
  const grouped = new Map<string, Reading>();
  for (const row of [...data].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
    if (row.quality && !["good", "valid"].includes(row.quality)) continue;
    const sensor = row.sensors || {};
    const groupKey = `${row.timestamp}:${row.sensor_id || "unknown"}:${row.unit || sensor.unit || ""}`;
    const reading: Reading = grouped.get(groupKey) || {
      id: row.id, organization_id: row.organization_id, asset_id: row.asset_id,
      recorded_at: row.timestamp, sensor_id: row.sensor_id,
      sensor_name: sensor.name,
      x_rms: 0, y_rms: 0, z_rms: 0, temperature: 0, rpm: 0,
      available_metrics: [], metric_units: {},
    };
    const set = (key: string, value: unknown, unit?: string) => {
      const number = finiteValue(value);
      if (number === undefined) return;
      (reading as any)[key] = number;
      reading.metric_units![key] = unit || "unit not recorded";
      if (!reading.available_metrics!.includes(key)) reading.available_metrics!.push(key);
    };
    const scalar = metricName(row.metadata?.metric || sensor.measurement_type || sensor.sensor_type);
    if (scalar) set(scalar, row.value, row.unit || sensor.unit);
    for (const key of ["x_rms", "y_rms", "z_rms", "overall_rms", "temperature", "rpm"])
      set(key, row.metadata?.[key], row.metadata?.units?.[key] || (key === scalar ? row.unit || sensor.unit : undefined));
    // Dedicated temperature_c is explicitly Celsius. Velocity is labelled RMS
    // only when the registered sensor configuration confirms that measurement.
    if (!reading.available_metrics!.includes("temperature")) set("temperature", row.temperature_c, "°C");
    if (sensor.configuration?.velocity_is_true_rms === true) {
      for (const [key, column] of [["x_rms", "vx"], ["y_rms", "vy"], ["z_rms", "vz"]])
        if (!reading.available_metrics!.includes(key)) set(key, row[column], sensor.unit || row.unit);
    }
    else {
      for (const axis of ["x", "y", "z"]) set(`velocity_${axis}`, row[`v${axis}`], sensor.unit || row.unit);
    }
    set("max_velocity", row.v_max, sensor.unit || row.unit);
    for (const axis of ["x", "y", "z"]) {
      set(`displacement_${axis}`, row[`d${axis}`], row.metadata?.units?.[`d${axis}`] || sensor.configuration?.displacement_unit);
      set(`acceleration_${axis}`, row[`a${axis}`], row.metadata?.units?.[`a${axis}`] || sensor.configuration?.acceleration_unit);
    }
    // v_max is kept separately from an overall RMS measurement.
    grouped.set(groupKey, reading);
  }
  return [...grouped.values()];
}

export function mergeLatestReadings(readings: Reading[]): Reading | null {
  const usable = readings.filter((r) => r.available_metrics?.length).sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  if (!usable.length) return null;
  const merge = (items: Reading[]): Reading => {
    const result: Reading = { ...items.at(-1)!, available_metrics: [], metric_units: {}, metric_timestamps: {} };
    for (const item of items) for (const key of item.available_metrics || []) {
      (result as any)[key] = (item as any)[key];
      result.metric_units![key] = item.metric_units?.[key] || "unit not recorded";
      result.metric_timestamps![key] = item.recorded_at;
      if (!result.available_metrics!.includes(key)) result.available_metrics!.push(key);
    }
    return result;
  };
  const groups = new Map<string, Reading[]>();
  for (const reading of usable) {
    const key = `${reading.sensor_id || "unknown"}:${JSON.stringify(reading.metric_units || {})}`;
    groups.set(key, [...groups.get(key) || [], reading]);
  }
  return { ...merge(usable), sensor_readings: [...groups.values()].map(merge) };
}
