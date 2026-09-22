"use client"

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { Position } from "reactflow"

import {
  areWorkspaceAcceleratorRuntimeSnapshotsEqual,
  buildWorkspaceAcceleratorFullscreenHref,
  type WorkspaceAcceleratorCardInput,
  type WorkspaceAcceleratorCardRuntimeActions,
  type WorkspaceAcceleratorCardRuntimeSnapshot,
  type WorkspaceAcceleratorCardStep,
} from "@/features/workspace-accelerator-card"
import { Badge } from "@/components/ui/badge"
import { ExistingCanvasParticleToolbar } from "@/features/workspace-particles/client"
import {
  getWorkspaceAcceleratorPaywallPath,
  getWorkspaceEditorPath,
} from "@/lib/workspace/routes"
import { cn } from "@/lib/utils"

import { WorkspaceCardErrorBoundary } from "./workspace-board-card-error-boundary"
import { resolveWorkspaceBoardFrameContentClassName } from "./workspace-board-frame-content-class-name"
import { WorkspaceBoardExecutionCardHeaderControls } from "./workspace-board-execution-card-header-controls"
import { WORKSPACE_CARD_META } from "./workspace-board-copy"
import {
  renderOrganizationOverviewCard,
  resolveAcceleratorHeaderDetails,
  resolveAcceleratorHeaderMeta,
  resolveOrganizationHeaderAction,
  renderWorkspaceBoardResolvedCard,
  useOrganizationMapCardAction,
} from "./workspace-board-node-card-support"
import type { WorkspaceBoardExecutionTab } from "./workspace-board-node-tool-card-execution"
import { workspaceBoardCardPropsEqual } from "./workspace-board-node-card-compare"
import type {
  WorkspaceCardId,
  WorkspaceCardOverflowAction,
  WorkspaceCardSize,
} from "./workspace-board-types"
import type { WorkspaceBoardNodeData } from "./workspace-board-node-types"
import { resolveWorkspaceAcceleratorReadinessSummary } from "./workspace-board-accelerator-card-helpers"
import {
  buildWorkspaceBoardAcceleratorCardInput,
  shouldWorkspaceBoardCardTrackEmbeddedAcceleratorRuntime,
} from "./workspace-board-node-card-accelerator-runtime"
import { useWorkspaceCanvasOverlayDrawerRequest } from "./workspace-canvas-v2/components/workspace-canvas-overlay-drawer-container"

// eslint-disable-next-line max-lines-per-function
export const WorkspaceBoardCard = memo(function WorkspaceBoardCard({
  data,
  selected,
  yPos = 0,
}: {
  data: WorkspaceBoardNodeData
  selected?: boolean
  yPos?: number
}) {
  const router = useRouter()
  const openWorkspaceDataDrawer = useWorkspaceCanvasOverlayDrawerRequest()
  const {
    cardId,
    size,
    seed,
    organizationEditorData,
    canEdit,
    presentationMode,
    communications,
    onSizeChange,
    onCommunicationsChange,
    onAcceleratorStateChange,
    onAcceleratorRuntimeChange,
    onAcceleratorRuntimeActionsChange,
    acceleratorTutorialCallout = null,
    acceleratorTutorialInteractionPolicy = null,
    onAcceleratorTutorialActionComplete,
    onWorkspaceOnboardingSubmit,
    acceleratorState,
    isJourneyTarget = false,
    isCanvasFullscreen = false,
    onToggleCanvasFullscreen,
  } = data
  const cardMeta = WORKSPACE_CARD_META[cardId]
  const particleToolbarPosition = yPos < 60 ? Position.Bottom : Position.Top
  const shouldTrackEmbeddedAcceleratorRuntime =
    shouldWorkspaceBoardCardTrackEmbeddedAcceleratorRuntime({
      cardId,
      presentationMode,
      tutorialStepId: data.tutorialStepId,
    })
  const hideHeaderSubtitle =
    cardId === "organization-overview" ||
    cardId === "programs" ||
    cardId === "accelerator" ||
    cardId === "roadmap" ||
    cardId === "calendar" ||
    cardId === "communications" ||
    cardId === "deck" ||
    cardId === "fiscal-sponsorship"
  const frameFullscreenToggle = onToggleCanvasFullscreen
    ? () => onToggleCanvasFullscreen(cardId)
    : undefined
  const organizationEditorHref = getWorkspaceEditorPath({ tab: "company" })
  const handleOrganizationEditorOpen = useCallback(() => {
    openWorkspaceDataDrawer?.({
      tab: "organization",
      organizationTab: "company",
      organizationEditMode: true,
    })
  }, [openWorkspaceDataDrawer])
  const acceleratorPaywallHref = getWorkspaceAcceleratorPaywallPath()
  const acceleratorCardHref = seed.hasAcceleratorAccess
    ? cardMeta.fullHref
    : acceleratorPaywallHref
  const effectiveCardSize: WorkspaceCardSize =
    cardId === "communications" && size === "sm" ? "md" : size
  const acceleratorHostCardId: WorkspaceCardId =
    cardId === "deck" ? "deck" : "accelerator"
  const handleAcceleratorSizeChange = useCallback(
    (nextSize: WorkspaceCardSize) =>
      onSizeChange(
        acceleratorHostCardId,
        acceleratorHostCardId === "deck" && nextSize === "sm" ? "md" : nextSize
      ),
    [acceleratorHostCardId, onSizeChange]
  )
  const handleAcceleratorProgressChange = useCallback(
    (nextProgress: {
      currentStepId: string | null
      completedStepIds: string[]
    }) => {
      startTransition(() => {
        onAcceleratorStateChange({
          activeStepId: nextProgress.currentStepId,
          completedStepIds: nextProgress.completedStepIds,
        })
      })
    },
    [onAcceleratorStateChange]
  )
  const [acceleratorRuntimeSnapshot, setAcceleratorRuntimeSnapshot] =
    useState<WorkspaceAcceleratorCardRuntimeSnapshot | null>(null)
  const [acceleratorRuntimeActions, setAcceleratorRuntimeActions] =
    useState<WorkspaceAcceleratorCardRuntimeActions | null>(null)
  const [executionActiveTab, setExecutionActiveTab] =
    useState<WorkspaceBoardExecutionTab>("roadmap")
  const [roadmapNavigatorCollapsed, setRoadmapNavigatorCollapsed] =
    useState(false)
  const lastForwardedAcceleratorRuntimeSnapshotRef =
    useRef<WorkspaceAcceleratorCardRuntimeSnapshot | null>(null)
  const [communicationsMenuActions, setCommunicationsMenuActions] = useState<
    WorkspaceCardOverflowAction[]
  >([])
  const [programsCreateOpen, setProgramsCreateOpen] = useState(false)
  const comingSoonTitleBadge =
    cardId === "economic-engine" || cardId === "communications" ? (
      <Badge
        variant="outline"
        className="border-border/70 bg-muted/70 text-foreground/80 dark:bg-muted/30 dark:text-foreground/75 rounded-full px-2 py-0 text-[10px] font-semibold"
      >
        Coming soon
      </Badge>
    ) : undefined
  const handleAcceleratorRuntimeChange = useCallback(
    (snapshot: WorkspaceAcceleratorCardRuntimeSnapshot) => {
      if (
        areWorkspaceAcceleratorRuntimeSnapshotsEqual(
          lastForwardedAcceleratorRuntimeSnapshotRef.current,
          snapshot
        )
      ) {
        return
      }
      lastForwardedAcceleratorRuntimeSnapshotRef.current = snapshot
      setAcceleratorRuntimeSnapshot((previous) => {
        if (
          previous?.currentStep?.id === snapshot.currentStep?.id &&
          previous?.currentModuleStepIndex ===
            snapshot.currentModuleStepIndex &&
          previous?.currentModuleStepTotal ===
            snapshot.currentModuleStepTotal &&
          previous?.currentModuleCompletedCount ===
            snapshot.currentModuleCompletedCount &&
          previous?.isCurrentModuleCompleted ===
            snapshot.isCurrentModuleCompleted &&
          previous?.isModuleViewerOpen === snapshot.isModuleViewerOpen &&
          previous?.openModuleId === snapshot.openModuleId &&
          JSON.stringify(previous?.lessonGroupOptions ?? []) ===
            JSON.stringify(snapshot.lessonGroupOptions ?? []) &&
          previous?.currentIndex === snapshot.currentIndex &&
          previous?.totalSteps === snapshot.totalSteps &&
          previous?.filteredProgressPercent === snapshot.filteredProgressPercent
        ) {
          return previous
        }
        return snapshot
      })
      onAcceleratorRuntimeChange?.(snapshot)
    },
    [onAcceleratorRuntimeChange]
  )
  const handleAcceleratorRuntimeActionsChange = useCallback(
    (actions: WorkspaceAcceleratorCardRuntimeActions) => {
      setAcceleratorRuntimeActions(() => actions)
      onAcceleratorRuntimeActionsChange?.(actions)
    },
    [onAcceleratorRuntimeActionsChange]
  )
  const handleProgramsCreateOpenChange = useCallback(
    (open: boolean) => {
      setProgramsCreateOpen(open)
      if (!open) {
        router.refresh()
      }
    },
    [router]
  )
  const handleAcceleratorRequestOpenStep = useCallback(
    ({
      step,
      selectedLessonGroupKey,
    }: {
      step: WorkspaceAcceleratorCardStep
      selectedLessonGroupKey: string | null
    }) => {
      if (!seed.hasAcceleratorAccess) {
        router.push(acceleratorPaywallHref)
        return true
      }
      if (openWorkspaceDataDrawer) {
        openWorkspaceDataDrawer({
          tab: "accelerator",
          acceleratorStepId: step.id,
          acceleratorModuleId: step.moduleId,
          acceleratorLessonGroupKey: selectedLessonGroupKey,
        })
        return true
      }
      const href = buildWorkspaceAcceleratorFullscreenHref({
        stepId: step.id,
        moduleId: step.moduleId,
        lessonGroupKey: selectedLessonGroupKey,
      })
      router.push(href, { scroll: false })
      return true
    },
    [
      acceleratorPaywallHref,
      openWorkspaceDataDrawer,
      router,
      seed.hasAcceleratorAccess,
    ]
  )
  const acceleratorFullscreenBaseHref = useMemo(
    () => buildWorkspaceAcceleratorFullscreenHref({}),
    []
  )
  useEffect(() => {
    if (!seed.hasAcceleratorAccess) return
    router.prefetch(acceleratorFullscreenBaseHref)
  }, [acceleratorFullscreenBaseHref, router, seed.hasAcceleratorAccess])
  const acceleratorReadinessSummary = useMemo(
    () =>
      resolveWorkspaceAcceleratorReadinessSummary({
        acceleratorState,
        programs: (organizationEditorData?.programs ?? []).map((program) => ({
          goal_cents: program.goal_cents ?? null,
        })),
        seed,
      }),
    [acceleratorState, organizationEditorData, seed]
  )
  const acceleratorCardInput = useMemo<WorkspaceAcceleratorCardInput>(
    () =>
      buildWorkspaceBoardAcceleratorCardInput({
        acceleratorTimeline: seed.acceleratorTimeline,
        size,
        acceleratorReadinessSummary,
        hasAcceleratorAccess: seed.hasAcceleratorAccess,
        acceleratorPaywallHref,
        shouldTrackEmbeddedAcceleratorRuntime,
        orgId: seed.orgId,
        viewerId: seed.viewerId,
        handleAcceleratorSizeChange,
        activeStepId: acceleratorState.activeStepId,
        completedStepIds: acceleratorState.completedStepIds,
        handleAcceleratorProgressChange,
        onWorkspaceOnboardingSubmit,
      }),
    [
      acceleratorState.activeStepId,
      acceleratorState.completedStepIds,
      handleAcceleratorProgressChange,
      handleAcceleratorSizeChange,
      size,
      acceleratorReadinessSummary,
      acceleratorPaywallHref,
      seed.acceleratorTimeline,
      seed.hasAcceleratorAccess,
      seed.orgId,
      seed.viewerId,
      onWorkspaceOnboardingSubmit,
      shouldTrackEmbeddedAcceleratorRuntime,
    ]
  )
  const frameContentClassName = resolveWorkspaceBoardFrameContentClassName({
    cardId,
    acceleratorTutorialCallout,
  })
  const acceleratorHeaderMeta = resolveAcceleratorHeaderMeta({
    acceleratorRuntimeActions,
    acceleratorRuntimeSnapshot,
    acceleratorTutorialCallout,
    acceleratorTutorialInteractionPolicy,
  })
  const executionHeaderMeta =
    cardId === "deck" ? (
      <WorkspaceBoardExecutionCardHeaderControls
        activeTab={executionActiveTab}
        runtimeSnapshot={acceleratorRuntimeSnapshot}
        onLessonGroupChange={acceleratorRuntimeActions?.selectLessonGroup}
      />
    ) : undefined
  const acceleratorHeaderDetails = resolveAcceleratorHeaderDetails({
    acceleratorRuntimeSnapshot,
    acceleratorTutorialCallout,
    acceleratorTutorialInteractionPolicy,
  })
  const { organizationMapButtonCallout, handleOpenMapCard } =
    useOrganizationMapCardAction(data)
  return (
    <div
      className={cn(
        "relative min-h-0 w-full min-w-0 origin-center transition-[box-shadow,filter,opacity,transform] duration-200",
        (cardId === "accelerator" || cardId === "deck") &&
          acceleratorRuntimeSnapshot?.isModuleViewerOpen === true &&
          "z-20",
        cardId === "accelerator" ||
          cardId === "deck" ||
          cardId === "organization-overview" ||
          cardId === "programs" ||
          cardId === "calendar" ||
          cardId === "fiscal-sponsorship"
          ? "h-auto"
          : "h-full"
      )}
    >
      {selected !== undefined &&
      (cardId === "organization-overview" || cardId === "programs") ? (
        <ExistingCanvasParticleToolbar
          title={cardMeta.title}
          size={effectiveCardSize}
          selected={selected && !presentationMode}
          position={particleToolbarPosition}
          canEdit={canEdit}
          onSizeChange={(nextSize) => onSizeChange(cardId, nextSize)}
          onRemove={() => data.onHideCard?.(cardId)}
        />
      ) : null}
      <WorkspaceCardErrorBoundary cardId={cardId}>
        {cardId === "organization-overview"
          ? renderOrganizationOverviewCard({
              size: effectiveCardSize,
              presentationMode,
              canEdit,
              contentClassName: frameContentClassName,
              organizationEditorHref,
              onOrganizationEditorOpen: openWorkspaceDataDrawer
                ? handleOrganizationEditorOpen
                : undefined,
              headerAction: resolveOrganizationHeaderAction({
                orgId: seed.orgId,
                profile:
                  organizationEditorData?.initialProfile ?? seed.initialProfile,
                highlighted: organizationMapButtonCallout !== null,
                instruction: organizationMapButtonCallout?.instruction ?? null,
                onPress: handleOpenMapCard,
              }),
              isCanvasFullscreen,
              onToggleCanvasFullscreen: frameFullscreenToggle,
              seed,
              organizationEditorData: data.organizationEditorData,
            })
          : renderWorkspaceBoardResolvedCard({
              cardId,
              cardMeta,
              comingSoonTitleBadge,
              acceleratorCardHref,
              acceleratorCardInput,
              acceleratorHeaderDetails,
              acceleratorHeaderMeta,
              acceleratorRuntimeActions,
              acceleratorRuntimeSnapshot,
              acceleratorTutorialCallout,
              acceleratorTutorialInteractionPolicy,
              canEdit,
              communications,
              communicationsMenuActions,
              contentClassName: frameContentClassName,
              data,
              effectiveCardSize,
              executionActiveTab,
              executionHeaderMeta,
              frameFullscreenToggle,
              hideHeaderSubtitle,
              isCanvasFullscreen,
              onAcceleratorRuntimeActionsChange:
                handleAcceleratorRuntimeActionsChange,
              onAcceleratorRuntimeChange: handleAcceleratorRuntimeChange,
              onAcceleratorTutorialActionComplete,
              onCommunicationsMenuActionsChange: setCommunicationsMenuActions,
              onExecutionTabChange: (nextValue) =>
                setExecutionActiveTab(
                  nextValue === "accelerator" ? "accelerator" : "roadmap"
                ),
              onProgramsCreateOpenChange: handleProgramsCreateOpenChange,
              onRequestOpenAcceleratorStep: handleAcceleratorRequestOpenStep,
              onRoadmapNavigatorCollapsedChange: setRoadmapNavigatorCollapsed,
              onSizeChange,
              presentationMode,
              programsCreateOpen,
              roadmapNavigatorCollapsed,
              seed,
              shouldTrackEmbeddedAcceleratorRuntime,
            })}
      </WorkspaceCardErrorBoundary>
    </div>
  )
}, workspaceBoardCardPropsEqual)

WorkspaceBoardCard.displayName = "WorkspaceBoardCard"
