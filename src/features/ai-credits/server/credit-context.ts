import "server-only"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveActiveOrganization } from "@/lib/organization/active-org"

export async function requireCreditOrganization(organizationId: string) {
  z.uuid().parse(organizationId)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in to view credits.")
  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  if (orgId !== organizationId) throw new Error("Your organization changed. Reopen usage before continuing.")
  return { orgId, actorId: user.id, supabase, user }
}
