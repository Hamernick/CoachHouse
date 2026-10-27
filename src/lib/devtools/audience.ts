import type { SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"

import {
  resolveLegacyPlatformAccessLevel,
  type PlatformAccessLevel,
} from "@/features/platform-access"
import { loadPlatformAccessLevel } from "@/lib/admin/platform-access"
import type { Database } from "@/lib/supabase"

type DevtoolsAudienceOptions = {
  supabase: SupabaseClient<Database, "public">
  userId: string
  fallbackIsTester?: boolean
}

export type DevtoolsAudience = {
  isAdmin: boolean
  isTester: boolean
}

export type ProfileAudience = {
  fullName: string | null
  avatarUrl: string | null
  headline: string | null
  isAdmin: boolean
  isPlatformStaff: boolean
  platformAccessLevel: PlatformAccessLevel | null
  isTester: boolean
}

type ProfileRowWithTester = {
  role: string | null
  is_tester: boolean | null
}

type ProfileRowWithoutTester = {
  role: string | null
}

type ProfileAudienceWithTester = {
  full_name: string | null
  avatar_url: string | null
  headline: string | null
  role: string | null
  is_tester: boolean | null
}

type ProfileAudienceWithoutTester = {
  full_name: string | null
  avatar_url: string | null
  headline: string | null
  role: string | null
}

type QueryResult<T> = {
  data: T | null
  error: unknown | null
}

function resolveIsTesterFlag({
  profileTesterValue,
  fallbackIsTester,
}: {
  profileTesterValue: boolean | null | undefined
  fallbackIsTester: boolean
}) {
  if (typeof profileTesterValue === "boolean") return profileTesterValue
  return fallbackIsTester
}

async function lookupProfileRow<T>({
  supabase,
  userId,
  columns,
}: {
  supabase: SupabaseClient<Database, "public">
  userId: string
  columns: string
}): Promise<QueryResult<T>> {
  try {
    const fromResult = supabase.from("profiles") as unknown as Record<
      string,
      unknown
    >
    if (typeof fromResult.select !== "function") {
      return { data: null, error: null }
    }
    const selected = (fromResult.select as (value: string) => unknown)(
      columns
    ) as Record<string, unknown>
    if (typeof selected.eq !== "function") {
      return { data: null, error: null }
    }
    const filtered = (
      selected.eq as (column: string, value: string) => unknown
    )("id", userId) as Record<string, unknown>

    if (typeof filtered.maybeSingle === "function") {
      return (
        (await (filtered.maybeSingle as () => Promise<QueryResult<T>>)()) ?? {
          data: null,
          error: null,
        }
      )
    }
    if (typeof filtered.single === "function") {
      return (
        (await (filtered.single as () => Promise<QueryResult<T>>)()) ?? {
          data: null,
          error: null,
        }
      )
    }
    return { data: null, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

function isMissingTesterColumnError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? (error as { code?: string }).code
      : undefined
  return code === "42703"
}

export function resolveTesterMetadata(userMetadata: unknown): boolean {
  if (
    !userMetadata ||
    typeof userMetadata !== "object" ||
    Array.isArray(userMetadata)
  )
    return false
  const meta = userMetadata as Record<string, unknown>
  return (
    meta.is_tester === true || meta.tester === true || meta.qa_tester === true
  )
}

const resolveDevtoolsAudienceCached = cache(
  async (
    supabase: SupabaseClient<Database, "public">,
    userId: string,
    fallbackIsTester: boolean
  ): Promise<DevtoolsAudience> => {
    const [withTester, storedAccessLevel] = await Promise.all([
      lookupProfileRow<ProfileRowWithTester>({
        supabase,
        userId,
        columns: "role, is_tester",
      }),
      loadPlatformAccessLevel({ supabase, userId }),
    ])

    if (!withTester.error) {
      const accessLevel =
        storedAccessLevel ??
        resolveLegacyPlatformAccessLevel(withTester.data?.role)
      return {
        isAdmin: accessLevel === "developer",
        isTester: resolveIsTesterFlag({
          profileTesterValue: withTester.data?.is_tester,
          fallbackIsTester,
        }),
      }
    }

    // Backward-compatible fallback for databases where `is_tester` has not been migrated yet.
    if (!isMissingTesterColumnError(withTester.error)) {
      return {
        isAdmin: storedAccessLevel === "developer",
        isTester: fallbackIsTester,
      }
    }

    const withoutTester = await lookupProfileRow<ProfileRowWithoutTester>({
      supabase,
      userId,
      columns: "role",
    })
    const accessLevel =
      storedAccessLevel ??
      resolveLegacyPlatformAccessLevel(withoutTester.data?.role)

    return {
      isAdmin: accessLevel === "developer",
      isTester: fallbackIsTester,
    }
  }
)

export async function resolveDevtoolsAudience({
  supabase,
  userId,
  fallbackIsTester = false,
}: DevtoolsAudienceOptions): Promise<DevtoolsAudience> {
  return resolveDevtoolsAudienceCached(supabase, userId, fallbackIsTester)
}

const resolveProfileAudienceCached = cache(
  async (
    supabase: SupabaseClient<Database, "public">,
    userId: string,
    fallbackIsTester: boolean
  ): Promise<ProfileAudience> => {
    const [withTester, storedAccessLevel] = await Promise.all([
      lookupProfileRow<ProfileAudienceWithTester>({
        supabase,
        userId,
        columns: "full_name, avatar_url, headline, role, is_tester",
      }),
      loadPlatformAccessLevel({ supabase, userId }),
    ])

    if (!withTester.error) {
      const platformAccessLevel =
        storedAccessLevel ??
        resolveLegacyPlatformAccessLevel(withTester.data?.role)
      return {
        fullName: withTester.data?.full_name ?? null,
        avatarUrl: withTester.data?.avatar_url ?? null,
        headline: withTester.data?.headline ?? null,
        isAdmin: platformAccessLevel === "developer",
        isPlatformStaff: platformAccessLevel !== null,
        platformAccessLevel,
        isTester: resolveIsTesterFlag({
          profileTesterValue: withTester.data?.is_tester,
          fallbackIsTester,
        }),
      }
    }

    if (!isMissingTesterColumnError(withTester.error)) {
      // Profile details and staff authorization are independent reads. A failed
      // profile lookup must not discard an already verified staff grant.
      return {
        fullName: null,
        avatarUrl: null,
        headline: null,
        isAdmin: storedAccessLevel === "developer",
        isPlatformStaff: storedAccessLevel !== null,
        platformAccessLevel: storedAccessLevel,
        isTester: fallbackIsTester,
      }
    }

    const withoutTester = await lookupProfileRow<ProfileAudienceWithoutTester>({
      supabase,
      userId,
      columns: "full_name, avatar_url, headline, role",
    })
    const platformAccessLevel =
      storedAccessLevel ??
      resolveLegacyPlatformAccessLevel(withoutTester.data?.role)

    return {
      fullName: withoutTester.data?.full_name ?? null,
      avatarUrl: withoutTester.data?.avatar_url ?? null,
      headline: withoutTester.data?.headline ?? null,
      isAdmin: platformAccessLevel === "developer",
      isPlatformStaff: platformAccessLevel !== null,
      platformAccessLevel,
      isTester: fallbackIsTester,
    }
  }
)

export async function resolveProfileAudience({
  supabase,
  userId,
  fallbackIsTester = false,
}: DevtoolsAudienceOptions): Promise<ProfileAudience> {
  return resolveProfileAudienceCached(supabase, userId, fallbackIsTester)
}
