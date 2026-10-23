import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"
import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"

import { redirect } from "next/navigation"

import { RoadmapShell } from "@/components/roadmap/roadmap-shell"
import { publicSharingEnabled } from "@/lib/feature-flags"
import {
  cleanupRoadmapTestSections,
  resolveRoadmapHeroUrl,
  resolveRoadmapSections,
} from "@/lib/roadmap"
import { resolveRoadmapHomework } from "@/lib/roadmap/homework"
import { cleanupOrgProfileHtml } from "@/lib/organization/profile-cleanup"
import {
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"

type StrategicRoadmapEditorPageProps = {
  redirectTo: string
  initialSectionSlug?: string | null
}

export async function StrategicRoadmapEditorPage({
  redirectTo,
  initialSectionSlug = null,
}: StrategicRoadmapEditorPageProps) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`)

  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  const access = await resolveDocumentCapabilities(supabase, user.id, orgId)
  if ("error" in access) throw new Error("Unable to verify document access.")
  const canEdit = access.capabilities.canEdit

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("profile, public_slug")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Record<string, unknown> | null
      public_slug: string | null
    }>()

  const htmlCleanup = cleanupOrgProfileHtml(orgRow?.profile ?? {})
  const profile = cleanupRoadmapTestSections(htmlCleanup.nextProfile).nextProfile

  const roadmapHomework = await resolveRoadmapHomework(orgId, supabase)
  const roadmapSections = resolveRoadmapSections(profile).map((section) => {
    const withHomework = {
      ...section,
      homework: roadmapHomework[section.id] ?? null,
    }
    return publicSharingEnabled
      ? withHomework
      : { ...withHomework, isPublic: false }
  })
  const normalizedSlug = initialSectionSlug?.trim() ?? ""
  const initialSectionId = normalizedSlug.length
    ? (roadmapSections.find(
        (section) =>
          section.slug === normalizedSlug || section.id === normalizedSlug
      )?.id ?? null)
    : null

  const roadmapPublicSlug = orgRow?.public_slug ?? null
  const roadmapHeroUrl = resolveRoadmapHeroUrl(profile)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {access.capabilities.reason === "upgrade" ? <FeatureUpgradeNotice title="Read here. Build more with an upgrade.">Your existing roadmap stays readable. Upgrade to edit and create documents in Coach House, or link Google Drive files from Documents.</FeatureUpgradeNotice> : null}
      <RoadmapShell
        sourceScope={{ userId: user.id, organizationId: orgId }}
        sections={roadmapSections}
        publicSlug={roadmapPublicSlug}
        heroUrl={roadmapHeroUrl ?? null}
        showHeroEditor={false}
        showProgramPreview={false}
        initialSectionId={initialSectionId}
        canEdit={canEdit}
        showHeader={false}
      />
    </div>
  )
}
