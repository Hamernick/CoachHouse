import { build } from "vite"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const output = path.join(root, ".tmp/companion-widget")
await build({
  configFile: false,
  resolve: { alias: { "@": path.join(root, "src") } },
  define: { "process.env.NODE_ENV": '"production"' },
  css: { postcss: { plugins: [(await import("@tailwindcss/postcss")).default()] } },
  build: { outDir: output, emptyOutDir: true, minify: true, assetsInlineLimit: 1000000,
    lib: { entry: path.join(root, "src/features/coach-house-companion/widget/entry.tsx"), name: "CompanionWidget", formats: ["iife"], fileName: () => "widget.js", cssFileName: "widget" },
  },
})
const [js, css] = await Promise.all([readFile(path.join(output, "widget.js"), "utf8"), readFile(path.join(output, "widget.css"), "utf8")])
await mkdir(output, { recursive: true })
await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Coach House Companion</title><style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="companion-root"></div><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`)
console.log("Companion MCP Apps resource built: .tmp/companion-widget/index.html")
