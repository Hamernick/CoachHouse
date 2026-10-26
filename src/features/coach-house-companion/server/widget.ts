import { readFile } from "node:fs/promises"
import path from "node:path"

export async function getCompanionWidgetHtml(mode: "sandbox" | "connected" = "sandbox") {
  try {
    const html = await readFile(path.join(process.cwd(), "build/companion-widget/index.html"), "utf8")
    return mode === "connected" ? html.replace("<head>", '<head><meta name="coach-house-companion-mode" content="connected">') : html
  }
  catch { throw new Error("Build the Companion widget with pnpm companion:widget before reading its MCP resource") }
}
