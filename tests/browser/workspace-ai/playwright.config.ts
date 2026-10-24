import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: __dirname,
  testMatch: "*.spec.ts",
  workers: 1, fullyParallel: false, timeout: 45_000,
  reporter: "list",
  outputDir: "../../../test-results/workspace-ai-browser",
  use: { baseURL: "http://127.0.0.1:3187", viewport: { width: 1100, height: 950 }, trace: "retain-on-failure" },
  webServer: { command: "pnpm exec vite --config tests/browser/workspace-ai/vite.config.ts", cwd: "../../..",
    url: "http://127.0.0.1:3187", reuseExistingServer: false, timeout: 60_000 },
})
