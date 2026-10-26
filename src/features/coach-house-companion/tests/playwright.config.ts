import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: ".", testMatch: "*.browser.spec.ts", fullyParallel: false, workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: "../../../../.tmp/companion-browser",
  reporter: [["list"], ["json", { outputFile: ".tmp/companion-browser/results.json" }]],
  use: { baseURL: "http://127.0.0.1:3150", headless: true, trace: "retain-on-failure", screenshot: "only-on-failure" },
})
