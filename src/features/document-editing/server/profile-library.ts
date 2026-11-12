import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"
import { readOrganizationProfileForProjection } from "@/lib/organization/profile-read"
import { projectReadableDocumentProfile } from "@/lib/organization/document-ai-copies"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { buildDocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import { profileDocumentLibrarySchema } from "@/lib/organization/document-library-schema"

const scopeSchema = z.object({ organizationId: z.string().uuid(), expectedUserId: z.string().uuid() })
const headers = { "Cache-Control": "private, no-store" }

/** Re-read the existing profile projection; never use a client snapshot as authority. */
export async function handleProfileDocumentLibraryGet(request: NextRequest) {
  const scope = scopeSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!scope.success) return NextResponse.json({ error: "Invalid document scope." }, { status: 400, headers })
  try {
    const context = await resolveOptionalAuthenticatedAppContext()
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    const { supabase, user, activeOrg, profileAudience } = context
    const { organizationId, expectedUserId } = scope.data
    if (user.id !== expectedUserId || activeOrg.orgId !== organizationId)
      return NextResponse.json({ error: "Your workspace changed. Reload Documents." }, { status: 403, headers })
    const resolved = await resolveDocumentCapabilities(supabase, user.id, organizationId)
    if ("error" in resolved || resolved.access.orgId !== organizationId)
      return NextResponse.json({ error: "Documents unavailable." }, { status: 403, headers })
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)])
    const current = await readOrganizationProfileForProjection(resolved.access.supabase, organizationId, user.id, signal)
    if (current.error || !current.data || current.data.user_id !== organizationId) throw new Error("Documents unavailable.")
    const [{ profile, roadmapSections }, entitlements, programs] = await Promise.all([
      projectReadableDocumentProfile(current.data.profile ?? {}, organizationId, user.id),
      fetchLearningEntitlements({ supabase, userId: user.id, orgUserId: organizationId, isAdmin: profileAudience.isAdmin }),
      resolved.access.supabase.from("programs").select("id,title").eq("user_id", organizationId).order("created_at", { ascending: false }).abortSignal(signal),
    ])
    if (programs.error || !programs.data) throw new Error("Documents unavailable.")
    const data = buildDocumentsTabData({ profile, roadmapSections, programs: programs.data,
      publicSlug: current.data.public_slug, canAccessRoadmapDocuments: entitlements.hasAcceleratorAccess })
    return NextResponse.json(profileDocumentLibrarySchema.parse({ ...data, userId: user.id, organizationId, canEdit: canEditOrganization(resolved.access.role) }), { headers })
  } catch {
    return NextResponse.json({ error: "Documents unavailable. Try again." }, { status: 503, headers })
  }
}
