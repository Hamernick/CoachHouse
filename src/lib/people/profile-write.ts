import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase"

const MAX_PROFILE_WRITE_ATTEMPTS = 4

export const PEOPLE_PROFILE_WRITE_CONFLICT_ERROR =
  "People changed while you were saving. Try again."

type OrganizationProfile = Record<string, unknown>

type OrganizationProfileSnapshot = {
  exists: boolean
  profile: OrganizationProfile
  revision: string | null
}

type ReadSnapshotResult =
  | { snapshot: OrganizationProfileSnapshot }
  | { error: string }

type ProfileMutation<T> =
  | { ok: true; changed: false; value: T }
  | {
      ok: true
      changed: true
      nextProfile: OrganizationProfile
      value: T
    }
  | { error: string }

type WriteSnapshotResult =
  | { status: "written" }
  | { status: "conflict" }
  | { status: "error"; error: string }

export async function commitPeopleProfileMutation<T>({
  readSnapshot,
  applyMutation,
  writeSnapshot,
  maxAttempts = MAX_PROFILE_WRITE_ATTEMPTS,
}: {
  readSnapshot: () => Promise<ReadSnapshotResult>
  applyMutation: (profile: OrganizationProfile) => ProfileMutation<T>
  writeSnapshot: (
    snapshot: OrganizationProfileSnapshot,
    nextProfile: OrganizationProfile
  ) => Promise<WriteSnapshotResult>
  maxAttempts?: number
}): Promise<{ ok: true; value: T } | { error: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const readResult = await readSnapshot()
    if ("error" in readResult) return readResult

    const mutation = applyMutation(readResult.snapshot.profile)
    if ("error" in mutation) return mutation
    if (!mutation.changed) return { ok: true, value: mutation.value }

    const writeResult = await writeSnapshot(
      readResult.snapshot,
      mutation.nextProfile
    )
    if (writeResult.status === "written") {
      return { ok: true, value: mutation.value }
    }
    if (writeResult.status === "error") {
      return { error: writeResult.error }
    }
  }

  return { error: PEOPLE_PROFILE_WRITE_CONFLICT_ERROR }
}

type OrganizationPeopleMutation<TPerson, TValue> =
  | { ok: true; changed: false; value: TValue }
  | { ok: true; changed: true; people: TPerson[]; peopleRoles?: string[]; value: TValue }
  | { error: string }

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505"
}

export async function mutateOrganizationPeopleProfile<TPerson, TValue>({
  supabase,
  orgId,
  mutate,
}: {
  supabase: SupabaseClient<Database>
  orgId: string
  mutate: (
    people: TPerson[],
    profile: OrganizationProfile
  ) => OrganizationPeopleMutation<TPerson, TValue>
}): Promise<{ ok: true; value: TValue } | { error: string }> {
  return commitPeopleProfileMutation({
    readSnapshot: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("profile, updated_at")
        .eq("user_id", orgId)
        .maybeSingle<{
          profile: OrganizationProfile | null
          updated_at: string
        }>()

      if (error) return { error: error.message }
      return {
        snapshot: {
          exists: Boolean(data),
          profile: data?.profile ?? {},
          revision: data?.updated_at ?? null,
        },
      }
    },
    applyMutation: (profile) => {
      const people = Array.isArray(profile.org_people)
        ? ([...profile.org_people] as TPerson[])
        : []
      const result = mutate(people, profile)
      if ("error" in result || !result.changed) return result
      return {
        ok: true,
        changed: true,
        nextProfile: { ...profile, org_people: result.people, ...(result.peopleRoles ? { people_roles: result.peopleRoles } : {}) },
        value: result.value,
      }
    },
    writeSnapshot: async (snapshot, nextProfile) => {
      const profile =
        nextProfile as Database["public"]["Tables"]["organizations"]["Update"]["profile"]

      if (!snapshot.exists) {
        const { data, error } = await supabase
          .from("organizations")
          .insert({ user_id: orgId, profile })
          .select("updated_at")
          .maybeSingle<{ updated_at: string }>()

        if (isUniqueViolation(error)) return { status: "conflict" }
        if (error) return { status: "error", error: error.message }
        return data ? { status: "written" } : { status: "conflict" }
      }

      if (!snapshot.revision) return { status: "conflict" }
      const { data, error } = await supabase
        .from("organizations")
        .update({ profile })
        .eq("user_id", orgId)
        .eq("updated_at", snapshot.revision)
        .select("updated_at")
        .maybeSingle<{ updated_at: string }>()

      if (error) return { status: "error", error: error.message }
      return data ? { status: "written" } : { status: "conflict" }
    },
  })
}
