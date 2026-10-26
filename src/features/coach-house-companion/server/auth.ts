import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CompanionPrincipal } from "../types"
import { companionSandboxDirectory } from "./store"

export const COMPANION_COOKIE = "coach-house-companion-sandbox"

export function companionDirectory() {
  return companionSandboxDirectory()
}

export function companionRequestOrigin(request: Request) {
  const url = new URL(request.url)
  // Next's internal request URL can use localhost while the browser uses 127.0.0.1.
  // Validate the actual Host separately before using it for the CSRF comparison.
  const host = request.headers.get("host") ?? url.host
  const origin = new URL(`${url.protocol}//${host}`)
  if (origin.host !== host || origin.username || origin.password) throw new Error("Invalid Companion request host")
  return origin
}

export function assertCompanionEnabled(request: Request) {
  if (process.env.COMPANION_SANDBOX_ENABLED !== "1") throw new Error("Companion sandbox is disabled")
  const incoming = companionRequestOrigin(request)
  const origin = incoming.origin
  const host = incoming.hostname
  const allowed = process.env.COMPANION_PUBLIC_ORIGIN
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && origin !== allowed) {
    throw new Error("Companion sandbox is restricted to its configured origin")
  }
}

async function signingKey() {
  const directory = companionDirectory()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const file = path.join(directory, "cookie-key")
  const temporary = `${file}.${randomBytes(12).toString("hex")}`
  await writeFile(temporary, randomBytes(32), { flag: "wx", mode: 0o600 })
  try { await link(temporary, file) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error }
  finally { await rm(temporary, { force: true }) }
  const key = await readFile(file)
  if (key.length !== 32) throw new Error("Sandbox signing key is unavailable")
  return key
}

export async function encodePrincipal(principal: CompanionPrincipal) {
  const body = Buffer.from(JSON.stringify(principal)).toString("base64url")
  const signature = createHmac("sha256", await signingKey()).update(body).digest("base64url")
  return `${body}.${signature}`
}

export async function decodePrincipal(token: string): Promise<CompanionPrincipal | null> {
  if (token.length > 2048) return null
  const [body, signature, extra] = token.split(".")
  if (!body || !signature || extra) return null
  const expected = createHmac("sha256", await signingKey()).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString())
    if (typeof value.sessionId !== "string" || typeof value.organizationId !== "string" ||
      typeof value.expiresAt !== "number" || value.expiresAt <= Date.now()) return null
    return value
  } catch { return null }
}

export function hasMcpSandboxToken(request: Request) {
  const token = process.env.COMPANION_SANDBOX_TOKEN
  if (!token || token.length < 32) return false
  const actual = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${token}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
