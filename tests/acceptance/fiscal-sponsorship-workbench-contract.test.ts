import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("fiscal sponsorship workbench contract", () => {
  it("keeps admin workbench actions injected and documents/signing separate", () => {
    const projectWorkbench = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-project-workbench.tsx"
    )
    const projectWorkbenchDocuments = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-project-workbench-documents.tsx"
    )
    const projectWorkbenchRequiredDocuments = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-project-workbench-required-documents.tsx"
    )
    const requiredDocumentConnectPanel = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-required-document-connect-panel.tsx"
    )
    const projectAssetUpload = readSource(
      "src/features/fiscal-sponsorship/lib/project-asset-upload.ts"
    )
    const workflowTimeline = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-timeline.tsx"
    )
    const projectWorkbenchAdminActions = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-project-workbench-admin-actions.tsx"
    )

    expect(projectWorkbench).toContain("FiscalSponsorshipProjectWorkbench")
    expect(projectWorkbench).toContain(
      "data-fiscal-sponsorship-project-workbench"
    )
    expect(projectWorkbench).toContain("Fiscal sponsorship progress")
    expect(projectWorkbench).toContain("WorkbenchPhaseTimeline")
    expect(projectWorkbench).toContain("RadioGroup")
    expect(projectWorkbench).toContain("RadioGroupItem")
    expect(projectWorkbench).toContain("Collapsible")
    expect(projectWorkbench).toContain("CollapsibleTrigger")
    expect(projectWorkbench).toContain("CollapsibleContent")
    expect(projectWorkbench).toContain("renderApplicationEditor")
    expect(projectWorkbench).toContain("data-[state=closed]:hidden")
    expect(projectWorkbench).toContain("onValueChange={onExpandedPhaseChange}")
    expect(projectWorkbench).toContain("Show ${item.label} details")
    expect(projectWorkbench).toContain("bg-primary/10 text-primary")
    expect(projectWorkbench).toContain('className="py-1.5"')
    expect(projectWorkbench).toContain("hover:bg-muted/60 min-w-0 rounded-xl")
    expect(projectWorkbench).toContain(
      "flex min-w-0 flex-1 items-center justify-between gap-3"
    )
    expect(projectWorkbench).toContain(
      "transition-[color,box-shadow,background-color]"
    )
    expect(projectWorkbench).toContain(
      'data-fiscal-sponsorship-phase-status="complete"'
    )
    expect(projectWorkbench).toContain("text-emerald-600")
    expect(projectWorkbench).not.toContain("HourglassIcon")
    expect(projectWorkbench).toContain("data-fiscal-sponsorship-phase-action")
    expect(projectWorkbench).not.toContain("FiscalSponsorshipWorkflowTimeline")
    expect(projectWorkbench).toContain("onOpenAssets")
    expect(projectWorkbench).toContain("onEditApplication")
    expect(projectWorkbench).toContain(
      "FiscalSponsorshipProjectWorkbenchAdminActions"
    )
    expect(projectWorkbench).toContain(
      "FiscalSponsorshipProjectWorkbenchDocuments"
    )
    expect(projectWorkbench).toContain("documents={data.documentActions}")
    expect(projectWorkbench).toContain("signingActions={data.signingActions}")
    expect(projectWorkbench).toContain("canApproveApplication")
    expect(projectWorkbench).toContain("canGenerateAgreement")
    expect(projectWorkbench).toContain("canSendAgreement")
    expect(projectWorkbench).toContain("applicationPhaseRef")
    expect(projectWorkbench).toContain("scrollIntoView")
    expect(projectWorkbenchAdminActions).toContain("Prepare agreement")
    expect(projectWorkbenchAdminActions).toContain("Send for signature")
    expect(projectWorkbenchAdminActions).toContain('role="alert"')
    expect(projectWorkbenchAdminActions).not.toContain(
      `
        Generate
`
    )
    expect(projectWorkbench).not.toContain("ShieldCheckIcon")

    expect(projectWorkbenchDocuments).toContain(
      "data-fiscal-sponsorship-project-workbench-documents"
    )
    expect(projectWorkbenchDocuments).toContain("Documents and signing")
    expect(projectWorkbenchDocuments).toContain("Sign securely in Coach House")
    expect(projectWorkbenchDocuments).not.toContain("DocuSeal")
    expect(projectWorkbenchDocuments).toContain("View")
    expect(projectWorkbenchDocuments).toContain("Download")
    expect(projectWorkbenchDocuments).toContain("Sign")
    expect(projectWorkbenchDocuments).toContain(
      "bg-amber-500/12 px-2 py-0.5 text-[11px] leading-none text-amber-700"
    )
    expect(projectWorkbenchDocuments).toContain(
      "ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5"
    )
    expect(projectWorkbenchDocuments).not.toContain(
      "reviewFiscalSponsorshipDocumentAction"
    )

    expect(projectWorkbenchRequiredDocuments).toContain("CollapsibleTrigger")
    expect(projectWorkbenchRequiredDocuments).toContain("CollapsibleContent")
    expect(projectWorkbenchRequiredDocuments).toContain("expandedUploadKey")
    expect(projectWorkbenchRequiredDocuments).toContain("ml-auto")
    expect(projectWorkbenchRequiredDocuments).toContain(
      "FiscalSponsorshipRequiredDocumentConnectPanel"
    )
    expect(projectWorkbenchRequiredDocuments).not.toContain(
      "onClick={onOpenAssets}"
    )
    expect(requiredDocumentConnectPanel).toContain("<Dropzone")
    expect(requiredDocumentConnectPanel).toContain("<DropzoneContent")
    expect(requiredDocumentConnectPanel).toContain("<DropzoneEmptyState")
    expect(requiredDocumentConnectPanel).toContain("Upload and connect")
    expect(requiredDocumentConnectPanel).toContain("RadioGroupItem")
    expect(requiredDocumentConnectPanel).toContain("max-h-40")
    expect(requiredDocumentConnectPanel).toContain("asset.sizeLabel")
    expect(requiredDocumentConnectPanel).toContain("router.refresh()")
    expect(projectAssetUpload).toContain('fetch("/api/account/project-assets"')

    expect(workflowTimeline).toContain(
      "data-fiscal-sponsorship-workflow-timeline"
    )
    expect(workflowTimeline).toContain("data-fiscal-sponsorship-workflow-event")
    expect(workflowTimeline).toContain("Intl.DateTimeFormat")
    expect(workflowTimeline).toContain("formatTimelineEventType")
    expect(workflowTimeline).toContain("formatTimelineEventSummary")
    expect(workflowTimeline).toContain("No fiscal activity recorded yet.")
    expect(workflowTimeline).toContain("DEFAULT_PAGE_SIZE = 4")
    expect(workflowTimeline).toContain("AnimatePresence")
    expect(workflowTimeline).toContain("useReducedMotion")
    expect(workflowTimeline).toContain("PaginationPrevious")
    expect(workflowTimeline).toContain("PaginationNext")
    expect(workflowTimeline).toContain("resolveEventHref")
    expect(workflowTimeline).toContain("onNavigate")

    expect(projectWorkbenchAdminActions).toContain(
      "data-fiscal-sponsorship-project-workbench-admin-actions"
    )
    expect(projectWorkbenchAdminActions).toContain("useTransition")
    expect(projectWorkbenchAdminActions).toContain("toast.success")
    expect(projectWorkbenchAdminActions).toContain("router.refresh()")
    expect(projectWorkbenchAdminActions).toContain(
      "reviewFiscalSponsorshipApplicationAction"
    )
    expect(projectWorkbenchAdminActions).toContain(
      "generateFiscalSponsorshipAgreementAction"
    )
    expect(projectWorkbenchAdminActions).toContain(
      "sendFiscalSponsorshipAgreementForSignatureAction"
    )
    expect(projectWorkbenchAdminActions).toContain("agreementDocumentId")
    expect(projectWorkbenchAdminActions).toContain('decision: "approved"')
    expect(projectWorkbenchAdminActions).not.toContain("<Card")
  })

  it("keeps project workbench data and server summary tied to real fiscal tables", () => {
    const projectWorkbenchData = readSource(
      "src/features/fiscal-sponsorship/lib/project-workbench-data.ts"
    )
    const projectWorkbenchDataHelpers = readSource(
      "src/features/fiscal-sponsorship/lib/project-workbench-data-helpers.ts"
    )
    const workflowSummary = readSource(
      "src/features/fiscal-sponsorship/server/workflow-summary.ts"
    )
    const workflowEventSummary = readSource(
      "src/features/fiscal-sponsorship/server/workflow-event-summary.ts"
    )

    expect(projectWorkbenchData).toContain(
      "buildFiscalSponsorshipProjectWorkbenchData"
    )
    expect(projectWorkbenchData).toContain("workflowSummary")
    expect(projectWorkbenchData).toContain("latestAgreementDocumentId")
    expect(projectWorkbenchData).toContain("documentActions")
    expect(projectWorkbenchData).toContain("timelineEvents")
    expect(projectWorkbenchData).toContain("signingActions")
    expect(projectWorkbenchData).toContain("requiredDocuments")
    expect(projectWorkbenchData).toContain("requiredItems")
    expect(projectWorkbenchData).toContain("phases")
    expect(projectWorkbenchData).toContain("latestExecutedAgreementDocument")
    expect(projectWorkbenchData).toContain("latestAuditCertificateDocument")
    expect(projectWorkbenchData).toContain(
      'document.reviewStatus !== "rejected"'
    )
    expect(projectWorkbenchData).toContain("applicantCanSign")
    expect(projectWorkbenchData).toContain("coachCanSign")
    expect(projectWorkbenchData).toContain('signaturePacketStatus === "sent"')
    expect(projectWorkbenchData).toContain(
      'signaturePacketStatus === "applicant_signed"'
    )
    expect(projectWorkbenchData).not.toContain(
      "requiredDocuments.length > 0 || hasFiles"
    )

    expect(projectWorkbenchDataHelpers).toContain("buildRequiredItems")
    expect(projectWorkbenchDataHelpers).toContain("buildWorkflowPhases")
    expect(projectWorkbenchDataHelpers).toContain("formatDocumentReviewStatus")
    expect(projectWorkbenchDataHelpers).toContain("Legal entity and tax status")
    expect(projectWorkbenchDataHelpers).toContain('id: "fund-setup"')
    expect(projectWorkbenchDataHelpers).toContain('id: "fundraising-approval"')
    expect(projectWorkbenchDataHelpers).toContain('id: "donations-ledger"')
    expect(projectWorkbenchDataHelpers).toContain('id: "reporting"')
    expect(projectWorkbenchDataHelpers).toContain('id: "closeout"')
    expect(projectWorkbenchDataHelpers).toContain("Grant request support")

    expect(workflowSummary).toContain(
      "loadFiscalSponsorshipProjectWorkflowSummary"
    )
    expect(workflowSummary).toContain("fiscal_sponsorship_applications")
    expect(workflowSummary).toContain("fiscal_sponsorship_documents")
    expect(workflowSummary).toContain("fiscal_sponsorship_signature_packets")
    expect(workflowEventSummary).toContain("fiscal_sponsorship_events")
    expect(workflowSummary).toContain("events: []")
    expect(workflowSummary).toContain("events: (events ?? [])")
    expect(workflowEventSummary).toContain("loadFiscalWorkflowEvents")
    expect(workflowEventSummary).toContain("mapFiscalWorkflowEventSummary")
    expect(workflowEventSummary).toContain(
      '.order("created_at", { ascending: false })'
    )
    expect(workflowSummary).toContain("latestAgreementDocument")
    expect(workflowSummary).toContain("latestExecutedAgreementDocument")
    expect(workflowSummary).toContain("latestAuditCertificateDocument")
    expect(workflowSummary).toContain("getLatestRequiredDocumentRows")
    expect(workflowSummary).toContain("resolveDocuSealSubmitterSigningHref")
    expect(workflowSummary).toContain("buildProjectAssetHref")
    expect(workflowSummary).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
  })

  it("keeps superadmin routing and member project placement explicit", () => {
    const memberProjectFiscalWorkbench = readSource(
      "src/features/member-workspace/components/projects/member-workspace-project-fiscal-workbench.tsx"
    )
    const memberProjectDetailPage = readSource(
      "src/features/member-workspace/components/projects/member-workspace-project-detail-page.tsx"
    )
    const memberProjectDetailTabs = readSource(
      "src/features/member-workspace/components/projects/member-workspace-project-detail-tabs.tsx"
    )
    const memberProjectRightMetaPanel = readSource(
      "src/features/member-workspace/components/projects/member-workspace-project-right-meta-panel.tsx"
    )
    const organizationDetailRoute = readSource(
      "src/app/(dashboard)/organizations/[id]/page.tsx"
    )
    const organizationsPage = readSource(
      "src/app/(dashboard)/organizations/page.tsx"
    )

    expect(memberProjectFiscalWorkbench).toContain(
      "buildMemberWorkspaceProjectFiscalWorkbenchData"
    )
    expect(memberProjectFiscalWorkbench).toContain(
      "FiscalSponsorshipApplicationEditor"
    )
    expect(memberProjectFiscalWorkbench).toContain('surface="inline"')
    expect(memberProjectFiscalWorkbench).not.toContain(
      "FiscalSponsorshipApplicationDrawer"
    )
    expect(memberProjectFiscalWorkbench).toContain("onOpenAssets")
    expect(memberProjectFiscalWorkbench).toContain(
      "<FiscalSponsorshipProjectWorkbench"
    )
    expect(memberProjectFiscalWorkbench).toContain(
      "reviewFiscalSponsorshipApplicationAction"
    )
    expect(memberProjectDetailPage).toContain(
      "fiscalSponsorshipWorkflowSummary"
    )
    expect(memberProjectDetailPage).toContain(
      "generateFiscalSponsorshipAgreementAction"
    )
    expect(memberProjectDetailTabs).toContain("fiscalSponsorshipWorkbench")
    expect(memberProjectDetailTabs).toContain(
      "MemberWorkspaceProjectFiscalWorkbench"
    )
    expect(memberProjectDetailTabs).not.toContain("showFiscalSponsorshipTab")
    expect(memberProjectDetailTabs).not.toContain(
      '<TabsTrigger value="activity-feed">Activity Feed</TabsTrigger>'
    )
    expect(memberProjectDetailTabs).not.toContain(
      '<TabsContent value="activity-feed">'
    )
    expect(memberProjectDetailTabs).toContain(
      "resolvedFiscalSponsorshipWorkbench"
    )
    expect(memberProjectDetailTabs).toMatch(/<TabsContent value="fiscal-sponsorship">\s*\{resolvedFiscalSponsorshipWorkbench\}\s*<\/TabsContent>/)
    expect(memberProjectRightMetaPanel).not.toContain(
      "FiscalSponsorshipProjectWorkbench"
    )
    expect(memberProjectRightMetaPanel).toContain(
      "FiscalSponsorshipWorkflowTimeline"
    )
    expect(memberProjectRightMetaPanel).toContain('variant="sidebar"')
    expect(memberProjectRightMetaPanel).toContain("resolveFiscalUpdateHref")
    expect(memberProjectRightMetaPanel).toContain("<Separator />")
    expect(
      memberProjectRightMetaPanel.indexOf("<FiscalSponsorshipWorkflowTimeline")
    ).toBeLessThan(memberProjectRightMetaPanel.indexOf("<ProjectScheduleTimeline"))
    expect(memberProjectDetailPage).toContain("revealFiscalUpdateTarget")
    expect(memberProjectDetailPage).toContain("handleNavigateFiscalUpdate")

    expect(organizationDetailRoute).toContain(
      'await requirePlatformCapability("organizations"'
    )
    expect(organizationsPage).toContain(
      'await requirePlatformCapability("organizations"'
    )
    expect(organizationDetailRoute).toContain(
      "loadFiscalSponsorshipProjectWorkflowSummary"
    )
    expect(organizationDetailRoute).toContain("canManageFiscalSponsorship")
    expect(organizationDetailRoute).not.toContain(
      "requireMemberWorkspacePageAccess"
    )
  })
})
