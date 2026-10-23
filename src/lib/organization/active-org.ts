import type { SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"

import type { Database } from "@/lib/supabase"
import { readActiveOrganizationCookie } from "./active-org-cookie"
import { hasWorkspaceSupportAccess } from "./support-access"
import { readOrganizationRequestScope } from "@/server/organization/request-scope"

export type OrganizationMemberRole = "owner" | "admin" | "staff" | "board" | "member"

export type ActiveOrganization = {
  orgId: string
  role: OrganizationMemberRole
  supportAccess?: boolean
}

const ROLE_PRIORITY: Record<OrganizationMemberRole, number> = {
  owner: 0,
  admin: 1,
  staff: 2,
  board: 3,
  member: 4,
}

function normalizeRole(role: unknown): OrganizationMemberRole {
  if (role === "owner") return "owner"
  if (role === "admin") return "admin"
  if (role === "staff") return "staff"
  if (role === "board") return "board"
  return "member"
}

function createdAtValue(input: string | null | undefined) {
  if (!input) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(input)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

export function canEditOrganization(role: OrganizationMemberRole) {
  return role === "owner" || role === "admin" || role === "staff"
}

const resolveActiveOrganizationCached = cache(async (
  supabase: SupabaseClient<Database>,
  userId: string,
  preferredOrgId: string | null,
): Promise<ActiveOrganization> => {
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("org_id, role, created_at")
    .eq("member_id", userId)
    .returns<Array<{ org_id: string; role: string | null; created_at: string | null }>>()

  if (preferredOrgId === userId) {
    return {
      orgId: userId,
      role: "owner",
    }
  }

  if (Array.isArray(memberships) && memberships.length > 0) {
    if (preferredOrgId) {
      const preferredMembership = memberships.find(
        (membership) => membership.org_id === preferredOrgId,
      )

      if (preferredMembership) {
        return {
          orgId: preferredMembership.org_id,
          role: normalizeRole(preferredMembership.role),
        }
      }
    }

    const sorted = [...memberships].sort((left, right) => {
      const roleDiff = ROLE_PRIORITY[normalizeRole(left.role)] - ROLE_PRIORITY[normalizeRole(right.role)]
      if (roleDiff !== 0) return roleDiff
      return createdAtValue(left.created_at) - createdAtValue(right.created_at)
    })
    const membership = sorted[0]
    return {
      orgId: membership.org_id,
      role: normalizeRole(membership.role),
    }
  }

  return { orgId: userId, role: "owner" }
})

export async function resolveActiveOrganization(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: {
    preferredOrgId?: string | null
    allowSupport?: boolean
  },
): Promise<ActiveOrganization> {
  const scope = await readOrganizationRequestScope()
  const preferredOrgId = scope?.explicit ?? (
    options && "preferredOrgId" in options
      ? options.preferredOrgId?.trim() || null
      : await readActiveOrganizationCookie().catch(() => null))
  if (preferredOrgId && preferredOrgId !== userId && options?.allowSupport !== false) {
    if (await hasWorkspaceSupportAccess(supabase)) {
      if (scope?.method && !["GET", "HEAD", "OPTIONS"].includes(scope.method) && !scope.explicit) {
        throw new Error("Reload this workspace before saving. Its organization context is missing.")
      }
      const { data, error } = await supabase.from("organizations").select("user_id")
        .eq("user_id", preferredOrgId).maybeSingle()
      if (error || !data) throw new Error("This workspace is unavailable. Choose another organization.")
      return { orgId: preferredOrgId, role: "admin", supportAccess: true }
    }
  }
  if ((scope?.supportRequested || (scope?.support && preferredOrgId === scope.support)) && options?.allowSupport !== false) {
    if (!scope?.explicit && scope?.method === "GET") return resolveActiveOrganizationCached(supabase, userId, userId)
    throw new Error("Workspace support access was revoked. Choose one of your own organizations.")
  }
  if (scope?.explicit) {
    const resolved = await resolveActiveOrganizationCached(supabase, userId, preferredOrgId)
    if (resolved.orgId !== preferredOrgId) throw new Error("You no longer have access to this organization.")
    return resolved
  }
  return resolveActiveOrganizationCached(supabase, userId, preferredOrgId)
}
