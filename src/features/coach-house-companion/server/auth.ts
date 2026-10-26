import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CompanionPrincipal } from "../types"
import { companionSandboxDirectory } from "./store"

export const COMPANION_COOKIE = "coach-house-companion-sandbox"

export function companionDirectory() {
  return companionSandboxDirectory()
}

export function assertCompanionEnabled(request: Request) {
  if (process.env.COMPANION_SANDBOX_ENABLED !== "1") throw new Error("Companion sandbox is disabled")
  const origin = new URL(request.url).origin
  const host = new URL(request.url).hostname
  const allowed = process.env.COMPANION_PUBLIC_ORIGIN
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && origin !== allowed) {
    throw new Error("Companion sandbox is restricted to its configured origin")
  }
}

async function signingKey() {
  const directory = companionDirectory()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const file = path.join(directory, "cookie-key")
  try { await writeFile(file, randomBytes(32), { flag: "wx", mode: 0o600 }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error }
  return readFile(file)
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
