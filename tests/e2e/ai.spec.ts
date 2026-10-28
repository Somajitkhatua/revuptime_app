import { test, expect } from "@playwright/test";
test("AI chat persists conversations, retries failures and opens an editable draft without saving", async ({
  page,
}) => {
  const user = "10000000-0000-4000-8000-000000000001",
    org = "10000000-0000-4000-8000-000000000002",
    site = "10000000-0000-4000-8000-000000000003",
    asset = "10000000-0000-4000-8000-000000000004",
    sid = "10000000-0000-4000-8000-000000000005";
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
  let messages: any[] = [],
    attempts = 0,
    workWrites = 0;
  const requests: any[] = [];
  await page.route(
    /^(https:\/\/[^/]+\.supabase\.co\/|http:\/\/127\.0\.0\.1:8787\/|http:\/\/localhost:8082\/api\/local-ai\/)/,
    async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path.endsWith("/token")) return route.fulfill({ json: session });
      if (path.endsWith("/user")) return route.fulfill({ json: session.user });
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
      if (path.endsWith("/profiles")) return route.fulfill({ json: [] });
      if (path.endsWith("/sites"))
        return route.fulfill({
          json: [{ id: site, organization_id: org, name: "Main plant" }],
        });
      if (path.endsWith("/assets"))
        return route.fulfill({
          json: [
            {
              id: asset,
              organization_id: org,
              site_id: site,
              name: "Test Motor",
              asset_type: "Motor",
              metadata: {},
              status: "active",
            },
          ],
        });
      if (path.endsWith("/chat_messages"))
        return route.fulfill({ json: messages });
      if (path.endsWith("/work_orders") && req.method() === "POST")
        workWrites++;
      if (path.endsWith("/asset-summary")) {
        expect(req.headers().authorization).toBe(
          `Bearer ${session.access_token}`,
        );
        const body = req.postDataJSON();
        requests.push(body);
        if (body.action === "insights")
          return route.fulfill({
            json: {
              asset: { id: asset, name: "Test Motor" },
              measurements: [],
              alerts: [],
              sensors: [],
              evidence: [],
              provider_configured: true,
              rag: { available: false, reason: "Not configured" },
              window: { returned: 0, total: 0, truncated: false },
            },
          });
        attempts++;
        if (attempts === 1)
          return route.fulfill({
            status: 429,
            json: {
              error: "The AI provider is rate limited. Please wait and retry.",
            },
          });
        const draft =
          body.action === "draft"
            ? {
                title: "Inspect sensor mounting",
                description:
                  "Review the recorded 4.2 mm/s reading and mounting condition.",
                priority: "Medium",
              }
            : undefined;
        const base = {
          session_id: sid,
          user_id: user,
          created_at: new Date().toISOString(),
          chat_sessions: {
            organization_id: org,
            asset_id: asset,
            user_id: user,
          },
        };
        const answer = {
          ...base,
          id: `a${attempts}`,
          role: "assistant",
          content: draft
            ? "Review mounting condition"
            : "## Recorded evidence\nLatest reading is **4.2 mm/s**. Confirm mounting and operating conditions.",
          metadata: { evidence: [], draft },
        };
        messages.push(
          {
            ...base,
            id: `u${attempts}`,
            role: "user",
            content: body.question,
            metadata: {},
          },
          answer,
        );
        return route.fulfill({
          json: {
            ...answer,
            organization_id: org,
            asset_id: asset,
            evidence: [],
            draft,
          },
        });
      }
      return route.fulfill({ json: [] });
    },
  );
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(session.user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(`/maintenance-chat?assetId=${asset}`);
  await expect(
    page.getByRole("button", { name: "Select asset", exact: true }),
  ).toContainText("Test Motor");
  await page
    .getByLabel("Ask about this machine", { exact: true })
    .fill("Why did vibration increase?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByText("The AI provider is rate limited. Please wait and retry.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry failed request", exact: true })
    .click();
  await expect(
    page.getByText("Recorded evidence", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ask about this machine", { exact: true })
    .fill("What should I inspect next?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect
    .poll(() => requests.filter((r) => r.session_id === sid).length)
    .toBe(1);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect(
    page.getByText("Recorded evidence", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Chat history", exact: true }).click();
  await page
    .getByText(/Recorded evidence/)
    .last()
    .click();
  await expect(
    page.getByText("Recorded evidence", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Request type", exact: true }).click();
  await page.getByText("Create Work Order with AI", { exact: true }).click();
  await page
    .getByLabel("Ask about this machine", { exact: true })
    .fill("Draft an inspection work order");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review Work Order Draft", exact: true })
    .click();
  await expect(page).toHaveURL(/work-order\/create/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Inspect sensor mounting",
  );
  await expect(page.getByLabel("Notes", { exact: true })).toContainText(
    "4.2 mm/s",
  );
  expect(workWrites).toBe(0);
  await page
    .getByLabel("Title", { exact: true })
    .fill("Review motor sensor mounting");
  await page.screenshot({
    path: "output/ai-work-order-draft.png",
    fullPage: true,
  });
});
