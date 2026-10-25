import type { Metadata } from "next"
import Link from "next/link"

import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SupabaseManagerSurface } from "@/components/supabase-manager"
import { requireAdmin } from "@/lib/admin/auth"
import { env } from "@/lib/env"
import { hasSupabaseManagementApiToken } from "@/lib/supabase/management-api-config"
import { resolveSupabaseProjectRef } from "@/lib/supabase/project-ref"
import { AdminPlatformSetupToast } from "./admin-platform-setup-toast"
import { SyncAuthEmailTemplatesButton } from "./sync-auth-email-templates-button"

export const metadata: Metadata = {
  title: "Platform Administration",
  description: "Manage Coach House platform operations and data.",
}


export default async function AdminPlatformPage() {
  await requireAdmin()

  const projectRef = resolveSupabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL)
  const hasManagementApiToken = hasSupabaseManagementApiToken()

  return (
    <div className="-m-[var(--shell-content-pad)] flex min-h-full flex-1 flex-col overflow-hidden">
      {!hasManagementApiToken ? <AdminPlatformSetupToast /> : null}

      <div className="border-b border-border/60 bg-background/90 px-4 py-4 md:px-6">
        <Card className="border-border/70 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(245,245,244,0.9))] shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide">
                Email system
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide">
                Resend + Supabase
              </Badge>
            </div>
            <div className="space-y-1">
              <CardTitle>Email templates and invite delivery</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                App-owned organization invites send through Resend. Supabase lifecycle emails
                stay in Supabase Auth and can be synced from the shared Coach House template
                source.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 pt-0">
            <SyncAuthEmailTemplatesButton />
            <Button asChild type="button" variant="outline" className="gap-2">
              <Link href="/admin/platform/prototypes?project=email-gallery">
                Open email gallery
                <ArrowUpRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {projectRef ? (
        <div className="min-h-0 flex-1">
          <SupabaseManagerSurface
            projectRef={projectRef}
            className="h-full min-h-full rounded-none border-0 bg-background shadow-none"
          />
        </div>
      ) : (
        <div className="flex min-h-full flex-1 items-center justify-center p-6">
          <Alert className="max-w-xl rounded-2xl border-destructive/30 bg-destructive/5">
            <AlertDescription className="text-destructive">
              Unable to determine the Supabase project ref from{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code>.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
