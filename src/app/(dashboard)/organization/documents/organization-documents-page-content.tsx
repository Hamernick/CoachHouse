import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { redirect } from "next/navigation"

import { DocumentsTab } from "@/components/organization/org-profile-card/tabs/documents-tab"
import { buildDocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { listUserModuleNotesIndex } from "@/lib/modules/notes-index"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { getOrganizationDocumentsPath } from "@/lib/workspace/routes"
import type { MyOrganizationSearchParams } from "../../my-organization/_lib/types"

export default async function MyOrganizationDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<MyOrganizationSearchParams>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialFocusKey =
    typeof resolvedSearchParams?.focus === "string"
      ? resolvedSearchParams.focus
      : null
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }
  if (!user) {
    const returnPath = getOrganizationDocumentsPath({
      focus: initialFocusKey,
    })
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`)
  }

  const activeOrg = await resolveActiveOrganization(supabase, user.id)
  const { orgId, role } = activeOrg
  const canEdit = canEditOrganization(role)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>()
  const isAdmin = profileRow?.role === "admin"
  const entitlements = await fetchLearningEntitlements({
    supabase,
    userId: user.id,
    orgUserId: orgId,
    isAdmin,
  })
  const canAccessRoadmapDocuments = entitlements.hasAcceleratorAccess
  const moduleNotes = canAccessRoadmapDocuments
    ? await listUserModuleNotesIndex({
        supabase,
        userId: organizationLearningUserId(user.id, activeOrg),
        limit: 200,
      })
    : []

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("profile, public_slug")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Record<string, unknown> | null
      public_slug: string | null
    }>()

  const profile = (orgRow?.profile ?? {}) as Record<string, unknown>

  const policyPrograms =
    (
      await supabase
        .from("programs")
        .select("id,title")
        .eq("user_id", orgId)
        .order("created_at", { ascending: false })
        .returns<Array<{ id: string; title: string | null }>>()
    ).data ?? []
  const documentsTabData = buildDocumentsTabData({
    canAccessRoadmapDocuments,
    profile,
    programs: policyPrograms,
    publicSlug: orgRow?.public_slug ?? null,
    roadmapSections: resolveRoadmapSections(profile),
  })

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">
          {canAccessRoadmapDocuments
            ? "Keep roadmap sections and organization files organized in one secure filing system."
            : "Keep organization files organized in one secure filing system."}
        </p>
      </div>
      <DocumentsTab
        notes={moduleNotes}
        userId={user.id}
        organizationId={orgId}
        {...documentsTabData}
        editMode={canEdit}
        canEdit={canEdit}
        initialFocusKey={initialFocusKey}
      />
    </div>
  )
}
