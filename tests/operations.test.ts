import test from "node:test";
import assert from "node:assert/strict";
import {
  scopedOperations,
  applyComputedHealth,
  gatewayState,
  isOverdue,
} from "../utils/operations";
import { normalizeRow } from "../services/canonical";
import type { Asset, AssetAlert, WorkOrder } from "../types/models";
import type { OperationsOverview } from "../types/operations";
test("plant dashboard uses computed health, scopes points and includes site gateway alerts", () => {
  const assets = [
    { id: "a", site_id: "s" },
    { id: "b", site_id: "other" },
  ] as Asset[];
  const overview = {
    health: [
      { asset_id: "a", score: 82, points: 1 },
      { asset_id: "b", score: 0, points: 1 },
      { asset_id: "unmapped", score: 99, points: 0 },
    ],
    points: [
      { point_id: "p", asset_id: "a", sensor_id: "sensor", fresh: true },
      { point_id: "q", asset_id: "b", sensor_id: "other", fresh: true },
    ],
    gateways: [
      {
        id: "g",
        name: "G",
        site_id: "s",
        status: "online",
        last_seen_at: new Date().toISOString(),
      },
    ],
  } as OperationsOverview;
  const alerts = [
    { asset_id: "a", status: "Open" },
    { asset_id: null, site_id: "s", status: "Open" },
    { asset_id: "b", status: "Open" },
    { asset_id: null, site_id: "other", status: "Open" },
  ] as AssetAlert[];
  const orders = [
    { asset_id: "a", status: "Open" },
    { asset_id: "a", status: "Open", raw_status: "cancelled" },
  ] as WorkOrder[];
  const result = scopedOperations(overview, assets, "s", alerts, orders);
  assert.equal(result.score, 82);
  assert.equal(result.points.length, 1);
  assert.equal(result.sensorCount, 1);
  assert.equal(result.sensorsOnline, 1);
  assert.equal(result.alerts.length, 2);
  assert.equal(result.orders.length, 1);
  assert.equal(result.gatewaysOnline, 1);
});
test("missing scores remain unavailable while valid zero scores remain measured", () => {
  const assets = [{ id: "a", site_id: "s" }] as Asset[];
  assert.equal(scopedOperations(undefined, assets, "s", [], []).score, null);
  const overview = {
    health: [{ asset_id: "a", points: 1, score: 0 }],
    points: [],
    gateways: [],
  } as unknown as OperationsOverview;
  assert.equal(scopedOperations(overview, assets, "s", [], []).score, 0);
  assert.equal(
    applyComputedHealth(
      { id: "a" } as Asset,
      { asset_id: "a", score: 40, status: "act" } as any,
    ).health,
    "Critical",
  );
  assert.equal(
    applyComputedHealth(
      { id: "a" } as Asset,
      { asset_id: "a", score: null, status: "offline" } as any,
    ).health,
    "Not assessed",
  );
});
test("gateway freshness matches SaaS fifteen-minute reporting state", () => {
  const now = Date.parse("2026-10-26T10:00:00Z");
  const g = {
    id: "g",
    organization_id: "o",
    name: "G",
    status: "online",
    last_seen_at: "2026-10-26T09:59:00Z",
  };
  assert.equal(gatewayState(g, now), "Online");
  assert.equal(
    gatewayState({ ...g, last_seen_at: "2026-10-26T09:00:00Z" }, now),
    "Stale",
  );
  assert.equal(gatewayState({ ...g, status: "stale" }, now), "Online");
  assert.equal(gatewayState({ ...g, last_seen_at: undefined }, now), "No data");
});
test("due dates compare calendar days and completed work is never overdue", () => {
  const w = { due_date: "2026-10-25", status: "Open" } as WorkOrder;
  assert.equal(isOverdue(w, "2026-10-26"), true);
  assert.equal(
    isOverdue({ ...w, due_date: "2026-10-26" }, "2026-10-26"),
    false,
  );
  assert.equal(isOverdue({ ...w, status: "Completed" }, "2026-10-26"), false);
});
test("alert adapter retains new direct measurements and never fabricates absent values", () => {
  const value = normalizeRow("alerts", {
    value: 0,
    threshold: 4.5,
    unit: "mm/s",
    severity: "high",
    status: "open",
    evidence: { value: 99 },
  });
  assert.equal(value.value, 0);
  assert.equal(value.threshold, 4.5);
  assert.equal(value.severity, "High");
  assert.equal(normalizeRow("alerts", {}).value, undefined);
});
