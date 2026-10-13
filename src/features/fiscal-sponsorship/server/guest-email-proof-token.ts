import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

export function guestEmailProofSecret() {
  const secret = process.env.FISCAL_GUEST_LINK_SECRET
  return secret && secret.length >= 32 ? secret : null
}
export function signGuestEmailProof(jobId: string, nonce: string, expiresAt: string, secret: string) {
  const payload = `v1.${jobId}.${nonce}.${Math.floor(new Date(expiresAt).getTime() / 1000)}`
  return `${payload}.${createHmac("sha256", secret).update(`fiscal-email:${payload}`).digest("hex")}`
}
export function validGuestEmailProof(token: string, secret: string) {
  if (!/^v1\.[a-f0-9-]{36}\.[a-f0-9]{64}\.[0-9]{10}\.[a-f0-9]{64}$/.test(token)) return false
  const [version, jobId, nonce, expiry, signature] = token.split(".")
  const now = Math.floor(Date.now() / 1000)
  if (Number(expiry) <= now || Number(expiry) > now + 7 * 86400) return false
  const expected = createHmac("sha256", secret).update(`fiscal-email:${version}.${jobId}.${nonce}.${expiry}`).digest("hex")
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
