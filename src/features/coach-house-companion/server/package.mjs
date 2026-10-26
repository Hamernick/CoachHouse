import { execFileSync } from "node:child_process"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const args = process.argv.slice(2)
if (args.length !== 2) throw new Error("Usage: pnpm companion:package <canonical-https-origin> <public-chatgpt-client-id>")
const origin = new URL(args[0])
if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
  throw new Error("Provide only the verified deployment's canonical HTTPS origin.")
}
const clientId = args[1]
if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientId)) throw new Error("Use the public client ID configured by COMPANION_CHATGPT_CLIENT_ID.")
const root = process.cwd()
const source = path.join(root, "docs/plugins/coach-house-companion")
const output = path.join(root, ".tmp/companion/connected-plugin")
await mkdir(path.join(output, "skills/continue-accelerator"), { recursive: true })
const manifest = JSON.parse(await readFile(path.join(source, "plugin.json"), "utf8"))
manifest.version = "0.2.0"
manifest.description = "Continue Coach House Accelerator lessons, save answers and review document changes in conversation."
const ui = manifest.extensions["com.openai"].interface
ui.shortDescription = "Continue your Coach House Accelerator"
ui.longDescription = "Connect your Coach House account, continue published lessons, save personal drafts, explicitly submit assignments, and approve organization document updates. Compact cards support the conversation. Coaching opens the existing credit-aware booking page; calendar files are exports."
ui.defaultPrompt = ["Connect Coach House and help me continue my Accelerator."]
delete ui.screenshots // Sandbox screenshots must not represent the connected product.
await writeFile(path.join(output, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n")
const mcp = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: { "coach-house-companion": {
    type: "streamable-http", url: `${origin.origin}/api/companion/mcp`,
    extensions: { "com.openai": { auth: {
      type: "oauth", client: { mode: "provided", clientId, tokenEndpointAuthMethod: "none" },
      authorizationServerBase: origin.origin, resource: `${origin.origin}/api/companion/mcp`,
      baseScopes: ["accelerator:read"], defaultScopes: ["accelerator:read", "accelerator:write"], oidcEnabled: false,
    } } },
  } },
}
await writeFile(path.join(output, "mcp.json"), JSON.stringify(mcp, null, 2) + "\n")
await copyFile(path.join(source, "connected-setup.md"), path.join(output, "README.md"))
await copyFile(path.join(source, "skills/continue-accelerator/SKILL.md"), path.join(output, "skills/continue-accelerator/SKILL.md"))
const zip = path.join(root, ".tmp/companion/coach-house-companion-connected.zip")
// -FS removes obsolete files from prior generated packages; explicit roots keep
// runtime credentials, connection state and unrelated source outside the ZIP.
execFileSync("zip", ["-q", "-FS", zip, "plugin.json", "mcp.json", "README.md", "skills/continue-accelerator/SKILL.md"], { cwd: output })
console.log(`Generated connected plugin: ${path.relative(root, zip)}. Installation and live acceptance are separate.`)
