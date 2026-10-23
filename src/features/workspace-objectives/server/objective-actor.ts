import "server-only"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import type { ObjectiveScope } from "../island-types"
const scopeSchema = z.object({ userId: z.uuid(), organizationId: z.uuid() })
export async function objectiveActor(scope: ObjectiveScope, write = false) {
  scopeSchema.parse(scope)
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== scope.userId) throw new Error("Sign in again to use Objectives.")
  const active = await resolveActiveOrganization(client, user.id)
  if (active.orgId !== scope.organizationId) throw new Error("Reopen Objectives in your current organization.")
  if (write && !canEditOrganization(active.role)) throw new Error("You do not have permission to edit objectives.")
  return { client, userId: user.id, orgId: active.orgId, isOrganizationOwner: active.role === "owner" }
}
