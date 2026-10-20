"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Sheet } from "@/components/ui/sheet"

import {
  formatFiscalSponsorshipProgramAmount,
  resolveFiscalSponsorshipProgramLocation,
} from "../lib/application-data"
import { buildFiscalSponsorshipProjectWorkbenchData } from "../lib/project-workbench-data"
import type {
  FiscalSponsorshipApplicationPrefill,
  FiscalSponsorshipProgramOption,
  FiscalSponsorshipProjectWorkflowSummary,
} from "../types"
import { FiscalSponsorshipApplicationDrawer } from "./fiscal-sponsorship-application-drawer"
import { FiscalSponsorshipWorkflowDrawer } from "./fiscal-sponsorship-workflow-drawer"
import {
  FALLBACK_WORKFLOW_ITEMS,
  FiscalSponsorshipWorkspaceCardSurface,
} from "./fiscal-sponsorship-workspace-card-surface"

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanText(value)
    if (cleaned) return cleaned
  }

  return null
}

function dateInputValue(value: string | null | undefined) {
  const cleaned = cleanText(value)
  if (!cleaned) return null

  const dateMatch = cleaned.match(/^\d{4}-\d{2}-\d{2}/)
  return dateMatch ? dateMatch[0] : null
}

function resolveSelectedProgram(
  programs: FiscalSponsorshipProgramOption[],
  selectedProgramId: string | null
) {
  return (
    programs.find((program) => program.id === selectedProgramId) ??
    programs[0] ??
    null
  )
}

function resolveProgramSourceLabel(program: FiscalSponsorshipProgramOption) {
  return firstText(program.objectKind, program.focusArea, "Activity")
}

export function buildSelectedProgramPrefill({
  basePrefill,
  program,
}: {
  basePrefill: FiscalSponsorshipApplicationPrefill | null
  program: FiscalSponsorshipProgramOption | null
}): FiscalSponsorshipApplicationPrefill | null {
  if (!program) return basePrefill

  const location = resolveFiscalSponsorshipProgramLocation(program)
  const formattedGoal = formatFiscalSponsorshipProgramAmount(program.goalCents)
  const formattedRaised = formatFiscalSponsorshipProgramAmount(
    program.raisedCents
  )
  const fundingParts = [
    program.prospectiveFundingSources,
    formattedGoal ? `Public fundraising goal: ${formattedGoal}` : null,
    formattedRaised ? `Raised to date: ${formattedRaised}` : null,
  ].filter((part): part is string => Boolean(part))
  const estimatedBudgetCents =
    typeof program.estimatedBudgetCents === "number" &&
    program.estimatedBudgetCents > 0
      ? program.estimatedBudgetCents
      : typeof program.goalCents === "number" && program.goalCents > 0
        ? program.goalCents
        : (basePrefill?.estimatedBudgetCents ?? null)

  return {
    ...basePrefill,
    sourceActivityId: program.id,
    sourceActivityTitle: cleanText(program.title),
    sourceActivityKind: resolveProgramSourceLabel(program),
    projectName: firstText(program.title, basePrefill?.projectName),
    projectDescription: firstText(
      program.description,
      program.subtitle,
      basePrefill?.projectDescription
    ),
    projectLocation: firstText(
      location === "Location needed" ? null : location,
      basePrefill?.projectLocation
    ),
    focusArea: firstText(
      program.focusArea,
      program.objectKind,
      basePrefill?.focusArea
    ),
    projectDurationType: dateInputValue(program.endDate)
      ? "temporary"
      : dateInputValue(program.startDate)
        ? "ongoing_multi_year"
        : (basePrefill?.projectDurationType ?? null),
    temporaryStartDate: firstText(
      dateInputValue(program.startDate),
      basePrefill?.temporaryStartDate
    ),
    temporaryEndDate: firstText(
      dateInputValue(program.endDate),
      basePrefill?.temporaryEndDate
    ),
    estimatedBudgetCents,
    budgetRows:
      program.budgetRows && program.budgetRows.length > 0
        ? program.budgetRows
        : (basePrefill?.budgetRows ?? null),
    expenseSummary: firstText(
      program.expenseSummary,
      basePrefill?.expenseSummary
    ),
    prospectiveFundingSources: firstText(
      fundingParts.join("; "),
      basePrefill?.prospectiveFundingSources
    ),
    publicBenefit: firstText(program.publicBenefit, basePrefill?.publicBenefit),
    shortPublicDescription: firstText(
      program.subtitle,
      program.description,
      basePrefill?.shortPublicDescription
    ),
  }
}

export function FiscalSponsorshipWorkspaceCardSummary({
  actionRequest = null,
  applicationPrefill = null,
  fiscalSponsorshipProjectId = null,
  fiscalSponsorshipWorkflowSummary = null,
  organizationName = null,
  programs = [],
}: {
  actionRequest?: {
    id: number
    phaseId: "application-intake" | "required-documents"
  } | null
  applicationPrefill?: FiscalSponsorshipApplicationPrefill | null
  fiscalSponsorshipProjectId?: string | null
  fiscalSponsorshipWorkflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null
  organizationName?: string | null
  programs?: FiscalSponsorshipProgramOption[]
}) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [applicationOpen, setApplicationOpen] = React.useState(false)
  const [selectedProgramId, setSelectedProgramId] = React.useState<
    string | null
  >(() => programs[0]?.id ?? null)
  const [selectedPhaseId, setSelectedPhaseId] =
    React.useState("application-intake")
  const handledActionRequestIdRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (programs.length === 0) {
      setSelectedProgramId(null)
      return
    }

    setSelectedProgramId((currentProgramId) =>
      programs.some((program) => program.id === currentProgramId)
        ? currentProgramId
        : (programs[0]?.id ?? null)
    )
  }, [programs])

  const selectedProgram = React.useMemo(
    () => resolveSelectedProgram(programs, selectedProgramId),
    [programs, selectedProgramId]
  )
  const selectedProgramPrefill = React.useMemo(
    () =>
      buildSelectedProgramPrefill({
        basePrefill: applicationPrefill,
        program: selectedProgram,
      }),
    [applicationPrefill, selectedProgram]
  )
  const applicationData = React.useMemo(() => {
    if (!fiscalSponsorshipProjectId) return null

    const primaryProgram = selectedProgram
    const locationLabel =
      selectedProgramPrefill?.projectLocation?.trim() ||
      [primaryProgram?.addressCity, primaryProgram?.addressState]
        .filter(Boolean)
        .join(", ") ||
      primaryProgram?.location ||
      null

    return buildFiscalSponsorshipProjectWorkbenchData({
      project: {
        id: fiscalSponsorshipProjectId,
        name:
          selectedProgramPrefill?.projectName?.trim() ||
          primaryProgram?.title?.trim() ||
          "Fiscal sponsorship application",
        description:
          selectedProgramPrefill?.projectDescription ??
          primaryProgram?.description ??
          null,
        locationLabel,
        fileCount: 0,
        noteCount: 0,
        taskCount: 0,
        assigneeCount: 0,
      },
      organization: {
        name: organizationName?.trim() || "Your organization",
        ownerName: selectedProgramPrefill?.applicantFullName ?? null,
        memberCount: 0,
      },
      applicationPrefill: selectedProgramPrefill,
      workflowSummary: fiscalSponsorshipWorkflowSummary,
    })
  }, [
    fiscalSponsorshipProjectId,
    fiscalSponsorshipWorkflowSummary,
    organizationName,
    selectedProgram,
    selectedProgramPrefill,
  ])
  const workflowItems = applicationData?.phases ?? FALLBACK_WORKFLOW_ITEMS
  const completedCount = workflowItems.filter((item) => item.complete).length
  const progress =
    applicationData?.readinessPercent ??
    Math.round((completedCount / workflowItems.length) * 100)
  const primaryPhase =
    applicationData?.phases.find((phase) => !phase.complete) ??
    applicationData?.phases[0] ??
    null
  const primaryActionLabel =
    primaryPhase?.actionType === "application"
      ? primaryPhase.complete
        ? "View application"
        : "Start application"
      : primaryPhase?.actionType === "assets" ||
          primaryPhase?.actionType === "signature"
        ? primaryPhase.actionLabel
        : "Open workflow"

  const openFlow = React.useCallback((phaseId = "application-intake") => {
    setSelectedPhaseId(phaseId)
    setSheetOpen(true)
  }, [])

  const openApplication = React.useCallback(() => {
    if (!applicationData) return
    setSheetOpen(false)
    setApplicationOpen(true)
  }, [applicationData])

  React.useEffect(() => {
    if (!actionRequest || !applicationData) return
    if (handledActionRequestIdRef.current === actionRequest.id) return
    handledActionRequestIdRef.current = actionRequest.id
    if (actionRequest.phaseId === "application-intake") {
      openApplication()
      return
    }
    openFlow(actionRequest.phaseId)
  }, [actionRequest, applicationData, openApplication, openFlow])

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <FiscalSponsorshipWorkspaceCardSurface
          draggable
          programs={programs}
          selectedProgramId={selectedProgramId}
          workflowItems={workflowItems}
          progress={progress}
          primaryActionLabel={primaryActionLabel}
          onSelectProgram={setSelectedProgramId}
          onOpenFlow={applicationData ? openFlow : undefined}
        />
        {applicationData ? (
          <FiscalSponsorshipWorkflowDrawer
            data={applicationData}
            selectedPhaseId={selectedPhaseId}
            onClose={() => setSheetOpen(false)}
            onOpenApplication={openApplication}
          />
        ) : null}
      </Sheet>
      {applicationData ? (
        <FiscalSponsorshipApplicationDrawer
          data={applicationData}
          open={applicationOpen}
          onOpenChange={setApplicationOpen}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
