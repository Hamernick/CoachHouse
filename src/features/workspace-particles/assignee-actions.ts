"use server"

import { z } from "zod"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { readParticleAssignees } from "./server/particle-assignees"

export async function loadParticleAssigneesAction(workspaceId: string) {
  z.uuid().parse(workspaceId)
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error("Sign in again to load your team.")
  const active = await resolveActiveOrganization(client, user.id)
  if (active.orgId !== workspaceId) throw new Error("Organization changed. Reopen the workspace.")
  // Membership RLS exposes only an actor's own row. The checked organization
  // scopes this minimal roster read, including board members and pending invites.
  return readParticleAssignees(createSupabaseAdminClient({ actorId: user.id }), active.orgId)
}
