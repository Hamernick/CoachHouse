import { defineConfig } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: "./tests/visual",
  testIgnore: "fiscal-sponsorship-authenticated-routes.visual.spec.ts",
  timeout: 90_000,
  snapshotPathTemplate: "{snapshotDir}/{testFileName}-snapshots/{arg}{ext}",
  fullyParallel: false,
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 2),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    extraHTTPHeaders: {
      "x-coach-house-visual-regression": "1",
    },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `NEXT_PUBLIC_ENABLE_REACT_GRAB=0 VISUAL_REGRESSION_ROUTES=1 pnpm dev --port ${port}`,
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
})
