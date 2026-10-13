import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"

export const GUEST_COOKIE = process.env.NODE_ENV === "production" ? "__Host-fiscal-intake" : "fiscal-intake"
export const hashGuestCapability = (value: string) => createHash("sha256").update(value).digest("hex")

export function guestIntakeConfiguration() {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  const riskSecret = process.env.FISCAL_GUEST_RISK_SECRET
  const captchaSecret = process.env.HCAPTCHA_SECRET_KEY
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
  if (process.env.FISCAL_GUEST_INTAKE_ENABLED !== "true" || !site || !riskSecret || riskSecret.length < 32 || !captchaSecret || !siteKey) return null
  if (process.env.NODE_ENV === "production" && (captchaSecret === "0x0000000000000000000000000000000000000000" || siteKey.includes("ffff-ffff"))) return null
  try {
    const url = new URL(site)
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null
    return { origin: url.origin, riskSecret, captchaSecret, siteKey }
  } catch { return null }
}

export function guestRequestIdentity(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return null
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : process.env.NODE_ENV !== "production" ? "127.0.0.1" : null
  return ip && isIP(ip) ? ip : null
}

export function issueGuestCapability(secret: string) {
  const payload = `${randomBytes(32).toString("hex")}.${Math.floor(Date.now() / 1000) + 7 * 86400}`
  const signature = guestRiskKey(secret, "session", payload)
  return `${payload}.${signature}`
}

export function readGuestCapability(request: Request, secret: string) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${GUEST_COOKIE}=`))
  if (matches.length !== 1) return null
  const value = matches[0].slice(GUEST_COOKIE.length + 1)
  if (!/^[a-f0-9]{64}\.[0-9]{10}\.[a-f0-9]{64}$/.test(value)) return null
  const [nonce, expiry, signature] = value.split(".")
  const now = Math.floor(Date.now() / 1000)
  if (Number(expiry) <= now || Number(expiry) > now + 7 * 86400) return null
  const expected = guestRiskKey(secret, "session", `${nonce}.${expiry}`)
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? value : null
}

export function guestRiskKey(secret: string, scope: string, value: string) {
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex")
}

export async function readGuestJson(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new Error("invalid_body")
  const reader = request.body?.getReader()
  if (!reader) throw new Error("invalid_body")
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) { await reader.cancel(); throw new Error("invalid_body") }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
}

export async function verifyGuestCaptcha(config: NonNullable<ReturnType<typeof guestIntakeConfiguration>>, token: string, ip: string) {
  try {
    const response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.captchaSecret, sitekey: config.siteKey, response: token, remoteip: ip }),
    })
    if (!response.ok) return false
    const result: unknown = await response.json()
    return Boolean(result && typeof result === "object" && "success" in result && result.success === true)
  } catch { return false }
}
