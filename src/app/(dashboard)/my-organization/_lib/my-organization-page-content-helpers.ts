import {
  applyWorkspaceOnboardingStageOverride,
  buildRestartedWorkspaceTutorialBoardState,
  buildCompletedWorkspaceTutorialBoardState,
  resolveWorkspaceOnboardingStageFromSearchParam,
} from "../_components/workspace-board/workspace-board-onboarding-flow"
import { buildDefaultWorkspaceConnections } from "../_components/workspace-board/workspace-board-layout"
import type { WorkspaceBoardState } from "../_components/workspace-board/workspace-board-types"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card"
import { resolveWorkspaceCanvasTutorialStepCount } from "@/features/workspace-canvas-tutorial"
import { isElectiveAddOnModule } from "@/lib/accelerator/elective-modules"
import { sortAcceleratorModules } from "@/lib/accelerator/module-order"

export type WorkspaceSeedWithAcceleratorBoardState = {
  boardState: WorkspaceBoardState
}

type SortableRoadmapModule = {
  slug: string
  title: string
  index: number
  sequence?: number
  href?: string
}

export function partitionRoadmapModules<T extends SortableRoadmapModule>(
  modules: T[]
) {
  const sortedRoadmapModules = sortAcceleratorModules(modules)
  return {
    sortedRoadmapModules,
    foundationRoadmapModules: sortedRoadmapModules.filter(
      (module) => !isElectiveAddOnModule(module)
    ),
    acceleratorRoadmapModules: sortedRoadmapModules.filter((module) =>
      isElectiveAddOnModule(module)
    ),
  }
}

function hasCompletedWorkspaceTutorial(boardState: WorkspaceBoardState) {
  const finalStepIndex = resolveWorkspaceCanvasTutorialStepCount() - 1

  return (
    boardState.onboardingFlow.active === false &&
    boardState.onboardingFlow.tutorialStepIndex >= finalStepIndex
  )
}

export function countWorkspaceDocuments(profile: Record<string, unknown>) {
  const documentsRoot =
    profile.documents && typeof profile.documents === "object"
      ? (profile.documents as Record<string, unknown>)
      : {}
  const uploadCount = Object.values(documentsRoot).filter((entry) => {
    if (!entry || typeof entry !== "object") return false
    const path = (entry as { path?: unknown }).path
    return typeof path === "string" && path.trim().length > 0
  }).length
  const policyCount = (
    Array.isArray(profile.policies) ? profile.policies : []
  ).filter((entry) => {
    if (!entry || typeof entry !== "object") return false
    const document = (entry as { document?: unknown }).document
    if (!document || typeof document !== "object") return false
    const path = (document as { path?: unknown }).path
    return typeof path === "string" && path.trim().length > 0
  }).length

  return uploadCount + policyCount
}

export function resolveOrganizationProfileComplete(initialProfile: {
  name?: string | null
  description?: string | null
  tagline?: string | null
  formationStatus?: string | null
  originStory?: string | null
  mission?: string | null
  vision?: string | null
  need?: string | null
  theoryOfChange?: string | null
}) {
  const storyFieldCount = [
    initialProfile.description,
    initialProfile.tagline,
    initialProfile.originStory,
    initialProfile.mission,
    initialProfile.vision,
    initialProfile.need,
    initialProfile.theoryOfChange,
  ].filter(
    (value) => typeof value === "string" && value.trim().length > 0
  ).length

  return (
    typeof initialProfile.name === "string" &&
    initialProfile.name.trim().length > 0 &&
    (Boolean(initialProfile.formationStatus) || storyFieldCount >= 2)
  )
}

export function hydrateWorkspaceSeedAcceleratorState<
  TSeed extends WorkspaceSeedWithAcceleratorBoardState,
>(workspaceSeed: TSeed, acceleratorTimeline: WorkspaceAcceleratorCardStep[]) {
  const hasTimeline = acceleratorTimeline.length > 0
  if (!hasTimeline) return workspaceSeed

  const completedStepIds = Array.from(
    new Set([
      ...acceleratorTimeline
        .filter((step) => step.status === "completed")
        .map((step) => step.id),
    ])
  )
  const persistedActiveStep = acceleratorTimeline.find(
    (step) => step.id === workspaceSeed.boardState.accelerator.activeStepId
  )
  const recoveredOrganizationSetup =
    persistedActiveStep?.status === "completed" &&
    persistedActiveStep.moduleContext?.workspaceOnboarding?.view ===
      "organization-setup" &&
    !workspaceSeed.boardState.accelerator.completedStepIds.includes(
      persistedActiveStep.id
    )
  const activeStep =
    persistedActiveStep && !recoveredOrganizationSetup
      ? persistedActiveStep
      : (acceleratorTimeline.find((step) => step.status === "in_progress") ??
        acceleratorTimeline.find((step) => step.status !== "completed") ??
        acceleratorTimeline.at(-1) ??
        null)

  if (
    workspaceSeed.boardState.accelerator.activeStepId ===
      (activeStep?.id ?? null) &&
    completedStepIds.length ===
      workspaceSeed.boardState.accelerator.completedStepIds.length &&
    completedStepIds.every((id, index) => id === workspaceSeed.boardState.accelerator.completedStepIds[index])
  ) {
    return workspaceSeed
  }

  return {
    ...workspaceSeed,
    boardState: {
      ...workspaceSeed.boardState,
      accelerator: {
        activeStepId: activeStep?.id ?? null,
        completedStepIds,
      },
    },
  }
}

export function applyWorkspaceOnboardingStageToSeed<
  TSeed extends WorkspaceSeedWithAcceleratorBoardState,
>(
  workspaceSeed: TSeed,
  onboardingStageOverride: ReturnType<
    typeof resolveWorkspaceOnboardingStageFromSearchParam
  >
) {
  if (!onboardingStageOverride) return workspaceSeed
  return {
    ...workspaceSeed,
    boardState: applyWorkspaceOnboardingStageOverride(
      workspaceSeed.boardState,
      onboardingStageOverride
    ),
  }
}

export function applyWorkspaceTutorialActivationToSeed<
  TSeed extends WorkspaceSeedWithAcceleratorBoardState,
>(
  workspaceSeed: TSeed,
  {
    initialOnboardingRequired,
    workspaceOnboardingActive,
    workspaceTutorialRequested,
    workspaceOnboardingCompletedAt,
  }: {
    initialOnboardingRequired: boolean
    workspaceOnboardingActive: boolean
    workspaceTutorialRequested: boolean
    workspaceOnboardingCompletedAt: string | null
  }
) {
  if (initialOnboardingRequired) return workspaceSeed

  if (workspaceOnboardingCompletedAt) {
    if (hasCompletedWorkspaceTutorial(workspaceSeed.boardState)) {
      return workspaceSeed
    }

    return {
      ...workspaceSeed,
      boardState: buildCompletedWorkspaceTutorialBoardState(
        workspaceSeed.boardState
      ),
    }
  }
  const shouldActivateTutorial =
    workspaceOnboardingActive || workspaceTutorialRequested

  if (!shouldActivateTutorial) return workspaceSeed

  const shouldRestartCompletedTutorial = workspaceOnboardingActive

  if (
    hasCompletedWorkspaceTutorial(workspaceSeed.boardState) &&
    shouldRestartCompletedTutorial
  ) {
    return {
      ...workspaceSeed,
      boardState: buildRestartedWorkspaceTutorialBoardState(
        workspaceSeed.boardState
      ),
    }
  }

  if (hasCompletedWorkspaceTutorial(workspaceSeed.boardState))
    return workspaceSeed

  const connectionMap = new Map(
    workspaceSeed.boardState.connections.map((connection) => [
      `${connection.source}->${connection.target}`,
      connection,
    ])
  )
  for (const connection of buildDefaultWorkspaceConnections()) {
    const key = `${connection.source}->${connection.target}`
    if (!connectionMap.has(key)) {
      connectionMap.set(key, connection)
    }
  }

  return {
    ...workspaceSeed,
    boardState: {
      ...workspaceSeed.boardState,
      connections: Array.from(connectionMap.values()),
      onboardingFlow: {
        ...workspaceSeed.boardState.onboardingFlow,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    },
  }
}
