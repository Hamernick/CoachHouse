"use client"

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import { listenForWorkspaceRoadmapDrawerRequests } from "@/lib/workspace/data-drawer-events"
import { getWorkspaceAcceleratorPaywallPath } from "@/lib/workspace/routes"

import { resolveWorkspaceAcceleratorReadinessSummary } from "../../workspace-board-accelerator-card-helpers"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"

type WorkspaceAcceleratorDrawerArgs = Pick<
  WorkspaceCanvasSurfaceV2Props,
  | "boardState"
  | "seed"
  | "organizationEditorData"
  | "onAcceleratorStateChange"
  | "onInitialOnboardingSubmit"
>

function resolveInitialWorkspaceDataDrawerRequest(
  organizationEditorData: WorkspaceAcceleratorDrawerArgs["organizationEditorData"]
): Omit<WorkspaceDataDrawerRequest, "id"> | null {
  const initialDrawerTab =
    organizationEditorData.initialDrawerTab ??
    (organizationEditorData.initialProfileTab ? "organization" : null)

  if (initialDrawerTab === "organization") {
    return {
      tab: "organization",
      organizationTab: organizationEditorData.initialProfileTab ?? "company",
      organizationProgramId: organizationEditorData.initialProgramId,
      organizationFocus: organizationEditorData.initialFocus,
      organizationEditMode: organizationEditorData.initialEditMode,
    }
  }

  if (initialDrawerTab === "accelerator") {
    return {
      tab: "accelerator",
      acceleratorStepId: organizationEditorData.initialAcceleratorStepId,
      acceleratorModuleId: organizationEditorData.initialAcceleratorModuleId,
      acceleratorLessonGroupKey: organizationEditorData.initialAcceleratorGroup,
    }
  }

  if (initialDrawerTab === "roadmap") {
    return {
      tab: "roadmap",
      roadmapSectionSlug: organizationEditorData.initialRoadmapSectionSlug,
    }
  }

  if (initialDrawerTab === "documents") {
    return {
      tab: "documents",
      focusKey: organizationEditorData.initialFocus,
    }
  }

  if (initialDrawerTab === "people") {
    return { tab: "people" }
  }

  if (initialDrawerTab === "finance") {
    return { tab: "finance" }
  }

  if (initialDrawerTab === "tools") {
    return { tab: "tools" }
  }

  if (initialDrawerTab === "particles") {
    return { tab: "particles" }
  }

  return null
}

export function useWorkspaceAcceleratorDrawer({
  boardState,
  seed,
  organizationEditorData,
  onAcceleratorStateChange,
  onInitialOnboardingSubmit,
}: WorkspaceAcceleratorDrawerArgs) {
  const initialDrawerRequest = resolveInitialWorkspaceDataDrawerRequest(
    organizationEditorData
  )
  const initialDrawerRequestSignature = initialDrawerRequest
    ? JSON.stringify(initialDrawerRequest)
    : null
  const requestIdRef = useRef(initialDrawerRequest ? 1 : 0)
  const [request, setRequest] = useState<WorkspaceDataDrawerRequest | null>(
    () =>
      initialDrawerRequest
        ? {
            id: 1,
            ...initialDrawerRequest,
          }
        : null
  )
  const handledInitialDrawerRequestRef = useRef(initialDrawerRequestSignature)
  const open = useCallback(
    (nextRequest: Omit<WorkspaceDataDrawerRequest, "id">) => {
      requestIdRef.current += 1
      setRequest({
        ...nextRequest,
        id: requestIdRef.current,
      })
    },
    []
  )
  useEffect(
    () =>
      listenForWorkspaceRoadmapDrawerRequests((nextRequest) => {
        open(nextRequest)
      }),
    [open]
  )
  useEffect(() => {
    if (
      handledInitialDrawerRequestRef.current === initialDrawerRequestSignature
    ) {
      return
    }

    handledInitialDrawerRequestRef.current = initialDrawerRequestSignature
    const nextRequest = resolveInitialWorkspaceDataDrawerRequest(
      organizationEditorData
    )
    if (!nextRequest) return

    open(nextRequest)
  }, [initialDrawerRequestSignature, open, organizationEditorData])
  const onProgressChange = useCallback<
    NonNullable<WorkspaceAcceleratorCardInput["onProgressChange"]>
  >(
    (nextProgress) => {
      startTransition(() => {
        onAcceleratorStateChange({
          activeStepId: nextProgress.currentStepId,
          completedStepIds: nextProgress.completedStepIds,
        })
      })
    },
    [onAcceleratorStateChange]
  )
  const readinessSummary = useMemo(
    () =>
      resolveWorkspaceAcceleratorReadinessSummary({
        acceleratorState: boardState.accelerator,
        programs: organizationEditorData.programs.map((program) => ({
          goal_cents: program.goal_cents ?? null,
        })),
        seed,
      }),
    [boardState.accelerator, organizationEditorData.programs, seed]
  )
  const input = useMemo<WorkspaceAcceleratorCardInput>(
    () => ({
      steps: seed.acceleratorTimeline ?? [],
      size: "lg",
      readinessSummary,
      allowAutoResize: false,
      storageKey: `${seed.orgId}:${seed.viewerId}`,
      initialCurrentStepId: boardState.accelerator.activeStepId,
      initialCompletedStepIds: boardState.accelerator.completedStepIds,
      onProgressChange,
      onWorkspaceOnboardingSubmit: onInitialOnboardingSubmit,
    }),
    [
      boardState.accelerator.activeStepId,
      boardState.accelerator.completedStepIds,
      onInitialOnboardingSubmit,
      onProgressChange,
      readinessSummary,
      seed.acceleratorTimeline,
      seed.orgId,
      seed.viewerId,
    ]
  )

  return {
    workspaceAcceleratorDrawerInput: input,
    workspaceAcceleratorDrawerRoadmapSections:
      organizationEditorData.roadmapSections,
    workspaceAcceleratorDrawerHasAccess: seed.hasAcceleratorAccess,
    workspaceAcceleratorDrawerPaywallHref:
      getWorkspaceAcceleratorPaywallPath("workspace-drawer"),
    workspaceDataDrawerRequest: request,
    onOpenWorkspaceDataDrawer: open,
  }
}
