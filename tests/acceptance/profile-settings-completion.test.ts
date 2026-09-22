import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseServerClientServerMock } from "./test-utils"
import {
  setPublicProfileVisibilityAction,
  savePublicProfileDetailsAction,
} from "@/actions/public-profile-settings"
import { saveAccountEmailPreferencesAction } from "@/actions/account-email-preferences"
import { checkEmailDeliveryPreferences } from "@/lib/email/delivery-preferences"

const admin = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}))
const rpc = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: { ok: true }, error: null })
  createSupabaseServerClientServerMock.mockResolvedValue({ rpc })
})

describe("profile saves", () => {
  it("updates only visibility, never accepting stale identity or privacy flags", async () => {
    expect(await setPublicProfileVisibilityAction(true)).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith("set_person_public_profile_visibility", {
      p_is_public: true,
    })
  })
  it("does not report success when the database refuses a save", async () => {
    rpc.mockResolvedValue({ data: { ok: false }, error: null })
    expect((await setPublicProfileVisibilityAction(true)).ok).toBe(false)
  })
  it("rejects executable website URLs before a database write", async () => {
    expect(
      (
        await savePublicProfileDetailsAction({
          bio: "Hello",
          location: "City",
          website: "javascript:alert(1)",
        })
      ).ok
    ).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
  it("saves only explicitly public fields, including clearing old values", async () => {
    await savePublicProfileDetailsAction({
      bio: " Public bio ",
      location: "",
      website: "",
    })
    expect(rpc).toHaveBeenCalledWith("save_person_public_profile_details", {
      p_bio: "Public bio",
      p_location_label: null,
      p_website_url: null,
    })
  })
  it("writes only the email choices changed in this form", async () => {
    await saveAccountEmailPreferencesAction({
      marketingOptIn: false,
      newsletterOptIn: null,
    })
    expect(rpc).toHaveBeenCalledWith("save_account_email_preferences", {
      p_marketing_opt_in: false,
      p_newsletter_opt_in: null,
    })
  })
})

function preferenceRows(
  suppressed: unknown[],
  preferences: unknown[],
  error: unknown = null
) {
  admin.from.mockImplementation((table: string) => ({
    select: () =>
      table === "platform_email_suppressions"
        ? { in: async () => ({ data: suppressed, error }) }
        : { eq: () => ({ in: async () => ({ data: preferences, error }) }) },
  }))
}
describe("optional email delivery", () => {
  it("honors a topic unsubscribe", async () => {
    preferenceRows(
      [],
      [{ email: "person@example.test", status: "unsubscribed" }]
    )
    expect(
      await checkEmailDeliveryPreferences(
        ["person@example.test"],
        "product_updates"
      )
    ).toMatch(/not subscribed/)
  })
  it("never overrides suppression with a topic opt-in", async () => {
    preferenceRows(
      [{ email: "person@example.test" }],
      [{ email: "person@example.test", status: "subscribed" }]
    )
    expect(
      await checkEmailDeliveryPreferences(["person@example.test"], "newsletter")
    ).toMatch(/disabled/)
  })
  it("checks every actual recipient, not the unsubscribe-link recipient", async () => {
    preferenceRows([], [{ email: "person@example.test", status: "subscribed" }])
    expect(
      await checkEmailDeliveryPreferences(
        ["person@example.test", "other@example.test"],
        "newsletter"
      )
    ).toMatch(/not subscribed/)
  })
  it("allows opted-in recipients and keeps required account notices available", async () => {
    preferenceRows([], [{ email: "person@example.test", status: "subscribed" }])
    expect(
      await checkEmailDeliveryPreferences(
        [" Person@Example.Test "],
        "newsletter"
      )
    ).toBeNull()
    expect(
      await checkEmailDeliveryPreferences(
        ["other@example.test"],
        "transactional"
      )
    ).toBeNull()
  })
  it("fails closed when preferences cannot be read", async () => {
    preferenceRows([], [], { message: "Unavailable" })
    expect(
      await checkEmailDeliveryPreferences(["person@example.test"], "newsletter")
    ).toMatch(/Unable to verify/)
  })
})
