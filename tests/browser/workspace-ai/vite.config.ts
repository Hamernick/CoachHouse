import { defineConfig } from "vite"
import { resolve } from "node:path"
import { fixtureServer } from "./fixture-server"
import tailwindcss from "@tailwindcss/postcss"

const repo = resolve(__dirname, "../../..")
const actions = resolve(__dirname, "actions.ts")
export default defineConfig({
  root: __dirname,
  envDir: false,
  cacheDir: resolve(repo, "node_modules/.vite-workspace-ai-fixture"),
  esbuild: { jsx: "automatic" },
  css: { postcss: { plugins: [tailwindcss()] } },
  define: { "process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED": JSON.stringify("true") },
  resolve: { alias: [
    { find: "next/navigation", replacement: actions },
    { find: "@/actions/roadmap", replacement: actions },
    { find: "@/lib/organization/org-media", replacement: actions },
    { find: "@", replacement: resolve(repo, "src") },
  ] },
  plugins: [
    { name: "fixture-server-action-boundary", enforce: "pre", resolveId(source, importer) {
      if ((source === "@/features/workspace-particles/client" || source === resolve(repo, "src/features/workspace-particles/client")) && importer?.includes("workspace-objectives/")) return resolve(__dirname, "revision-particle-client.ts")
      if (source === "../actions" && importer?.includes("workspace-objectives/hooks/use-particle-plans")) return actions
      if (source === "../matching-actions" && importer?.includes("workspace-finance/components/")) return resolve(__dirname, "matching-actions.ts")
      if (source === "../research-actions" && importer?.includes("workspace-ai/components/")) return actions
      if (source === "../refill-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "refill-actions.ts")
      if (source === "../purchase-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../allowance-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../usage-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../limit-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../actions" && (importer?.includes("workspace-ai/components/") || importer?.includes("workspace-ai/hooks/"))) return actions
      return null
    } },
    fixtureServer(),
  ],
  server: { host: "127.0.0.1", port: 3187, strictPort: true, fs: { allow: [repo] } },
})
