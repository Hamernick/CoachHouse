import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OrganizationAccessManager } from "@/components/account-settings/sections/organization-access-manager"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { resolveActiveOrganization } from "@/lib/organization/active-org"

export const metadata: Metadata = {
  title: "Organization Administration",
  description: "Manage membership and access for your organization.",
}


export default async function OrganizationAdminPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }
  if (!user) {
    redirect("/team/login?redirect=/admin")
  }

  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()

  const orgNameRaw = orgRow?.profile?.name
  const organizationName = typeof orgNameRaw === "string" && orgNameRaw.trim().length > 0 ? orgNameRaw.trim() : undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-semibold text-foreground">Organization access</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates, adjust roles, and manage who can access your organization.
        </p>
      </header>
      <OrganizationAccessManager organizationName={organizationName} />
    </div>
  )
}
