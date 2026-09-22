import { HIDDEN_TEST_STAFF_IDS } from "@/lib/admin/staff-picker-exclusions"
import type { User } from "@/features/platform-admin-dashboard"
import { toMemberWorkspaceDataError } from "./table-errors"
import type { Database } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemberWorkspacePersonOption } from "../types"

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

type OrganizationPeopleRow = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "user_id"
>

type MembershipPeopleRow = Pick<
  Database["public"]["Tables"]["organization_memberships"]["Row"],
  "org_id" | "member_id" | "member_email" | "role"
>

type ProfilePeopleRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "avatar_url" | "email" | "role"
>

type PlatformStaffProfile = ProfilePeopleRow & {
  platformAccessLevel: "developer" | "coach"
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function optionKey({
  id,
  email,
  name,
}: {
  id: string | null
  email: string | null
  name: string
}) {
  if (id) return `id:${id}`
  if (email) return `email:${email.toLowerCase()}`
  return `name:${name.toLowerCase()}`
}

function buildFallbackId({
  id,
  email,
  name,
}: {
  id: string | null
  email: string | null
  name: string
}) {
  return id ?? email ?? name.toLowerCase().replace(/\s+/g, "-")
}

function normalizeOrganizationRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
      return "Org admin"
    case "staff":
      return "Staff"
    case "board":
      return "Board member"
    case "member":
      return "Member"
    default:
      return "Team member"
  }
}

function sortGroupPriority(groupKey: MemberWorkspacePersonOption["groupKey"]) {
  if (groupKey === "platform-admins") return 0
  return 1
}

function mergeGroupKey(
  existing: MemberWorkspacePersonOption["groupKey"] | undefined,
  next: MemberWorkspacePersonOption["groupKey"] | undefined
) {
  if (existing === "platform-admins" || next === "platform-admins") {
    return "platform-admins" as const
  }

  return next ?? existing
}

function mergeGroupLabel({
  existing,
  next,
  groupKey,
}: {
  existing: string | null | undefined
  next: string | null | undefined
  groupKey: MemberWorkspacePersonOption["groupKey"] | undefined
}) {
  if (groupKey === "platform-admins") return "Coach House staff"
  return next ?? existing ?? null
}

function upsertPersonOption({
  map,
  id,
  name,
  email,
  avatarUrl,
  roleLabel,
  groupKey,
  groupLabel,
}: {
  map: Map<string, MemberWorkspacePersonOption>
  id: string | null
  name: string | null
  email?: string | null
  avatarUrl?: string | null
  roleLabel?: string | null
  groupKey?: MemberWorkspacePersonOption["groupKey"]
  groupLabel?: string | null
}) {
  const normalizedName = toTrimmedString(name) || toTrimmedString(email)
  if (!normalizedName || (id && HIDDEN_TEST_STAFF_IDS.has(id))) return

  const normalizedId = toTrimmedString(id) || null
  const normalizedEmail = toTrimmedString(email) || null
  const normalizedAvatarUrl = toTrimmedString(avatarUrl) || null
  const normalizedRoleLabel = toTrimmedString(roleLabel) || null
  const normalizedGroupKey = mergeGroupKey(undefined, groupKey)
  const normalizedGroupLabel =
    toTrimmedString(groupLabel) ||
    (normalizedGroupKey === "platform-admins" ? "Coach House staff" : null)
  const key = optionKey({
    id: normalizedId,
    email: normalizedEmail,
    name: normalizedName,
  })
  const existing = map.get(key)
  const mergedGroupKey = mergeGroupKey(existing?.groupKey, normalizedGroupKey)

  map.set(key, {
    id: buildFallbackId({
      id: normalizedId ?? existing?.id ?? null,
      email: normalizedEmail ?? existing?.email ?? null,
      name: normalizedName,
    }),
    name: normalizedName,
    avatarUrl: normalizedAvatarUrl ?? existing?.avatarUrl ?? null,
    email: normalizedEmail ?? existing?.email ?? null,
    roleLabel: normalizedRoleLabel ?? existing?.roleLabel ?? null,
    groupKey: mergedGroupKey,
    groupLabel: mergeGroupLabel({
      existing: existing?.groupLabel,
      next: normalizedGroupLabel,
      groupKey: mergedGroupKey,
    }),
  })
}

async function loadProfilesByIds({
  profileIds,
  supabase,
}: {
  profileIds: string[]
  supabase: ServerSupabase
}) {
  if (profileIds.length === 0) {
    return new Map<string, ProfilePeopleRow>()
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, role")
    .in("id", profileIds)
    .returns<ProfilePeopleRow[]>()

  if (profilesError) {
    throw supabaseErrorToError(profilesError, "Unable to load member profiles.")
  }

  return new Map(
    (profiles ?? []).map((profile) => [profile.id, profile] as const)
  )
}

async function loadPlatformAdminProfiles({
  includePlatformAdmins,
  supabase,
}: {
  includePlatformAdmins: boolean
  supabase: ServerSupabase
}) {
  if (!includePlatformAdmins) {
    return [] as PlatformStaffProfile[]
  }

  const { data: staffRows, error: staffError } = await supabase
    .from("platform_staff_members")
    .select("user_id, access_level")
    .returns<
      Array<{
        user_id: string
        access_level: "developer" | "coach"
      }>
    >()

  if (staffError) {
    const code = (staffError as { code?: string }).code
    if (code === "42P01" || code === "PGRST205") {
      const { data: legacyAdmins, error: legacyError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email, role")
        .eq("role", "admin")
        .returns<ProfilePeopleRow[]>()
      if (legacyError) {
        throw supabaseErrorToError(
          legacyError,
          "Unable to load Coach House staff."
        )
      }
      return (legacyAdmins ?? []).map((profile) => ({
        ...profile,
        platformAccessLevel: "developer" as const,
      }))
    }
    throw supabaseErrorToError(staffError, "Unable to load Coach House staff.")
  }

  const staffIds = (staffRows ?? []).map((row) => row.user_id)
  if (staffIds.length === 0) return []
  const profilesById = await loadProfilesByIds({
    profileIds: staffIds,
    supabase,
  })

  return (staffRows ?? []).flatMap((row) => {
    const profile = profilesById.get(row.user_id)
    return profile
      ? [{ ...profile, platformAccessLevel: row.access_level }]
      : []
  })
}

export async function loadMemberWorkspacePersonOptionsForOrganizations({
  orgIds,
  supabase,
  includePlatformAdmins = false,
}: {
  orgIds: string[]
  supabase: ServerSupabase
  includePlatformAdmins?: boolean
}): Promise<MemberWorkspacePersonOption[]> {
  const uniqueOrgIds = Array.from(new Set(orgIds.filter(Boolean)))
  if (uniqueOrgIds.length === 0 && !includePlatformAdmins) {
    return []
  }

  const [
    { data: organizations, error: organizationsError },
    { data: memberships, error: membershipsError },
    platformAdminProfiles,
  ] = await Promise.all([
    uniqueOrgIds.length > 0
      ? supabase
          .from("organizations")
          .select("user_id")
          .in("user_id", uniqueOrgIds)
          .returns<OrganizationPeopleRow[]>()
      : Promise.resolve({
          data: [] as OrganizationPeopleRow[],
          error: null,
        }),
    uniqueOrgIds.length > 0
      ? supabase
          .from("organization_memberships")
          .select("org_id, member_id, member_email, role")
          .in("org_id", uniqueOrgIds)
          .returns<MembershipPeopleRow[]>()
      : Promise.resolve({
          data: [] as MembershipPeopleRow[],
          error: null,
        }),
    loadPlatformAdminProfiles({
      includePlatformAdmins,
      supabase,
    }),
  ])

  if (organizationsError) {
    throw supabaseErrorToError(
      organizationsError,
      "Unable to load organization people."
    )
  }

  if (membershipsError) {
    throw supabaseErrorToError(
      membershipsError,
      "Unable to load organization memberships."
    )
  }

  const profileIds = Array.from(
    new Set(
      [
        ...(organizations ?? []).map((organization) => organization.user_id),
        ...(memberships ?? []).map((membership) => membership.member_id),
        ...platformAdminProfiles.map((profile) => profile.id),
      ].filter(Boolean)
    )
  )

  const profilesById = await loadProfilesByIds({
    profileIds,
    supabase,
  })

  const options = new Map<string, MemberWorkspacePersonOption>()

  for (const platformAdmin of platformAdminProfiles) {
    upsertPersonOption({
      map: options,
      id: platformAdmin.id,
      name:
        platformAdmin.full_name ?? platformAdmin.email ?? "Coach House staff",
      email: platformAdmin.email ?? null,
      avatarUrl: platformAdmin.avatar_url ?? null,
      roleLabel:
        platformAdmin.platformAccessLevel === "coach" ? "Coach" : "Developer",
      groupKey: "platform-admins",
      groupLabel: "Coach House staff",
    })
  }

  for (const organization of organizations ?? []) {
    const ownerProfile = profilesById.get(organization.user_id) ?? null
    upsertPersonOption({
      map: options,
      id: ownerProfile?.id ?? organization.user_id,
      name:
        ownerProfile?.full_name ?? ownerProfile?.email ?? "Organization owner",
      email: ownerProfile?.email ?? null,
      avatarUrl: ownerProfile?.avatar_url ?? null,
      roleLabel: "Owner",
      groupKey: "organization-team",
      groupLabel: "Organization team",
    })
  }

  for (const membership of memberships ?? []) {
    const profile = profilesById.get(membership.member_id) ?? null
    upsertPersonOption({
      map: options,
      id: membership.member_id,
      name: profile?.full_name ?? membership.member_email ?? "Unknown member",
      email: profile?.email ?? membership.member_email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      roleLabel: normalizeOrganizationRoleLabel(membership.role),
      groupKey: "organization-team",
      groupLabel: "Organization team",
    })
  }

  return Array.from(options.values()).sort((left, right) => {
    const groupDiff =
      sortGroupPriority(left.groupKey) - sortGroupPriority(right.groupKey)
    if (groupDiff !== 0) return groupDiff
    return left.name.localeCompare(right.name)
  })
}

export async function loadMemberWorkspaceCurrentUser({
  supabase,
  userId,
}: {
  supabase: ServerSupabase
  userId: string
}): Promise<User> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("id", userId)
    .maybeSingle<Pick<ProfilePeopleRow, "id" | "full_name" | "avatar_url" | "email">>()

  if (profileError) {
    throw toMemberWorkspaceDataError(
      profileError,
      "Unable to load your profile."
    )
  }

  return {
    id: userId,
    name:
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      "You",
    avatarUrl: profile?.avatar_url?.trim() || undefined,
  }
}
