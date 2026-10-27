import { defineConfig } from "@playwright/test"

const port = 3146
const baseURL = `http://localhost:${port}`

// Behavior tests with a simulated provider; no real Google/Supabase accounts.
export default defineConfig({
  testDir: ".",
  testMatch: "*.browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "../../../../.tmp/google-auth-browser/runs",
  reporter: [["list"]],
  use: { baseURL, headless: true, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "123-example.apps.googleusercontent.com",
      NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-placeholder",
    },
  },
})
