import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
  test.skip(
    await page
      .getByRole("link", { name: "New to RevUpTime? Create account" })
      .isVisible(),
    "This journey requires the demo preview; live registration is covered in auth.spec.ts.",
  );
});
test("technician journey creates, checks, completes, and records maintenance", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await expect(page.getByText("Plant health", { exact: true })).toBeVisible();
  await page.getByText("Assets", { exact: true }).last().click();
  await page.getByRole("textbox", { name: "Search assets..." }).fill("M-07");
  await page.getByText("Motor M-07", { exact: true }).last().click();
  await expect(
    page.getByText("Current readings", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create Work Order", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Inspect test bearing");
  await page
    .getByRole("button", { name: "Create Work Order", exact: true })
    .click();
  await expect(
    page.getByText("Inspection checklist", { exact: true }),
  ).toBeVisible();
  for (const title of [
    "Check vibration reading",
    "Inspect lubrication",
    "Check coupling alignment",
    "Record final vibration",
  ]) {
    await page.getByText(title, { exact: true }).click();
    await page.waitForTimeout(250);
  }
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Root Cause", exact: true })
    .fill("Lubrication issue");
  await page
    .getByRole("textbox", { name: "Action Taken", exact: true })
    .fill("Lubricated test bearing");
  await page
    .getByRole("textbox", { name: "Downtime (Minutes)", exact: true })
    .fill("45");
  await page
    .getByRole("textbox", { name: "Final Vibration (mm/s)", exact: true })
    .fill("2.8");
  await page
    .getByRole("button", { name: "Complete Work Order", exact: true })
    .click();
  await expect(
    page.getByText("Completed", { exact: true }).last(),
  ).toBeVisible();
  await page.goto("/asset/history?id=00000000-0000-4000-8000-000000000011");
  await expect(
    page.getByText("Lubricated test bearing", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Lubricated test bearing", { exact: true }),
  ).toBeVisible();
});
test("alerts mutate and AI shows evidence sources", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await page.goto("/alert/00000000-0000-4000-8000-000000000030");
  await page.getByRole("button", { name: "Acknowledge", exact: true }).click();
  await expect(page.getByText("Acknowledged", { exact: true })).toBeVisible();
  await page.goto("/maintenance-chat");
  await page
    .getByText("Analyze current condition", { exact: false })
    .first()
    .click();
  await expect(
    page.getByText("LIVE SENSOR EVIDENCE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("OEM/RAG EVIDENCE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("AI RECOMMENDATION", { exact: true }),
  ).toBeVisible();
});
