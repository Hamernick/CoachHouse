import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

const directory = path.join(process.cwd(), ".tmp/companion")
await mkdir(directory, { recursive: true, mode: 0o700 })
const tokenFile = path.join(directory, "operator-token")
try { await writeFile(tokenFile, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }) }
catch (error) { if (error.code !== "EEXIST") throw error }
const token = process.env.COMPANION_SANDBOX_TOKEN ?? (await readFile(tokenFile, "utf8")).trim()
console.log("Companion preview: http://127.0.0.1:3150/companion")
console.log("Local MCP bearer credential stored privately in .tmp/companion/operator-token")
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3150"], {
  stdio: "inherit",
  env: {
    ...process.env,
    COMPANION_SANDBOX_ENABLED: "1",
    COMPANION_SANDBOX_TOKEN: token,
    COMPANION_SANDBOX_DIR: process.env.COMPANION_SANDBOX_DIR ?? path.join(process.cwd(), ".tmp/companion-sandbox"),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "companion-local-preview",
  },
})
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", code => { process.exitCode = code ?? 0 })
