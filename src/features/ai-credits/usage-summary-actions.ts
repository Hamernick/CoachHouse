"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { readAiAccount } from "./server/accounting"

/** Identity and workspace are resolved server-side, never supplied by the widget. */
export async function loadCurrentAiUsage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in to view usage.")
  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  const account = await readAiAccount(orgId, user.id)
  return { organizationId: orgId, account }
}
