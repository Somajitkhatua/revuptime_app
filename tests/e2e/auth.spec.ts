import { test, expect } from "@playwright/test";
test("existing-account signup does not promise a new verification email", async ({page})=>{
  await page.route("https://*.supabase.co/**",async route=>{
    if(new URL(route.request().url()).pathname.endsWith("/signup"))return route.fulfill({json:{user:{id:"10000000-0000-4000-8000-000000000003",identities:[]},session:null}});
    return route.fulfill({json:[]});
  });
  await page.goto("/register");
  await page.getByRole("textbox",{name:"Full name",exact:true}).fill("Existing user");
  await page.getByRole("textbox",{name:"Email address",exact:true}).fill("existing@example.invalid");
  for(const name of ["Password","Confirm password"])await page.getByRole("textbox",{name,exact:true}).fill("test-password-2026");
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await expect(page.getByText(/No new verification email was requested/)).toBeVisible();
  await expect(page).toHaveURL(/register/);
  await page.getByRole("button",{name:"Reset password",exact:true}).click();
  await expect(page).toHaveURL(/forgot-password/);
});

test("registration, invalid verification, successful verification and workspace access", async ({
  page,
}) => {
  const user = "10000000-0000-4000-8000-000000000001";
  const org = "10000000-0000-4000-8000-000000000002";
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  const session = {
    access_token: token,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: user,
      email: "qa@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "QA Owner" },
    },
  };
  let signupRequests = 0;
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const payload = route.request().postDataJSON();
    if (url.pathname.endsWith("/signup")) {
      signupRequests++;
      expect(payload.options).toBeUndefined();
      expect(payload.data.full_name).toBe("QA Owner");
      return route.fulfill({
        json: {
          user: { id: user, email: "qa@example.invalid" },
          session: null,
        },
      });
    }
    if (url.pathname.endsWith("/verify")) {
      expect(payload.type).toBe("signup");
      return payload.token === "123456"
        ? route.fulfill({ json: session })
        : route.fulfill({
            status: 403,
            json: {
              code: "otp_expired",
              msg: "Token has expired or is invalid",
            },
          });
    }
    if (url.pathname.endsWith("/revuptime_account_profile"))
      return route.fulfill({
        json: {
          id: user,
          name: "QA Owner",
          email: "qa@example.invalid",
          organization_id: org,
          role: "Owner",
        },
      });
    if (url.pathname.endsWith("/organizations"))
      return route.fulfill({ json: { id: org, name: "QA workspace" } });
    if (url.pathname.endsWith("/user"))
      return route.fulfill({ json: session.user });
    return route.fulfill({ json: [] });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
  test.skip(
    !(await page
      .getByRole("link", { name: "New to RevUpTime? Create account" })
      .isVisible()),
    "Live auth preview is required for this test.",
  );
  await page
    .getByRole("link", { name: "New to RevUpTime? Create account" })
    .click();
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("QA Owner");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("qa@example.invalid");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("test-password-2026");
  await page
    .getByRole("textbox", { name: "Confirm password", exact: true })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Passwords do not match.", { exact: true }),
  ).toBeVisible();
  expect(signupRequests).toBe(0);
  await page
    .getByRole("textbox", { name: "Confirm password", exact: true })
    .fill("test-password-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Check your inbox", { exact: true }),
  ).toBeVisible();
  expect(signupRequests).toBe(1);
  await page
    .getByRole("textbox", { name: "Verification code", exact: true })
    .fill("000000");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("Token has expired or is invalid", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/verify-email/);
  await page
    .getByRole("textbox", { name: "Verification code", exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Plant health", { exact: true })).toBeVisible();
});
