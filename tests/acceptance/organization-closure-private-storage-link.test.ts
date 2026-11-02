import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc = vi.hoisted(() => vi.fn())
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { createPrivateOrganizationLink } from "@/lib/organization/private-storage-link"
const instant = Date.parse("2026-11-02T12:00:00Z")
const window = (seconds: number, elapsed = 0) => ({ data: { serverNow: new Date(instant + elapsed * 1000).toISOString(), expiresAt: new Date(instant + seconds * 1000).toISOString() }, error: null })
const link = (seconds: number) => ({ data: { signedUrl: `https://storage.example/object?token=a.${Buffer.from(JSON.stringify({ exp: instant / 1000 + seconds })).toString("base64url")}.b` }, error: null })
describe("organization client download deadline", () => {
 beforeEach(() => rpc.mockReset())
 it("bounds provider expiry to remaining fixed export window and rechecks original authority", async () => {
  rpc.mockResolvedValue(window(15))
  const sign = vi.fn().mockResolvedValue(link(14)); const revalidate = vi.fn().mockResolvedValue(true)
  const result = await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign, revalidate })
  expect(result.error).toBeNull(); expect(sign).toHaveBeenCalledWith(14); expect(revalidate).toHaveBeenCalledOnce(); expect(rpc).toHaveBeenCalledTimes(2)
 })
 it("withholds a provider response whose actual token expiry exceeds the deadline", async () => {
  rpc.mockResolvedValue(window(15)); const revalidate = vi.fn()
  const result = await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => link(16), revalidate })
  expect(result.data).toBeNull(); expect(revalidate).not.toHaveBeenCalled()
 })
 it("discards signing completion after fixed expiry", async () => {
  rpc.mockResolvedValueOnce(window(15)).mockResolvedValueOnce(window(15, 16))
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => link(14), revalidate: async () => true })).data).toBeNull()
 })
 it("discards revoked resource authority even while organization remains readable", async () => {
  rpc.mockResolvedValue(window(900))
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => link(899), revalidate: async () => false })).data).toBeNull()
 })
 it("withholds a link after a newly observed earlier deadline", async () => {
  rpc.mockResolvedValueOnce(window(900)).mockResolvedValueOnce(window(60))
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => link(899), revalidate: async () => true })).data).toBeNull()
 })
 it.each([null, { serverNow: "bad", expiresAt: "bad" }, { serverNow: new Date(instant).toISOString(), expiresAt: new Date(instant).toISOString() }])("does not issue links without current admission", async data => {
  rpc.mockResolvedValue({ data, error: null }); const sign = vi.fn()
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign, revalidate: async () => true })).data).toBeNull(); expect(sign).not.toHaveBeenCalled()
 })
 it("fails closed for unavailable authority and malformed provider tokens", async () => {
  rpc.mockResolvedValue(window(900))
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => ({ data: { signedUrl: "https://storage.example/no-token" }, error: null }), revalidate: async () => true })).data).toBeNull()
  rpc.mockResolvedValue({ data: null, error: new Error("unavailable") })
  expect((await createPrivateOrganizationLink({ orgId: "org", ttl: 900, sign: async () => link(899), revalidate: async () => true })).data).toBeNull()
 })
})
