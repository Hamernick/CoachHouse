import { unstable_cache } from "next/cache"

import {
  normalizePublicHandle,
  validatePublicHandle,
} from "@/features/public-profiles"
import type {
  PublicOrganizationProfilePerson,
  PublicOrganizationProfileView,
  PublicPersonProfileView,
  PublicProfileActivityEvent,
  PublicProfileAffiliation,
  PublicProfileHeatmapDay,
  PublicProfileSavedCollection,
  PublicProfileView,
} from "@/features/public-profiles"
import { buildFindOrganizationHref } from "@/lib/find/routes"
import { normalizeExternalUrl } from "@/lib/organization/urls"
import { normalizePersonCategory } from "@/lib/people/categories"
import { resolvePeopleDisplayImages } from "@/lib/people/display-images"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { fetchPersonPublicSavedCollections } from "@/lib/queries/public-profile-saved-collections"

type PublicHandleRow = {
  handle: string
  owner_type: "person" | "organization"
  profile_id: string | null
  organization_id: string | null
}

type PublicPersonProfileRow = {
  display_name: string
  headline: string | null
  bio: string | null
  location_label: string | null
  website_url: string | null
  avatar_url: string | null
  is_public: boolean
  show_organizations: boolean
  show_program_activity: boolean
  show_saved_locations: boolean
}

type PublicAffiliationRow = {
  organization_id: string
  role: "owner" | "admin" | "staff" | "board" | "member"
}

type PublicActivityRow = {
  id: string
  organization_id: string
  event_kind: "affiliation_published"
  title: string
  summary: string | null
  occurred_at: string
}

type PublicOrganizationHandleRow = {
  handle: string
  organization_id: string | null
}

type PublicTrackedResourceLinkRow = {
  id: string
  code: string
  resource_title: string
  created_at: string
}

type PublicOrganizationProfileRow = {
  profile: Record<string, unknown> | null
}

type PublicOrganizationPersonSource = {
  id?: unknown
  name?: unknown
  title?: unknown
  category?: unknown
  image?: unknown
}

const PUBLIC_ACTIVITY_WINDOW_DAYS = 365
const DAY_IN_MS = 86_400_000

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(normalizeExternalUrl(value) ?? value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function organizationLocationLabel(input: {
  city: string | null
  state: string | null
  country: string | null
  isOnlineOnly: boolean
}) {
  const place = [input.city, input.state, input.country]
    .filter(Boolean)
    .join(", ")
  if (place) return place
  return input.isOnlineOnly ? "Online" : null
}

const PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS = {
  staff: "Staff",
  governing_board: "Governing Board",
  advisory_board: "Advisory Board",
} as const

function readPublicOrganizationPeople(
  profile: Record<string, unknown> | null
): Array<{
  id: string
  name: string
  title: string | null
  category: keyof typeof PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS
  image: string | null
}> {
  const people = Array.isArray(profile?.org_people)
    ? (profile.org_people as PublicOrganizationPersonSource[])
    : []

  return people.flatMap((person, index) => {
    const name = typeof person.name === "string" ? person.name.trim() : ""
    if (!name) return []

    const category = normalizePersonCategory(
      typeof person.category === "string" ? person.category : null
    )
    if (!(category in PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS)) return []

    return [
      {
        id:
          typeof person.id === "string" && person.id.trim()
            ? person.id.trim()
            : `public-person-${index}`,
        name,
        title:
          typeof person.title === "string" && person.title.trim()
            ? person.title.trim()
            : null,
        category:
          category as keyof typeof PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS,
        image:
          typeof person.image === "string" && person.image.trim()
            ? person.image.trim()
            : null,
      },
    ]
  })
}

async function fetchPublicOrganizationPeople(
  organizationId: string
): Promise<PublicOrganizationProfilePerson[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", organizationId)
    .eq("is_public", true)
    .maybeSingle<PublicOrganizationProfileRow>()

  if (error) {
    console.error("[public-profile] organization people query failed", {
      code: error.code,
      message: error.message,
    })
    return []
  }

  const people = readPublicOrganizationPeople(data?.profile ?? null)
  const peopleWithImages = await resolvePeopleDisplayImages(people)

  return peopleWithImages
    .map((person) => ({
      id: person.id,
      name: person.name,
      title: person.title,
      roleLabel: PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS[person.category],
      avatarUrl: safeHttpUrl(person.displayImage),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function buildPublicActivityHeatmap(
  activity: PublicProfileActivityEvent[],
  now = new Date()
): PublicProfileHeatmapDay[] {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const startTime =
    end.getTime() - (PUBLIC_ACTIVITY_WINDOW_DAYS - 1) * DAY_IN_MS
  const counts = new Map<string, number>()

  for (const event of activity) {
    const eventTime = new Date(event.occurredAt).getTime()
    if (!Number.isFinite(eventTime) || eventTime < startTime) continue
    const date = new Date(eventTime).toISOString().slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return Array.from({ length: PUBLIC_ACTIVITY_WINDOW_DAYS }, (_, index) => {
    const date = new Date(startTime + index * DAY_IN_MS)
      .toISOString()
      .slice(0, 10)
    return { date, value: counts.get(date) ?? 0 }
  })
}

async function buildPersonPublicImpact(input: {
  profileId: string
  showOrganizations: boolean
  showProgramActivity: boolean
  showSavedLocations: boolean
}): Promise<{
  affiliations: PublicProfileAffiliation[]
  activity: PublicProfileActivityEvent[]
  heatmap: PublicProfileHeatmapDay[]
  resourcesShared: number
  resourceOpens: number
  savedCollections: PublicProfileSavedCollection[]
  savedItems: number
}> {
  if (
    !input.showOrganizations &&
    !input.showProgramActivity &&
    !input.showSavedLocations
  ) {
    return {
      affiliations: [],
      activity: [],
      heatmap: [],
      resourcesShared: 0,
      resourceOpens: 0,
      savedCollections: [],
      savedItems: 0,
    }
  }

  const supabase = createSupabaseAdminClient()
  const [
    affiliationResult,
    activityResult,
    trackedLinkResult,
    savedCollections,
  ] = await Promise.all([
    input.showOrganizations
      ? supabase
          .from("public_person_organization_affiliations")
          .select("organization_id, role")
          .eq("profile_id", input.profileId)
          .returns<PublicAffiliationRow[]>()
      : Promise.resolve({ data: [] as PublicAffiliationRow[], error: null }),
    input.showProgramActivity
      ? supabase
          .from("public_profile_activity_events")
          .select(
            "id, organization_id, event_kind, title, summary, occurred_at"
          )
          .eq("profile_id", input.profileId)
          .order("occurred_at", { ascending: false })
          .limit(100)
          .returns<PublicActivityRow[]>()
      : Promise.resolve({ data: [] as PublicActivityRow[], error: null }),
    input.showProgramActivity
      ? supabase
          .from("public_tracked_resource_links")
          .select("id, code, resource_title, created_at")
          .eq("owner_profile_id", input.profileId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<PublicTrackedResourceLinkRow[]>()
      : Promise.resolve({
          data: [] as PublicTrackedResourceLinkRow[],
          error: null,
        }),
    input.showSavedLocations
      ? fetchPersonPublicSavedCollections(input.profileId)
      : Promise.resolve([] as PublicProfileSavedCollection[]),
  ])

  if (affiliationResult.error) {
    console.error("[public-profile] affiliation query failed", {
      code: affiliationResult.error.code,
      message: affiliationResult.error.message,
    })
  }
  if (activityResult.error) {
    console.error("[public-profile] activity query failed", {
      code: activityResult.error.code,
      message: activityResult.error.message,
    })
  }
  if (trackedLinkResult.error) {
    console.error("[public-profile] tracked link query failed", {
      code: trackedLinkResult.error.code,
      message: trackedLinkResult.error.message,
    })
  }

  const affiliationRows = affiliationResult.error
    ? []
    : (affiliationResult.data ?? [])
  const activityRows = activityResult.error ? [] : (activityResult.data ?? [])
  const trackedLinkRows = trackedLinkResult.error
    ? []
    : (trackedLinkResult.data ?? [])
  const organizationIds = Array.from(
    new Set([
      ...affiliationRows.map((row) => row.organization_id),
      ...activityRows.map((row) => row.organization_id),
    ])
  )
  const organizationIdSet = new Set(organizationIds)
  const [organizations, handleResult] =
    organizationIds.length > 0
      ? await Promise.all([
          fetchPublicMapOrganizations(),
          supabase
            .from("public_handles")
            .select("handle, organization_id")
            .eq("owner_type", "organization")
            .in("organization_id", organizationIds)
            .returns<PublicOrganizationHandleRow[]>(),
        ])
      : [[], { data: [] as PublicOrganizationHandleRow[] }]
  const publicOrganizations = new Map(
    organizations
      .filter((organization) => organizationIdSet.has(organization.id))
      .map((organization) => [organization.id, organization])
  )
  const handles = new Map(
    (handleResult.data ?? [])
      .filter(
        (
          row
        ): row is PublicOrganizationHandleRow & { organization_id: string } =>
          Boolean(row.organization_id)
      )
      .map((row) => [row.organization_id, row.handle])
  )

  function organizationDestination(organizationId: string) {
    const organization = publicOrganizations.get(organizationId)
    if (!organization) return null
    const handle =
      handles.get(organizationId) ??
      normalizePublicHandle(organization.publicSlug ?? "")
    if (!validatePublicHandle(handle).valid) return null
    return { organization, handle, href: `/${encodeURIComponent(handle)}` }
  }

  const affiliations = affiliationRows
    .flatMap((row): PublicProfileAffiliation[] => {
      const destination = organizationDestination(row.organization_id)
      if (!destination) return []
      return [
        {
          organizationId: row.organization_id,
          name: destination.organization.name,
          handle: destination.handle,
          role: row.role,
          avatarUrl: safeHttpUrl(
            destination.organization.logoUrl ??
              destination.organization.brandMarkUrl
          ),
          href: destination.href,
        },
      ]
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  const affiliationActivity = activityRows.flatMap(
    (row): PublicProfileActivityEvent[] => {
      const destination = organizationDestination(row.organization_id)
      if (!destination) return []
      return [
        {
          id: row.id,
          kind: row.event_kind,
          title: row.title,
          summary: row.summary,
          occurredAt: row.occurred_at,
          relatedLabel: destination.organization.name,
          relatedHref: destination.href,
        },
      ]
    }
  )
  const resourceActivity = trackedLinkRows.map(
    (row): PublicProfileActivityEvent => ({
      id: `resource:${row.id}`,
      kind: "resource_shared",
      title: `Shared ${row.resource_title}`,
      summary: "Created a tracked public resource link.",
      occurredAt: row.created_at,
      relatedLabel: row.resource_title,
      relatedHref: `/go/${encodeURIComponent(row.code)}`,
    })
  )
  const activity = [...affiliationActivity, ...resourceActivity].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  )
  const linkIds = trackedLinkRows.map((row) => row.id)
  const { count, error: openCountError } =
    linkIds.length > 0
      ? await supabase
          .from("public_tracked_resource_link_daily_opens")
          .select("link_id", { count: "exact", head: true })
          .in("link_id", linkIds)
      : { count: 0, error: null }
  if (openCountError) {
    console.error("[public-profile] tracked open query failed", {
      code: openCountError.code,
      message: openCountError.message,
    })
  }

  return {
    affiliations,
    activity,
    heatmap: buildPublicActivityHeatmap(activity),
    resourcesShared: trackedLinkRows.length,
    resourceOpens: openCountError ? 0 : (count ?? 0),
    savedCollections,
    savedItems: savedCollections.reduce(
      (total, collection) => total + collection.items.length,
      0
    ),
  }
}

function buildOrganizationView(
  handle: string,
  organization: Awaited<ReturnType<typeof fetchPublicMapOrganizations>>[number],
  people: PublicOrganizationProfilePerson[]
): PublicOrganizationProfileView {
  return {
    kind: "organization",
    organization,
    handle,
    organizationId: organization.id,
    displayName: organization.name,
    headline: organization.tagline,
    description: organization.description,
    avatarUrl: safeHttpUrl(organization.logoUrl ?? organization.brandMarkUrl),
    locationLabel: organizationLocationLabel(organization),
    websiteUrl: safeHttpUrl(organization.website),
    donateUrl: safeHttpUrl(organization.donateUrl),
    findUrl: buildFindOrganizationHref(organization.publicSlug ?? handle),
    people,
    programs: organization.programs.map((program) => ({
      id: program.id,
      title: program.title,
      summary: program.description ?? program.subtitle,
      statusLabel: program.chips[0] ?? null,
      startDate: program.startDate,
      locationLabel:
        program.locationType === "online"
          ? "Online"
          : (program.chips.find((chip) => chip !== program.chips[0]) ?? null),
      ctaLabel: program.ctaLabel,
      ctaUrl: safeHttpUrl(program.ctaUrl),
    })),
  }
}

async function fetchPublicProfileUncached(
  input: string
): Promise<PublicProfileView | null> {
  const handle = normalizePublicHandle(input)
  if (!validatePublicHandle(handle).valid) return null

  const supabase = createSupabaseAdminClient()
  const { data: handleRow, error } = await supabase
    .from("public_handles")
    .select("handle, owner_type, profile_id, organization_id")
    .eq("handle", handle)
    .maybeSingle<PublicHandleRow>()

  if (error) return null
  // Legacy public slugs get a real page too. A claimed handle always wins,
  // including private person profiles; never fall back around their visibility.
  if (!handleRow) {
    const organizations = await fetchPublicMapOrganizations()
    const organization = organizations.find(
      (candidate) => normalizePublicHandle(candidate.publicSlug || candidate.id) === handle
    )
    if (!organization) return null
    const people = await fetchPublicOrganizationPeople(organization.id)
    return buildOrganizationView(handle, organization, people)
  }

  if (handleRow.owner_type === "person" && handleRow.profile_id) {
    const { data: person } = await supabase
      .from("public_person_profiles")
      .select(
        "display_name, headline, bio, location_label, website_url, avatar_url, is_public, show_organizations, show_program_activity, show_saved_locations"
      )
      .eq("profile_id", handleRow.profile_id)
      .eq("is_public", true)
      .maybeSingle<PublicPersonProfileRow>()

    if (!person) return null
    const publicImpact = await buildPersonPublicImpact({
      profileId: handleRow.profile_id,
      showOrganizations: person.show_organizations,
      showProgramActivity: person.show_program_activity,
      showSavedLocations: person.show_saved_locations,
    })
    return {
      kind: "person",
      handle,
      displayName: person.display_name,
      headline: person.headline,
      description: person.bio,
      avatarUrl: safeHttpUrl(person.avatar_url),
      locationLabel: person.location_label,
      websiteUrl: safeHttpUrl(person.website_url),
      showOrganizations: person.show_organizations,
      showProgramActivity: person.show_program_activity,
      showSavedLocations: person.show_saved_locations,
      affiliations: publicImpact.affiliations,
      activity: publicImpact.activity,
      heatmap: publicImpact.heatmap,
      resourcesShared: publicImpact.resourcesShared,
      resourceOpens: publicImpact.resourceOpens,
      savedCollections: publicImpact.savedCollections,
      savedItems: publicImpact.savedItems,
    } satisfies PublicPersonProfileView
  }

  if (handleRow.owner_type === "organization" && handleRow.organization_id) {
    const organizations = await fetchPublicMapOrganizations()
    const organization = organizations.find(
      (candidate) => candidate.id === handleRow.organization_id
    )
    if (!organization) return null
    const people = await fetchPublicOrganizationPeople(organization.id)
    return buildOrganizationView(handle, organization, people)
  }

  return null
}

const fetchPublicProfileCached = unstable_cache(
  fetchPublicProfileUncached,
  ["public-profile-by-handle-v3"],
  {
    revalidate: 300,
    tags: ["public-profiles", "public-map-organizations"],
  }
)

export async function fetchPublicProfileByHandle(input: string) {
  return fetchPublicProfileCached(input)
}

export async function findLegacyPublicOrganizationSlug(input: string) {
  const handle = normalizePublicHandle(input)
  const organizations = await fetchPublicMapOrganizations()
  return (
    organizations.find(
      (organization) =>
        normalizePublicHandle(organization.publicSlug ?? "") === handle
    )?.publicSlug ?? null
  )
}
