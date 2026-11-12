import { z } from "zod"

/** Rolling deployments may still return the former HTTPS Storage URL. Local
 * file addresses are restricted to authenticated content routes, not arbitrary
 * relative paths, protocol-relative hosts or browser-executable schemes. */
export const privateFileUrlSchema = z.string().refine(value => {
  if (/^https:\/\//.test(value)) return z.url({ protocol: /^https$/ }).safeParse(value).success
  if (!/^\/api\/account\/(organization-document-files|org-documents|org-policies\/document)\?/.test(value)) return false
  const url = new URL(value, "https://local.invalid")
  return url.origin === "https://local.invalid" && url.searchParams.get("content") === "1" && !url.hash
}, "This file address is unavailable.")
