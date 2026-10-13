"use server"

import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { writeActiveOrganizationCookie } from "@/lib/organization/active-org-cookie"
import type { FiscalSponsorshipApplicationStatus, FiscalSponsorshipProjectWorkbenchData } from "../types"

export async function loadPublicFiscalApplicant() {
  const context = await resolveOptionalAuthenticatedAppContext()
  if (!context) return { authenticated: false as const }
  const { data, error } = await context.supabase.from("organizations")
    .select("profile").eq("user_id", context.user.id).maybeSingle()
  if (error) return { error: "Your organization could not load. Please try again." }
  const profile = data?.profile
  const name = profile && typeof profile === "object" && !Array.isArray(profile)
    && typeof profile.name === "string" ? profile.name : ""
  return { authenticated: true as const, organizationName: name }
}

export async function startPublicFiscalIntake(organizationName: string): Promise<
  { error: string } | { data: FiscalSponsorshipProjectWorkbenchData; status: FiscalSponsorshipApplicationStatus | null }
> {
  const context = await resolveOptionalAuthenticatedAppContext()
  if (!context) return { error: "Sign in to start your application." }
  if (typeof organizationName !== "string" || !organizationName.trim() || organizationName.trim().length > 160) {
    return { error: "Enter an organization name (up to 160 characters)." }
  }
  // Use the applicant's session, never a service-role client or caller-provided org.
  const { data: projectId, error } = await context.supabase.rpc("start_public_fiscal_intake", {
    p_organization_name: organizationName.trim(),
  })
  if (error || !projectId) return { error: "We couldn’t open your application. Please try again shortly." }
  const { data: application, error: readError } = await context.supabase
    .from("fiscal_sponsorship_applications").select("id, status")
    .eq("project_id", projectId).eq("org_id", context.user.id).maybeSingle()
  if (readError) return { error: "Your application was preserved, but could not load. Please try again." }
  // Existing draft/document actions are active-org scoped. Explicit start/resume
  // selects the verified owner's organization; page reads never change it.
  await writeActiveOrganizationCookie(context.user.id)
  return {
    status: application?.status as FiscalSponsorshipApplicationStatus | null ?? null,
    data: {
      projectId, projectName: "", organizationName: organizationName.trim(),
      applicationPrefill: { primaryEmail: context.user.email ?? null },
      workflowSummary: {
        applicationId: application?.id ?? null,
        applicationStatus: application?.status as FiscalSponsorshipApplicationStatus | null ?? null,
        legalEntityType: null, submittedAt: null, reviewedAt: null, reviewNotes: null,
        events: [], latestAgreementDocument: null, latestExecutedAgreementDocument: null,
        latestAuditCertificateDocument: null, requiredDocuments: [], latestSignaturePacket: null,
      },
      applicantName: "", statusLabel: "Draft", readinessPercent: 0,
      nextStep: "Complete your application", latestAgreementDocumentId: null,
      canApproveApplication: false, canGenerateAgreement: false, canSendAgreement: false,
      documentActions: [], timelineEvents: [], metrics: [], phases: [], requiredItems: [],
      reusableItems: [], missingItems: [], reviewItems: [], signingActions: [],
    },
  }
}
