import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"

import {
  commitPeopleProfileMutation,
  mutateOrganizationPeopleProfile,
  PEOPLE_PROFILE_WRITE_CONFLICT_ERROR,
} from "@/lib/people/profile-write"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("People profile write concurrency", () => {
  it("retries a stale write and preserves the concurrent profile change", async () => {
    let revision = "revision-1"
    let profile: Record<string, unknown> = {
      mission: "Keep this",
      org_people: [{ id: "person-a", name: "A", title: "Old" }],
    }
    let injectConcurrentChange = true

    const result = await commitPeopleProfileMutation({
      readSnapshot: async () => ({
        snapshot: {
          exists: true,
          profile: structuredClone(profile),
          revision,
        },
      }),
      applyMutation: (snapshotProfile) => {
        const people = Array.isArray(snapshotProfile.org_people)
          ? (snapshotProfile.org_people as Array<Record<string, unknown>>)
          : []
        return {
          ok: true,
          changed: true,
          nextProfile: {
            ...snapshotProfile,
            org_people: people.map((person) =>
              person.id === "person-a" ? { ...person, title: "New" } : person
            ),
          },
          value: "saved",
        }
      },
      writeSnapshot: async (snapshot, nextProfile) => {
        if (injectConcurrentChange) {
          profile = {
            ...profile,
            org_people: [
              ...(profile.org_people as Array<Record<string, unknown>>),
              { id: "person-b", name: "B" },
            ],
          }
          revision = "revision-2"
          injectConcurrentChange = false
        }
        if (snapshot.revision !== revision) return { status: "conflict" }
        profile = nextProfile
        revision = "revision-3"
        return { status: "written" }
      },
    })

    expect(result).toEqual({ ok: true, value: "saved" })
    expect(profile.mission).toBe("Keep this")
    expect(profile.org_people).toEqual([
      { id: "person-a", name: "A", title: "New" },
      { id: "person-b", name: "B" },
    ])
  })

  it("returns a clear error after bounded conflict retries", async () => {
    let readCount = 0
    let writeCount = 0
    const result = await commitPeopleProfileMutation({
      maxAttempts: 3,
      readSnapshot: async () => {
        readCount += 1
        return {
          snapshot: {
            exists: true,
            profile: { org_people: [] },
            revision: `revision-${readCount}`,
          },
        }
      },
      applyMutation: () => ({
        ok: true,
        changed: true,
        nextProfile: { org_people: [] },
        value: null,
      }),
      writeSnapshot: async () => {
        writeCount += 1
        return { status: "conflict" }
      },
    })

    expect(result).toEqual({ error: PEOPLE_PROFILE_WRITE_CONFLICT_ERROR })
    expect(readCount).toBe(3)
    expect(writeCount).toBe(3)
  })

  it("atomically retries role creation alongside concurrent role and profile edits", async () => {
    let stored = { mission: "Original", org_people: [{ id: "a", customRole: null as string | null }], people_roles: [] as string[] }
    let attempted: typeof stored | null = null
    let writes = 0
    const query = {
      select: () => query,
      eq: () => query,
      update: ({ profile }: { profile: typeof stored }) => { attempted = profile; return query },
      maybeSingle: async () => {
        if (!attempted) return { data: { profile: structuredClone(stored), updated_at: String(writes) }, error: null }
        writes += 1
        if (writes === 1) {
          stored = { ...stored, mission: "Concurrent edit", people_roles: ["Mentor"] }
          attempted = null
          return { data: null, error: null }
        }
        stored = attempted
        attempted = null
        return { data: { updated_at: String(writes) }, error: null }
      },
    }
    const result = await mutateOrganizationPeopleProfile<{ id: string; customRole: string | null }, null>({
      supabase: { from: () => query } as unknown as SupabaseClient<Database>,
      orgId: "org-a",
      mutate: (people, profile) => ({
        ok: true, changed: true, value: null,
        people: people.map((person) => ({ ...person, customRole: "Partner" })),
        peopleRoles: [...(profile.people_roles as string[]), "Partner"],
      }),
    })
    expect(result).toEqual({ ok: true, value: null })
    expect(writes).toBe(2)
    expect(stored).toEqual({ mission: "Concurrent edit", org_people: [{ id: "a", customRole: "Partner" }], people_roles: ["Mentor", "Partner"] })
  })

  it("skips the database write for an unchanged mutation", async () => {
    let writeCount = 0
    const result = await commitPeopleProfileMutation({
      readSnapshot: async () => ({
        snapshot: {
          exists: true,
          profile: { org_people: [] },
          revision: "revision-1",
        },
      }),
      applyMutation: () => ({
        ok: true,
        changed: false,
        value: "unchanged",
      }),
      writeSnapshot: async () => {
        writeCount += 1
        return { status: "written" }
      },
    })

    expect(result).toEqual({ ok: true, value: "unchanged" })
    expect(writeCount).toBe(0)
  })

  it("guards every interactive People profile writer", () => {
    const actions = readSource("src/actions/people.ts")
    const positions = readSource("src/app/api/people/position/route.ts")
    const resetPositions = readSource(
      "src/app/api/people/position/reset/route.ts"
    )
    const writer = readSource("src/lib/people/profile-write.ts")

    expect(actions.match(/mutateOrganizationPeopleProfile</g)?.length).toBe(5)
    expect(actions).not.toContain(".upsert({ user_id: orgId, profile:")
    expect(positions).toContain("mutateOrganizationPeopleProfile<")
    expect(resetPositions).toContain("mutateOrganizationPeopleProfile<")
    expect(writer).toContain('.eq("updated_at", snapshot.revision)')
    expect(writer).toContain("MAX_PROFILE_WRITE_ATTEMPTS = 4")
  })

  it("guards automatic onboarding writes and keeps directory reads read-only", () => {
    const onboarding = readSource("src/app/(dashboard)/onboarding/actions.ts")
    const onboardingWriter = readSource(
      "src/lib/onboarding/organization-profile-write.ts"
    )
    const invites = readSource(
      "src/app/actions/organization-access/invites-helpers.ts"
    )
    const memberDirectory = readSource(
      "src/features/member-workspace/server/loaders.ts"
    )

    expect(onboarding).toContain("writeOnboardingOrganizationProfile({")
    expect(onboardingWriter).toContain("commitPeopleProfileMutation({")
    expect(onboardingWriter).toContain('.eq("updated_at", snapshot.revision)')
    expect(onboarding).not.toContain(
      ".upsert(\n        {\n          user_id: targetOrgId"
    )
    expect(invites).toContain("mutateOrganizationPeopleProfile<")
    expect(memberDirectory).not.toContain("mutateOrganizationPeopleProfile<")
    expect(memberDirectory).toContain("...selfExisting")
    expect(memberDirectory).toContain("const sync = synchronizeSelf(peopleRaw)")
    expect(memberDirectory).not.toContain(
      ".upsert({ user_id: orgId, profile: nextProfile }"
    )
  })
})
