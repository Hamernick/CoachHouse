import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { trackUserJourneyMilestone } from "@/lib/user-journey"

import { ensureInvitedMemberInOrgDirectory } from "./invites-helpers"
import {
  getAuthenticatedUser,
  isOrganizationMemberRole,
  normalizeEmail,
  parseInviteKindFromToken,
} from "./shared"
import type { AcceptInviteResult } from "./shared"

export async function acceptOrganizationInviteActionImpl(
  token: string,
): Promise<AcceptInviteResult> {
  const supabase = await createSupabaseServerClient()
  const authResult = await getAuthenticatedUser(supabase)
  if ("error" in authResult) return { error: authResult.error }
  const user = authResult.user

  const normalizedToken = String(token ?? "").trim()
  if (!normalizedToken) return { error: "Missing invite token." }

  const email = user.email
  if (!email) return { error: "Your account does not have an email address." }
  if (!user.email_confirmed_at) return { error: "Verify your email before accepting this invitation." }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>
  try {
    adminClient = createSupabaseAdminClient()
  } catch {
    return { error: "Invites are not configured on this environment." }
  }

  const { data: invite, error: inviteError } = await adminClient
    .from("organization_invites")
    .select("id, org_id, email, role, token, expires_at, accepted_at")
    .eq("token", normalizedToken)
    .maybeSingle<{
      id: string
      org_id: string
      email: string
      role: string
      token: string
      expires_at: string
      accepted_at: string | null
    }>()

  if (inviteError || !invite) return { error: "Invite not found." }
  const inviteKind = parseInviteKindFromToken(invite.token)

  if (!isOrganizationMemberRole(invite.role) || invite.role === "owner") {
    return { error: "Invalid invite role." }
  }
  const inviteRole = invite.role

  const normalizedInviteEmail = normalizeEmail(invite.email)
  const normalizedUserEmail = normalizeEmail(email)
  if (normalizedInviteEmail !== normalizedUserEmail) {
    return { error: "This invite was sent to a different email address." }
  }

  if (invite.accepted_at) {
    const { data: membership, error } = await adminClient
      .from("organization_memberships")
      .select("role")
      .eq("org_id", invite.org_id)
      .eq("member_id", user.id)
      .maybeSingle<{ role: string }>()
    if (error || !membership || !isOrganizationMemberRole(membership.role)) {
      return { error: "This invitation has already been used. Ask your team for a new invitation." }
    }
    return { ok: true, orgId: invite.org_id, role: membership.role, inviteKind }
  }

  const expiresAt = Date.parse(invite.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { error: "This invite link has expired. Ask your team for a new invitation." }
  }

  const now = new Date().toISOString()

  const { error: upsertError } = await adminClient
    .from("organization_memberships")
    .upsert(
      {
        org_id: invite.org_id,
        member_id: user.id,
        role: inviteRole,
        member_email: normalizedUserEmail,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "org_id,member_id" },
    )

  if (upsertError) return { error: "Unable to join organization." }

  const { error: acceptError } = await adminClient
    .from("organization_invites")
    .update({ accepted_at: now })
    .eq("id", invite.id)

  if (acceptError) {
    return { error: "Joined, but failed to mark invite accepted." }
  }

  try {
    await ensureInvitedMemberInOrgDirectory({
      adminClient,
      orgId: invite.org_id,
      role: inviteRole,
      inviteKind,
      user,
      email,
    })
  } catch {}

  await trackUserJourneyMilestone({
    userId: user.id,
    orgId: invite.org_id,
    eventName: "organization_invite_accepted",
    journey: "member_access",
    source: "organization_invite_action",
    surface: "join_organization",
    checkpoint: "first_invite_accepted",
    metadata: {
      inviteKind,
      role: inviteRole,
    },
  })

  return { ok: true, orgId: invite.org_id, role: inviteRole, inviteKind }
}
