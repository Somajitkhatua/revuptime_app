import { test, expect } from "@playwright/test";
test("Devices is a bottom tab and stays reachable from its detail pages", async ({
  page,
}) => {
  const user = "10000000-0000-4000-8000-000000000001",
    org = "10000000-0000-4000-8000-000000000002";
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: user,
      email: "qa@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "QA Owner" },
    },
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: session });
    if (path.endsWith("/user")) return route.fulfill({ json: session.user });
    if (path.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          name: "QA Owner",
          email: "qa@example.invalid",
          organization_id: org,
          role: "Owner",
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("qa@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("qa-password-2026");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await expect(
    page.getByRole("button", { name: "View devices", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Devices/ }).click();
  await expect(page).toHaveURL(/devices$/);
  await page.getByRole("tab", { name: "Certificates", exact: true }).waitFor();
  await page.screenshot({ path: "output/grouped-devices-page.png" });
  await expect(
    page.getByRole("button", { name: "Go to Devices", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Certificates", exact: true }).click();
  await expect(page).toHaveURL(/devices\/certificates$/);
  await page.getByRole("tab", { name: "Policies", exact: true }).click();
  await expect(page).toHaveURL(/devices\/policies$/);
  await page
    .getByRole("button", { name: "Go to Devices", exact: true })
    .click();
  await expect(page).toHaveURL(/devices$/);
  await page.getByText("Home", { exact: true }).last().click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.screenshot({ path: "output/devices-tab-navigation.png" });
  await expect(page.getByText("Orders", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(page).toHaveURL(/alerts$/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Work Orders", exact: true }).click();
  await expect(page).toHaveURL(/work-orders$/);
});
