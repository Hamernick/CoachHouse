"use client"

import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"

import { useWorkspaceAcceleratorPrefetch } from "../hooks/use-workspace-accelerator-prefetch"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceAcceleratorRuntimeActionsSignature,
  resolveWorkspaceAcceleratorOpenModuleId,
} from "../lib"
import { useWorkspaceAcceleratorCompletion } from "../hooks/use-workspace-accelerator-completion"
import { useWorkspaceAcceleratorCardController } from "../hooks/use-workspace-accelerator-card-controller"
import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorOpenStepRequest,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"
import {
  completeWorkspaceAcceleratorTutorialPreview,
  shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen,
  shouldWorkspaceAcceleratorSyncModuleViewerSize,
  shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue,
  useWorkspaceAcceleratorTutorialViewerState,
  WorkspaceAcceleratorCardEmptyState,
  WorkspaceAcceleratorCardFullscreenRail,
  WorkspaceAcceleratorCardInlinePicker,
  WorkspaceAcceleratorCardSidebar,
  WorkspaceAcceleratorDrawerHeaderControls,
  useModuleViewerSizeSync,
} from "./workspace-accelerator-card-panel-support"
import { canWorkspaceAcceleratorTutorialActivateStep } from "./workspace-accelerator-card-tutorial-guards"
import type { WorkspaceAcceleratorCardPanelProps } from "./workspace-accelerator-card-panel-types"
import { useWorkspaceAcceleratorLessonGroupState } from "./workspace-accelerator-card-panel-lesson-groups"
import { WorkspaceAcceleratorStepViewerTransition } from "./workspace-accelerator-step-viewer-transition"
import {
  resolveWorkspaceAcceleratorModuleStepNavigation,
  resolveWorkspaceAcceleratorPlaceholderVideoUrl,
} from "./workspace-accelerator-module-navigation"
import {
  buildAcceleratorRuntimeSnapshot,
  buildAcceleratorRuntimeSnapshotSignature,
  buildWorkspaceAcceleratorControllerInput,
  isWorkspaceAcceleratorOpenStepRequestFulfilled,
  useWorkspaceAcceleratorRuntimeSync,
} from "./workspace-accelerator-card-panel-runtime"
import { WorkspaceAcceleratorStepNodeCard } from "./workspace-accelerator-step-node-card"
import { useWorkspaceAcceleratorDrawerScroll } from "./use-workspace-accelerator-drawer-scroll"

// eslint-disable-next-line max-lines-per-function
export function WorkspaceAcceleratorCardPanel({
  input,
  overviewOnly = false,
  workspaceOverviewNotice = null,
  roadmapSections = [],
  roadmapBasePath = "/workspace/roadmap",
  presentationMode = "embedded",
  initialModuleViewerOpen = false,
  initialOpenModuleId = null,
  openStepRequest = null,
  onOpenStepRequestHandled,
  onRuntimeChange,
  onRuntimeActionsChange,
  onRequestOpenStep,
  onModuleViewerClose,
  tutorialCallout = null,
  tutorialInteractionPolicy = null,
  tutorialMode = null,
  showEmbeddedClassPicker = true,
  workspaceDrawerHeader = null,
  drawerContainer = null,
  onTutorialActionComplete,
}: WorkspaceAcceleratorCardPanelProps) {
  const controllerInput = useMemo<WorkspaceAcceleratorCardInput>(
    () => buildWorkspaceAcceleratorControllerInput(input),
    [input]
  )
  const controller = useWorkspaceAcceleratorCardController(controllerInput)
  const currentStep = controller.currentStep
  const stepHrefOverride =
    typeof controllerInput.linkHrefOverride === "string" &&
    controllerInput.linkHrefOverride.trim().length > 0
      ? controllerInput.linkHrefOverride
      : null
  const fallbackAcceleratorHref =
    stepHrefOverride ??
    (presentationMode === "fullscreen-route"
      ? "/workspace"
      : presentationMode === "workspace-drawer"
        ? "/workspace/accelerator"
        : "/accelerator")
  const runtimeStep = useMemo(
    () =>
      currentStep
        ? {
            ...currentStep,
            href: stepHrefOverride ?? currentStep.href,
          }
        : null,
    [currentStep, stepHrefOverride]
  )

  useWorkspaceAcceleratorPrefetch(fallbackAcceleratorHref, runtimeStep?.href, !overviewOnly)

  const [openModuleId, setOpenModuleId] = useState<string | null>(
    initialOpenModuleId
  )
  const [moduleViewerOpen, setIsModuleViewerOpen] = useState(
    presentationMode === "fullscreen-route" || initialModuleViewerOpen
  )
  const isModuleViewerOpen = !overviewOnly && moduleViewerOpen
  const workspaceDrawerEmbedded = presentationMode === "workspace-drawer"
  const {
    hasScrollableOverflow: workspaceDrawerHasScrollableOverflow,
    viewportRef: workspaceDrawerScrollRef,
  } = useWorkspaceAcceleratorDrawerScroll(
    workspaceDrawerEmbedded && !isModuleViewerOpen
  )
  useEffect(() => {
    if (overviewOnly || !initialOpenModuleId || openStepRequest) return
    setOpenModuleId(initialOpenModuleId)
    setIsModuleViewerOpen(true)
  }, [initialOpenModuleId, openStepRequest, overviewOnly])
  const previousCurrentModuleIdRef = useRef<string | null>(null)
  const previousTutorialManagedViewerOpenRef = useRef(false)
  const pendingFirstModuleTutorialAdvanceRef = useRef(false)
  const handledOpenStepRequestIdRef = useRef<number | null>(null)
  const acknowledgedOpenStepRequestIdRef = useRef<number | null>(null)
  const {
    selectedLessonGroup,
    selectedLessonGroupKey,
    lessonGroupSummaries,
    checklistModules,
    filteredSteps,
    filteredProgressPercent,
    firstVisibleChecklistStepId,
    handleLessonGroupChange,
  } = useWorkspaceAcceleratorLessonGroupState({
    controller,
    currentStep,
    tutorialInteractionPolicy,
    setOpenModuleId,
  })
  useEffect(() => {
    if (
      overviewOnly || !openStepRequest ||
      handledOpenStepRequestIdRef.current === openStepRequest.id
    ) {
      return
    }

    handledOpenStepRequestIdRef.current = openStepRequest.id
    const requestedStep = controller.steps.find(
      (step) =>
        step.id === openStepRequest.stepId &&
        step.moduleId === openStepRequest.moduleId
    )
    if (requestedStep) {
      controller.goToStep(requestedStep.id)
      setOpenModuleId(requestedStep.moduleId)
      setIsModuleViewerOpen(true)
    }
  }, [controller, openStepRequest, setOpenModuleId, overviewOnly])
  useEffect(() => {
    if (
      !openStepRequest ||
      acknowledgedOpenStepRequestIdRef.current === openStepRequest.id ||
      !isWorkspaceAcceleratorOpenStepRequestFulfilled({
        request: openStepRequest,
        currentStep,
        isModuleViewerOpen,
      })
    ) {
      return
    }

    acknowledgedOpenStepRequestIdRef.current = openStepRequest.id
    onOpenStepRequestHandled?.(openStepRequest.id)
  }, [
    currentStep,
    isModuleViewerOpen,
    onOpenStepRequestHandled,
    openStepRequest,
  ])
  const placeholderVideoUrl = useMemo(
    () =>
      resolveWorkspaceAcceleratorPlaceholderVideoUrl({
        steps: controller.steps,
        currentStepId: currentStep?.id,
      }),
    [controller.steps, currentStep?.id]
  )
  const moduleStepNavigation = useMemo(
    () =>
      resolveWorkspaceAcceleratorModuleStepNavigation({
        steps: controller.steps,
        currentModuleSteps: controller.currentModuleSteps,
        currentStepId: currentStep?.id,
      }),
    [controller.currentModuleSteps, controller.steps, currentStep?.id]
  )
  const { completeModule, completeVideo } = useWorkspaceAcceleratorCompletion({
    controller, onModuleComplete: input.onModuleComplete,
  })
  const goPreviousWithinModule = useCallback(() => {
    if (!moduleStepNavigation.previousStepId) return
    controller.goToStep(moduleStepNavigation.previousStepId)
  }, [controller, moduleStepNavigation.previousStepId])
  const goNextWithinModule = useCallback(() => {
    if (!moduleStepNavigation.nextStepId) return
    controller.markCurrentStepComplete()
    controller.goToStep(moduleStepNavigation.nextStepId)
  }, [controller, moduleStepNavigation.nextStepId])
  const runtimeActions = useMemo<WorkspaceAcceleratorCardRuntimeActions>(
    () => ({
      goPrevious: goPreviousWithinModule,
      goNext: goNextWithinModule,
      markCurrentStepComplete: controller.markCurrentStepComplete,
      selectLessonGroup: handleLessonGroupChange,
    }),
    [
      handleLessonGroupChange,
      goNextWithinModule,
      goPreviousWithinModule,
      controller.markCurrentStepComplete,
    ]
  )
  const runtimeSnapshot = useMemo<WorkspaceAcceleratorCardRuntimeSnapshot>(
    () =>
      buildAcceleratorRuntimeSnapshot({
        controller,
        runtimeStep,
        selectedLessonGroupKey,
        selectedLessonGroupLabel: selectedLessonGroup?.label ?? null,
        lessonGroupOptions: lessonGroupSummaries,
        firstVisibleChecklistStepId,
        isModuleViewerOpen,
        openModuleId,
        placeholderVideoUrl,
        readinessSummary: controllerInput.readinessSummary,
        checklistModuleCount: checklistModules.length,
        filteredStepCount: filteredSteps.length,
        filteredProgressPercent,
        canGoPrevious: moduleStepNavigation.canGoPrevious,
        canGoNext: moduleStepNavigation.canGoNext,
      }),
    [
      controller,
      controllerInput.readinessSummary,
      firstVisibleChecklistStepId,
      filteredProgressPercent,
      filteredSteps.length,
      isModuleViewerOpen,
      lessonGroupSummaries,
      checklistModules.length,
      moduleStepNavigation.canGoNext,
      moduleStepNavigation.canGoPrevious,
      openModuleId,
      placeholderVideoUrl,
      runtimeStep,
      selectedLessonGroup?.label,
      selectedLessonGroupKey,
    ]
  )
  const runtimeSnapshotSignature = useMemo(
    () => buildAcceleratorRuntimeSnapshotSignature(runtimeSnapshot),
    [runtimeSnapshot]
  )
  const runtimeActionsSignature = useMemo(
    () =>
      buildWorkspaceAcceleratorRuntimeActionsSignature({
        currentStepId: runtimeSnapshot.currentStep?.id ?? null,
        canGoPrevious: runtimeSnapshot.canGoPrevious,
        canGoNext: runtimeSnapshot.canGoNext,
        isCurrentStepCompleted: runtimeSnapshot.isCurrentStepCompleted,
        totalSteps: runtimeSnapshot.totalSteps,
        selectedLessonGroupKey,
        lessonGroupCount: lessonGroupSummaries.length,
      }),
    [
      runtimeSnapshot.canGoNext,
      runtimeSnapshot.canGoPrevious,
      runtimeSnapshot.currentStep?.id,
      runtimeSnapshot.isCurrentStepCompleted,
      runtimeSnapshot.totalSteps,
      lessonGroupSummaries.length,
      selectedLessonGroupKey,
    ]
  )
  const checklistModuleIds = useMemo(
    () => checklistModules.map((module) => module.id),
    [checklistModules]
  )
  const checklistModuleIdsSignature = useMemo(
    () => checklistModuleIds.join("|"),
    [checklistModuleIds]
  )
  const { onSizeChange, size, readinessSummary } = controllerInput
  const shouldSyncModuleViewerSize =
    shouldWorkspaceAcceleratorSyncModuleViewerSize({
      tutorialCallout,
      tutorialMode,
    })
  const showMilestoneTooltips = tutorialInteractionPolicy === null

  useModuleViewerSizeSync({
    size,
    onSizeChange,
    isModuleViewerOpen,
    enabled: shouldSyncModuleViewerSize,
  })

  useEffect(() => {
    const currentModuleId = currentStep?.moduleId ?? null
    const previousCurrentModuleId = previousCurrentModuleIdRef.current
    previousCurrentModuleIdRef.current = currentModuleId

    if (checklistModuleIds.length === 0) {
      setOpenModuleId((previous) => (previous === null ? previous : null))
      return
    }

    const hasCurrentModuleChanged =
      previousCurrentModuleId !== null &&
      previousCurrentModuleId !== currentModuleId
    const shouldForceCurrentModuleOpen =
      previousCurrentModuleId === null || hasCurrentModuleChanged

    setOpenModuleId((previous) => {
      const next = resolveWorkspaceAcceleratorOpenModuleId({
        previousOpenModuleId: previous,
        visibleModuleIds: checklistModuleIds,
        currentModuleId,
        forceCurrentModuleOpen: shouldForceCurrentModuleOpen,
      })
      return previous === next ? previous : next
    })
  }, [checklistModuleIds, checklistModuleIdsSignature, currentStep?.moduleId])

  useEffect(() => {
    if (tutorialCallout?.focus !== "first-module") return
    const nextModuleId =
      checklistModules
        .flatMap((module) => module.steps)
        .find((step) => step.id === firstVisibleChecklistStepId)?.moduleId ??
      checklistModules[0]?.id ??
      null
    if (!nextModuleId) return
    setOpenModuleId((previous) =>
      previous === nextModuleId ? previous : nextModuleId
    )
  }, [checklistModules, firstVisibleChecklistStepId, tutorialCallout?.focus])

  useWorkspaceAcceleratorTutorialViewerState({
    currentModuleId: currentStep?.moduleId ?? null,
    tutorialCallout,
    tutorialMode,
    setIsModuleViewerOpen,
    setOpenModuleId,
    previousTutorialManagedViewerOpenRef,
  })

  useWorkspaceAcceleratorRuntimeSync({
    runtimeSnapshot,
    runtimeSnapshotSignature,
    runtimeActions,
    runtimeActionsSignature,
    onRuntimeChange,
    onRuntimeActionsChange,
  })

  useEffect(() => {
    if (
      !shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen({
        tutorialCallout,
        pendingAdvance: pendingFirstModuleTutorialAdvanceRef.current,
        isModuleViewerOpen,
        currentStepId: currentStep?.id ?? null,
        tutorialTargetStepId: firstVisibleChecklistStepId,
      })
    ) {
      if (tutorialCallout?.focus !== "first-module") {
        pendingFirstModuleTutorialAdvanceRef.current = false
      }
      return
    }

    pendingFirstModuleTutorialAdvanceRef.current = false
    onTutorialActionComplete?.("complete-and-advance")
  }, [
    currentStep?.id,
    firstVisibleChecklistStepId,
    isModuleViewerOpen,
    onTutorialActionComplete,
    tutorialCallout,
  ])

  const handleCloseModuleViewer = () => {
    if (onModuleViewerClose) {
      onModuleViewerClose()
      return
    }
    setIsModuleViewerOpen(false)
    if (tutorialCallout?.focus === "close-module") {
      onTutorialActionComplete?.("complete-and-advance")
    }
  }

  const handleCompleteModuleStep = async () => {
    if (
      shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue(tutorialMode)
    ) {
      completeWorkspaceAcceleratorTutorialPreview({
        setIsModuleViewerOpen,
        previousTutorialManagedViewerOpenRef,
        onTutorialActionComplete,
      })
      return
    }
    if (!(await completeModule())) return
    if (moduleStepNavigation.nextStepId) {
      controller.goToStep(moduleStepNavigation.nextStepId)
    }
    handleCloseModuleViewer()
  }

  const handleStepSelect = (step: WorkspaceAcceleratorCardStep) => {
    if (overviewOnly) return
    if (
      !canWorkspaceAcceleratorTutorialActivateStep({
        tutorialInteractionPolicy,
        stepId: step.id,
        moduleId: step.moduleId,
      })
    ) {
      return
    }

    const canRequestExternalOpen =
      Boolean(onRequestOpenStep) &&
      (presentationMode === "fullscreen-route" ||
        tutorialInteractionPolicy === null)
    const openRequestResult = canRequestExternalOpen
      ? onRequestOpenStep?.({
          step,
          selectedLessonGroupKey: selectedLessonGroupKey || null,
        })
      : undefined

    if (
      presentationMode === "embedded" &&
      tutorialInteractionPolicy === null &&
      onRequestOpenStep &&
      openRequestResult !== false
    ) {
      return
    }

    controller.goToStep(step.id)
    setOpenModuleId(step.moduleId)
    setIsModuleViewerOpen(true)
    if (
      tutorialCallout?.focus === "first-module" &&
      step.id === firstVisibleChecklistStepId
    ) {
      pendingFirstModuleTutorialAdvanceRef.current = true
    }
  }

  if (!currentStep) {
    return <WorkspaceAcceleratorCardEmptyState href={fallbackAcceleratorHref} />
  }

  const fullscreenEmbedded = presentationMode === "fullscreen-route"
  const sidebarProps = {
    selectedLessonGroup,
    tutorialCallout,
    tutorialInteractionPolicy,
    filteredProgressPercent,
    readinessSummary,
    showMilestoneTooltips,
    checklistModules,
    currentStepId: currentStep.id,
    completedStepIds: controller.completedStepIds,
    openModuleId,
    onOpenModuleIdChange: setOpenModuleId,
    onStepSelect: handleStepSelect,
    tutorialTargetStepId:
      tutorialCallout?.focus === "first-module"
        ? firstVisibleChecklistStepId
        : null,
  } satisfies ComponentProps<typeof WorkspaceAcceleratorCardSidebar>

  return (
    <div
      data-workspace-accelerator-current-step={currentStep.id}
      data-workspace-accelerator-open-module={openModuleId ?? undefined}
      className={cn("relative flex h-full min-h-0 flex-1 flex-col overflow-hidden", workspaceDrawerEmbedded && "@container/accelerator-overview")}
    >
      {fullscreenEmbedded ? (
        <WorkspaceAcceleratorCardFullscreenRail
          {...sidebarProps}
          lessonGroupOptions={lessonGroupSummaries}
          selectedLessonGroupKey={selectedLessonGroupKey}
          viewerOpen={isModuleViewerOpen}
          onLessonGroupChange={handleLessonGroupChange}
          roadmapSections={roadmapSections}
          roadmapBasePath={roadmapBasePath}
        />
      ) : null}
      <div
        className={cn(
          "grid min-h-0 flex-1",
          fullscreenEmbedded ? "gap-0" : "gap-3",
          !fullscreenEmbedded && isModuleViewerOpen
            ? workspaceDrawerEmbedded
              ? "grid-cols-1"
              : "grid-cols-[minmax(250px,290px)_minmax(0,1fr)]"
            : "grid-cols-1"
        )}
      >
        {!fullscreenEmbedded && !(workspaceDrawerEmbedded && isModuleViewerOpen) ? (
          <ScrollFadeEffect
            ref={workspaceDrawerScrollRef}
            enabled={workspaceDrawerHasScrollableOverflow && !workspaceDrawerEmbedded}
            data-scrollable={
              workspaceDrawerHasScrollableOverflow ? "true" : undefined
            }
            data-workspace-accelerator-drawer-scroll={
              workspaceDrawerEmbedded ? "true" : undefined
            }
            className={cn(
              "flex min-h-0 flex-col gap-2",
              workspaceDrawerEmbedded &&
                "mx-auto grid w-full min-w-0 max-w-[1200px] auto-rows-max grid-cols-1 content-start items-start gap-6 pt-6 pb-2 sm:pb-3 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
              workspaceDrawerEmbedded && workspaceDrawerHeader && "@min-[900px]/accelerator-overview:grid-cols-[420px_minmax(0,1fr)]"
            )}
          >
            {workspaceDrawerEmbedded ? workspaceDrawerHeader : null}
            <div className={cn("flex min-w-0 flex-col gap-3", workspaceDrawerEmbedded && "mx-auto w-full max-w-3xl")}>
              {workspaceOverviewNotice}
              <div inert={overviewOnly || undefined} aria-label={overviewOnly ? "Accelerator preview — upgrade to access" : undefined}>
                <WorkspaceAcceleratorCardSidebar
                  {...sidebarProps}
                  className={
                    workspaceDrawerEmbedded ? "mx-auto w-full max-w-3xl" : undefined
                  }
                  showProgressSummary={false}
                  fillAvailableHeight={!workspaceDrawerEmbedded}
                  headerControls={
                    workspaceDrawerEmbedded ? (
                      <WorkspaceAcceleratorDrawerHeaderControls
                        roadmapReturnTo={getWorkspaceDrawerPath({ tab: "accelerator", group: selectedLessonGroupKey, ...(isModuleViewerOpen ? { moduleId: currentStep.moduleId, stepId: currentStep.id } : {}) })}
                        roadmapSections={roadmapSections}
                        roadmapBasePath={roadmapBasePath}
                        filteredProgressPercent={filteredProgressPercent}
                        lessonGroupOptions={lessonGroupSummaries}
                        onLessonGroupChange={handleLessonGroupChange}
                        readinessSummary={readinessSummary}
                        selectedLessonGroupKey={selectedLessonGroupKey}
                        showMilestoneTooltips={showMilestoneTooltips}
                        showPicker={showEmbeddedClassPicker}
                        tutorialCallout={tutorialCallout}
                        tutorialInteractionPolicy={tutorialInteractionPolicy ?? null}
                        viewerOpen={isModuleViewerOpen}
                      />
                    ) : null
                  }
                  checklistHeaderControls={
                    !workspaceDrawerEmbedded && showEmbeddedClassPicker ? (
                      <WorkspaceAcceleratorCardInlinePicker
                        lessonGroupOptions={lessonGroupSummaries}
                        selectedLessonGroupKey={selectedLessonGroupKey}
                        tutorialCallout={tutorialCallout}
                        tutorialInteractionPolicy={tutorialInteractionPolicy ?? null}
                        viewerOpen={isModuleViewerOpen}
                        layout="badge"
                        onLessonGroupChange={handleLessonGroupChange}
                      />
                    ) : null
                  }
                />
              </div>
            </div>
          </ScrollFadeEffect>
        ) : null}

        <WorkspaceAcceleratorStepViewerTransition open={!overviewOnly && isModuleViewerOpen} immediate={workspaceDrawerEmbedded && Boolean(drawerContainer)}>
          <WorkspaceAcceleratorStepNodeCard
            variant="embedded"
            drawerContainer={workspaceDrawerEmbedded ? drawerContainer : null}
            step={currentStep}
            placeholderVideoUrl={placeholderVideoUrl}
            stepIndex={controller.currentModuleStepIndex}
            stepTotal={Math.max(controller.currentModuleSteps.length, 1)}
            canGoPrevious={moduleStepNavigation.canGoPrevious}
            canGoNext={moduleStepNavigation.canGoNext}
            completed={controller.isCurrentStepCompleted}
            moduleCompleted={controller.isCurrentModuleCompleted}
            onPrevious={goPreviousWithinModule}
            onNext={goNextWithinModule}
            onVideoComplete={tutorialMode ? undefined : () => void completeVideo()}
            onComplete={handleCompleteModuleStep}
            onClose={handleCloseModuleViewer}
            tutorialCallout={
              tutorialCallout?.focus === "close-module" ? tutorialCallout : null
            }
            tutorialInteractionPolicy={tutorialInteractionPolicy}
            onWorkspaceOnboardingSubmit={input.onWorkspaceOnboardingSubmit}
            immersive={fullscreenEmbedded}
          />
        </WorkspaceAcceleratorStepViewerTransition>
      </div>
    </div>
  )
}
