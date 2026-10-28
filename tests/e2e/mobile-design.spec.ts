import { test, expect } from "@playwright/test";
test("operational mobile design uses scoped SaaS data and all five destinations work", async ({
  page,
}) => {
  const org = "10000000-0000-4000-8000-000000000002",
    user = "10000000-0000-4000-8000-000000000001",
    site = "10000000-0000-4000-8000-000000000003",
    asset = "10000000-0000-4000-8000-000000000004",
    point = "10000000-0000-4000-8000-000000000005",
    sensor = "10000000-0000-4000-8000-000000000006",
    gateway = "10000000-0000-4000-8000-000000000007",
    alert = "10000000-0000-4000-8000-000000000008",
    order = "10000000-0000-4000-8000-000000000009";
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256" })}.${encode({ sub: user, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
    refresh_token: "fixture",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: user,
      email: "design@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
  const machine = {
    id: asset,
    organization_id: org,
    site_id: site,
    name: "Pump P-102",
    asset_code: "P-102",
    asset_type: "Pump",
    status: "active",
    location: "Pump room",
    metadata: { health: "Healthy", health_score: 99 },
  };
  let velocity = 5.4;
  const now = () => new Date().toISOString();
  const vitals = () => ({
    organization_id: org,
    asset_id: asset,
    point_id: point,
    point_name: "Drive-end bearing",
    sensor_id: sensor,
    sensor_name: "Vibration sensor",
    gateway_id: gateway,
    latest_at: now(),
    fresh: true,
    velocity,
    temperature: 62.8,
    score: 64,
    status: "watch",
    zone: "C",
    graded: true,
    zone_bc: 4.5,
    zone_ab: 1.8,
    zone_cd: 7.1,
    limit_set_name: "ISO 20816-3 · Configured",
  });
  const alerts = [
    {
      id: alert,
      organization_id: org,
      site_id: site,
      asset_id: asset,
      title: "Vibration above configured limit",
      severity: "critical",
      status: "open",
      value: 5.4,
      threshold: 4.5,
      unit: "mm/s",
      detected_at: now(),
    },
  ];
  const work = {
    id: order,
    organization_id: org,
    site_id: site,
    asset_id: asset,
    work_order_number: "WO-2048",
    title: "Inspect pump bearing",
    priority: "high",
    status: "in_progress",
    assigned_to: user,
    scheduled_end: "2026-10-20T12:00:00Z",
    work_order_tasks: [
      { id: "t1", title: "Inspect", status: "completed", task_number: 1 },
      { id: "t2", title: "Record", status: "open", task_number: 2 },
    ],
  };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Unexpected text node|cannot be a child|Maximum update depth/i.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  let overviewRequests = 0,
    writes = 0;
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          name: "Alex Morgan",
          email: session.user.email,
          organization_id: org,
          role: "Owner",
        },
      });
    if (path.endsWith("/page_overview")) {
      expect(req.postDataJSON()).toEqual({ p_org: org });
      overviewRequests++;
      return route.fulfill({
        json: {
          health: [
            {
              organization_id: org,
              asset_id: asset,
              score: 64,
              status: "watch",
              points: 1,
              sensors: 1,
              latest_at: now(),
              driven_by_point_id: point,
              driven_by_point_name: "Drive-end bearing",
            },
          ],
          points: [vitals()],
          gateways: [
            {
              id: gateway,
              organization_id: org,
              site_id: site,
              name: "Gateway GW-03",
              status: "online",
              last_seen_at: now(),
            },
          ],
          daily: [
            {
              point_id: point,
              day: new Date().toISOString().slice(0, 10),
              v_max: velocity,
              samples: 4,
            },
          ],
        },
      });
    }
    if (path.endsWith("/sites"))
      return route.fulfill({
        json: [{ id: site, organization_id: org, name: "Main plant" }],
      });
    if (path.endsWith("/assets")) return route.fulfill({ json: [machine] });
    if (path.endsWith("/alerts")) return route.fulfill({ json: alerts });
    if (path.endsWith("/work_orders")) return route.fulfill({ json: [work] });
    if (path.endsWith("/organization_members"))
      return route.fulfill({ json: [{ user_id: user, role: "owner" }] });
    if (path.endsWith("/profiles"))
      return route.fulfill({ json: [{ id: user, full_name: "Alex Morgan" }] });
    if (path.endsWith("/sensors"))
      return route.fulfill({
        json: [
          {
            id: sensor,
            name: "Vibration sensor",
            organization_id: org,
            asset_id: asset,
            unit: "mm/s",
            measurement_type: "velocity",
            configuration: {},
          },
        ],
      });
    if (path.endsWith("/gateways"))
      return route.fulfill({
        json: [
          {
            id: gateway,
            name: "Gateway GW-03",
            organization_id: org,
            status: "online",
            last_seen_at: now(),
          },
        ],
      });
    if (path.endsWith("/point_vitals")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      return route.fulfill({ json: [{ point_id: point }] });
    }
    if (path.endsWith("/sensor_readings")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      return route.fulfill({
        json: [1, 2, 3].map((i) => ({
          id: `r${i}`,
          organization_id: org,
          asset_id: asset,
          point_id: point,
          sensor_id: sensor,
          timestamp: new Date(Date.now() - (4 - i) * 60000).toISOString(),
          v_max: 3 + i * 0.8,
          temperature_c: 62.8,
          quality: "good",
          metadata: {},
        })),
      });
    }
    if (path.endsWith("/sensor_installations"))
      return route.fulfill({
        json: [
          {
            id: "install",
            sensor_id: sensor,
            point_id: point,
            installed_at: "2026-10-01T10:00:00Z",
            removed_at: null,
          },
        ],
      });
    if (path.endsWith("/asset-summary"))
      return route.fulfill({
        json: {
          asset: { id: asset, name: machine.name },
          measurements: [],
          alerts: [],
          sensors: [],
          rag: { available: false, reason: "No indexed manual" },
          window: { returned: 0, total: 0, truncated: false },
          provider_configured: false,
        },
      });
    if (path.endsWith("/wa_conversations"))
      return route.fulfill({
        json: [
          {
            id: "conversation",
            contact_name: "Plant technician",
            contact_phone: "+910000000000",
            mode: "human",
            last_message_preview: "Please inspect Pump P-102",
            unread_count: 1,
            last_message_at: now(),
          },
        ],
      });
    if (
      req.method() !== "GET" &&
      !path.includes("/rpc/") &&
      !path.includes("/functions/")
    )
      writes++;
    return route.fulfill({ json: [] });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await expect(
    page.getByRole("button", { name: "Plant health: 64 / 100", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sensors online: 1/1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gateways online: 1 / 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Alerts/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Devices/ })).toBeVisible();
  await expect(
    page.getByText("Calculated condition", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "output/mobile-ui-home.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  await expect(
    page.getByRole("button", { name: "Plant health: 64 / 100", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Devices/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/mobile-ui-home-small.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: /Devices/ }).click();
  await expect(page).toHaveURL(/devices$/);
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/asset\/documents$/);
  await page.goto("/dashboard");
  await page.goto(`/asset/${asset}`);
  await expect(
    page.getByText("Measurement points", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("5.4 mm/s", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Zone C · Configured limits", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sensor installation history", exact: true })
    .click();
  await expect(page.getByText(/Currently installed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Hide sensor history", exact: true })
    .click();
  await page.screenshot({
    path: "output/mobile-ui-machine.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Go to Home", exact: true }).click();
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(page).toHaveURL(/alerts$/);
  await expect(
    page.getByRole("button", {
      name: "Review alert: Vibration above configured limit",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/mobile-ui-alerts.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: /Work/ }).click();
  await expect(page).toHaveURL(/work-orders$/);
  await expect(
    page.getByRole("button", {name:"Open work order: Inspect pump bearing",exact:true}),
  ).toBeVisible();
  await expect(page.getByText("1 of 2 tasks", { exact: true })).toBeVisible();
  await page.screenshot({ path: "output/mobile-ui-work.png", fullPage: true });
  await page.getByRole("tab", { name: /More/ }).click();
  await expect(
    page.getByRole("button", { name: "RevUpTime AI", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByText("Operational summary", { exact: true }),
  ).toBeVisible();
  await page.goto("/more");
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(
    page.getByText("Plant technician", { exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");
  velocity = 6.8;
  await page
    .getByRole("button", { name: "Refresh dashboard", exact: true })
    .click();
  await page.goto(`/asset/${asset}`);
  await expect(page.getByText("6.8 mm/s", { exact: true })).toBeVisible();
  expect(overviewRequests).toBeGreaterThan(1);
  expect(writes).toBe(0);
  expect(errors).toEqual([]);
});
