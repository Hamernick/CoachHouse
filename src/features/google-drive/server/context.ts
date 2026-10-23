import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { GoogleDriveError } from "../types"

export async function requireGoogleDriveContext(
  request: NextRequest,
  response: NextResponse,
  requireEdit = false,
) {
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new GoogleDriveError("unauthorized", 401)
  const organization = await resolveActiveOrganization(supabase, user.id)
  if (organization.supportAccess) throw new GoogleDriveError("forbidden", 403)
  if (requireEdit && !canEditOrganization(organization.role)) {
    throw new GoogleDriveError("forbidden", 403)
  }
  return { supabase, user, organization }
}
