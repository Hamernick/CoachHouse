import { readFile } from "node:fs/promises"
import path from "node:path"

export async function getCompanionWidgetHtml() {
  try { return await readFile(path.join(process.cwd(), "build/companion-widget/index.html"), "utf8") }
  catch { throw new Error("Build the Companion widget with pnpm companion:widget before reading its MCP resource") }
}
