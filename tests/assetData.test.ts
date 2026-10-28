import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeReadings, mergeLatestReadings } from "../utils/telemetryReadings";
import { displayMeasurements } from "../utils/readingDisplay";
import { normalizeRow } from "../services/canonical";
import { linkedReadings, unavailableChartFunction } from "../services/linkedTelemetry";

test("asset adapter uses actual rated power and code while preserving unassessed health", () => {
  const asset = normalizeRow("assets", { name: "MotorPump", asset_code: "Motor001", asset_type: "Pump", description: null, rated_power_kw: "15", metadata: { power: 9 } });
  assert.equal(asset.power, 15);
  assert.equal(asset.asset_code, "Motor001");
  assert.equal(asset.description, "");
  assert.equal(asset.health, "Not assessed");
});
test("multi-axis sensor data retains stored values, units and zero without inventing overall RMS", () => {
  const [reading] = normalizeReadings([{ id: "r", sensor_id: "sensor", timestamp: "2026-10-16T10:49:01Z", value: null, unit: null, quality: "good", metadata: {}, vx: 0.3, vy: 5.4, vz: 0, v_max: 5.4, temperature_c: 28.9,
    sensors: { unit: "mm/s", configuration: { velocity_is_true_rms: true } } }]);
  assert.equal(reading.x_rms, 0.3);
  assert.equal(reading.y_rms, 5.4);
  assert.equal(reading.z_rms, 0);
  assert.equal(reading.temperature, 28.9);
  assert.equal(reading.metric_units?.z_rms, "mm/s");
  assert.equal(reading.metric_units?.temperature, "°C");
  assert.ok(!reading.available_metrics?.includes("overall_rms"));
  assert.ok(!reading.available_metrics?.includes("rpm"));
  assert.deepEqual(normalizeReadings([{ quality: "bad" }]), []);
});
test("unassigned ingestion is scoped to the selected workspace and assigned sensor, with paginated history", async () => {
  const queries: any[][] = [];
  const sensor = { id: "sensor", unit: "mm/s" };
  const db: any = { from: (table: string) => {
    const calls: any[] = [["from", table]]; queries.push(calls);
    const q: any = { then: (resolve: any) => Promise.resolve({ data: [{ id: "row", asset_id: null, sensor_id: "sensor" }] }).then(resolve) };
    for (const method of ["select", "eq", "is", "or", "order", "range", "limit", "gte", "lte"]) q[method] = (...args: any[]) => { calls.push([method, ...args]); return q; };
    return q;
  } };
  const result = await linkedReadings(db, "own-org", "own-asset", [sensor]);
  assert.ok(queries[0].some((q) => q[0] === "eq" && q[1] === "organization_id" && q[2] === "own-org"));
  assert.ok(queries[0].some((q) => q[0] === "eq" && q[1] === "sensor_id" && q[2] === "sensor"));
  assert.ok(queries[0].some((q) => q[0] === "or" && q[1].includes("asset_id.is.null") && q[1].includes("asset_id.eq.own-asset")));
  assert.equal(result[0].asset_id, "own-asset");
  assert.equal(result[0].sensors, sensor);
  assert.deepEqual(await linkedReadings(db, "own-org", "own-asset", []), []);
});
test("all raw channels remain readable and multiple sensors retain their own latest values", () => {
  const readings = normalizeReadings([
    { id: "a", sensor_id: "a", timestamp: "2026-10-16T10:00:00Z", vx: 0.3, vy: 5.4, vz: 0, dx: 9.8, dy: 150.7, dz: 0, ax: 0, ay: 1, az: 0.5, temperature_c: 28.9, v_max: 5.4,
      sensors: { name: "Vibration sensor", unit: "mm/s", configuration: { velocity_is_true_rms: true } } },
    { id: "b", sensor_id: "b", timestamp: "2026-10-16T11:00:00Z", temperature_c: 35, sensors: { name: "Second sensor" } },
  ]);
  const latest = mergeLatestReadings(readings)!;
  assert.equal(latest.sensor_readings?.length, 2);
  const first = latest.sensor_readings!.find((r) => r.sensor_id === "a")!;
  assert.equal(first.sensor_name, "Vibration sensor");
  const display = displayMeasurements(first);
  assert.equal(display.find((field) => field.key === "displacement_y")?.value, 150.7);
  assert.equal(display.find((field) => field.key === "displacement_y")?.unit, "unit not recorded");
  assert.equal(display.find((field) => field.key === "acceleration_x")?.value, 0);
  assert.equal(display.find((field) => field.key === "max_velocity")?.value, 5.4);
  assert.equal(display.find((field) => field.key === "temperature")?.value, 28.9);
  assert.equal(latest.temperature, 35);
});
test("chart table fallback recovers an unavailable function without swallowing authorization or network failures", () => {
  assert.equal(unavailableChartFunction({ code: "42501", message: "permission denied for function revuptime_chart_readings" }), true);
  assert.equal(unavailableChartFunction({ code: "PGRST202", message: "Function not found" }), true);
  assert.equal(unavailableChartFunction({ code: "42501", message: "permission denied for table sensor_readings" }), false);
  assert.equal(unavailableChartFunction({ message: "Network request failed" }), false);
});
