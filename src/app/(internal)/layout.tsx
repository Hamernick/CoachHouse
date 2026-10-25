import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { readAppSidebarDefaultOpen } from "@/components/app-shell/sidebar-state-server"
import { fetchSidebarTree } from "@/lib/academy"
import { requireAdmin } from "@/lib/admin/auth"
import { resolveAccountBillingCancellationRisk } from "@/lib/billing/subscription-access"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function InternalAdminLayout({
  children,
  breadcrumbs,
}: {
  children: ReactNode
  breadcrumbs?: ReactNode
}) {
  const [{ supabase, userId }, defaultSidebarOpen] = await Promise.all([
    requireAdmin(),
    readAppSidebarDefaultOpen(),
  ])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; avatar_url: string | null }>()

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null
  const email =
    user?.email ??
    (typeof user?.user_metadata?.email === "string"
      ? user?.user_metadata?.email
      : null)
  const avatar =
    profile?.avatar_url ??
    (user?.user_metadata?.avatar_url as string | undefined) ??
    null
  const accountBillingResult = await resolveAccountBillingCancellationRisk({
    supabase,
    userId,
  })
  const hasBillingCancellationRisk =
    "error" in accountBillingResult
      ? false
      : accountBillingResult.hasBillingCancellationRisk

  const sidebarTree = await fetchSidebarTree({
    includeDrafts: true,
    forceAdmin: true,
  })

  return (
    <AppShell
      breadcrumbs={breadcrumbs}
      sidebarTree={sidebarTree}
      user={{ name: displayName, email, avatar }}
      isAdmin
      platformAccessLevel="developer"
      showOrgAdmin
      showAccelerator
      hasBillingCancellationRisk={hasBillingCancellationRisk}
      defaultSidebarOpen={defaultSidebarOpen}
      context="platform"
    >
      {children}
    </AppShell>
  )
}
