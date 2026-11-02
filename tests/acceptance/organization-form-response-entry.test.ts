import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireFormResponseSession, requireFormSourceSession } from "@/features/organization-forms/server/response-entry"
import { formSourcePath } from "@/features/organization-forms/lib/form-source-link"
import { formResponsePath } from "@/features/organization-forms/lib/form-response-link"
import { getSafePostLoginRedirectPath } from "@/lib/auth/redirects"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.create }))
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND") },
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
}))
const versionId = "10000000-0000-4000-8000-000000000080"
beforeEach(() => {
  vi.resetAllMocks()
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.auth } })
})

describe("isolated response entry", () => {
  it.each(["not-a-version", "../workspace", "https://elsewhere.test"]) ("rejects malformed locators before session work: %s", async (value) => {
    await expect(requireFormResponseSession(value)).rejects.toThrow("NOT_FOUND")
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "untrusted-session" } }, error: { message: "Expired" } },
  ])("requires verified sign-in and preserves the exact return destination", async (result) => {
    mocks.auth.mockResolvedValue(result)
    const path = formResponsePath(versionId)
    await expect(requireFormResponseSession(versionId)).rejects.toThrow(`REDIRECT:/login?redirect=${encodeURIComponent(path)}`)
    expect(getSafePostLoginRedirectPath(path)).toBe(path)
  })
  it("allows a verified account to enter without selecting or joining an organization", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
    await expect(requireFormResponseSession(versionId)).resolves.toBeUndefined()
    // No organization table or admin client exists in this session mock. Private
    // reads still go through the separately tested form intake authorization.
    expect(mocks.auth).toHaveBeenCalledTimes(1)
  })
})


describe("isolated draft entry", () => {
  const org = "10000000-0000-4000-8000-000000000001"
  const form = "10000000-0000-4000-8000-000000000020"
  it.each([["bad-org", form], [org, "../workspace"]])("rejects malformed targets before session work", async (organizationId, formId) => {
    await expect(requireFormSourceSession(organizationId, formId)).rejects.toThrow("NOT_FOUND")
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("preserves the exact draft return destination through sign-in", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    const path = formSourcePath(org, form)
    await expect(requireFormSourceSession(org, form)).rejects.toThrow(`REDIRECT:/login?redirect=${encodeURIComponent(path)}`)
    expect(getSafePostLoginRedirectPath(path)).toBe(path)
  })
  it("enters with verified identity without joining or selecting an organization", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
    await expect(requireFormSourceSession(org, form)).resolves.toBeUndefined()
    expect(mocks.auth).toHaveBeenCalledTimes(1)
  })
})
