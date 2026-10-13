"use server"

import { resolvePaidTeamAccessForOrgSubscription } from "@/lib/billing/subscription-access"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import { canEditOrganization } from "@/lib/organization/active-org"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import { normalizeWorkspaceBoardState } from "../_components/workspace-board/workspace-board-layout"
import type {
  WorkspaceBoardState,
  WorkspaceCollaborationInvite,
  WorkspaceDurationUnit,
} from "../_components/workspace-board/workspace-board-types"
import {
  buildWorkspaceBoardStateWithPersistedNodePosition,
  mergeNewerPersistedWorkspaceNodeState,
} from "./workspace-board-state-persistence"
import { persistWorkspaceBoardState } from "./workspace-board-state-write"
import type {
  WorkspaceBoardActionResult,
  WorkspaceCollaborationActionResult,
  WorkspaceNodePositionActionInput,
  WorkspaceRevokeActionResult,
  WorkspaceTutorialActionResult,
} from "./workspace-action-types"
import {
  buildWorkspaceInviteExpiry,
  canInviteWorkspaceCollaborators,
  filterActiveWorkspaceInvites,
} from "./workspace-state"
import { WORKSPACE_COLLABORATION_INVITE_NOTIFICATION_TYPE } from "./workspace-collaboration-invite-helpers"
import {
  loadWorkspaceInvites,
  notifyWorkspaceInvitee,
  resolveActor,
  resolveProfileDisplayName,
  resolveWorkspaceInviteTarget,
  resolveWorkspaceOrganizationName,
} from "./workspace-actions-support"

function revalidateWorkspaceBoardRoutes() {
  revalidatePath("/workspace")
  revalidatePath("/my-organization")
  revalidatePath("/organization/workspace")
}

async function canEditWorkspaceLayout({
  activeOrgRole,
  supabase,
  userId,
}: {
  activeOrgRole: Parameters<typeof canEditOrganization>[0]
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
}) {
  if (canEditOrganization(activeOrgRole)) return true

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>()

  return profile?.role === "admin"
}

export async function saveWorkspaceBoardStateAction(
  input: WorkspaceBoardState
): Promise<WorkspaceBoardActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase, activeOrg, user } = actor
  const canEditLayout = await canEditWorkspaceLayout({
    activeOrgRole: activeOrg.role,
    supabase,
    userId: user.id,
  })
  if (!canEditLayout) {
    return { error: "Only owner, admin, or staff can edit workspace layout." }
  }

  let persistenceClient = supabase
  try {
    persistenceClient = createSupabaseAdminClient()
  } catch {
    // Local/dev environments may omit service-role credentials.
  }

  if (activeOrg.orgId === user.id) {
    const { error: organizationUpsertError } = await persistenceClient
      .from("organizations")
      .upsert(
        {
          user_id: activeOrg.orgId,
        },
        { ignoreDuplicates: true, onConflict: "user_id" }
      )

    if (organizationUpsertError) {
      return { error: "Unable to save workspace layout." }
    }
  }

  const incomingBoardState = normalizeWorkspaceBoardState(input)
  const result = await persistWorkspaceBoardState({
    buildState: (persisted) =>
      mergeNewerPersistedWorkspaceNodeState({
        incoming: incomingBoardState,
        persisted,
      }),
    orgId: activeOrg.orgId,
    supabase: persistenceClient,
    userId: user.id,
  })
  if ("error" in result) return result

  revalidateWorkspaceBoardRoutes()

  return result
}

export async function saveWorkspaceNodePositionAction(
  input: WorkspaceNodePositionActionInput
): Promise<WorkspaceBoardActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase, activeOrg, user } = actor
  const canEditLayout = await canEditWorkspaceLayout({
    activeOrgRole: activeOrg.role,
    supabase,
    userId: user.id,
  })
  if (!canEditLayout) {
    return { error: "Only owner, admin, or staff can edit workspace layout." }
  }

  let persistenceClient = supabase
  try {
    persistenceClient = createSupabaseAdminClient()
  } catch {
    // Local/dev environments may omit service-role credentials.
  }

  if (activeOrg.orgId === user.id) {
    const { error: organizationUpsertError } = await persistenceClient
      .from("organizations")
      .upsert(
        {
          user_id: activeOrg.orgId,
        },
        { ignoreDuplicates: true, onConflict: "user_id" }
      )

    if (organizationUpsertError) {
      return { error: "Unable to save workspace layout." }
    }
  }

  const result = await persistWorkspaceBoardState({
    buildState: (persisted) =>
      buildWorkspaceBoardStateWithPersistedNodePosition({
        boardState: persisted ?? normalizeWorkspaceBoardState(input.boardState),
        cardId: input.cardId,
        x: Math.round(input.x),
        y: Math.round(input.y),
      }),
    orgId: activeOrg.orgId,
    supabase: persistenceClient,
    userId: user.id,
  })
  if ("error" in result) return result

  revalidateWorkspaceBoardRoutes()

  return result
}

export async function completeWorkspaceCanvasTutorialAction(): Promise<WorkspaceTutorialActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase } = actor
  const { error } = await supabase.auth.updateUser({
    data: {
      workspace_onboarding_active: false,
      workspace_onboarding_completed_at: new Date().toISOString(),
    },
  })

  if (error) {
    return { error: "Unable to complete the workspace tutorial." }
  }

  return { ok: true }
}

export async function resetWorkspaceCanvasTutorialAction(): Promise<WorkspaceTutorialActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase } = actor
  const { error } = await supabase.auth.updateUser({
    data: {
      workspace_onboarding_active: true,
      workspace_onboarding_stage: 2,
      workspace_onboarding_started_at: new Date().toISOString(),
      workspace_onboarding_completed_at: null,
    },
  })

  if (error) {
    return { error: "Unable to restart the workspace tutorial." }
  }

  return { ok: true }
}

export async function createWorkspaceCollaborationInviteAction({
  userId,
  durationValue,
  durationUnit,
}: {
  userId: string
  durationValue: number
  durationUnit: WorkspaceDurationUnit
}): Promise<WorkspaceCollaborationActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase, user, activeOrg } = actor
  if (!canInviteWorkspaceCollaborators(activeOrg.role)) {
    return {
      error: "You do not have permission to invite workspace collaborators.",
    }
  }

  const paidAccess = await resolvePaidTeamAccessForOrgSubscription({ supabase, orgId: activeOrg.orgId })
  if (paidAccess.error) return { error: paidAccess.error }
  if (!paidAccess.hasPaidTeamAccess) return { error: "Upgrade to invite collaborators and manage team access." }

  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return { error: "Choose someone to invite." }
  }

  const invitedProfile = await resolveWorkspaceInviteTarget({
    supabase,
    targetId: normalizedUserId,
  })

  if (!invitedProfile?.id) {
    return { error: "Invite target not found." }
  }

  const isOwnerInvite = invitedProfile.id === activeOrg.orgId
  if (!isOwnerInvite && !invitedProfile.isPlatformAdmin) {
    const { data: memberRow } = await supabase
      .from("organization_memberships")
      .select("member_id")
      .eq("org_id", activeOrg.orgId)
      .eq("member_id", invitedProfile.id)
      .maybeSingle<{ member_id: string }>()

    if (!memberRow?.member_id) {
      return {
        error:
          "Invite target must already be part of this organization or be a Coach House reviewer.",
      }
    }
  }

  const invitesResult = await loadWorkspaceInvites(supabase, activeOrg.orgId)
  if ("error" in invitesResult) {
    return {
      error: invitesResult.error ?? "Unable to load collaboration invites.",
    }
  }

  const activeInvites = filterActiveWorkspaceInvites(invitesResult.invites)
  const existingInvite = activeInvites.find(
    (invite) => invite.userId === invitedProfile.id
  )
  if (existingInvite) {
    return {
      ok: true,
      invite: existingInvite,
      invites: invitesResult.invites,
      inviteWasAlreadyActive: true,
    }
  }

  const invite: WorkspaceCollaborationInvite = {
    id: randomUUID(),
    userId: invitedProfile.id,
    userName: invitedProfile.fullName?.trim() || null,
    userEmail: invitedProfile.email?.trim() || null,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: buildWorkspaceInviteExpiry({
      unit: durationUnit,
      value: durationValue,
    }),
    revokedAt: null,
    durationValue: Math.max(1, Math.min(12, Math.round(durationValue))),
    durationUnit,
  }

  const { error: saveError } = await supabase
    .from("organization_workspace_invites")
    .insert({
      id: invite.id,
      org_id: activeOrg.orgId,
      user_id: invite.userId,
      user_name: invite.userName,
      user_email: invite.userEmail,
      created_by: invite.createdBy,
      created_at: invite.createdAt,
      expires_at: invite.expiresAt,
      revoked_at: invite.revokedAt,
      duration_value: invite.durationValue,
      duration_unit: invite.durationUnit,
    })

  if (saveError) {
    return { error: "Unable to create collaboration invite." }
  }

  const refreshedInvitesResult = await loadWorkspaceInvites(
    supabase,
    activeOrg.orgId
  )
  if ("error" in refreshedInvitesResult) {
    return {
      error:
        refreshedInvitesResult.error ?? "Unable to load collaboration invites.",
    }
  }

  const organizationName = await resolveWorkspaceOrganizationName({
    client: supabase,
    orgId: activeOrg.orgId,
  })
  const inviterName = await resolveProfileDisplayName({
    client: supabase,
    userId: user.id,
  })
  const notificationSent = await notifyWorkspaceInvitee({
    supabase,
    userId: invite.userId,
    orgId: activeOrg.orgId,
    organizationName,
    inviterName,
    actorId: user.id,
    inviteeName: invite.userName,
    inviteId: invite.id,
    expiresAt: invite.expiresAt,
  })

  return {
    ok: true,
    invite,
    invites: refreshedInvitesResult.invites,
    notificationSent,
  }
}

export async function revokeWorkspaceCollaborationInviteAction(
  inviteId: string
): Promise<WorkspaceRevokeActionResult> {
  const actor = await resolveActor()
  if ("error" in actor) return { error: actor.error }

  const { supabase, activeOrg } = actor
  if (!canInviteWorkspaceCollaborators(activeOrg.role)) {
    return {
      error: "You do not have permission to manage collaboration invites.",
    }
  }

  const normalizedInviteId = inviteId.trim()
  if (!normalizedInviteId) {
    return { error: "Invite ID is required." }
  }

  const { error: revokeError } = await supabase
    .from("organization_workspace_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("org_id", activeOrg.orgId)
    .eq("id", normalizedInviteId)

  if (revokeError) {
    return { error: "Unable to revoke invite." }
  }

  let notificationClient = supabase
  try {
    notificationClient = createSupabaseAdminClient()
  } catch {
    // Local environments can omit service-role credentials.
  }

  await notificationClient
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("type", WORKSPACE_COLLABORATION_INVITE_NOTIFICATION_TYPE)
    .contains("metadata", { inviteId: normalizedInviteId })

  const invitesResult = await loadWorkspaceInvites(supabase, activeOrg.orgId)
  if ("error" in invitesResult) {
    return {
      error: invitesResult.error ?? "Unable to load collaboration invites.",
    }
  }

  return { ok: true, invites: invitesResult.invites }
}
