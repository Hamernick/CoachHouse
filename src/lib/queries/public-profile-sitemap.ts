import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type PublicHandleSitemapRow = {
  handle: string
  owner_type: "person" | "organization"
  profile_id: string | null
  organization_id: string | null
  updated_at: string
}

export type PublishedPublicHandle = {
  handle: string
  updatedAt: string
}

export async function fetchPublishedPublicHandles({ page = 0, strict = false }: { page?: number; strict?: boolean } = {}): Promise<
  PublishedPublicHandle[]
> {
  let supabase: ReturnType<typeof createSupabaseAdminClient>
  try {
    supabase = createSupabaseAdminClient()
  } catch (error) {
    console.warn("[public-profile-sitemap] admin client unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    if (strict) throw error
    return []
  }
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("Public profile sitemap exceeded its 10-second deadline"))
      controller.abort()
    }, 10_000)
  })

  try {
    return await Promise.race([
      readPublishedPublicHandles(supabase, controller.signal, page),
      deadline,
    ])
  } catch (error) {
    console.error("[public-profile-sitemap] lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    if (strict) throw error
    return []
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

async function readPublishedPublicHandles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  signal: AbortSignal,
  page: number
): Promise<PublishedPublicHandle[]> {
  const { data, error } = await supabase
    .from("public_handles")
    .select("handle, owner_type, profile_id, organization_id, updated_at")
    .order("handle", { ascending: true })
    .range(page * 500, page * 500 + 499)
    .abortSignal(signal)
    .returns<PublicHandleSitemapRow[]>()

  if (error) {
    console.error("[public-profile-sitemap] handle query failed", {
      code: error.code,
      message: error.message,
    })
    throw new Error("Public handle query failed")
  }

  const handles = data ?? []
  const profileIds = handles.flatMap((row) =>
    row.owner_type === "person" && row.profile_id ? [row.profile_id] : []
  )
  const organizationIds = handles.flatMap((row) =>
    row.owner_type === "organization" && row.organization_id
      ? [row.organization_id]
      : []
  )
  const [personResult, organizationResult] = await Promise.all([
    profileIds.length
      ? supabase
          .from("public_person_profiles")
          .select("profile_id")
          .in("profile_id", profileIds)
          .eq("is_public", true)
          .abortSignal(signal)
          .returns<Array<{ profile_id: string }>>()
      : Promise.resolve({ data: [], error: null }),
    organizationIds.length
      ? supabase
          .from("organizations")
          .select("user_id")
          .in("user_id", organizationIds)
          .eq("is_public", true)
          .abortSignal(signal)
          .returns<Array<{ user_id: string }>>()
      : Promise.resolve({ data: [], error: null }),
  ])

  if (personResult.error || organizationResult.error) {
    console.error("[public-profile-sitemap] publication query failed", {
      organizationCode: organizationResult.error?.code,
      personCode: personResult.error?.code,
    })
    throw new Error("Public profile publication query failed")
  }

  const publishedPeople = new Set(
    (personResult.data ?? []).map((row) => row.profile_id)
  )
  const publishedOrganizations = new Set(
    (organizationResult.data ?? []).map((row) => row.user_id)
  )

  return handles.flatMap((row) => {
    const isPublished =
      (row.owner_type === "person" &&
        row.profile_id !== null &&
        publishedPeople.has(row.profile_id)) ||
      (row.owner_type === "organization" &&
        row.organization_id !== null &&
        publishedOrganizations.has(row.organization_id))

    return isPublished
      ? [{ handle: row.handle, updatedAt: row.updated_at }]
      : []
  })
}
