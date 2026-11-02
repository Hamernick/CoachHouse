import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { GoogleDriveError } from "../types"

export async function requireGoogleDriveContext(
  request: NextRequest,
  response: NextResponse,
  requireEdit = false,
  intent: "organization" | "revoke" = "organization",
) {
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new GoogleDriveError("unauthorized", 401)
  const organization = await resolveActiveOrganization(supabase, user.id)
  if (organization.supportAccess) throw new GoogleDriveError("forbidden", 403)
  if (requireEdit && !canEditOrganization(organization.role)) {
    throw new GoogleDriveError("forbidden", 403)
  }
  const recheck = async () => {
    // Revoking this user's shared connection remains independent of closing
    // any one organization. It never grants new access or restores files.
    if (intent === "revoke") return
    const client = createSupabaseAdminClient({ actorId: user.id })
    const admit = client.rpc.bind(client) as unknown as (
      name: "authorize_organization_drive_access",
      args: { p_actor_id: string; p_org_id: string; p_write: boolean },
    ) => PromiseLike<{ data: unknown; error: unknown }>
    const { data, error: admissionError } = await admit(
      "authorize_organization_drive_access",
      { p_actor_id: user.id, p_org_id: organization.orgId, p_write: requireEdit },
    )
    if (admissionError || data !== true) throw new GoogleDriveError("forbidden", 403)
  }
  await recheck()
  return { supabase, user, organization, recheck }
}
