"use client"

import { markModuleCompleteAction } from "@/app/actions/module-progress"
import { saveModuleStepProgressAction } from "@/app/actions/module-step-progress"

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"

import {
  buildWorkspaceAcceleratorFullscreenHref,
  WorkspaceAcceleratorCardPanel,
  type WorkspaceAcceleratorCardInput,
} from "@/features/workspace-accelerator-card"
import {
  WORKSPACE_PATH,
  WORKSPACE_ROADMAP_PATH,
} from "@/lib/workspace/routes"

import { resolveWorkspaceAcceleratorReadinessSummary } from "./workspace-board-accelerator-card-helpers"
import type { WorkspaceSeedData } from "./workspace-board-types"

type MyOrganizationAcceleratorViewProps = {
  seed: WorkspaceSeedData
  initialStepId?: string | null
  initialModuleId?: string | null
  initialLessonGroupKey?: string | null
  programFundingTargets: Array<{ goal_cents: number | null }>
  onWorkspaceOnboardingSubmit: (form: FormData) => Promise<void>
}

export function MyOrganizationAcceleratorView({
  seed,
  initialStepId = null,
  initialModuleId = null,
  initialLessonGroupKey = null,
  programFundingTargets,
  onWorkspaceOnboardingSubmit,
}: MyOrganizationAcceleratorViewProps) {
  const router = useRouter()
  const acceleratorReadinessSummary = useMemo(
    () =>
      resolveWorkspaceAcceleratorReadinessSummary({
        acceleratorState: seed.boardState.accelerator,
        programs: programFundingTargets,
        seed,
      }),
    [programFundingTargets, seed],
  )
  const acceleratorCardInput = useMemo<WorkspaceAcceleratorCardInput>(
    () => ({
      steps: seed.acceleratorTimeline ?? [],
      size: "lg",
      readinessSummary: acceleratorReadinessSummary,
      allowAutoResize: false,
      storageKey: `${seed.orgId}:${seed.viewerId}`,
      initialCurrentStepId: initialStepId ?? seed.boardState.accelerator.activeStepId,
      initialCompletedStepIds: seed.boardState.accelerator.completedStepIds,
      onModuleComplete: (moduleId) => markModuleCompleteAction(moduleId, seed.orgId),
      onStepComplete: (moduleId, stepId) => saveModuleStepProgressAction({ moduleId, stepId, expectedOrgId: seed.orgId }),
      onWorkspaceOnboardingSubmit,
    }),
    [
      acceleratorReadinessSummary,
      initialStepId,
      onWorkspaceOnboardingSubmit,
      seed.acceleratorTimeline,
      seed.boardState.accelerator.activeStepId,
      seed.boardState.accelerator.completedStepIds,
      seed.orgId,
      seed.viewerId,
    ],
  )
  const handleCloseFullscreen = useCallback(() => {
    router.push(WORKSPACE_PATH)
  }, [router])
  const handleRequestOpenStep = useCallback(
    ({
      step,
      selectedLessonGroupKey,
    }: {
      step: WorkspaceAcceleratorCardInput["steps"][number]
      selectedLessonGroupKey: string | null
    }) => {
      const href = buildWorkspaceAcceleratorFullscreenHref({
        stepId: step.id,
        moduleId: step.moduleId,
        lessonGroupKey: selectedLessonGroupKey ?? initialLessonGroupKey,
      })
      router.push(href, { scroll: false })
      return false
    },
    [initialLessonGroupKey, router],
  )
  return (
    <div className="-m-[var(--shell-content-pad)] flex min-h-[calc(100%_+_var(--shell-content-pad)_+_var(--shell-content-pad))] flex-1 flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden text-foreground bg-[var(--shell-bg)]">
        <div className="nodrag nopan flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <WorkspaceAcceleratorCardPanel
            input={acceleratorCardInput}
            roadmapSections={seed.roadmapSections}
            roadmapBasePath={WORKSPACE_ROADMAP_PATH}
            presentationMode="fullscreen-route"
            initialModuleViewerOpen
            initialOpenModuleId={initialModuleId}
            onModuleViewerClose={handleCloseFullscreen}
            onRequestOpenStep={handleRequestOpenStep}
          />
        </div>
      </section>
    </div>
  )
}
