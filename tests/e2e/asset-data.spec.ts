import { test, expect } from "@playwright/test";

test("Assets displays scoped canonical records and sensor-linked multi-axis readings", async ({ page }) => {
  const pageErrors: string[] = [];
  const nestingErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (/cannot contain a nested|cannot be a descendant|validateDOMNesting|Unexpected text node|text node cannot be a child/i.test(message.text())) nestingErrors.push(message.text());
  });
  const user = "10000000-0000-4000-8000-000000000001", org = "10000000-0000-4000-8000-000000000002",
    asset = "10000000-0000-4000-8000-000000000003", site = "10000000-0000-4000-8000-000000000004",
    sensor = "10000000-0000-4000-8000-000000000005", otherSite = "10000000-0000-4000-8000-000000000006";
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const session = { access_token: `${encode({ alg: "HS256" })}.${encode({ sub: user, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`, refresh_token: "fixture", expires_in: 3600, token_type: "bearer",
    user: { id: user, email: "fixture@example.invalid", email_confirmed_at: new Date().toISOString(), aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  // Isolated fixtures reproduce the live schema and values; this is not a real user session.
  const machine = { id: asset, organization_id: org, site_id: site, name: "MotorPump", asset_code: "Motor001", asset_type: "Pump", status: "active", manufacturer: "Honda", model: "123", description: null, location: "front", rated_power_kw: 15, metadata: {} };
  let writes = 0, linkedRequests = 0, summaryCalls = 0;
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/revuptime_account_profile")) return route.fulfill({ json: { id: user, name: "Local Data Review", email: session.user.email, organization_id: org, role: "Owner" } });
    if (path.endsWith("/profiles")) return route.fulfill({ json: {} });
    if (req.method() !== "GET" && !path.includes("/rpc/") && !path.includes("/functions/")) writes++;
    if (path.endsWith("/sites")) return route.fulfill({ json: [{ id: site, name: "Pipli" }, { id: otherSite, name: "Other plant" }] });
    if (path.endsWith("/assets")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      return route.fulfill({ json: url.searchParams.get("site_id") === `eq.${otherSite}` ? [] : [machine] });
    }
    if (path.endsWith("/sensors")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      expect(url.searchParams.get("asset_id")).toBe(`eq.${asset}`);
      return route.fulfill({ json: [{ id: sensor, unit: "mm/s", measurement_type: "velocity_displacement_acceleration_temperature", configuration: { velocity_is_true_rms: true } }] });
    }
    if (path.endsWith("/sensor_readings")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      if (url.searchParams.get("asset_id") === `eq.${asset}`) return route.fulfill({ json: [] });
      expect(url.searchParams.get("sensor_id")).toBe(`eq.${sensor}`);
      if (url.searchParams.get("asset_id") !== "is.null") {
        expect(url.searchParams.get("or")).toContain("asset_id.is.null");
        expect(url.searchParams.get("or")).toContain(`asset_id.eq.${asset}`);
      }
      linkedRequests++;
      return route.fulfill({ json: [{ id: "reading", asset_id: null, sensor_id: sensor, timestamp: "2026-10-16T10:49:01Z", value: null, unit: null, quality: "good", vx: 0.3, vy: 5.4, vz: 0, v_max: 5.4, temperature_c: 28.9, dx: 9.8, dy: 150.7, dz: 0, ax: 0, ay: 1, az: 0.5, metadata: {} }] });
    }
    if (path.endsWith("/revuptime_latest_readings")) { summaryCalls++; return route.fulfill({ status: 403, json: { code: "42501", message: "permission denied for function revuptime_latest_readings" } }); }
    if (path.endsWith("/revuptime_chart_readings")) return route.fulfill({ status: 403, json: { code: "42501", message: "permission denied for function revuptime_chart_readings" } });
    if (path.endsWith("/asset-summary")) return route.fulfill({ json: { asset: { id: asset, name: "MotorPump" }, measurements: [], sensors: [], alerts: [], rag: {}, window: {}, provider_configured: false } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.getByText("Assets", { exact: true }).last().click();
  await expect(page.getByText("Motor001", { exact: true })).toBeVisible();
  for (const value of ["X RMS: 0.3 mm/s", "Y RMS: 5.4 mm/s", "Z RMS: 0 mm/s", "Temp: 28.9 °C"])
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  await expect(page.getByText(/Older than 24 hours/)).toBeVisible();
  await expect(page.getByText("Not assessed", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Search assets...").fill("Motor001");
  await expect(page.getByText("MotorPump", { exact: true })).toBeVisible();
  await page.getByLabel("Search assets...").fill("");
  await page.screenshot({ path: "output/asset-board-local.png", fullPage: true });
  await page.getByRole("button", { name: "View all readings for MotorPump", exact: true }).click();
  for (const group of ["Vibration velocity", "Displacement", "Acceleration"])
    await expect(page.getByText(group, { exact: true })).toBeVisible();
  await expect(page.getByText("150.7 unit not recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("0.5 unit not recorded", { exact: true })).toBeVisible();
  await expect(page.locator("button button")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 1900 });
  await page.screenshot({ path: "output/asset-readings-expanded-local.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Hide readings for MotorPump", exact: true }).click();
  await page.getByRole("button", { name: "Plant", exact: true }).click();
  await page.getByText("Other plant", { exact: true }).click();
  await expect(page.getByText("No assets match your filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Plant", exact: true }).click();
  await page.getByText("All plants", { exact: true }).last().click();
  await page.getByText("MotorPump", { exact: true }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByText("15 kW", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Data Explorer", exact: true }).click();
  await expect(page.getByText("0.30 mm/s", { exact: true }).first()).toBeVisible();
  expect(linkedRequests).toBeGreaterThan(0);
  expect(writes).toBe(0);
  expect(summaryCalls).toBe(0);
  expect(pageErrors).toEqual([]);
  expect(nestingErrors).toEqual([]);
});
