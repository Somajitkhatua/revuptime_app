import { test, expect } from "@playwright/test";
test("profile photo persists and asset location/time appear across new sections", async ({
  page,
}) => {
  const user = "10000000-0000-4000-8000-000000000001",
    org = "10000000-0000-4000-8000-000000000002",
    site = "10000000-0000-4000-8000-000000000003",
    asset = "10000000-0000-4000-8000-000000000004";
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: user,
      email: "qa@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "QA Owner" },
    },
  };
  let avatarPath: string | null = null;
  const docId = "10000000-0000-4000-8000-000000000006";
  let docStatus = "Queued",
    processAttempts = 0,
    documentWrites = 0;
  let machine: any = {
    id: asset,
    organization_id: org,
    site_id: site,
    name: "QA Motor",
    asset_type: "Motor",
    description: "Production conveyor",
    location: "Tower 1",
    installation_date: null,
    installation_datetime: null,
    status: "active",
    metadata: {},
    created_at: new Date().toISOString(),
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/api/rag/documents/index", async (route) => {
    processAttempts++;
    if (processAttempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Indexing temporarily unavailable. Please retry." },
      });
    docStatus = "Ready for AI";
    return route.fulfill({
      json: { embedding_pending: false, message: "Keyword retrieval ready" },
    });
  });
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/process-document")) {
      processAttempts++;
      if (processAttempts === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Temporary backend failure" },
        });
      docStatus = "Ready for AI";
      return route.fulfill({ json: { status: docStatus } });
    }
    if (path.endsWith("/asset_documents")) {
      if (req.method() !== "GET") documentWrites++;
      return route.fulfill({
        json: [
          {
            id: docId,
            organization_id: org,
            asset_id: asset,
            name: "QA Manual",
            document_type: "OEM Manual",
            mime_type: "application/pdf",
            storage_path: `${org}/${asset}/manual.pdf`,
            version: "1.0",
            uploaded_at: new Date().toISOString(),
            metadata: {
              status: docStatus,
              pages: docStatus === "Ready for AI" ? 2 : null,
            },
          },
        ],
      });
    }
    if (path.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          name: "QA Owner",
          email: session.user.email,
          organization_id: org,
          role: "Owner",
        },
      });
    if (path.includes("/storage/v1/object/sign/")) {
      if (req.method() === "POST")
        return route.fulfill({
          json: {
            signedURL: `/object/sign/profile-photos/${avatarPath}?token=test`,
          },
        });
      return route.fulfill({ body: png, contentType: "image/png" });
    }
    if (path.includes("/storage/v1/object/profile-photos/")) {
      expect(path).toContain(`/profile-photos/${user}/`);
      return route.fulfill({ json: { Key: path } });
    }
    if (path.endsWith("/profiles")) {
      if (req.method() === "PATCH") {
        avatarPath = req.postDataJSON().avatar_path;
        return route.fulfill({ json: { id: user } });
      }
      if (url.searchParams.get("select")?.includes("full_name"))
        return route.fulfill({ json: [{ id: user, full_name: "QA Owner" }] });
      return route.fulfill({ json: { avatar_path: avatarPath } });
    }
    if (path.endsWith("/organizations"))
      return route.fulfill({
        json: { id: org, name: "QA Plant Operations", status: "active" },
      });
    if (path.endsWith("/organization_members"))
      return route.fulfill({ json: [{ user_id: user, role: "owner" }] });
    if (path.endsWith("/sites"))
      return route.fulfill({
        json: [
          {
            id: site,
            organization_id: org,
            name: "Main plant",
            city: "Rourkela",
          },
        ],
      });
    if (path.endsWith("/assets")) {
      if (req.method() === "PATCH") {
        machine = { ...machine, ...req.postDataJSON() };
        return route.fulfill({ json: machine });
      }
      return route.fulfill({ json: [machine] });
    }
    if (path.endsWith("/revuptime_chart_readings"))
      return route.fulfill({
        json: {
          readings: [0, 1].map((i) => ({
            id: `chart-${i}`,
            organization_id: org,
            asset_id: asset,
            timestamp: new Date(Date.now() - (1 - i) * 600000).toISOString(),
            value: 2.1 + i * 0.2,
            unit: "mm/s",
            metadata: { metric: "x_rms" },
            sensors: { measurement_type: "x_rms" },
          })),
        },
      });
    if (
      path.endsWith("/sensor_readings") ||
      path.endsWith("/revuptime_latest_readings")
    )
      return route.fulfill({
        json: [0, 1].map((i) => ({
          id: `reading-${i}`,
          organization_id: org,
          asset_id: asset,
          timestamp: new Date(Date.now() - (1 - i) * 600000).toISOString(),
          value: 2.1 + i * 0.2,
          unit: "mm/s",
          metadata: { metric: "x_rms" },
          sensors: { measurement_type: "x_rms" },
        })),
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("qa-password-2026");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/profile");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add profile photo", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "profile.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Profile photo", { exact: true })).toBeVisible();
  expect(avatarPath).toContain(`${user}/`);
  await page.reload();
  await expect(page.getByLabel("Profile photo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Organization", exact: true }).click();
  await expect(
    page.getByText("QA Plant Operations", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage plants", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/organization-redesign.png",
    fullPage: true,
  });
  await page.goto(`/asset/edit?id=${asset}`);
  await page
    .getByLabel("Machine location", { exact: true })
    .fill("Cooling Tower 2");
  await page
    .getByLabel("Installation date (YYYY-MM-DD)", { exact: true })
    .fill("2026-10-12");
  await page
    .getByLabel("Installation time (HH:mm)", { exact: true })
    .fill("09:30");
  await page.getByRole("button", { name: "Save machine", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/asset/${asset}$`));
  expect(machine.location).toBe("Cooling Tower 2");
  expect(machine.installation_datetime).toBeTruthy();
  await expect(
    page.getByText("Location: Cooling Tower 2", { exact: true }),
  ).toBeVisible();
  for (const section of [
    "Details",
    "Alarms",
    "Data Explorer",
    "Timeline",
    "Documents",
  ]) {
    await page.getByRole("tab", { name: section, exact: true }).click();
    await expect(
      page.getByRole("tab", { name: section, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    if (section === "Data Explorer")
      await expect(
        page.getByText("2.30 mm/s", { exact: true }).last(),
      ).toBeVisible();
  }
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByText("Asset installed", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "output/asset-timeline-preview.png" });
  await page.goto(`/document/${docId}?assetId=${asset}`);
  await expect(page.getByText("QA Manual", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Your file is saved and waiting for processing/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Index document", exact: true })
    .click();
  await expect(
    page.getByText(/Indexing temporarily unavailable/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Index document", exact: true })
    .click();
  await expect(page.getByText("Ready for AI", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume vectors", exact: true }),
  ).toBeVisible();
  expect(documentWrites).toBe(0);
  expect(processAttempts).toBe(2);
  await page.screenshot({
    path: "output/document-processing-ready.png",
    fullPage: true,
  });
});
