import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed, assetId } from "../data/seed";
import {
  validDate,
  nonNegativeNumber,
  installationTimestamp,
} from "../utils/validation";
import { authError } from "../utils/authErrors";
import { normalizeAuthClock } from "../utils/authClock";
test("clock skew changes only the refresh schedule of a fresh auth response", async () => {
  const now = 2000000000000;
  const token = "signed.jwt.unchanged";
  const reply = new Response(
    JSON.stringify({
      access_token: token,
      refresh_token: "same-refresh",
      expires_in: 3600,
      expires_at: now / 1000 - 9000,
      user: { id: "same-user" },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  const fixed = await (await normalizeAuthClock(reply, now)).json();
  assert.equal(fixed.expires_at, now / 1000 + 3600);
  assert.equal(fixed.access_token, token);
  assert.equal(fixed.refresh_token, "same-refresh");
  assert.equal(fixed.user.id, "same-user");
  const noToken = new Response(
    JSON.stringify({ expires_in: 3600, expires_at: 1 }),
    { headers: { "Content-Type": "application/json" } },
  );
  assert.equal(await normalizeAuthClock(noToken, now), noToken);
});
test("mail delivery failures provide useful guidance", () => {
  assert.match(
    authError({ code: "over_email_send_rate_limit", status: 429 }).message,
    /wait before retrying/,
  );
  assert.match(
    authError({ code: "email_address_not_authorized" }).message,
    /Contact support/,
  );
  assert.match(
    authError({ code: "email_not_confirmed" }).message,
    /Verify your email/,
  );
  assert.equal(
    authError({ message: "Invalid login credentials" }).message,
    "Invalid login credentials",
  );
});
test("installation timestamps validate date and time and preserve local input", () => {
  assert.equal(installationTimestamp("2026-10-12", ""), null);
  assert.equal(installationTimestamp("", ""), null);
  for (const [date, time] of [
    ["", "09:30"],
    ["2026-02-30", "09:30"],
    ["2026-10-12", "24:00"],
    ["2026-10-12", "09:65"],
  ])
    assert.throws(() => installationTimestamp(date, time));
  const value = installationTimestamp("2026-10-12", "09:30")!;
  assert.equal(new Date(value).getHours(), 9);
  assert.equal(new Date(value).getMinutes(), 30);
});
test("maintenance forms reject impossible dates and blank numeric readings", () => {
  assert.equal(validDate("2026-02-31"), false);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-10-08"), true);
  for (const value of ["", " ", "NaN", "Infinity", "-1"])
    assert.equal(nonNegativeNumber(value), false);
  for (const value of ["0", "2.8", "45"])
    assert.equal(nonNegativeNumber(value), true);
});
test("demo dataset has seven days of readings and a rising motor trend", () => {
  const s = createSeed();
  assert.equal(s.assets.length, 5);
  const r = s.readings.filter((r) => r.asset_id === assetId(1));
  assert.equal(r.length, 169);
  assert.equal(
    (Date.parse(r.at(-1)!.recorded_at) - Date.parse(r[0].recorded_at)) /
      3600000,
    168,
  );
  assert.equal(r.at(-1)!.x_rms, 7.3);
  assert.ok(r.at(-1)!.x_rms > r[0].x_rms);
});
test("every asset reference remains inside the demo organization", () => {
  const s = createSeed();
  for (const rows of [
    s.readings,
    s.alerts,
    s.workOrders,
    s.documents,
    s.maintenance,
  ])
    for (const row of rows) {
      const a = s.assets.find((a) => a.id === row.asset_id);
      assert.ok(a);
      assert.equal(a.organization_id, row.organization_id);
    }
});
