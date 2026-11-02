import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  hasOwnedOrganization,
  ORGANIZATION_CLOSURE_REQUIRED,
  reassignSharedWorkspaceAuthorReferences,
} from "@/lib/account-deletion/server"
import { disconnectGoogleDrive } from "@/features/google-drive"

export async function DELETE(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  try {
    if (await hasOwnedOrganization(admin, user.id)) {
      return NextResponse.json({ error: ORGANIZATION_CLOSURE_REQUIRED }, { status: 409 })
    }
  } catch {
    return NextResponse.json({ error: "Unable to check organization ownership." }, { status: 503 })
  }
  await disconnectGoogleDrive({ admin, userId: user.id, revoke: true }).catch(() => undefined)
  try {
    await reassignSharedWorkspaceAuthorReferences(admin, user.id)
  } catch (cleanupError) {
    return NextResponse.json(
      {
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : "Unable to prepare account data for deletion.",
      },
      { status: 500 }
    )
  }

  const { error: delError } = await admin.auth.admin.deleteUser(user.id)
  if (delError) {
    // Ownership may have changed after admission. Never resolve an Auth failure
    // by deleting organization data or by blindly retrying the deletion.
    try {
      if (await hasOwnedOrganization(admin, user.id)) {
        return NextResponse.json({ error: ORGANIZATION_CLOSURE_REQUIRED }, { status: 409 })
      }
    } catch {
      // Keep the original failure terminal; a failed read cannot authorize deletion.
    }
    return NextResponse.json(
      { error: "Account deletion could not complete. Refresh its status and retry." },
      { status: 500 },
    )
  }

  // Clear the active browser session cookie/token after deletion succeeds.
  await supabase.auth.signOut()

  return response
}
