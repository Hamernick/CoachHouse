import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"

export const oauthHash = (value: string) => createHash("sha256").update(value).digest("hex")
export const oauthRandom = () => randomBytes(32).toString("base64url")
export const oauthChallenge = (value: string) => createHash("sha256").update(value).digest("base64url")

export function oauthEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Separate AAD contexts prevent swapping transaction verifiers and grant tokens.
export function encryptOAuth(value: unknown, encodedKey: string, context: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(encodedKey, "base64"), iv)
  cipher.setAAD(Buffer.from(`coach-house-companion:${context}`))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptOAuth<T>(value: string, encodedKey: string, context: string): T {
  const [version, iv, tag, encrypted, extra] = value.split(".")
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("Invalid encrypted connection state")
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(encodedKey, "base64"), Buffer.from(iv, "base64url"))
  decipher.setAAD(Buffer.from(`coach-house-companion:${context}`))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")) as T
}
