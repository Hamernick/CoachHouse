import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("fiscal sponsorship workspace drawer contract", () => {
  it("keeps the workspace card on the drawer flow instead of a project workbench link", () => {
    const workspaceCardSummaryController = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-summary.tsx"
    )
    const workspaceCardSurface = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface.tsx"
    )
    const workspaceCardSummary = `${workspaceCardSummaryController}\n${workspaceCardSurface}`
    const data = readSource(
      "src/features/fiscal-sponsorship/lib/prototype-data.ts"
    )

    expect(workspaceCardSummary).toContain("FiscalSponsorshipWorkflowDrawer")
    expect(workspaceCardSummary).toContain("FiscalSponsorshipApplicationDrawer")
    expect(workspaceCardSummary).toContain("FISCAL_SPONSORSHIP_HANDBOOK_HREF")
    expect(workspaceCardSummary).toContain("FiscalSponsorshipStartDialog")
    expect(workspaceCardSummary).not.toContain("FiscalSponsorshipStepDrawer")
    expect(workspaceCardSummary).not.toContain("Project workbench")
    expect(workspaceCardSummary).not.toContain("Open flow")
    expect(workspaceCardSummary).not.toContain("mapped")

    expect(data).toContain("FISCAL_SPONSORSHIP_DOCUMENTS")
    expect(data).toContain("FISCAL_SPONSORSHIP_SIGNATURE_PACKET")
    expect(data).toContain("FISCAL_SPONSORSHIP_HANDBOOK_HREF")
    expect(data).toContain("FISCAL_SPONSORSHIP_HANDBOOK_DOWNLOAD_HREF")
    expect(data).toContain('id: "full-handbook"')
    expect(data).toContain("2026 Coach House fiscal sponsorship handbook")
    expect(data).not.toContain("/fiscal-sponsorship/placeholders/")
  })

  it("keeps the fiscal workflow drawer compact, animated, and timeline-aware", () => {
    const workflowDrawer = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-drawer.tsx"
    )
    const workflowDrawerSections = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-drawer-sections.tsx"
    )
    const stepDrawer = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-step-drawer.tsx"
    )

    expect(stepDrawer).toContain(
      'viewportClassName="max-h-[calc(100svh-15rem)] scroll-fade-effect-y [--mask-height:2rem] [--scroll-buffer:1.5rem]"'
    )
    expect(workflowDrawer).toContain(
      "FiscalSponsorshipRequiredDocumentsUploadPanel"
    )
    expect(workflowDrawer).toContain("legalEntityType={")
    expect(workflowDrawer).toContain("SigningActions")
    expect(workflowDrawer).toContain("DocumentsAndSigning")
    expect(workflowDrawer).toContain("showGrantRequestSupport")
    expect(workflowDrawer).toContain("FiscalSponsorshipWorkflowTimeline")
    expect(workflowDrawer).toContain("events={data.timelineEvents}")
    expect(workflowDrawerSections).toContain("FiscalWorkflowDisclosureRow")
    expect(workflowDrawerSections).toContain(
      "FISCAL_WORKFLOW_DISCLOSURE_ROW_CLASSNAME"
    )
    expect(workflowDrawerSections).toContain(
      "transition-[background-color,color]"
    )
    expect(workflowDrawerSections).toContain(
      "h-7 max-w-full overflow-visible rounded-full"
    )
    expect(workflowDrawerSections).toContain("group-hover:bg-emerald-500/15")
    expect(workflowDrawerSections).toContain("group-hover:bg-amber-500/15")
    expect(workflowDrawerSections).not.toContain("group-hover:shadow-sm")
    expect(workflowDrawerSections).toContain("aria-expanded={open}")
    expect(workflowDrawerSections).toContain("grid-rows-[1fr] opacity-100")
    expect(workflowDrawerSections).toContain(
      "pointer-events-none grid-rows-[0fr] opacity-0"
    )
    expect(workflowDrawer).toContain(
      "text-card-foreground border-border/60 bg-muted relative mx-3 mt-3 min-h-0 min-w-0 flex-1 overflow-hidden rounded-[2rem] border p-3 shadow-sm"
    )
    expect(workflowDrawer).toContain(
      'viewportClassName="max-h-[calc(100svh-15rem)] max-w-full overflow-x-hidden rounded-none scroll-fade-effect-y [--mask-height:2rem] [--scroll-buffer:1.5rem] [&>div]:!block [&>div]:!w-full [&>div]:!max-w-full [&>div]:!min-w-0"'
    )
    expect(workflowDrawer).toContain(
      'contentClassName="min-w-0 max-w-full overflow-hidden [&>*]:min-w-0 [&>*]:max-w-full"'
    )
    expect(workflowDrawer).not.toContain("space-y-4")
  })

  it("keeps user uploads connected to project assets and post-signing requirements", () => {
    const uploadPanel = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-required-documents-upload-panel.tsx"
    )
    const projectAssetUpload = readSource(
      "src/features/fiscal-sponsorship/lib/project-asset-upload.ts"
    )

    expect(uploadPanel).toContain("uploadFiscalSponsorshipProjectAsset")
    expect(projectAssetUpload).toContain('fetch("/api/account/project-assets"')
    expect(uploadPanel).toContain("connectFiscalSponsorshipDocumentAsset")
    expect(uploadPanel).toContain("[overflow-wrap:anywhere]")
    expect(uploadPanel).toContain(
      "Grant requests and reports come after signing"
    )
    expect(uploadPanel).not.toContain("reviewFiscalSponsorshipDocument")
  })
})
