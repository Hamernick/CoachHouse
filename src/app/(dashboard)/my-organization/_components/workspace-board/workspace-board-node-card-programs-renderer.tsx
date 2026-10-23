"use client"

import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { useEffect, useMemo, useState } from "react"

import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import { Button } from "@/components/ui/button"
import type { CarouselApi } from "@/components/ui/carousel"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  analyzeFiscalSponsorshipActivityEligibility,
  FiscalSponsorshipActivityAction,
  type FiscalSponsorshipActivityEligibility,
  type FiscalSponsorshipActivityEligibilityActivity,
} from "@/features/fiscal-sponsorship"

import { WORKSPACE_CARD_META } from "./workspace-board-copy"
import { WorkspaceBoardFormationTrackerCard } from "./workspace-board-formation-tracker-card"
import type { WorkspaceBoardNodeData } from "./workspace-board-node-types"
import {
  isWorkspaceProgramsPreviewOnlyStep,
  resolveWorkspaceProgramsDisplayPrograms,
  WorkspaceBoardProgramsCard,
} from "./workspace-board-programs-card"
import { useWorkspaceCanvasOverlayDrawerRequest } from "./workspace-canvas-v2/components/workspace-canvas-overlay-drawer-container"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs"
import { WorkspaceBoardNodeCardShell } from "./workspace-board-node-card-shell"
import type { WorkspaceCardSize } from "./workspace-board-types"

type WorkspaceProgramsDisplayProgram = OrgProgram
type FiscalSponsorshipCriterionId =
  FiscalSponsorshipActivityEligibility["criteria"][number]["id"]

const FISCAL_SPONSORSHIP_PROGRAM_STEP_BY_CRITERION: Partial<
  Record<FiscalSponsorshipCriterionId, number>
> = {
  "impact-narrative": 3,
  "us-operations": 5,
  "funding-use": 6,
  "mission-fit": 2,
}

function resolveFiscalSponsorshipUpdateRequest({
  criterionId,
  organizationEin,
  programId,
}: {
  criterionId: FiscalSponsorshipCriterionId
  organizationEin: string | null | undefined
  programId: string
}): Omit<WorkspaceDataDrawerRequest, "id"> {
  if (criterionId === "tax-mailing") {
    return {
      tab: "organization",
      organizationTab: "company",
      organizationFocus: organizationEin?.trim() ? "address" : "ein",
    }
  }

  return {
    tab: "organization",
    organizationTab: "programs",
    organizationProgramId: programId,
    organizationProgramStep:
      FISCAL_SPONSORSHIP_PROGRAM_STEP_BY_CRITERION[criterionId] ?? 0,
  }
}

function getProgramField<K extends keyof WorkspaceProgramsDisplayProgram>(
  program: WorkspaceProgramsDisplayProgram | null,
  key: K
) {
  return program && key in program ? program[key] : null
}

function getProgramWizardSnapshot(
  program: WorkspaceProgramsDisplayProgram | null
) {
  const value = getProgramField(program, "wizard_snapshot")
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readSnapshotString(
  snapshot: Record<string, unknown> | null,
  key: string
) {
  const value = snapshot?.[key]
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function buildEligibilityActivity(
  program: WorkspaceProgramsDisplayProgram | null
): FiscalSponsorshipActivityEligibilityActivity | null {
  if (!program) return null

  const wizardSnapshot = getProgramWizardSnapshot(program)

  return {
    title: program.title,
    subtitle: program.subtitle,
    description: program.description,
    location: getProgramField(program, "location"),
    locationType: getProgramField(program, "location_type"),
    addressCity: getProgramField(program, "address_city"),
    addressState: getProgramField(program, "address_state"),
    addressCountry: getProgramField(program, "address_country"),
    focusArea:
      readSnapshotString(wizardSnapshot, "programType") ??
      program.features?.[0] ??
      null,
    objectKind: readSnapshotString(wizardSnapshot, "objectKind"),
    estimatedBudgetCents: getProgramField(program, "goal_cents"),
    goalCents: getProgramField(program, "goal_cents"),
    wizardSnapshot,
  }
}

function renderProgramsHeaderAction({
  canEdit,
  eligibility,
  fiscalSponsorshipCardVisible,
  isCanvasFullscreen,
  onOpenFiscalSponsorship,
  onProgramsCreateOpenChange,
  onUpdateFiscalSponsorshipInfo,
  presentationMode,
  programsPreviewOnly,
}: {
  canEdit: boolean
  eligibility: FiscalSponsorshipActivityEligibility
  fiscalSponsorshipCardVisible: boolean
  isCanvasFullscreen: boolean
  onOpenFiscalSponsorship: () => void
  onProgramsCreateOpenChange: (open: boolean) => void
  onUpdateFiscalSponsorshipInfo: (
    criterionId: FiscalSponsorshipCriterionId
  ) => void
  presentationMode: boolean
  programsPreviewOnly: boolean
}) {
  const fiscalSponsorshipActionLabel = fiscalSponsorshipCardVisible
    ? "Close fiscal sponsorship tile"
    : eligibility.eligible
      ? "Open fiscal sponsorship tile"
      : "Fiscal sponsorship review readiness"
  const canOpenFiscalSponsorship =
    canEdit && !presentationMode && !isCanvasFullscreen && !programsPreviewOnly
  if (!canOpenFiscalSponsorship && !canEdit) return null

  return (
    <div className="flex items-center gap-1.5">
      {canOpenFiscalSponsorship ? (
        <FiscalSponsorshipActivityAction
          active={fiscalSponsorshipCardVisible}
          ariaLabel={fiscalSponsorshipActionLabel}
          disabled={programsPreviewOnly}
          eligibility={eligibility}
          onOpen={onOpenFiscalSponsorship}
          onUpdateInfo={onUpdateFiscalSponsorshipInfo}
        />
      ) : null}
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="nodrag nopan hover:bg-background hover:text-foreground dark:hover:bg-background relative"
          aria-label="Add program"
          title="Add program"
          disabled={programsPreviewOnly}
          onClick={() => onProgramsCreateOpenChange(true)}
        >
          <PlusIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

function renderProgramsFooterAction({
  canScrollNext,
  canScrollPrevious,
  hasCarouselControls,
  onScrollNext,
  onScrollPrevious,
}: {
  canScrollNext: boolean
  canScrollPrevious: boolean
  hasCarouselControls: boolean
  onScrollNext: () => void
  onScrollPrevious: () => void
}) {
  if (!hasCarouselControls) return null

  return (
    <div className="flex w-full items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="border-border/70 bg-background/85 h-8 w-8 rounded-full backdrop-blur-sm"
        disabled={!canScrollPrevious}
        aria-label="Previous resource"
        onClick={onScrollPrevious}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="border-border/70 bg-background/85 h-8 w-8 rounded-full backdrop-blur-sm"
        disabled={!canScrollNext}
        aria-label="Next resource"
        onClick={onScrollNext}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  )
}

export function WorkspaceBoardProgramsNodeCard({
  canEdit,
  cardMeta,
  contentClassName,
  data,
  effectiveCardSize,
  frameFullscreenToggle,
  hideHeaderSubtitle,
  isCanvasFullscreen,
  onProgramsCreateOpenChange,
  presentationMode,
  programsCreateOpen,
}: {
  canEdit: boolean
  cardMeta: (typeof WORKSPACE_CARD_META)["programs"]
  contentClassName: string | undefined
  data: WorkspaceBoardNodeData
  effectiveCardSize: WorkspaceCardSize
  frameFullscreenToggle?: () => void
  hideHeaderSubtitle: boolean
  isCanvasFullscreen: boolean
  onProgramsCreateOpenChange: (open: boolean) => void
  presentationMode: boolean
  programsCreateOpen: boolean
}) {
  const openWorkspaceDataDrawer = useWorkspaceCanvasOverlayDrawerRequest()
  const workspacePrograms = data.organizationEditorData?.programs
  const programs = useMemo(() => workspacePrograms ?? [], [workspacePrograms])
  const legacyProgramsValue =
    data.organizationEditorData?.initialProfile.programs
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)
  const [canScrollPrevious, setCanScrollPrevious] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [selectedProgramIndex, setSelectedProgramIndex] = useState(0)
  const [objectivesOpen, setObjectivesOpen] = useState(false)
  const [objectivesFocusRequest, setObjectivesFocusRequest] = useState<{
    id: number
    ticketId: string | null
  } | null>(null)
  const programsPreviewOnly = isWorkspaceProgramsPreviewOnlyStep(
    data.tutorialStepId
  )
  const displayPrograms = useMemo(
    () =>
      resolveWorkspaceProgramsDisplayPrograms({
        programs,
        legacyProgramsValue,
      }) as WorkspaceProgramsDisplayProgram[],
    [legacyProgramsValue, programs]
  )
  const hasCarouselControls = displayPrograms.length > 1
  const selectedProgram =
    displayPrograms[
      Math.min(Math.max(selectedProgramIndex, 0), displayPrograms.length - 1)
    ] ??
    displayPrograms[0] ??
    null
  const fiscalSponsorshipEligibility = useMemo(
    () =>
      analyzeFiscalSponsorshipActivityEligibility({
        activity: buildEligibilityActivity(selectedProgram),
        organization: data.organizationEditorData?.initialProfile ?? null,
        prefill:
          data.organizationEditorData?.fiscalSponsorshipApplicationPrefill ??
          null,
      }),
    [
      data.organizationEditorData?.fiscalSponsorshipApplicationPrefill,
      data.organizationEditorData?.initialProfile,
      selectedProgram,
    ]
  )
  const selectedProgramId =
    selectedProgram?.id && !selectedProgram.id.startsWith("legacy-program-")
      ? selectedProgram.id
      : null

  useEffect(() => {
    if (displayPrograms.length <= 1) {
      setSelectedProgramIndex(0)
    }
  }, [displayPrograms.length])

  useEffect(() => {
    if (!hasCarouselControls || !carouselApi) {
      setCanScrollPrevious(false)
      setCanScrollNext(false)
      return
    }

    const updateCarouselState = () => {
      setCanScrollPrevious(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
      setSelectedProgramIndex(carouselApi.selectedScrollSnap())
    }

    updateCarouselState()
    carouselApi.on("reInit", updateCarouselState)
    carouselApi.on("select", updateCarouselState)

    return () => {
      carouselApi.off("reInit", updateCarouselState)
      carouselApi.off("select", updateCarouselState)
    }
  }, [carouselApi, hasCarouselControls])

  useEffect(() => {
    const request = data.ontologyActionRequest
    if (request?.rootId !== "programs" || request.target.kind !== "task") {
      return
    }
    setObjectivesFocusRequest({
      id: request.id,
      ticketId: request.target.ticketId,
    })
    setObjectivesOpen(true)
  }, [data.ontologyActionRequest])

  return (
    <>
      <WorkspaceBoardNodeCardShell
        cardId="programs"
        compact
        title={cardMeta.title}
        subtitle={cardMeta.subtitle}
        hideSubtitle={hideHeaderSubtitle}
        headerAction={renderProgramsHeaderAction({
          canEdit,
          eligibility: fiscalSponsorshipEligibility,
          fiscalSponsorshipCardVisible:
            data.fiscalSponsorshipCardVisible === true,
          isCanvasFullscreen,
          onOpenFiscalSponsorship: () =>
            data.onOpenCard?.("fiscal-sponsorship"),
          onProgramsCreateOpenChange,
          onUpdateFiscalSponsorshipInfo: (criterionId) => {
            if (criterionId !== "tax-mailing" && !selectedProgramId) {
              onProgramsCreateOpenChange(true)
              return
            }

            if (!openWorkspaceDataDrawer) return
            openWorkspaceDataDrawer(
              resolveFiscalSponsorshipUpdateRequest({
                criterionId,
                organizationEin:
                  data.organizationEditorData?.initialProfile.ein,
                programId: selectedProgramId ?? "",
              })
            )
          },
          presentationMode,
          programsPreviewOnly,
        })}
        size={effectiveCardSize}
        presentationMode={presentationMode}
        fullHref={cardMeta.fullHref}
        canEdit={canEdit}
        contentInsetClassName="px-0"
        contentClassName={contentClassName}
        contentSurface="plain"
        editorHref={null}
        footer={renderProgramsFooterAction({
          canScrollNext,
          canScrollPrevious,
          hasCarouselControls,
          onScrollNext: () => carouselApi?.scrollNext(),
          onScrollPrevious: () => carouselApi?.scrollPrev(),
        })}
        footerClassName="justify-center"
        isCanvasFullscreen={isCanvasFullscreen}
        onToggleCanvasFullscreen={frameFullscreenToggle}
      >
        <WorkspaceBoardProgramsCard
          programs={programs}
          legacyProgramsValue={legacyProgramsValue}
          canEdit={canEdit}
          createOpen={programsCreateOpen}
          onCreateOpenChange={onProgramsCreateOpenChange}
          onCarouselApiChange={setCarouselApi}
          previewOnly={programsPreviewOnly}
        />
      </WorkspaceBoardNodeCardShell>
      <Sheet open={objectivesOpen} onOpenChange={setObjectivesOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 sm:max-w-xl max-sm:[&_[data-slot=select-trigger]]:h-11 max-sm:[&_[data-slot=select-trigger]]:text-base max-sm:[&_button]:min-h-11 max-sm:[&_button]:min-w-11 max-sm:[&_input]:h-11 max-sm:[&_input]:text-base"
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>Objectives and tasks</SheetTitle>
            <SheetDescription>
              Plan ownership, priorities, due dates, and operating follow-up.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <WorkspaceBoardFormationTrackerCard
              size="lg"
              seed={data.seed}
              presentationMode={presentationMode}
              tracker={data.tracker}
              onTrackerChange={data.onTrackerChange}
              focusRequest={objectivesFocusRequest}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
