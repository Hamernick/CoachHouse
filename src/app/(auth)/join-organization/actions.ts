"use server"

import { redirect } from "next/navigation"

import { acceptOrganizationInviteAction } from "@/app/actions/organization-access"
import { getOrganizationInviteRedirect } from "@/lib/auth/organization-invite"
import { writeActiveOrganizationCookie } from "@/lib/organization/active-org-cookie"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function joinOrganizationAction(
  _previous: { error: string } | null,
  formData: FormData,
) {
  const token = formData.get("token")
  if (typeof token !== "string" || !token.trim()) return { error: "Missing invite token." }
  const result = await acceptOrganizationInviteAction(token)
  if ("error" in result) return { error: result.error }

  // Server actions may persist cookies; rendering the invite page may not.
  await writeActiveOrganizationCookie(result.orgId)
  const role = result.inviteKind === "funder" ? "funder" : result.role
  redirect(`/workspace?joined=1&role=${encodeURIComponent(role)}`)
}

export async function switchInviteAccountAction(formData: FormData) {
  const token = formData.get("token")
  const destination = typeof token === "string"
    ? getOrganizationInviteRedirect(`/join-organization?token=${encodeURIComponent(token)}`)
    : undefined
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut({ scope: "local" })
  if (error) throw new Error("Unable to sign out. Try again.")
  redirect(destination ? `/login?redirect=${encodeURIComponent(destination)}` : "/login")
}
