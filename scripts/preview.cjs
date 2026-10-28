const { chromium } = require("@playwright/test");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8082", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.screenshot({
    path: path.resolve("output/login.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await page
    .getByText("Plant Health", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.resolve("output/dashboard.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.resolve("output/mobile-dashboard.png"),
    fullPage: true,
  });
  console.log(JSON.stringify({ errors, url: page.url() }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

