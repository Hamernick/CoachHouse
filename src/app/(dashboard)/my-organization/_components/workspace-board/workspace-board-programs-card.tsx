"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import FolderPlusIcon from "lucide-react/dist/esm/icons/folder-plus"

import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import {
  locationSummary,
  normalizeToList,
} from "@/components/organization/org-profile-card/utils"
import { ProgramCard } from "@/components/programs/program-card"
import { ProgramWizardLazy } from "@/components/programs/program-wizard-lazy"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { Empty } from "@/components/ui/empty"
import type { WorkspaceCanvasTutorialStepId } from "@/features/workspace-canvas-tutorial"
import {
  resolveProgramBannerImageUrl,
  resolveProgramCardChips,
  resolveProgramProfileImageUrl,
  resolveProgramSummary,
} from "@/lib/programs/display"
import { getWorkspaceEditorPath } from "@/lib/workspace/routes"

import { useWorkspaceCanvasOverlayDrawerContainer } from "./workspace-canvas-v2/components/workspace-canvas-overlay-drawer-container"

function sortProgramsByNewest(programs: OrgProgram[]) {
  return [...programs].sort((left, right) => {
    const leftCreatedAt = left.created_at ? Date.parse(left.created_at) : 0
    const rightCreatedAt = right.created_at ? Date.parse(right.created_at) : 0
    return rightCreatedAt - leftCreatedAt
  })
}

export function buildWorkspaceProgramEditorHref(programId?: string | null) {
  if (!programId || programId.trim().length === 0) {
    return getWorkspaceEditorPath({ tab: "programs" })
  }

  return getWorkspaceEditorPath({ tab: "programs", programId })
}

export function isWorkspaceProgramRecord(program: Pick<OrgProgram, "id">) {
  return Boolean(program.id && !program.id.startsWith("legacy-program-"))
}

export function isWorkspaceProgramsPreviewOnlyStep(
  tutorialStepId?: WorkspaceCanvasTutorialStepId | null
) {
  return tutorialStepId === "programs"
}

export function resolveWorkspaceProgramsDisplayPrograms({
  programs,
  legacyProgramsValue,
}: {
  programs: OrgProgram[]
  legacyProgramsValue?: string | null
}) {
  if (programs.length > 0) return sortProgramsByNewest(programs)

  return normalizeToList(legacyProgramsValue).map((title, index) => ({
    id: `legacy-program-${index}`,
    title,
    status_label: "Configured",
  }))
}

export function WorkspaceBoardProgramsCard({
  programs,
  legacyProgramsValue,
  canEdit,
  createOpen,
  onCarouselApiChange,
  onCreateOpenChange,
  previewOnly = false,
}: {
  programs: OrgProgram[]
  legacyProgramsValue?: string | null
  canEdit: boolean
  createOpen: boolean
  onCarouselApiChange?: (api: CarouselApi) => void
  onCreateOpenChange: (open: boolean) => void
  previewOnly?: boolean
}) {
  const router = useRouter()
  const canvasPortalContainer = useWorkspaceCanvasOverlayDrawerContainer()
  const [editOpen, setEditOpen] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<OrgProgram | null>(
    null
  )
  const sortedPrograms = useMemo(
    () =>
      resolveWorkspaceProgramsDisplayPrograms({
        programs,
        legacyProgramsValue,
      }),
    [legacyProgramsValue, programs]
  )

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open)
    if (!open) {
      setSelectedProgram(null)
      router.refresh()
    }
  }

  const renderProgramCard = (program: OrgProgram) => {
    const useOverlay =
      canEdit && !previewOnly && isWorkspaceProgramRecord(program)
    const ctaHref = previewOnly
      ? undefined
      : useOverlay
        ? undefined
        : buildWorkspaceProgramEditorHref(program.id)
    const onCtaClick = useOverlay
      ? () => {
          setSelectedProgram(program)
          setEditOpen(true)
        }
      : undefined

    return (
      <ProgramCard
        title={program.title?.trim() || "Untitled resource"}
        location={locationSummary(program) ?? undefined}
        description={resolveProgramSummary(program) ?? undefined}
        bannerImageUrl={resolveProgramBannerImageUrl(program) ?? undefined}
        imageUrl={resolveProgramProfileImageUrl(program) ?? undefined}
        statusLabel={program.status_label?.trim() || "Draft"}
        showStatusBadge={false}
        chips={resolveProgramCardChips(program)}
        goalCents={program.goal_cents || 0}
        raisedCents={program.raised_cents || 0}
        ctaLabel="Open"
        ctaHref={ctaHref}
        ctaTarget="_self"
        onCtaClick={onCtaClick}
        variant="medium"
        surface="workspace"
        contentFill={false}
        className="border-border/60 bg-background/35 h-full min-h-0 max-w-none border shadow-none"
      />
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-col gap-2">
        {sortedPrograms.length > 0 ? (
          sortedPrograms.length === 1 ? (
            <div
              key={
                sortedPrograms[0]?.id ?? sortedPrograms[0]?.title ?? "program-0"
              }
            >
              {renderProgramCard(sortedPrograms[0]!)}
            </div>
          ) : (
            <Carousel
              className="w-full"
              opts={{ align: "start", loop: false }}
              setApi={onCarouselApiChange}
            >
              <CarouselContent className="ml-0 items-stretch">
                {sortedPrograms.map((program, index) => (
                  <CarouselItem
                    key={program.id ?? program.title ?? `program-${index}`}
                    className="flex pl-0"
                  >
                    {renderProgramCard(program)}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )
        ) : (
          <Empty
            icon={<FolderPlusIcon className="h-5 w-5" aria-hidden />}
            title="No resources to display"
            description="Projects, programs, events, services, and grant requests you create will appear here."
            actions={
              canEdit ? null : (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs shadow-none"
                >
                  <Link href={buildWorkspaceProgramEditorHref()}>
                    Open activity
                  </Link>
                </Button>
              )
            }
            size="sm"
            variant="subtle"
            className="bg-background rounded-[25px] p-3 shadow-none"
          />
        )}
      </div>

      {canEdit && !previewOnly ? (
        <ProgramWizardLazy
          mode="create"
          open={createOpen}
          onOpenChange={onCreateOpenChange}
          portalContainer={canvasPortalContainer}
        />
      ) : null}
      {selectedProgram && !previewOnly ? (
        <ProgramWizardLazy
          mode="edit"
          program={selectedProgram}
          open={editOpen}
          onOpenChange={handleEditOpenChange}
          portalContainer={canvasPortalContainer}
        />
      ) : null}
    </>
  )
}
