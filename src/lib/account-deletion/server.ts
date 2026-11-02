/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  hasBillingCancellationRiskFromSubscription,
} from "@/lib/billing/subscription-access"
import { resolvePaidPlanTierFromMetadata } from "@/lib/billing/plan-tier"
import type { Database, Json } from "@/lib/supabase"
import type {
  AccountDeletionAccountType,
  AccountDeletionCleanupItem,
  AccountDeletionNotice,
  AccountDeletionPreflight,
} from "./types"

export const WORKSPACE_AUTHOR_TABLES = [
  "organization_project_assets",
  "organization_project_quick_links",
  "organization_project_notes",
  "organization_task_assignees",
  "organization_tasks",
  "organization_projects",
] as const

type AdminClient = SupabaseClient<Database, "public">

type SubscriptionForPreflight = {
  status: string | null
  metadata: Json | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export function resolveSupabaseErrorMessage(
  error: { message?: string } | null | undefined,
) {
  return typeof error?.message === "string" && error.message.trim().length > 0
    ? error.message
    : "Unable to delete account."
}

export const ORGANIZATION_CLOSURE_REQUIRED =
  "Your organization must be closed separately before this login can be deleted."

// Recheck at dispatch: a previously loaded dialog is not deletion authority.
// The organizations owner FK supplies the concurrent-write boundary.
export async function hasOwnedOrganization(admin: AdminClient, userId: string) {
  const { count, error } = await admin
    .from("organizations")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (error || typeof count !== "number") throw new Error("Unable to check organization ownership.")
  return count > 0
}

function asRecord(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function resolvePlanLabel(metadata: Json | null | undefined) {
  const source = asRecord(metadata)
  const planName = typeof source?.planName === "string" ? source.planName.trim() : ""
  if (planName.length > 0) return planName

  const tier = resolvePaidPlanTierFromMetadata(metadata)
  if (tier === "operations_support") return "Operations Support"
  if (tier === "organization") return "Organization"
  return null
}

async function countRows({
  admin,
  table,
  filter,
}: {
  admin: AdminClient
  table: string
  filter: (query: any) => any
}) {
  const uncheckedAdmin = admin as SupabaseClient<any>
  const { count, error } = await filter(
    uncheckedAdmin.from(table).select("*", { count: "exact", head: true }),
  )

  if (error) {
    throw new Error(resolveSupabaseErrorMessage(error))
  }

  return count ?? 0
}

async function countSharedWorkspaceAuthorReferences(
  admin: AdminClient,
  userId: string,
) {
  let total = 0
  for (const table of WORKSPACE_AUTHOR_TABLES) {
    total += await countRows({
      admin,
      table,
      filter: (query) => query.eq("created_by", userId).neq("org_id", userId),
    })
  }
  return total
}

async function loadAccountSubscriptionForPreflight(
  admin: AdminClient,
  userId: string,
) {
  const uncheckedAdmin = admin as SupabaseClient<any>
  const { data, error } = await uncheckedAdmin
    .from("subscriptions")
    .select("status, metadata, stripe_customer_id, stripe_subscription_id, created_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "incomplete"])
    .not("stripe_subscription_id", "ilike", "stub_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionForPreflight>()

  if (error) {
    throw new Error(resolveSupabaseErrorMessage(error))
  }

  return data ?? null
}

function buildAccountType({
  isAdmin,
  hasBillingRisk,
  ownedOrganizations,
  joinedOrganizations,
}: {
  isAdmin: boolean
  hasBillingRisk: boolean
  ownedOrganizations: number
  joinedOrganizations: number
}): AccountDeletionAccountType {
  if (isAdmin) return "admin"
  if (hasBillingRisk) return "paid_owner"
  if (ownedOrganizations > 0) return "org_owner"
  if (joinedOrganizations > 0) return "member"
  return "free"
}

function addNotice(
  notices: AccountDeletionNotice[],
  notice: AccountDeletionNotice | false,
) {
  if (notice) notices.push(notice)
}

function buildCleanupPreview({
  ownedOrganizations,
  joinedOrganizations,
  sharedWorkspaceAuthorReferences,
  pendingAccessRequests,
  pendingInvitesSent,
}: AccountDeletionPreflight["counts"]): AccountDeletionCleanupItem[] {
  const items: AccountDeletionCleanupItem[] = [
    {
      id: "profile",
      label: "Profile and login",
      count: 1,
      disposition: "deleted",
    },
    {
      id: "owned-organizations",
      label: "Owned organizations",
      count: ownedOrganizations,
      disposition: "retained",
    },
    {
      id: "joined-organizations",
      label: "Joined organization memberships",
      count: joinedOrganizations,
      disposition: "removed",
    },
    {
      id: "shared-workspace-author-references",
      label: "Shared workspace authored items",
      count: sharedWorkspaceAuthorReferences,
      disposition: "retained",
    },
    {
      id: "pending-access-requests",
      label: "Pending access requests",
      count: pendingAccessRequests,
      disposition: "deleted",
    },
    {
      id: "pending-invites",
      label: "Pending invites sent",
      count: pendingInvitesSent,
      disposition: "unchanged",
    },
  ]

  return items.filter((item) => item.count > 0 || item.id === "profile")
}

export async function getAccountDeletionPreflight({
  admin,
  userId,
  isAdmin,
}: {
  admin: AdminClient
  userId: string
  isAdmin: boolean
}): Promise<AccountDeletionPreflight> {
  const [
    accountSubscription,
    ownedOrganizations,
    ownedOrganizationMembers,
    joinedOrganizations,
    sharedWorkspaceAuthorReferences,
    pendingAccessRequests,
    pendingInvitesSent,
  ] = await Promise.all([
    loadAccountSubscriptionForPreflight(admin, userId),
    countRows({
      admin,
      table: "organizations",
      filter: (query) => query.eq("user_id", userId),
    }),
    countRows({
      admin,
      table: "organization_memberships",
      filter: (query) => query.eq("org_id", userId),
    }),
    countRows({
      admin,
      table: "organization_memberships",
      filter: (query) => query.eq("member_id", userId).neq("org_id", userId),
    }),
    countSharedWorkspaceAuthorReferences(admin, userId),
    countRows({
      admin,
      table: "organization_access_requests",
      filter: (query) =>
        query.or(`invitee_user_id.eq.${userId},invited_by_user_id.eq.${userId}`),
    }),
    countRows({
      admin,
      table: "organization_invites",
      filter: (query) => query.eq("invited_by", userId),
    }),
  ])

  const hasBillingRisk =
    hasBillingCancellationRiskFromSubscription(accountSubscription)
  const counts: AccountDeletionPreflight["counts"] = {
    ownedOrganizations,
    ownedOrganizationMembers,
    joinedOrganizations,
    sharedWorkspaceAuthorReferences,
    pendingAccessRequests,
    pendingInvitesSent,
  }
  const warnings: AccountDeletionNotice[] = []
  const blockingIssues: AccountDeletionNotice[] = []

  addNotice(
    warnings,
    hasBillingRisk && {
      id: "billing-risk",
      title: "Stripe billing may continue",
      description:
        "This account owns an active paid Stripe subscription. Delete the account only after billing is canceled or intentionally left active.",
    },
  )
  addNotice(
    blockingIssues,
    ownedOrganizations > 0 && {
      id: "organization-closure-required",
      title: "Close your organization separately",
      description: ORGANIZATION_CLOSURE_REQUIRED,
    },
  )
  addNotice(
    warnings,
    joinedOrganizations > 0 && {
      id: "joined-organizations",
      title: "Joined organization access will be removed",
      description:
        "This account will be removed from organizations it has joined, but those organizations and their data stay in place.",
    },
  )
  addNotice(
    warnings,
    sharedWorkspaceAuthorReferences > 0 && {
      id: "shared-workspace-author-references",
      title: "Shared workspace items will stay with the organization",
      description:
        "Content created inside another organization is reassigned before deletion so shared workspace records do not block account removal.",
    },
  )
  addNotice(
    warnings,
    isAdmin && {
      id: "admin-account",
      title: "Platform admin access will be removed",
      description:
        "This account has admin privileges. Deleting it removes that admin access permanently.",
    },
  )

  return {
    canDelete: blockingIssues.length === 0,
    accountType: buildAccountType({
      isAdmin,
      hasBillingRisk,
      ownedOrganizations,
      joinedOrganizations,
    }),
    billing: {
      hasCancellationRisk: hasBillingRisk,
      stripeCustomerId: accountSubscription?.stripe_customer_id ?? null,
      stripeSubscriptionId: accountSubscription?.stripe_subscription_id ?? null,
      status: accountSubscription?.status ?? null,
      planLabel: resolvePlanLabel(accountSubscription?.metadata ?? null),
    },
    counts,
    cleanupPreview: buildCleanupPreview(counts),
    warnings,
    blockingIssues,
  }
}

export async function reassignSharedWorkspaceAuthorReferences(
  admin: AdminClient,
  userId: string,
) {
  for (const table of WORKSPACE_AUTHOR_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("org_id")
      .eq("created_by", userId)
      .neq("org_id", userId)
      .returns<Array<{ org_id: string }>>()

    if (error) {
      throw new Error(resolveSupabaseErrorMessage(error))
    }

    const orgIds = Array.from(new Set((data ?? []).map((row) => row.org_id)))
    for (const orgId of orgIds) {
      const { error: updateError } = await admin
        .from(table)
        .update({ created_by: orgId })
        .eq("created_by", userId)
        .eq("org_id", orgId)

      if (updateError) {
        throw new Error(resolveSupabaseErrorMessage(updateError))
      }
    }
  }
}
