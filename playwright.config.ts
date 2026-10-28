import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:8082",
    viewport: { width: 390, height: 844 },
    channel: "chrome",
  },
  workers: 1,
  timeout: 120000,
  webServer: {
    command: "npm run web -- --port 8082",
    url: "http://localhost:8082/login",
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
  },
});
