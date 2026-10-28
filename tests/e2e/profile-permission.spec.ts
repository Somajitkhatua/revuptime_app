import { test, expect } from "@playwright/test";
for (const active of [true, false])
  test(`profile function denied: ${active ? "existing verified member reaches dashboard" : "inactive member stays signed out"}`, async ({
    page,
  }) => {
    const id = "10000000-0000-4000-8000-000000000001",
      org = "10000000-0000-4000-8000-000000000002";
    const encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const user = {
      id,
      email: "qa@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      role: "authenticated",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };
    const session = {
      access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
      refresh_token: "test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user,
    };
    let checkedToken = false;
    let tokenRequests = 0;
    await page.route("https://*.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname.endsWith("/token")) {
        tokenRequests++;
        return route.fulfill({
          json: {
            ...session,
            expires_at: Math.floor(Date.now() / 1000) - 9000,
          },
        });
      }
      if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
      if (url.pathname.endsWith("/revuptime_account_profile")) {
        expect(req.headers().authorization).toBe(
          `Bearer ${session.access_token}`,
        );
        checkedToken = true;
        return route.fulfill({
          status: 403,
          json: {
            code: "42501",
            message: "permission denied for function revuptime_account_profile",
          },
        });
      }
      if (url.pathname.endsWith("/profiles"))
        return route.fulfill({
          json: [
            {
              id,
              full_name: "Verified member",
              email: user.email,
              status: "active",
            },
          ],
        });
      if (url.pathname.endsWith("/organization_members")) {
        expect(url.searchParams.get("user_id")).toBe(`eq.${id}`);
        expect(url.searchParams.get("status")).toBe("eq.active");
        return route.fulfill({
          json: active
            ? [
                {
                  user_id: id,
                  organization_id: org,
                  role: "viewer",
                  status: "active",
                },
              ]
            : [],
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/login");
    await page.getByLabel("Email address", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    if (active) {
      await expect(page).toHaveURL(/dashboard$/);
      await expect(
        page.getByText("Plant health", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText(
          "No active workspace membership is available. Contact your administrator.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page).toHaveURL(/login$/);
    }
    expect(checkedToken).toBe(true);
    expect(tokenRequests).toBe(1);
  });
