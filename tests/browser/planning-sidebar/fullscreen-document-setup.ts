import { build } from "vite"
import tailwindcss from "@tailwindcss/postcss"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import particleUiFoundation from "../../../src/components/ui/particle-ui/postcss.cjs"

// Compile once before browser workers; the interaction tests retain their 30s limit.
export default async function buildFullscreenDocumentFixture() {
  const result = await build({
    configFile: false, logLevel: "error", worker: { format: "es" },
    resolve: { alias: [
      { find: "@/features/workspace-objectives/client", replacement: resolve("src/features/workspace-objectives/components/planning-sidebar-surface.tsx") },
      { find: "@", replacement: resolve("src") },
    ] },
    esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [particleUiFoundation(), tailwindcss()] } },
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { write: false, minify: false, rollupOptions: { input: resolve(__dirname, "fullscreen-document-fixture.tsx"), output: { inlineDynamicImports: true } } },
  })
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected fixture bundle")
  let script = "", css = ""
  for (const entry of result.output) {
    if (entry.type === "chunk") script += entry.code
    else if (entry.fileName.endsWith(".css")) css += entry.source
  }
  mkdirSync(resolve("test-results"), { recursive: true })
  writeFileSync(resolve("test-results/fullscreen-document-bundle.json"), JSON.stringify({ script, css }))
}
