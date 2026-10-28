import { test, expect } from "@playwright/test";

test("workspace choice restores SaaS documents, includes shared manuals and keeps chat scoped", async ({
  page,
}) => {
  const user = "10000000-0000-4000-8000-000000000001";
  const first = "10000000-0000-4000-8000-000000000002";
  const second = "20000000-0000-4000-8000-000000000002";
  const site = "10000000-0000-4000-8000-000000000003";
  const asset = "10000000-0000-4000-8000-000000000004";
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256" })}.${encode({ sub: user, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
    refresh_token: "fixture",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: user,
      email: "workspace@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: { role: "owner" },
    },
  };
  const docs = [
    {
      id: "old",
      organization_id: first,
      site_id: site,
      asset_id: asset,
      name: "previous-saas-manual.pdf",
    },
    {
      id: "shared",
      organization_id: first,
      site_id: null,
      asset_id: null,
      name: "shared-workspace-manual.pdf",
    },
    {
      id: "plant",
      organization_id: first,
      site_id: site,
      asset_id: null,
      name: "shared-plant-manual.pdf",
    },
    {
      id: "other-machine",
      organization_id: first,
      site_id: site,
      asset_id: "other",
      name: "other-machine.pdf",
    },
    {
      id: "other-plant",
      organization_id: first,
      site_id: "other",
      asset_id: null,
      name: "other-plant.pdf",
    },
    {
      id: "second",
      organization_id: second,
      site_id: null,
      asset_id: null,
      name: "second-workspace-sensor.pdf",
    },
  ].map((d) => ({
    ...d,
    document_type: "manual",
    storage_bucket: "revuptime-documents",
    mime_type: "application/pdf",
    version: "1",
    metadata: { index_status: "ready" },
    uploaded_at: "2026-10-24T10:00:00Z",
  }));
  const requests: any[] = [];
  let writes = 0;
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          name: "Workspace user",
          email: session.user.email,
          organization_id: first,
          role: "Owner",
        },
      });
    if (path.endsWith("/organization_members")) {
      expect(url.searchParams.get("user_id")).toBe(`eq.${user}`);
      expect(url.searchParams.get("status")).toBe("eq.active");
      return route.fulfill({
        json: [
          {
            user_id: user,
            organization_id: first,
            role: "owner",
            status: "active",
          },
          {
            user_id: user,
            organization_id: second,
            role: "viewer",
            status: "active",
          },
        ],
      });
    }
    if (path.endsWith("/organizations"))
      return route.fulfill({
        json: [
          { id: first, name: "First workspace" },
          { id: second, name: "Second workspace" },
        ],
      });
    if (path.endsWith("/page_overview"))
      return route.fulfill({
        json: { health: [], points: [], gateways: [], daily: [] },
      });
    const org = url.searchParams.get("organization_id")?.slice(3);
    if (path.endsWith("/assets")) {
      const found =
        org === first
          ? [
              {
                id: asset,
                organization_id: first,
                site_id: site,
                name: "Pump A",
                asset_type: "Pump",
                metadata: {},
              },
            ]
          : [];
      return route.fulfill({
        json: req.headers().accept?.includes("vnd.pgrst.object")
          ? found[0]
          : found,
      });
    }
    if (path.endsWith("/asset_documents")) {
      expect([first, second]).toContain(org);
      if (req.method() !== "GET") writes++;
      let found = docs.filter((d) => d.organization_id === org);
      if (url.searchParams.has("or")) {
        expect(url.searchParams.get("or")).toContain(`asset_id.eq.${asset}`);
        expect(url.searchParams.get("or")).toContain("asset_id.is.null");
        found = found.filter(
          (d) =>
            (!d.asset_id || d.asset_id === asset) &&
            (!d.site_id || d.site_id === site),
        );
      }
      return route.fulfill({ json: found });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/rag/**", async (route) => {
    const body = route.request().postDataJSON(),
      endpoint = new URL(route.request().url()).pathname.split("/api/rag/")[1];
    requests.push({ endpoint, ...body });
    expect(route.request().headers().authorization).toBe(
      `Bearer ${session.access_token}`,
    );
    if (endpoint === "general-chat")
      return route.fulfill({
        status: 502,
        json: {
          error:
            "The configured AI model is unavailable. No paid fallback was used.",
        },
      });
    return route.fulfill({
      json: {
        content: "A vibration sensor measures oscillation. [S1]",
        response_mode: "source_excerpts",
        engine: "local-retrieval",
        citations: [
          {
            source_id: "S1",
            table: "asset_documents",
            id: "second",
            label: "second-workspace-sensor.pdf",
            excerpt: "Measures oscillation.",
          },
        ],
      },
    });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(`/asset/documents?id=${asset}`);
  for (const name of [
    "previous-saas-manual.pdf",
    "shared-workspace-manual.pdf",
    "shared-plant-manual.pdf",
  ])
    await expect(
      page.getByRole("button", { name: `Open ${name}`, exact: true }),
    ).toBeVisible();
  for (const name of [
    "other-machine.pdf",
    "other-plant.pdf",
    "second-workspace-sensor.pdf",
  ])
    await expect(
      page.getByRole("button", { name: `Open ${name}`, exact: true }),
    ).toHaveCount(0);
  await page.getByText("Manuals", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Open previous-saas-manual.pdf",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Search documents", { exact: true })
    .fill("shared-workspace");
  await expect(
    page.getByRole("button", {
      name: "Open shared-workspace-manual.pdf",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open previous-saas-manual.pdf",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Search documents", { exact: true }).fill("");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByText("Second workspace", { exact: true }).last().click();
  await expect(page).toHaveURL(/\/asset\/documents$/);
  await expect(
    page.getByRole("button", {
      name: "Open second-workspace-sensor.pdf",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open previous-saas-manual.pdf",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upload", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Open second-workspace-sensor.pdf",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/ai");
  await page.getByRole("button", { name: "Answer from", exact: true }).click();
  await page.getByText("General AI", { exact: true }).last().click();
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("Explain this sensor");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByText(/selected model is temporarily unavailable/),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Search workspace documents instead",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Explain this sensor",
  );
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "",
  );
  expect(requests.at(-1)).toMatchObject({
    endpoint: "knowledge-chat",
    organization_id: second,
    history: [],
  });
  await expect(
    page.getByText(/Source excerpts · no AI-written summary/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByText("First workspace", { exact: true }).last().click();
  await expect(
    page.getByText(/A vibration sensor measures oscillation/),
  ).toHaveCount(0);
  expect(writes).toBe(0);
});
