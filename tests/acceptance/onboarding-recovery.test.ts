import { afterEach, describe, expect, it, vi } from "vitest"
import { clearOnboardingDraft, onboardingDraftStorageKey, readOnboardingDraft, writeOnboardingDraft } from "@/components/onboarding/onboarding-dialog/draft"
import { resolveDraftFieldValue } from "@/components/onboarding/onboarding-dialog/state-helpers"
import { isCompletedOnboardingDestination, submitOnboardingWithRecovery } from "@/components/onboarding/onboarding-dialog/hooks/use-onboarding-submission"
import { restoreOnboardingAvatar, serializeOnboardingAvatar } from "@/components/onboarding/onboarding-dialog/avatar-draft"
import { buildOnboardingFlowDefaults } from "@/lib/onboarding/defaults"

afterEach(() => vi.unstubAllGlobals())
function storage() {
  const values = new Map<string, string>()
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })
  return values
}

describe("onboarding draft recovery", () => {
  it("isolates accounts, organizations and phases and ignores unowned legacy drafts", () => {
    storage()
    writeOnboardingDraft({ values: { orgName: "Legacy" } })
    writeOnboardingDraft({ stepId: "community", values: { orgName: "Changed name" } }, "user-a:org-a:workspace_setup")
    expect(readOnboardingDraft("user-a:org-a:workspace_setup")?.values?.orgName).toBe("Changed name")
    expect(readOnboardingDraft("user-b:org-a:workspace_setup")).toBeNull()
    expect(readOnboardingDraft("user-a:org-b:workspace_setup")).toBeNull()
    expect(readOnboardingDraft("user-a:org-a:post_signup_access")).toBeNull()
  })
  it("restores failed edits and intentional clears over saved defaults", () => {
    const defaults = { orgName: "Saved name", phone: "555" }
    expect(resolveDraftFieldValue(defaults, "orgName", "New unsaved name")).toBe("New unsaved name")
    expect(resolveDraftFieldValue(defaults, "phone", "")).toBe("")
    expect(resolveDraftFieldValue(defaults, "orgName", undefined)).toBe("Saved name")
  })
  it("expires old drafts and only clears the completed scope", () => {
    const values = storage()
    writeOnboardingDraft({ values: { orgName: "Current" } }, "current")
    values.set(onboardingDraftStorageKey("old"), JSON.stringify({ savedAt: Date.now() - 8 * 86400000, values: { orgName: "Old" } }))
    expect(readOnboardingDraft("old")).toBeNull()
    clearOnboardingDraft("old")
    expect(readOnboardingDraft("current")?.values?.orgName).toBe("Current")
  })
  it("keeps the form usable when browser storage is unavailable", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Storage blocked") } })
    expect(() => writeOnboardingDraft({}, "scope")).not.toThrow()
    expect(() => clearOnboardingDraft("scope")).not.toThrow()
    expect(readOnboardingDraft("scope")).toBeNull()
  })
  it("cleans up only confirmed completion redirects, not errors or authentication", () => {
    expect(isCompletedOnboardingDestination("/workspace?onboarding_flow=1&source=onboarding")).toBe(true)
    expect(isCompletedOnboardingDestination("/workspace?source=onboarding_setup")).toBe(true)
    expect(isCompletedOnboardingDestination("/find?member_onboarding=0&source=member_onboarding")).toBe(true)
    for (const href of ["/onboarding?error=slug_taken", "/login?redirect=/onboarding", "/workspace?source=onboarding&error=failed", "//outside.example/workspace", "/workspace"]) expect(isCompletedOnboardingDestination(href)).toBe(false)
  })
  it("retains rejected submissions, then clears only after the retry succeeds", async () => {
    storage()
    writeOnboardingDraft({ values: { orgName: "Unsaved organization" } }, "account:org")
    const onError = vi.fn()
    const failed = await submitOnboardingWithRecovery({ onSubmit: async () => { throw new Error("Network failed") }, form: new FormData(), draftScope: "account:org", onError })
    expect(failed).toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("entries are still here"))
    expect(readOnboardingDraft("account:org")?.values?.orgName).toBe("Unsaved organization")
    const saved = await submitOnboardingWithRecovery({ onSubmit: async () => {}, form: new FormData(), draftScope: "account:org", onError })
    expect(saved).toBe(true)
    expect(readOnboardingDraft("account:org")).toBeNull()
  })
  it("retains drafts for validation redirects and clears confirmed success redirects", async () => {
    storage()
    for (const [destination, retained] of [["/onboarding?error=slug_taken", true], ["/login?redirect=/onboarding", true], ["/workspace?source=onboarding", false]] as const) {
      writeOnboardingDraft({ values: { orgName: "Draft" } }, "scope")
      const error = Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${destination};307;` })
      await expect(submitOnboardingWithRecovery({ onSubmit: async () => { throw error }, form: new FormData(), draftScope: "scope", onError: vi.fn() })).rejects.toBe(error)
      expect(Boolean(readOnboardingDraft("scope"))).toBe(retained)
    }
  })
  it("restores a cropped photo as an actual upload after reload", async () => {
    const files: File[] = []
    vi.stubGlobal("DataTransfer", class { files = files; items = { add: (file: File) => files.push(file) } })
    const input = { files: null }
    const form = { querySelector: () => input } as unknown as HTMLFormElement
    const url = await serializeOnboardingAvatar(new Blob(["image-bytes"], { type: "image/png" }))
    expect(restoreOnboardingAvatar(form, url)).toBe(true)
    expect(await files[0].text()).toBe("image-bytes")
    expect(files[0].type).toBe("image/png")
    expect(restoreOnboardingAvatar(form, "blob:expired")).toBe(false)
    expect(restoreOnboardingAvatar(form, "data:image/svg+xml;base64,AAA=")).toBe(false)
  })
  it("builds scope from authenticated account and selected organization", () => {
    const defaults = buildOnboardingFlowDefaults({ userId: "user", organizationId: "org", email: null, displayName: null, avatarUrl: null, userMetadata: null, orgProfile: null, orgSlug: null })
    expect(defaults.draftScope).toBe("user:org")
  })
})
