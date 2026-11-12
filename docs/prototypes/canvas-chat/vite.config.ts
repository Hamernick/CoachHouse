import { defineConfig } from "vite"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/postcss"
import particleUiFoundation from "../../../src/components/ui/particle-ui/postcss.cjs"
const repo = resolve(__dirname, "../../..")
export default defineConfig({
  root: __dirname, envDir: false, cacheDir: resolve(__dirname, ".cache"),
  esbuild: { jsx: "automatic" },
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  css: { postcss: { plugins: [particleUiFoundation(), tailwindcss()] } },
  resolve: { alias: [{ find: /^@\/features\/workspace-data-views$/, replacement: resolve(__dirname, "data-view-contract.ts") }, { find: "@", replacement: resolve(repo, "src") }] },
  server: { host: "127.0.0.1", port: 3191, strictPort: true, watch: { ignored: ["**/results/**", "**/*.log"] }, fs: { allow: [repo] } },
})
