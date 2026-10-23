import { defineConfig } from "@playwright/test"
import { supportQaEnvironment } from "./tests/visual/fixtures/workspace-support-auth"
const qa = supportQaEnvironment()
const port = 3138
export default defineConfig({
  testDir: "./tests/visual", testMatch: "workspace-support-authenticated-routes.visual.spec.ts",
  fullyParallel: false, workers: 1, retries: 0, timeout: 180_000, reporter: "list",
  expect: { timeout: 20_000 }, use: { baseURL: `http://localhost:${port}`, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `pnpm exec next dev --webpack --port ${port}`,
    reuseExistingServer: false, timeout: 240_000, url: `http://localhost:${port}/team/login`,
    env: { NEXT_PUBLIC_SUPABASE_URL: qa.url, SUPABASE_URL: qa.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: qa.anon,
      SUPABASE_SERVICE_ROLE_KEY: qa.service, POSTGRES_URL: qa.database, POSTGRES_URL_NON_POOLING: qa.database,
      ENABLE_STRIPE_ENTITLEMENT_SYNC: "0", NEXT_PUBLIC_CORE_DOCUMENT_COLLABORATION_ENABLED: "true",
      NEXT_PUBLIC_WORKSPACE_SUPPORT_ENABLED: "true", NEXT_TELEMETRY_DISABLED: "1" },
  },
})
