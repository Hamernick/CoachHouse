import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolvePaidTeamAccessForOrgSubscription } from "@/lib/billing/subscription-access"

export type OrganizationMemberRole =
  | "owner"
  | "admin"
  | "staff"
  | "board"
  | "member"

export type OrganizationAccessMember = {
  id: string
  email: string | null
  role: OrganizationMemberRole
  joinedAt: string | null
  isTester?: boolean
}

export type OrganizationAccessInvite = {
  id: string
  email: string
  role: OrganizationMemberRole
  inviteKind: OrganizationInviteKind
  token: string
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

export type OrganizationAccessRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked"

export type OrganizationAccessRequest = {
  id: string
  orgId: string
  organizationName: string | null
  inviteeUserId: string
  inviteeEmail: string
  inviteeName: string | null
  inviterUserId: string | null
  inviterName: string | null
  role: OrganizationMemberRole
  status: OrganizationAccessRequestStatus
  message: string | null
  createdAt: string
  respondedAt: string | null
  expiresAt: string
}

export type OrganizationAccessResult = { ok: true } | { error: string }

export type OrganizationAccessListResult =
  | {
      ok: true
      members: OrganizationAccessMember[]
      invites: OrganizationAccessInvite[]
      requests: OrganizationAccessRequest[]
      adminsCanInvite: boolean
      staffCanManageCalendar: boolean
      hasPaidTeamAccess: boolean
      canInvite: boolean
      canManageMembers: boolean
      canEditRoles: boolean
      canManageSettings: boolean
      canManageTesterFlags: boolean
    }
  | { error: string }

export type CreateInviteResult =
  | {
      ok: true
      outcome: "existing_user_request_created" | "existing_user_request_resent"
      request: OrganizationAccessRequest
      emailSent: boolean
      emailError: string | null
    }
  | {
      ok: true
      outcome: "external_invite_sent" | "external_invite_resent"
      invite: OrganizationAccessInvite
      emailSent: boolean
      emailError: string | null
    }
  | { error: string }

export type AcceptInviteResult =
  | {
      ok: true
      orgId: string
      role: OrganizationMemberRole
      inviteKind: OrganizationInviteKind
    }
  | { error: string }

export type ListOrganizationAccessRequestsResult =
  | { ok: true; requests: OrganizationAccessRequest[] }
  | { error: string }

export type RespondToOrganizationAccessRequestResult =
  | { ok: true; orgId: string; status: "accepted" | "declined" }
  | { error: string }

export type OrganizationInviteKind = "standard" | "funder"
export const FUNDER_INVITE_TOKEN_PREFIX = "fndr_"

export type ServerSupabaseClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

export type AuthenticatedUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  created_at?: string | null
  user_metadata?: Record<string, unknown>
}

export const INVITE_ROLES: OrganizationMemberRole[] = [
  "admin",
  "staff",
  "board",
  "member",
]

export const TEAM_ACCESS_UPGRADE_MESSAGE =
  "Upgrade to Organization to invite teammates and manage team access."

export function normalizeEmail(input: string) {
  return input.trim().toLowerCase()
}

export function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

export function isOrganizationMemberRole(
  value: string,
): value is OrganizationMemberRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "staff" ||
    value === "board" ||
    value === "member"
  )
}

export function resolveUserEmail(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}) {
  if (typeof user.email === "string" && user.email.length > 0) return user.email
  const metaEmail = user.user_metadata?.email
  return typeof metaEmail === "string" && metaEmail.length > 0 ? metaEmail : null
}

export function createInviteToken(inviteKind: OrganizationInviteKind = "standard") {
  const prefix = inviteKind === "funder" ? FUNDER_INVITE_TOKEN_PREFIX : ""
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}${uuid.replace(/-/g, "")}`
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
    return `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  }
  return `${prefix}${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
}

export function parseInviteKindFromToken(token: string): OrganizationInviteKind {
  return token.startsWith(FUNDER_INVITE_TOKEN_PREFIX) ? "funder" : "standard"
}

export function formatOrganizationRoleLabel(role: OrganizationMemberRole) {
  if (role === "owner") return "Owner"
  if (role === "admin") return "Admin"
  if (role === "staff") return "Staff"
  if (role === "board") return "Board"
  return "Viewer"
}

export function resolveOrganizationAccessRequestStatus({
  status,
  expiresAt,
}: {
  status: OrganizationAccessRequestStatus
  expiresAt: string
}): OrganizationAccessRequestStatus {
  if (status !== "pending") return status
  return new Date(expiresAt).getTime() < Date.now() ? "expired" : "pending"
}

export async function resolvePaidTeamAccessForOrg(
  supabase: ServerSupabaseClient,
  orgId: string,
): Promise<{ hasPaidTeamAccess: boolean } | { error: string }> {
  return resolvePaidTeamAccessForOrgSubscription({ supabase, orgId })
}

export async function getAuthenticatedUser(
  supabase: ServerSupabaseClient,
): Promise<{ user: AuthenticatedUser } | { error: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }
  return { user: user as AuthenticatedUser }
}

export async function resolveOrganizationActorContext(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<{
  orgId: string
  role: OrganizationMemberRole
  isPlatformAdmin: boolean
}> {
  const { orgId, role } = await resolveActiveOrganization(supabase, userId)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>()

  return {
    orgId,
    role: role as OrganizationMemberRole,
    isPlatformAdmin: profileRow?.role === "admin",
  }
}

export async function getOrganizationAccessSettings(
  supabase: ServerSupabaseClient,
  orgId: string,
): Promise<{ adminsCanInvite: boolean; staffCanManageCalendar: boolean }> {
  const { data: settingsRow } = await supabase
    .from("organization_access_settings")
    .select("admins_can_invite, staff_can_manage_calendar")
    .eq("org_id", orgId)
    .maybeSingle<{ admins_can_invite: boolean; staff_can_manage_calendar: boolean }>()

  return {
    adminsCanInvite: Boolean(settingsRow?.admins_can_invite),
    staffCanManageCalendar: Boolean(settingsRow?.staff_can_manage_calendar),
  }
}

export function canInviteTeammates({
  hasPaidTeamAccess,
  isPlatformAdmin,
  isOwner,
  role,
  adminsCanInvite,
}: {
  hasPaidTeamAccess: boolean
  isPlatformAdmin: boolean
  isOwner: boolean
  role: OrganizationMemberRole
  adminsCanInvite: boolean
}) {
  if (!hasPaidTeamAccess) return false
  return isPlatformAdmin || isOwner || (role === "admin" && adminsCanInvite)
}

export function tryCreateSupabaseAdminClient(): ReturnType<
  typeof createSupabaseAdminClient
> | null {
  try {
    return createSupabaseAdminClient()
  } catch {
    return null
  }
}

export async function findUserByEmail(email: string) {
  const admin = tryCreateSupabaseAdminClient()
  if (!admin) return null

  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return null

    const match = (data.users ?? []).find(
      (user) => normalizeEmail(user.email ?? "") === email,
    )
    if (match) {
      return {
        id: match.id,
        email: normalizeEmail(match.email ?? email),
      }
    }

    if (!data.users || data.users.length < perPage) return null
    page += 1
  }
}
