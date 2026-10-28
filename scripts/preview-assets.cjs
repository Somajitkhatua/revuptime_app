const { chromium } = require("@playwright/test");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8082/login", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.getByText("Plant Health", { exact: true }).waitFor();
  await page.getByText("Assets", { exact: true }).last().click();
  await page
    .getByRole("button", { name: "Motor M-07, Critical, 43%", exact: true })
    .waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve("output/third-page-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Critical assets", exact: true })
    .click();
  await page.getByText("1 asset · Rourkela Plant", { exact: true }).waitFor();
  await page.getByRole("button", { name: "All assets", exact: true }).click();
  await page.getByRole("textbox", { name: "Search assets..." }).fill("P-04");
  await page
    .getByRole("button", { name: "Pump P-04, Warning, 68%", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .getByRole("button", { name: "Filter assets by type", exact: true })
    .click();
  await page.getByText("Pump", { exact: true }).click();
  await page.getByRole("button", { name: "Show assets", exact: true }).click();
  await page.getByText("1 asset · Rourkela Plant", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Clear asset type filter", exact: true })
    .click();
  await page.getByRole("button", { name: "Sort assets", exact: true }).click();
  await page
    .getByRole("button", { name: "Health: lowest first", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Motor M-07, Critical, 43%", exact: true })
    .click();
  await page.getByText("Current readings", { exact: true }).waitFor();
  console.log(
    JSON.stringify({
      errors,
      search: "passed",
      healthFilter: "passed",
      typeFilter: "passed",
      sort: "passed",
      detailsNavigation: "passed",
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
