const { chromium } = require("@playwright/test");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8082/login", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
  await page.screenshot({
    path: path.resolve("output/first-page-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.resolve("output/first-page-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page
    .getByText("Plant Health", { exact: true })
    .waitFor();
  console.log(
    JSON.stringify({ errors, demoSignIn: "passed", url: page.url() }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});


