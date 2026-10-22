"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { readAiAccount } from "./accounting"

export async function loadAiCredits() {
  const client = await createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error("Sign in to view AI usage.")
  const { orgId } = await resolveActiveOrganization(client,user.id)
  return readAiAccount(orgId,user.id)
}
