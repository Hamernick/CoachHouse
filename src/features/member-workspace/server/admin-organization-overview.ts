import { isActiveContact } from "@/lib/people/contact-schema"
import { resolveOrganizationCardImage } from "../lib/organization-card-image"
import { addDays } from "date-fns"

import { fetchAcceleratorProgressTotalsByUserId } from "@/lib/accelerator/progress"
import type { Database, Json } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type {
  MemberWorkspaceAdminOrganizationMember,
  MemberWorkspaceAdminOrganizationSummary,
} from "@/features/member-workspace/types"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { computeAdminOrganizationSetupSummary } from "./admin-organization-setup"
import { buildAdminMemberCompleteness } from "./admin-member-completeness"
import {
  resolveAdminOrganizationProjectPriority,
  resolveAdminOrganizationProjectStatus,
} from "./admin-organization-project-state"
import type { OrganizationProjectRecord } from "./project-starter-data"

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

type OrganizationRow = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  | "user_id"
  | "status"
  | "profile"
  | "created_at"
  | "updated_at"
  | "public_slug"
  | "is_public"
  | "location_lat"
  | "location_lng"
>

type MembershipRow = Pick<
  Database["public"]["Tables"]["organization_memberships"]["Row"],
  "org_id" | "member_id" | "role" | "member_email" | "created_at"
>

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "avatar_url" | "headline" | "email" | "role"
>

type ProgramRow = {
  id: string
  user_id: string
  title: string | null
  goal_cents: number | null
  status_label: string | null
  start_date: string | null
  end_date: string | null
  is_public: boolean
}

function toRecord(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function hasText(value: unknown) {
  return toTrimmedString(value).length > 0
}

function resolveOrganizationName({
  organization,
  ownerProfile,
}: {
  organization: OrganizationRow
  ownerProfile: ProfileRow | null
}) {
  const profile = toRecord(organization.profile)
  const name = toTrimmedString(profile.name)
  if (name) return name

  const ownerName = toTrimmedString(ownerProfile?.full_name)
  if (ownerName) return ownerName

  const publicSlug = toTrimmedString(organization.public_slug)
  if (publicSlug) return publicSlug

  return "Organization"
}

function resolveOrganizationOwner({
  organization,
  ownerProfile,
  members,
}: {
  organization: OrganizationRow
  ownerProfile: ProfileRow | null
  members: MemberWorkspaceAdminOrganizationMember[]
}) {
  const ownerMember = members.find((member) => member.isOwner) ?? null
  const name =
    toTrimmedString(ownerMember?.name) ||
    toTrimmedString(ownerProfile?.full_name) ||
    toTrimmedString(ownerProfile?.email) ||
    toTrimmedString(organization.public_slug) ||
    "Organization owner"
  const avatarUrl =
    toTrimmedString(ownerMember?.avatarUrl) ||
    toTrimmedString(ownerProfile?.avatar_url) ||
    null

  return { name, avatarUrl }
}

function rolePriority(role: string) {
  switch (role) {
    case "owner":
      return 0
    case "admin":
      return 1
    case "staff":
      return 2
    case "board":
      return 3
    default:
      return 4
  }
}

function computeSetupSummary({
  organization,
  memberCount,
  programs,
}: {
  organization: OrganizationRow
  memberCount: number
  programs: ProgramRow[]
}) {
  return computeAdminOrganizationSetupSummary({
    profile: organization.profile,
    publicSlug: organization.public_slug,
    memberCount,
    programs,
  })
}

function buildSummaryTags({
  organization,
  setupProgress,
}: {
  organization: OrganizationRow
  setupProgress: number
}) {
  const tags = new Set<string>()
  tags.add("organization")
  tags.add(
    organization.status === "approved"
      ? "approved"
      : organization.status === "pending"
        ? "pending"
        : "setup"
  )
  if (organization.is_public) tags.add("public")
  if (setupProgress < 100) tags.add("onboarding")
  return Array.from(tags)
}

function buildOrganizationMembers({
  organization,
  memberships,
  profilesById,
}: {
  organization: OrganizationRow
  memberships: MembershipRow[]
  profilesById: Map<string, ProfileRow>
}) {
  const profile = toRecord(organization.profile)
  const orgPeople = Array.isArray(profile.org_people)
    ? (profile.org_people as Array<Record<string, unknown>>).filter(isActiveContact)
    : []

  if (memberships.length === 0 && orgPeople.length > 0) {
    return orgPeople
      .map((person, index) => {
        const name = toTrimmedString(person.name) || "Unknown member"
        const email = toTrimmedString(person.email) || null
        const avatarUrl = toTrimmedString(person.image) || null
        const headline = toTrimmedString(person.title) || null

        return {
          userId:
            toTrimmedString(person.id) ||
            `${organization.user_id}-person-${index + 1}`,
          name,
          email,
          avatarUrl,
          headline,
          organizationRole: toTrimmedString(person.category) || "member",
          platformRole: null,
          isOwner: toTrimmedString(person.id) === organization.user_id,
          ...buildAdminMemberCompleteness({ avatarUrl, email, headline, name }),
        }
      })
      .sort((left, right) => {
        const roleDiff =
          rolePriority(left.organizationRole) -
          rolePriority(right.organizationRole)
        if (roleDiff !== 0) return roleDiff
        return left.name.localeCompare(right.name)
      })
  }

  const membershipMembers = memberships.map((membership) => {
    const profileRow = profilesById.get(membership.member_id) ?? null
    const name =
      toTrimmedString(profileRow?.full_name) ||
      toTrimmedString(membership.member_email) ||
      "Unknown member"

    const email =
      toTrimmedString(profileRow?.email) ||
      toTrimmedString(membership.member_email) ||
      null
    const avatarUrl = toTrimmedString(profileRow?.avatar_url) || null
    const headline = toTrimmedString(profileRow?.headline) || null

    return {
      userId: membership.member_id,
      name,
      email,
      avatarUrl,
      headline,
      organizationRole: membership.role,
      platformRole: profileRow?.role ?? null,
      isOwner: membership.member_id === organization.user_id,
      ...buildAdminMemberCompleteness({ avatarUrl, email, headline, name }),
    }
  })

  if (!membershipMembers.some((member) => member.isOwner)) {
    const ownerProfile = profilesById.get(organization.user_id) ?? null
    const name =
      toTrimmedString(ownerProfile?.full_name) ||
      toTrimmedString(ownerProfile?.email) ||
      "Organization owner"
    const email = toTrimmedString(ownerProfile?.email) || null
    const avatarUrl = toTrimmedString(ownerProfile?.avatar_url) || null
    const headline = toTrimmedString(ownerProfile?.headline) || null

    membershipMembers.push({
      userId: organization.user_id,
      name,
      email,
      avatarUrl,
      headline,
      organizationRole: "owner",
      platformRole: ownerProfile?.role ?? null,
      isOwner: true,
      ...buildAdminMemberCompleteness({ avatarUrl, email, headline, name }),
    })
  }

  return membershipMembers.sort((left, right) => {
    const roleDiff =
      rolePriority(left.organizationRole) - rolePriority(right.organizationRole)
    if (roleDiff !== 0) return roleDiff
    return left.name.localeCompare(right.name)
  })
}

function buildOrganizationSummary({
  organization,
  memberships,
  profilesById,
  programsByOrgId,
  acceleratorProgressByOrgId,
}: {
  organization: OrganizationRow
  memberships: MembershipRow[]
  profilesById: Map<string, ProfileRow>
  programsByOrgId: Map<string, ProgramRow[]>
  acceleratorProgressByOrgId: Map<string, { percent: number }>
}): MemberWorkspaceAdminOrganizationSummary {
  const ownerProfile = profilesById.get(organization.user_id) ?? null
  const members = buildOrganizationMembers({
    organization,
    memberships,
    profilesById,
  })
  const owner = resolveOrganizationOwner({
    organization,
    ownerProfile,
    members,
  })
  const {
    setupProgress,
    setupCompletedCount,
    setupTotalCount,
    missingSetupCount,
    setupItems,
  } = computeSetupSummary({
    organization,
    memberCount: members.length,
    programs: programsByOrgId.get(organization.user_id) ?? [],
  })

  return {
    orgId: organization.user_id,
    canonicalProjectId: null,
    name: resolveOrganizationName({ organization, ownerProfile }),
    ownerName: owner.name,
    ownerAvatarUrl: owner.avatarUrl,
    publicSlug: organization.public_slug ?? null,
    organizationStatus: organization.status,
    isPublic: Boolean(organization.is_public),
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    acceleratorProgress:
      acceleratorProgressByOrgId.get(organization.user_id)?.percent ?? 0,
    setupProgress,
    setupCompletedCount,
    setupTotalCount,
    missingSetupCount,
    memberCount: members.length,
    tags: buildSummaryTags({ organization, setupProgress }),
    members,
    setupItems,
    programs: (programsByOrgId.get(organization.user_id) ?? []).map(
      (program) => ({
        id: program.id,
        title: toTrimmedString(program.title) || "Untitled program",
        statusLabel:
          toTrimmedString(program.status_label) ||
          (program.is_public ? "Published" : "Draft"),
        startAt: program.start_date,
        endAt: program.end_date,
        isPublic: Boolean(program.is_public),
      })
    ),
    profile: toRecord(organization.profile),
  }
}

async function loadProgramsByOrgId({
  supabase,
  orgIds,
}: {
  supabase: ServerSupabase
  orgIds: string[]
}) {
  const uniqueIds = Array.from(new Set(orgIds.filter(Boolean)))
  const programsByOrgId = new Map<string, ProgramRow[]>()

  if (uniqueIds.length === 0) {
    return programsByOrgId
  }

  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, user_id, title, goal_cents, status_label, start_date, end_date, is_public"
    )
    .in("user_id", uniqueIds)
    .returns<ProgramRow[]>()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === "42P01" || code === "42703") {
      return programsByOrgId
    }
    throw supabaseErrorToError(error, "Unable to load organization programs.")
  }

  for (const program of data ?? []) {
    const list = programsByOrgId.get(program.user_id) ?? []
    list.push(program)
    programsByOrgId.set(program.user_id, list)
  }

  return programsByOrgId
}

async function loadProfilesById({
  supabase,
  ids,
}: {
  supabase: ServerSupabase
  ids: string[]
}) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, ProfileRow>()

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, headline, email, role")
    .in("id", uniqueIds)
    .returns<ProfileRow[]>()

  if (error) {
    throw supabaseErrorToError(
      error,
      "Unable to load platform member profiles."
    )
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile] as const))
}

export async function loadAdminOrganizationSummaries({
  supabase,
}: {
  supabase: ServerSupabase
}) {
  const [
    { data: organizations, error: organizationsError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "user_id, status, profile, created_at, updated_at, public_slug, is_public, location_lat, location_lng"
      )
      .order("updated_at", { ascending: false })
      .returns<OrganizationRow[]>(),
    supabase
      .from("organization_memberships")
      .select("org_id, member_id, role, member_email, created_at")
      .returns<MembershipRow[]>(),
  ])

  if (organizationsError) {
    throw supabaseErrorToError(
      organizationsError,
      "Unable to load organizations."
    )
  }
  if (membershipsError) {
    throw supabaseErrorToError(
      membershipsError,
      "Unable to load organization memberships."
    )
  }

  const organizationRows = organizations ?? []
  const membershipRows = memberships ?? []
  const [profilesById, programsByOrgId, acceleratorProgressByOrgId] =
    await Promise.all([
      loadProfilesById({
        supabase,
        ids: [
          ...organizationRows.map((organization) => organization.user_id),
          ...membershipRows.map((membership) => membership.member_id),
        ],
      }),
      loadProgramsByOrgId({
        supabase,
        orgIds: organizationRows.map((organization) => organization.user_id),
      }),
      fetchAcceleratorProgressTotalsByUserId({
        supabase,
        userIds: organizationRows.map((organization) => organization.user_id),
        isAdmin: false,
      }),
    ])

  const membershipsByOrgId = new Map<string, MembershipRow[]>()
  for (const membership of membershipRows) {
    const list = membershipsByOrgId.get(membership.org_id) ?? []
    list.push(membership)
    membershipsByOrgId.set(membership.org_id, list)
  }

  return organizationRows
    .map((organization) =>
      buildOrganizationSummary({
        organization,
        memberships: membershipsByOrgId.get(organization.user_id) ?? [],
        profilesById,
        programsByOrgId,
        acceleratorProgressByOrgId,
      })
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function loadAdminOrganizationSummaryById({
  supabase,
  orgId,
}: {
  supabase: ServerSupabase
  orgId: string
}) {
  const [
    { data: organization, error: organizationError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "user_id, status, profile, created_at, updated_at, public_slug, is_public, location_lat, location_lng"
      )
      .eq("user_id", orgId)
      .maybeSingle<OrganizationRow>(),
    supabase
      .from("organization_memberships")
      .select("org_id, member_id, role, member_email, created_at")
      .eq("org_id", orgId)
      .returns<MembershipRow[]>(),
  ])

  if (organizationError) {
    throw supabaseErrorToError(
      organizationError,
      "Unable to load organization."
    )
  }
  if (!organization) {
    return null
  }
  if (membershipsError) {
    throw supabaseErrorToError(
      membershipsError,
      "Unable to load organization memberships."
    )
  }

  const [profilesById, programsByOrgId, acceleratorProgressByOrgId] =
    await Promise.all([
      loadProfilesById({
        supabase,
        ids: [
          organization.user_id,
          ...(memberships ?? []).map((membership) => membership.member_id),
        ],
      }),
      loadProgramsByOrgId({
        supabase,
        orgIds: [organization.user_id],
      }),
      fetchAcceleratorProgressTotalsByUserId({
        supabase,
        userIds: [organization.user_id],
        isAdmin: false,
      }),
    ])

  return buildOrganizationSummary({
    organization,
    memberships: memberships ?? [],
    profilesById,
    programsByOrgId,
    acceleratorProgressByOrgId,
  })
}

export function mapAdminOrganizationSummaryToProject(
  organization: MemberWorkspaceAdminOrganizationSummary
): PlatformAdminDashboardLabProject {
  const now = new Date()
  const createdAt = new Date(organization.createdAt)
  const endDate =
    organization.setupProgress >= 100
      ? addDays(now, 14)
      : addDays(now, Math.max(21, organization.missingSetupCount * 7))
  const status = resolveAdminOrganizationProjectStatus({
    organizationStatus: organization.organizationStatus,
    setupProgress: organization.setupProgress,
  })

  return {
    id: organization.canonicalProjectId ?? organization.orgId,
    organizationId: organization.orgId,
    projectKind: "organization_admin",
    name: organization.name,
    taskCount: organization.setupTotalCount,
    progress: organization.setupProgress,
    startDate: createdAt,
    endDate,
    status,
    priority: resolveAdminOrganizationProjectPriority(
      organization.setupProgress
    ),
    tags: organization.tags,
    members: organization.members.slice(0, 4).map((member) => member.name),
    primaryPersonName: organization.ownerName,
    primaryPersonAvatarUrl: organization.ownerAvatarUrl,
    organizationImageUrl: resolveOrganizationCardImage(organization),
    client: organization.isPublic ? "Public" : "Private",
    typeLabel:
      organization.organizationStatus === "approved"
        ? "Approved nonprofit"
        : organization.organizationStatus === "pending"
          ? "Pending setup"
          : "Organization account",
    durationLabel: [
      `${organization.memberCount} member${organization.memberCount === 1 ? "" : "s"}`,
      `${organization.programs?.length ?? 0} program${organization.programs?.length === 1 ? "" : "s"}`,
    ].join(" • "),
    taskSummaryLabel: "Setup items",
    tasks: organization.setupItems.map((item) => ({
      id: `${organization.orgId}-${item.id}`,
      name: item.label,
      type: "task",
      assignee: organization.ownerName,
      status: item.complete ? "done" : "todo",
      startDate: createdAt,
      endDate,
    })),
  }
}

export function mapAdminOrganizationSummaryToProjectRecord(
  organization: MemberWorkspaceAdminOrganizationSummary
): OrganizationProjectRecord {
  const project = mapAdminOrganizationSummaryToProject(organization)

  return {
    id: organization.canonicalProjectId ?? organization.orgId,
    org_id: organization.orgId,
    canonical_org_id: organization.orgId,
    project_kind: "organization_admin",
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    start_date: project.startDate?.toISOString().slice(0, 10) ?? null,
    end_date: project.endDate?.toISOString().slice(0, 10) ?? null,
    client_name: project.client ?? null,
    type_label: project.typeLabel ?? null,
    duration_label: project.durationLabel ?? null,
    tags: project.tags,
    member_labels: project.members,
    task_count: project.taskCount,
    created_source: "system",
    starter_seed_key: null,
    starter_seed_version: null,
    created_by: organization.orgId,
    updated_by: organization.orgId,
    created_at: organization.createdAt,
    updated_at: organization.updatedAt,
  }
}
