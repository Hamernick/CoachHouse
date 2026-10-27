import { describe, expect, it } from "vitest"

import {
  resolveDevtoolsAudience,
  resolveProfileAudience,
  resolveTesterMetadata,
} from "@/lib/devtools/audience"

function createSupabaseProfileStub<T>(result: { data: T | null; error: unknown | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  } as unknown
}

describe("devtools audience", () => {
  it.each(["coach", "developer", null] as const)(
    "preserves only verified %s staff access when the profile lookup fails",
    async (accessLevel) => {
      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                table === "platform_staff_members"
                  ? { data: accessLevel ? { access_level: accessLevel } : null, error: null }
                  : { data: { role: "admin" }, error: { code: "57014", message: "query timeout" } },
            }),
          }),
        }),
      }
      const input = { supabase: supabase as never, userId: "staff-user" }
      await expect(resolveProfileAudience(input)).resolves.toMatchObject({
        platformAccessLevel: accessLevel,
        isPlatformStaff: accessLevel !== null,
        isAdmin: accessLevel === "developer",
        fullName: null,
      })
      await expect(resolveDevtoolsAudience(input)).resolves.toEqual({
        isAdmin: accessLevel === "developer", isTester: false,
      })
    }
  )

  it("does not grant access when the authoritative staff lookup fails", async () => {
    const failure = { code: "57014", message: "staff lookup unavailable" }
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => table === "platform_staff_members"
              ? { data: null, error: failure }
              : { data: { role: "admin", is_tester: false }, error: null },
          }),
        }),
      }),
    }
    const input = { supabase: supabase as never, userId: "staff-user" }
    await expect(resolveProfileAudience(input)).rejects.toEqual(failure)
    await expect(resolveDevtoolsAudience(input)).rejects.toEqual(failure)
  })

  it("detects tester metadata flags from auth user metadata", () => {
    expect(resolveTesterMetadata({ qa_tester: true })).toBe(true)
    expect(resolveTesterMetadata({ tester: true })).toBe(true)
    expect(resolveTesterMetadata({ is_tester: true })).toBe(true)
    expect(resolveTesterMetadata({ is_tester: false })).toBe(false)
  })

  it("uses explicit profile tester false over metadata fallback true", async () => {
    const supabase = createSupabaseProfileStub({
      data: { role: "member", is_tester: false },
      error: null,
    })

    const audience = await resolveDevtoolsAudience({
      supabase: supabase as never,
      userId: "user-1",
      fallbackIsTester: true,
    })

    expect(audience).toEqual({ isAdmin: false, isTester: false })
  })

  it("falls back to metadata tester flag when profile tester value is null", async () => {
    const supabase = createSupabaseProfileStub({
      data: { role: "member", is_tester: null },
      error: null,
    })

    const audience = await resolveDevtoolsAudience({
      supabase: supabase as never,
      userId: "user-1",
      fallbackIsTester: true,
    })

    expect(audience).toEqual({ isAdmin: false, isTester: true })
  })

  it("keeps profile audience in sync with explicit profile tester false", async () => {
    const supabase = createSupabaseProfileStub({
      data: {
        full_name: "Sample User",
        avatar_url: "https://example.com/avatar.png",
        role: "member",
        is_tester: false,
      },
      error: null,
    })

    const audience = await resolveProfileAudience({
      supabase: supabase as never,
      userId: "user-1",
      fallbackIsTester: true,
    })

    expect(audience.isTester).toBe(false)
    expect(audience.fullName).toBe("Sample User")
  })
})
