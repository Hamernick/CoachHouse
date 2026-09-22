vi.mock("@/actions/public-profile-settings", () => ({
  refreshPublicProfileAction: vi.fn(),
}))
vi.mock("@/actions/account-email-preferences", () => ({
  saveAccountEmailPreferencesAction: vi.fn().mockResolvedValue({ ok: true }),
}))
import { beforeEach, describe, expect, it, vi } from "vitest"

import { saveProfileSettings } from "@/components/account-settings/account-settings-dialog-state-helpers"

function buildSupabaseStub() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn((table: string) => {
    if (table !== "profiles") {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { upsert }
  })

  return {
    supabase: {
      from,
      auth: {
        updateUser,
      },
    } as never,
    calls: {
      from,
      upsert,
      updateUser,
    },
  }
}

describe("account settings profile helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("persists internal member profile fields on profiles without touching auth metadata when name and phone are unchanged", async () => {
    const { supabase, calls } = buildSupabaseStub()

    const result = await saveProfileSettings({
      supabase,
      userId: "user-1",
      firstName: "Jordan",
      lastName: "Rivers",
      title: "  Board member  ",
      company: "  Bright Futures Collective  ",
      contact: "  jordan@example.com  ",
      about: "  Volunteer operator and advisor.  ",
      phone: "555-1000",
      initialFirstName: "Jordan",
      initialLastName: "Rivers",
      initialTitle: "",
      initialCompany: "",
      initialContact: "",
      initialAbout: "",
      initialPhone: "555-1000",
    })

    expect(calls.from).toHaveBeenCalledWith("profiles")
    expect(calls.upsert).toHaveBeenCalledWith(
      {
        id: "user-1",
        full_name: "Jordan Rivers",
        headline: "Board member",
        company: "Bright Futures Collective",
        contact: "jordan@example.com",
        about: "Volunteer operator and advisor.",
      },
      { onConflict: "id" }
    )
    expect(calls.updateUser).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      title: "Board member",
      company: "Bright Futures Collective",
      contact: "jordan@example.com",
      about: "Volunteer operator and advisor.",
      initialTitle: "Board member",
      initialCompany: "Bright Futures Collective",
      initialContact: "jordan@example.com",
      initialAbout: "Volunteer operator and advisor.",
    })
  })

  it("updates auth metadata only for full name and phone changes", async () => {
    const { supabase, calls } = buildSupabaseStub()

    const result = await saveProfileSettings({
      supabase,
      userId: "user-2",
      firstName: "  Taylor ",
      lastName: " Brooks  ",
      title: "Advisor",
      company: "Acme Foundation",
      contact: "",
      about: "",
      phone: "555-2222",
      initialFirstName: "Casey",
      initialLastName: "Brooks",
      initialTitle: "Advisor",
      initialCompany: "Acme Foundation",
      initialContact: "",
      initialAbout: "",
      initialPhone: "555-1111",
    })

    expect(calls.upsert).toHaveBeenCalledWith(
      {
        id: "user-2",
        full_name: "Taylor Brooks",
        headline: "Advisor",
        company: "Acme Foundation",
        contact: null,
        about: null,
      },
      { onConflict: "id" }
    )
    expect(calls.updateUser).toHaveBeenCalledTimes(2)
    expect(calls.updateUser).toHaveBeenNthCalledWith(1, {
      data: {
        full_name: "Taylor Brooks",
        first_name: "Taylor",
        last_name: "Brooks",
      },
    })
    expect(calls.updateUser).toHaveBeenNthCalledWith(2, {
      data: { phone: "555-2222" },
    })
    expect(result).toMatchObject({
      firstName: "Taylor",
      lastName: "Brooks",
      initialFirstName: "Taylor",
      initialLastName: "Brooks",
      initialPhone: "555-2222",
    })
  })
})
