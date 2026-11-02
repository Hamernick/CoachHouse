import { saveModuleStepProgressAction } from "@/app/actions/module-step-progress"
import { markModuleCompleteAction } from "@/app/actions/module-progress"
import type {
  WorkspaceAcceleratorCardInput,
} from "@/features/workspace-accelerator-card"
import { shouldWorkspaceTutorialTrackEmbeddedAcceleratorRuntime } from "./workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation-state"
import type {
  WorkspaceCardId,
  WorkspaceCardSize,
} from "./workspace-board-types"
import type { WorkspaceBoardNodeData } from "./workspace-board-node-types"
import { resolveWorkspaceAcceleratorReadinessSummary } from "./workspace-board-accelerator-card-helpers"

export function shouldWorkspaceBoardCardTrackEmbeddedAcceleratorRuntime({
  cardId,
  presentationMode,
  tutorialStepId,
}: {
  cardId: WorkspaceCardId
  presentationMode: boolean
  tutorialStepId?: WorkspaceBoardNodeData["tutorialStepId"]
}) {
  return (
    cardId !== "accelerator" ||
    !presentationMode ||
    !tutorialStepId ||
    shouldWorkspaceTutorialTrackEmbeddedAcceleratorRuntime(tutorialStepId)
  )
}

export function buildWorkspaceBoardAcceleratorCardInput({
  acceleratorTimeline,
  size,
  acceleratorReadinessSummary,
  hasAcceleratorAccess,
  acceleratorPaywallHref,
  shouldTrackEmbeddedAcceleratorRuntime,
  orgId,
  viewerId,
  handleAcceleratorSizeChange,
  activeStepId,
  completedStepIds,
  handleAcceleratorProgressChange,
  onWorkspaceOnboardingSubmit,
}: {
  acceleratorTimeline: WorkspaceBoardNodeData["seed"]["acceleratorTimeline"]
  size: WorkspaceCardSize
  acceleratorReadinessSummary: ReturnType<
    typeof resolveWorkspaceAcceleratorReadinessSummary
  >
  hasAcceleratorAccess: boolean
  acceleratorPaywallHref: string
  shouldTrackEmbeddedAcceleratorRuntime: boolean
  orgId: string
  viewerId: string
  handleAcceleratorSizeChange: (nextSize: WorkspaceCardSize) => void
  activeStepId: string | null
  completedStepIds: string[]
  handleAcceleratorProgressChange: (
    nextProgress: { currentStepId: string | null; completedStepIds: string[] },
  ) => void
  onWorkspaceOnboardingSubmit: WorkspaceBoardNodeData["onWorkspaceOnboardingSubmit"]
}): WorkspaceAcceleratorCardInput {
  return {
    steps: acceleratorTimeline ?? [],
    size: size === "lg" ? "lg" : size === "sm" ? "sm" : "md",
    readinessSummary: acceleratorReadinessSummary,
    linkHrefOverride: hasAcceleratorAccess ? null : acceleratorPaywallHref,
    allowAutoResize: false,
    storageKey: shouldTrackEmbeddedAcceleratorRuntime
      ? `${orgId}:${viewerId}`
      : undefined,
    onSizeChange: shouldTrackEmbeddedAcceleratorRuntime
      ? handleAcceleratorSizeChange
      : undefined,
    initialCurrentStepId: activeStepId,
    initialCompletedStepIds: completedStepIds,
    onModuleComplete: shouldTrackEmbeddedAcceleratorRuntime ? (moduleId) => markModuleCompleteAction(moduleId, orgId) : undefined,
    onStepComplete: shouldTrackEmbeddedAcceleratorRuntime
      ? (moduleId, stepId) => saveModuleStepProgressAction({ moduleId, stepId, expectedOrgId: orgId })
      : undefined,
    onProgressChange: shouldTrackEmbeddedAcceleratorRuntime
      ? handleAcceleratorProgressChange
      : undefined,
    onWorkspaceOnboardingSubmit,
  }
}
