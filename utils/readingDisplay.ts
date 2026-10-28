import type { Reading } from "../types/models";
export const readingFields = [
  { key: "temperature", label: "Temperature", group: "Temperature", unit: "°C" },
  { key: "x_rms", label: "X-axis vibration (RMS)", group: "Vibration velocity", unit: "mm/s" },
  { key: "y_rms", label: "Y-axis vibration (RMS)", group: "Vibration velocity", unit: "mm/s" },
  { key: "z_rms", label: "Z-axis vibration (RMS)", group: "Vibration velocity", unit: "mm/s" },
  { key: "velocity_x", label: "X-axis velocity", group: "Vibration velocity", unit: "" },
  { key: "velocity_y", label: "Y-axis velocity", group: "Vibration velocity", unit: "" },
  { key: "velocity_z", label: "Z-axis velocity", group: "Vibration velocity", unit: "" },
  { key: "max_velocity", label: "Maximum axis velocity", group: "Vibration velocity", unit: "" },
  { key: "overall_rms", label: "Overall RMS", group: "Vibration velocity", unit: "mm/s" },
  ...["x", "y", "z"].map((axis) => ({ key: `displacement_${axis}`, label: `${axis.toUpperCase()}-axis displacement`, group: "Displacement", unit: "" })),
  ...["x", "y", "z"].map((axis) => ({ key: `acceleration_${axis}`, label: `${axis.toUpperCase()}-axis acceleration`, group: "Acceleration", unit: "" })),
  { key: "rpm", label: "Rotational speed", group: "Speed", unit: "rpm" },
];
export function displayMeasurements(reading: Reading) {
  return readingFields.filter((field) => (!reading.available_metrics || reading.available_metrics.includes(field.key)) && Number.isFinite((reading as any)[field.key]))
    .map((field) => ({ ...field, value: (reading as any)[field.key] as number,
      unit: reading.metric_units?.[field.key] || (!reading.available_metrics ? field.unit : "") || "unit not recorded",
      timestamp: reading.metric_timestamps?.[field.key] || reading.recorded_at }));
}
