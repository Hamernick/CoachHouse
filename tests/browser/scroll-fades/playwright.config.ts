import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: __dirname,
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  outputDir: "../../../test-results/scroll-fades",
  use: { viewport: { width: 900, height: 1000 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
})
