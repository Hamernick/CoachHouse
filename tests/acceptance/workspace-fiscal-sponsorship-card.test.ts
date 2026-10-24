import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { buildFiscalSponsorshipApplicationPrefill } from "@/app/(dashboard)/my-organization/_lib/workspace-fiscal-sponsorship-prefill"
import { mapWorkspaceProgramsToFiscalSponsorshipPrograms } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-static-cards"
import { WORKSPACE_CARD_IDS } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"
import {
  WORKSPACE_CARD_META,
  WORKSPACE_EDGE_SPECS,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-copy"
import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import { analyzeFiscalSponsorshipActivityEligibility } from "@/features/fiscal-sponsorship"
import { buildSelectedProgramPrefill } from "@/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-summary"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("workspace fiscal sponsorship card", () => {
  it("registers fiscal sponsorship as a real workspace card connected to Activity", () => {
    expect(WORKSPACE_CARD_IDS).toContain("fiscal-sponsorship")
    expect(WORKSPACE_CARD_META["fiscal-sponsorship"]).toMatchObject({
      title: "Fiscal Sponsorship",
      subtitle: "Model C eligibility, agreements, and grant requests",
    })
    expect(WORKSPACE_EDGE_SPECS).toContainEqual({
      id: "edge-activity-to-fiscal-sponsorship",
      source: "programs",
      target: "fiscal-sponsorship",
    })
  })

  it("uses the fiscal feature public entrypoint without mounting the prototype flow", () => {
    const featureIndex = readSource("src/features/fiscal-sponsorship/index.ts")
    const staticCards = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-static-cards.tsx"
    )
    const layoutConfig = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout-config.ts"
    )
    const frameContentClassName = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-frame-content-class-name.ts"
    )
    const organizationSupport = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-organization-support.tsx"
    )
    const activityAction = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-activity-action.tsx"
    )

    expect(featureIndex).toContain("FiscalSponsorshipWorkspaceCardSummary")
    expect(featureIndex).toContain("FiscalSponsorshipWorkspaceCardSurface")
    expect(featureIndex).toContain("FiscalSponsorshipMark")
    expect(featureIndex).toContain("FiscalSponsorshipActivityAction")
    expect(featureIndex).toContain(
      "analyzeFiscalSponsorshipActivityEligibility"
    )
    expect(featureIndex).toContain("FiscalSponsorshipWorkflowDrawer")
    expect(featureIndex).toContain(
      "FiscalSponsorshipRequiredDocumentsUploadPanel"
    )
    expect(staticCards).toContain("FiscalSponsorshipWorkspaceCardSummary")
    expect(staticCards).not.toContain("FiscalSponsorshipPanel")
    expect(staticCards).not.toContain(
      'input={{ id: "workspace-fiscal-sponsorship" }}'
    )
    expect(staticCards).toContain(
      "mapWorkspaceProgramsToFiscalSponsorshipPrograms"
    )
    expect(staticCards).toContain("type FiscalSponsorshipProgramOption")
    expect(staticCards).toContain("goalCents: program.goal_cents")
    expect(staticCards).toContain("bannerImageUrl: safeSnapshotText(")
    expect(staticCards).toContain('"bannerImageUrl"')
    expect(staticCards).toContain("imageUrl: program.image_url")
    expect(staticCards).toContain("estimatedBudgetCents")
    expect(staticCards).toContain("formatSnapshotBudgetRows")
    expect(staticCards).toContain('"fundingSource"')
    expect(staticCards).toContain('"successOutcomes"')
    expect(staticCards).not.toContain('surface="workspace-card"')
    expect(staticCards).not.toContain("FISCAL_SPONSORSHIP_PROTOTYPE_STEPS")
    expect(layoutConfig).not.toContain('cardId === "fiscal-sponsorship")')
    expect(layoutConfig).not.toContain("relative w-full max-w-[42rem]")
    expect(layoutConfig).not.toContain("border border-border/60 bg-muted/70")
    expect(layoutConfig).not.toContain("rounded-[2rem] p-3 shadow-sm")
    expect(frameContentClassName).not.toContain(
      'cardId === "fiscal-sponsorship"'
    )
    expect(staticCards).not.toContain(
      "@/features/fiscal-sponsorship/components"
    )
    expect(organizationSupport).not.toContain(
      "@/features/fiscal-sponsorship/components"
    )
    expect(activityAction).toContain("FiscalSponsorshipMark")
    expect(activityAction).toContain("CheckCircle2Icon")
    expect(activityAction).toContain(
      'className="nodrag nopan hover:bg-background hover:text-foreground dark:hover:bg-background relative"'
    )
    expect(activityAction).toContain(
      'className="text-foreground size-7 rounded-md bg-transparent text-xs shadow-none ring-0"'
    )
    expect(activityAction).not.toContain(
      'className="h-8 w-8 rounded-lg p-0 hover:bg-transparent"'
    )
    expect(activityAction).not.toContain("Signals only. Coach House reviews.")
    expect(activityAction).not.toContain(
      'className="text-muted-foreground truncate text-[10px]"'
    )
    expect(activityAction).toContain(
      '<div className="flex min-w-0 items-center gap-1.5">'
    )
    expect(activityAction).toContain(
      'className="h-6 shrink-0 rounded-full px-2 text-[10px]"'
    )
    expect(activityAction).not.toContain(
      'className="h-6 shrink-0 gap-1 rounded-full px-2 text-[10px]"'
    )
    const tooltipTitleGroupIndex = activityAction.indexOf(
      '<div className="flex min-w-0 items-center gap-1.5">'
    )
    const tooltipTitleMarkIndex = activityAction.indexOf(
      'className="size-4 rounded-[0.35rem] text-[7px]"',
      tooltipTitleGroupIndex
    )
    const tooltipBadgeIndex = activityAction.indexOf(
      "<Badge",
      tooltipTitleGroupIndex
    )

    expect(tooltipTitleGroupIndex).toBeGreaterThan(-1)
    expect(tooltipTitleMarkIndex).toBeGreaterThan(tooltipTitleGroupIndex)
    expect(tooltipTitleMarkIndex).toBeLessThan(tooltipBadgeIndex)
    expect(activityAction).toContain("Request review")
    expect(activityAction).toContain("Update info")
    expect(activityAction).toContain("onUpdateInfo(criterion.id)")
    expect(activityAction).toContain("const firstMissingCriterion")
    expect(activityAction).toContain("onUpdateInfo(firstMissingCriterion.id)")
    expect(activityAction).not.toContain("String(criterion.met)")
  })

  it.each(["United States", "Canada"])(
    "accepts a known %s location for application readiness",
    (country) => {
      const ready = analyzeFiscalSponsorshipActivityEligibility({
        activity: {
          title: "Youth Stewardship Fellows",
          description: "Youth leaders coordinate neighborhood food access.",
          addressCity: "Chicago",
          addressState: "IL",
          addressCountry: country,
          focusArea: "Training & Capacity Building",
          goalCents: 1400000,
          publicBenefit: "Residents get reliable resource-night support.",
        },
        organization: {
          ein: "12-3456789",
          mission: "Support neighborhood leaders.",
          addressStreet: "100 Main St",
          addressCity: "Chicago",
          addressState: "IL",
          addressPostal: "60601",
          addressCountry: country,
        },
        prefill: null,
      })
      const missing = analyzeFiscalSponsorshipActivityEligibility({
        activity: { title: "Untitled" },
        organization: null,
        prefill: null,
      })

      expect(ready.eligible).toBe(true)
      expect(ready.state).toBe("lit")
      expect(ready.completedCount).toBe(5)
      expect(ready.criteria.map((criterion) => criterion.label)).toEqual([
        "Impact narrative",
        "Operating location",
        "Funding use",
        "Mission fit signal",
        "Tax ID + mailing",
      ])
      expect(missing.eligible).toBe(false)
      expect(missing.state).toBe("inactive")
    }
  )

  it("opens the handbook-aligned user sidebar flow with saved application data when available", () => {
    const cardSummaryController = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-summary.tsx"
    )
    const cardSurface = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface.tsx"
    )
    const cardSummary = `${cardSummaryController}\n${cardSurface}`
    const workflowDrawer = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-drawer.tsx"
    )
    const workflowDrawerSections = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-drawer-sections.tsx"
    )
    const uploadPanel = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-required-documents-upload-panel.tsx"
    )
    const projectAssetUpload = readSource(
      "src/features/fiscal-sponsorship/lib/project-asset-upload.ts"
    )
    const staticCards = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-static-cards.tsx"
    )
    const renderer = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-resolved-renderer.tsx"
    )
    const organizationEditorData = readSource(
      "src/app/(dashboard)/my-organization/_lib/workspace-organization-editor-data.ts"
    )
    const myOrganizationPage = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx"
    )
    const myOrganizationFiscalSupport = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-fiscal.ts"
    )

    expect(cardSummary).toContain("Sheet")
    expect(cardSummary).toContain("FiscalSponsorshipWorkflowDrawer")
    expect(cardSummary).toContain("FiscalSponsorshipApplicationDrawer")
    expect(cardSummary).toContain("FiscalSponsorshipStartDialog")
    expect(cardSummary).toContain("buildFiscalSponsorshipProjectWorkbenchData")
    expect(cardSummary).toContain("FISCAL_SPONSORSHIP_HANDBOOK_HREF")
    expect(cardSummary).toContain("Start application")
    expect(cardSummary).toContain("WORKSPACE_PARTICLE_CHROME.body")
    expect(cardSummary).toContain("loadFiscalWorkspaceApplications")
    expect(cardSummary).toContain("startFiscalWorkspaceApplication")
    expect(cardSurface).toContain("Sponsorship applications")
    expect(cardSurface).toContain("application.projectId")
    expect(cardSurface).toContain("status.label")
    expect(cardSurface).not.toContain("Activity source")
    expect(cardSurface).not.toContain("activities ready")
    expect(cardSurface).not.toContain("<Progress")
    expect(cardSurface).not.toContain("workflowItems.map")
    expect(cardSummary).toContain("setSheetOpen(false)")
    expect(cardSummary).toContain("setApplicationOpen(true)")
    expect(cardSummary).not.toContain('href="/projects"')
    expect(cardSummary).not.toContain("FiscalSponsorshipStepDrawer")

    expect(workflowDrawer).toContain(
      "FiscalSponsorshipRequiredDocumentsUploadPanel"
    )
    expect(workflowDrawer).toContain("data.workflowSummary?.requiredDocuments")
    expect(workflowDrawer).toContain(
      "data.workflowSummary?.latestSignaturePacket?.status ==="
    )
    expect(workflowDrawer).toContain('"completed"')
    expect(workflowDrawer).toContain("SigningActions")
    expect(workflowDrawer).toContain("DocumentsAndSigning")
    expect(workflowDrawerSections).toContain("FiscalWorkflowDisclosureRow")
    expect(workflowDrawerSections).toContain(
      "FISCAL_WORKFLOW_DISCLOSURE_ROW_CLASSNAME"
    )
    expect(workflowDrawerSections).toContain("transition-[background-color]")
    expect(workflowDrawerSections).toContain(
      "transition-[background-color,color]"
    )
    expect(workflowDrawerSections).toContain(
      "h-7 max-w-full overflow-visible rounded-full"
    )
    expect(workflowDrawerSections).toContain("group-hover:bg-emerald-500/15")
    expect(workflowDrawerSections).toContain("group-hover:bg-amber-500/15")
    expect(workflowDrawerSections).toContain(
      "group-focus-within:bg-amber-500/15"
    )
    expect(workflowDrawerSections).not.toContain("group -mx-1 rounded-xl")
    expect(workflowDrawerSections).not.toContain("group-hover:shadow-sm")
    expect(workflowDrawerSections).not.toContain("group-focus-within:shadow-sm")
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
    expect(workflowDrawerSections).toContain("px-1 pt-1")
    expect(workflowDrawer).not.toContain("space-y-4")
    expect(workflowDrawer).not.toContain(
      "bg-background flex min-w-0 items-start gap-2 rounded-xl border p-3"
    )
    expect(workflowDrawer).not.toContain(
      "bg-background min-w-0 rounded-xl border p-3"
    )
    expect(workflowDrawer).not.toContain("FISCAL_SPONSORSHIP_PROTOTYPE_STEPS")
    expect(uploadPanel).toContain("uploadFiscalSponsorshipProjectAsset")
    expect(projectAssetUpload).toContain('fetch("/api/account/project-assets"')
    expect(uploadPanel).toContain("connectFiscalSponsorshipDocumentAsset")
    expect(uploadPanel).toContain("showGrantRequestSupport")
    expect(uploadPanel).toContain("filterFiscalSponsorshipRequiredDocuments")
    expect(uploadPanel).toContain("legalEntityType")
    expect(uploadPanel).toContain(
      "Grant requests and reports come after signing"
    )
    expect(uploadPanel).not.toContain("reviewFiscalSponsorshipDocument")
    expect(uploadPanel).not.toContain("reviewFiscalSponsorshipApplication")

    expect(staticCards).toContain("fiscalSponsorshipProjectId")
    expect(staticCards).toContain("fiscalSponsorshipWorkflowSummary")
    expect(staticCards).toContain("applicationPrefill")
    expect(staticCards).toContain("organizationName")
    expect(renderer).toContain("fiscalSponsorshipApplicationPrefill")
    expect(renderer).toContain("applicationPrefill={")
    expect(renderer).toContain("fiscalSponsorshipProjectId={")
    expect(renderer).toContain("fiscalSponsorshipWorkflowSummary={")
    expect(renderer).toContain("organizationName={")
    expect(organizationEditorData).toContain(
      "buildFiscalSponsorshipApplicationPrefill"
    )
    expect(organizationEditorData).toContain(
      "fiscalSponsorshipApplicationPrefill"
    )
    expect(organizationEditorData).toContain("fiscalSponsorshipProjectId")
    expect(organizationEditorData).toContain("fiscalSponsorshipWorkflowSummary")
    expect(myOrganizationPage).toContain(
      "resolveFiscalApplicantPrefillIdentity"
    )
    expect(myOrganizationFiscalSupport).toContain(
      "applicantEmail: user.email ?? null"
    )
    expect(myOrganizationFiscalSupport).toContain("applicantFullName:")
    expect(myOrganizationFiscalSupport).toContain(
      "loadFiscalSponsorshipProjectWorkflowSummary"
    )
    expect(myOrganizationFiscalSupport).toContain(
      'project_kind", "organization_admin"'
    )
  })

  it("builds fiscal application prefill from organization profile and program builder data", () => {
    const prefill = buildFiscalSponsorshipApplicationPrefill({
      applicantEmail: "viewer@example.com",
      applicantFullName: "Viewer Name",
      initialProfile: {
        name: "Coach House",
        description: "Organization description.",
        tagline: "Build public benefit.",
        formationStatus: "in_progress",
        rep: "Ana Torres",
        email: "ana@example.com",
        phone: "312-555-0100",
        addressStreet: "123 Main St",
        addressCity: "Chicago",
        addressState: "IL",
        addressPostal: "60601",
        addressCountry: "US",
        mission: "Increase neighborhood food access.",
        need: "Neighbors need reliable meals.",
        originStory: "Started as a neighborhood project.",
        boilerplate: "Public program summary.",
      },
      programs: [
        {
          id: "program-1",
          title: "Community kitchen",
          subtitle: "Free meals",
          description: "Legacy description.",
          location: "Chicago",
          features: ["Food security"],
          goal_cents: 500000,
          raised_cents: 125000,
          start_date: "2026-07-15",
          end_date: "2026-12-31",
          address_city: "Chicago",
          address_state: "IL",
          address_country: "US",
          wizard_snapshot: {
            oneSentence: "Free meals and food access.",
            programType: "Direct Services",
            budgetUsd: 25000,
            budgetRows: [
              {
                category: "Food",
                description: "Ingredients",
                totalCost: "12000.00",
              },
            ],
            fundingSource: "Community donors",
            successOutcomes: ["Neighbors receive free meals."],
          },
        },
      ],
    })

    expect(prefill).toEqual(
      expect.objectContaining({
        applicantFullName: "Ana Torres",
        applicantFirstName: "Ana",
        applicantLastName: "Torres",
        primaryEmail: "ana@example.com",
        phoneNumber: "312-555-0100",
        mailingStreetAddress: "123 Main St",
        mailingCity: "Chicago",
        mailingState: "IL",
        mailingPostalCode: "60601",
        legalEntityHas501c3: false,
        formationStatus: "501(c)(3) in progress",
        projectName: "Community kitchen",
        projectDurationType: "temporary",
        temporaryStartDate: "2026-07-15",
        temporaryEndDate: "2026-12-31",
        focusArea: "Direct Services",
        projectDescription: "Free meals and food access.",
        projectLocation: "Chicago, IL, US",
        estimatedBudgetCents: 2500000,
        budgetRows: [
          {
            category: "Food",
            costPerUnit: "12000.00",
            costType: "Fixed",
            description: "Ingredients",
            totalCost: "12000.00",
            unit: "Program",
            units: "1",
          },
        ],
        expenseSummary: "Food - Ingredients - $12000.00",
        prospectiveFundingSources:
          "Community donors; Public fundraising goal: $5,000; Raised to date: $1,250",
        publicBenefit: "Neighbors receive free meals.",
        initiativeHistory: "Started as a neighborhood project.",
        shortPublicDescription: "Free meals",
      })
    )
  })

  it("keeps selected fiscal activity prefill tied to the selected activity snapshot", () => {
    const programs = mapWorkspaceProgramsToFiscalSponsorshipPrograms([
      {
        id: "program-1",
        title: "First activity",
        description: "First description.",
        goal_cents: 100000,
        raised_cents: 50000,
        wizard_snapshot: {
          oneSentence: "First snapshot description.",
          budgetUsd: 1000,
          budgetRows: [
            {
              category: "Food",
              description: "Pantry supplies",
              totalCost: "1000.00",
            },
          ],
          fundingSource: "First donors",
          successOutcomes: ["First public benefit."],
        },
      },
      {
        id: "program-2",
        title: "Selected activity",
        subtitle: "Youth training",
        description: "Legacy selected description.",
        goal_cents: 900000,
        raised_cents: 200000,
        start_date: "2026-08-01T00:00:00.000Z",
        wizard_snapshot: {
          oneSentence: "Selected snapshot description.",
          objectKind: "Program",
          programType: "Training & Capacity Building",
          budgetUsd: 32000,
          budgetRows: [
            {
              category: "Materials",
              description: "Welding kits",
              totalCost: "15000.00",
            },
          ],
          fundingSource: "State grant",
          successOutcomes: ["Students complete certifications."],
        },
      },
    ] satisfies OrgProgram[])
    const selectedProgram = programs.find(
      (program) => program.id === "program-2"
    )

    const selectedPrefill = buildSelectedProgramPrefill({
      basePrefill: {
        estimatedBudgetCents: 100000,
        expenseSummary: "First activity expense summary.",
        projectName: "First activity",
        prospectiveFundingSources: "First activity funding.",
        publicBenefit: "First activity benefit.",
      },
      program: selectedProgram ?? null,
    })

    expect(selectedProgram).toEqual(
      expect.objectContaining({
        description: "Selected snapshot description.",
        estimatedBudgetCents: 3200000,
        budgetRows: [
          {
            category: "Materials",
            costPerUnit: "15000.00",
            costType: "Fixed",
            description: "Welding kits",
            totalCost: "15000.00",
            unit: "Program",
            units: "1",
          },
        ],
        expenseSummary: "Materials - Welding kits - $15000.00",
        focusArea: "Training & Capacity Building",
        prospectiveFundingSources: "State grant",
        publicBenefit: "Students complete certifications.",
      })
    )
    expect(selectedPrefill).toEqual(
      expect.objectContaining({
        sourceActivityId: "program-2",
        sourceActivityTitle: "Selected activity",
        sourceActivityKind: "Program",
        projectName: "Selected activity",
        projectDescription: "Selected snapshot description.",
        projectDurationType: "ongoing_multi_year",
        temporaryStartDate: "2026-08-01",
        estimatedBudgetCents: 3200000,
        budgetRows: selectedProgram?.budgetRows,
        expenseSummary: "Materials - Welding kits - $15000.00",
        prospectiveFundingSources:
          "State grant; Public fundraising goal: $9,000; Raised to date: $2,000",
        publicBenefit: "Students complete certifications.",
        shortPublicDescription: "Youth training",
      })
    )
  })

  it("toggles from the Activity card header and connects on reveal", () => {
    const nodeCard = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card.tsx"
    )
    const organizationSupport = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-organization-support.tsx"
    )
    const renderer = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-resolved-renderer.tsx"
    )
    const programsRenderer = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-programs-renderer.tsx"
    )
    const support = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-support.ts"
    )

    expect(organizationSupport).not.toContain("FiscalSponsorshipMark")
    expect(organizationSupport).not.toContain("fiscalSponsorshipActionLabel")
    expect(programsRenderer).toContain("fiscalSponsorshipActionLabel")
    expect(programsRenderer).toContain("Close fiscal sponsorship tile")
    expect(programsRenderer).toContain("Open fiscal sponsorship tile")
    expect(programsRenderer).toContain("Fiscal sponsorship review readiness")
    expect(programsRenderer).toContain("FiscalSponsorshipActivityAction")
    expect(programsRenderer).toContain(
      "analyzeFiscalSponsorshipActivityEligibility"
    )
    expect(programsRenderer).toContain("selectedProgramIndex")
    expect(programsRenderer).toContain("carouselApi.selectedScrollSnap()")
    expect(programsRenderer).toContain("fiscalSponsorshipEligibility")
    expect(programsRenderer).toContain("!programsPreviewOnly")
    expect(programsRenderer).toContain("active={fiscalSponsorshipCardVisible}")
    expect(programsRenderer).toContain("eligibility={eligibility}")
    expect(programsRenderer).toContain(
      "onUpdateInfo={onUpdateFiscalSponsorshipInfo}"
    )
    expect(programsRenderer).toContain(
      "FISCAL_SPONSORSHIP_PROGRAM_STEP_BY_CRITERION"
    )
    expect(programsRenderer).toContain('"impact-narrative": 3')
    expect(programsRenderer).toContain('"us-operations": 5')
    expect(programsRenderer).toContain('"funding-use": 6')
    expect(programsRenderer).toContain('"mission-fit": 2')
    expect(programsRenderer).toContain('organizationTab: "programs"')
    expect(programsRenderer).toContain("organizationProgramStep:")
    expect(programsRenderer).toContain(
      'organizationFocus: organizationEin?.trim() ? "address" : "ein"'
    )
    expect(programsRenderer).toContain("openWorkspaceDataDrawer(")
    expect(programsRenderer).toContain("onProgramsCreateOpenChange(true)")
    expect(programsRenderer).toContain('aria-label="Add program"')
    expect(programsRenderer).toContain(
      'className="nodrag nopan hover:bg-background hover:text-foreground dark:hover:bg-background relative"'
    )
    expect(programsRenderer).toContain('variant="ghost"')
    expect(programsRenderer).toContain('size="icon"')
    expect(programsRenderer).toContain("<PlusIcon aria-hidden />")
    expect(programsRenderer).not.toContain("buildWorkspaceProgramEditorHref")
    expect(programsRenderer).toContain(
      "eligibility: fiscalSponsorshipEligibility"
    )
    expect(programsRenderer).not.toContain(
      "router.push(updateFiscalSponsorshipInfoHref)"
    )
    expect(programsRenderer).not.toContain(
      'FiscalSponsorshipMark className="size-5 rounded-lg text-[10px]"'
    )
    expect(programsRenderer).not.toContain("FiscalSponsorshipMark")
    expect(programsRenderer).toContain(
      'data.onOpenCard?.("fiscal-sponsorship")'
    )
    expect(nodeCard).not.toContain("handleOpenFiscalSponsorshipCard")
    expect(programsRenderer).toContain("canOpenFiscalSponsorship")
    expect(programsRenderer).toContain(
      "data.fiscalSponsorshipCardVisible === true"
    )
    expect(programsRenderer).toContain("!isCanvasFullscreen")
    expect(nodeCard).toContain('cardId === "fiscal-sponsorship"')
    expect(renderer).toContain("WorkspaceBoardFiscalSponsorshipCard")
    expect(renderer).toContain('if (cardId === "fiscal-sponsorship")')
    expect(renderer).toContain("<WorkspaceBoardFiscalSponsorshipCard")
    expect(renderer).toContain(
      "programs={data.organizationEditorData?.programs}"
    )
    expect(renderer).toContain("fiscalSponsorshipProjectId={")
    expect(renderer).toContain("fiscalSponsorshipWorkflowSummary={")
    expect(renderer).toContain("WorkspaceBoardAcceleratorCard")
    expect(renderer).toContain('if (cardId === "accelerator")')
    const fiscalBranchIndex = renderer.indexOf(
      'if (cardId === "fiscal-sponsorship")'
    )
    expect(fiscalBranchIndex).toBeGreaterThan(-1)
    expect(fiscalBranchIndex).toBeLessThan(
      renderer.indexOf("<WorkspaceBoardCardFrame", fiscalBranchIndex)
    )
    expect(renderer).not.toContain('hideTitle={cardId === "accelerator"}')
    expect(renderer).not.toContain('titleIcon={cardId === "accelerator"')
    const acceleratorBranchIndex = renderer.indexOf(
      'if (cardId === "accelerator")'
    )
    expect(acceleratorBranchIndex).toBeGreaterThan(-1)
    expect(acceleratorBranchIndex).toBeLessThan(
      renderer.indexOf("<WorkspaceBoardCardFrame", acceleratorBranchIndex)
    )
    expect(renderer).not.toContain(
      "<WorkspaceBoardFiscalSponsorshipCard\n          size={effectiveCardSize}"
    )
    expect(support).toContain('if (cardId === "fiscal-sponsorship")')
    expect(support).toContain('if (cardId === "atlas")')
    const fiscalSupportBranch = support.slice(
      support.indexOf('if (cardId === "fiscal-sponsorship")'),
      support.indexOf('if (cardId === "atlas")')
    )
    expect(support).toContain('onConnectCards("programs", cardId)')
    expect(fiscalSupportBranch).not.toContain(
      'onConnectCards("organization-overview", cardId)'
    )
    expect(support).toContain(
      'onToggleCardVisibility(cardId, { source: "dock" })'
    )
  })
})
