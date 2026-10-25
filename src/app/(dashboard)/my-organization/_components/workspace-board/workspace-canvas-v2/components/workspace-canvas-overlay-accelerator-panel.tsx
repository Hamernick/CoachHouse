"use client"

import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { OrganizationLaunchPanel, type OrganizationLaunchInput } from "@/features/organization-launch/client"
import { WorkspaceAcceleratorBanner, isWorkspaceAcceleratorControllerStepVisible } from "@/features/workspace-accelerator-card"
import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorOpenStepRequest,
} from "@/features/workspace-accelerator-card"
import type { RoadmapSection } from "@/lib/roadmap"
import { WORKSPACE_ROADMAP_PATH } from "@/lib/workspace/routes"

import {
  buildWorkspaceBoardUiPreferencesStorageKey,
  patchWorkspaceBoardUiPreferences,
  readWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
} from "../../workspace-board-ui-preferences"
import { WorkspaceBoardLazyAcceleratorCardPanel } from "../../workspace-board-accelerator-lazy"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"

export function WorkspaceCanvasOverlayAcceleratorPanel({
  input,
  uiPreferencesScope,
  organizationLaunch,
  roadmapSections,
  hasAccess,
  request,
  onRequestHandled,
  drawerContainer,
}: {
  organizationLaunch: OrganizationLaunchInput
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  input: WorkspaceAcceleratorCardInput
  roadmapSections: RoadmapSection[]
  hasAccess: boolean
  paywallHref: string
  request: WorkspaceDataDrawerRequest | null
  drawerContainer?: HTMLElement | null
  onRequestHandled: (requestId: number) => void
}) {
  const searchParams = useSearchParams()
  const guideOverview = searchParams.get("guide") === "1"
  const openStepRequest =
    useMemo<WorkspaceAcceleratorOpenStepRequest | null>(() => {
      if (
        !hasAccess || guideOverview || request?.tab !== "accelerator" ||
        !request.acceleratorModuleId
      ) {
        return null
      }

      const stepId = request.acceleratorStepId ?? input.steps.find((step) => step.moduleId === request.acceleratorModuleId && isWorkspaceAcceleratorControllerStepVisible(step))?.id
      if (!stepId) return null
      return {
        id: request.id,
        stepId,
        moduleId: request.acceleratorModuleId,
        lessonGroupKey: request.acceleratorLessonGroupKey ?? null,
      }
    }, [request, guideOverview, hasAccess, input.steps])
  const requestedModuleId =
    hasAccess && !guideOverview && request?.tab === "accelerator"
      ? (request.acceleratorModuleId ?? null)
      : null
  const panelInput = useMemo<WorkspaceAcceleratorCardInput>(
    () =>
      !hasAccess
        ? { ...input, onProgressChange: undefined, onModuleComplete: undefined, onWorkspaceOnboardingSubmit: undefined }
        : openStepRequest
        ? {
            ...input,
            initialCurrentStepId: openStepRequest.stepId,
          }
        : input,
    [input, openStepRequest, hasAccess]
  )
  const [isModuleViewerOpen, setIsModuleViewerOpen] = useState(false)
  const handleRuntimeChange = useCallback(
    (snapshot: WorkspaceAcceleratorCardRuntimeSnapshot) => {
      setIsModuleViewerOpen(Boolean(snapshot.isModuleViewerOpen))
    },
    []
  )
  const showBanner = guideOverview || (!requestedModuleId && !isModuleViewerOpen)
  const preferenceKey = buildWorkspaceBoardUiPreferencesStorageKey(uiPreferencesScope)
  const { orgId, viewerId } = uiPreferencesScope
  const [introduction, setIntroduction] = useState<{ key: string; dismissed: boolean } | null>(null)
  useEffect(() => {
    setIntroduction({
      key: preferenceKey,
      dismissed: readWorkspaceBoardUiPreferences({ orgId, viewerId }).acceleratorIntroductionDismissed,
    })
  }, [preferenceKey, orgId, viewerId])
  const panelRef = useRef<HTMLDivElement>(null)
  const introductionFocusRequested = useRef(false)
  useEffect(() => {
    if (!introductionFocusRequested.current) return
    introductionFocusRequested.current = false
    panelRef.current?.focus({ preventScroll: true })
  }, [introduction])
  const setIntroductionDismissed = (dismissed: boolean) => {
    introductionFocusRequested.current = true
    patchWorkspaceBoardUiPreferences(uiPreferencesScope, { acceleratorIntroductionDismissed: dismissed })
    setIntroduction({ key: preferenceKey, dismissed })
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      data-workspace-accelerator-drawer-panel="true"
      data-workspace-accelerator-request-step={
        openStepRequest?.stepId ?? undefined
      }
      data-workspace-accelerator-request-module={requestedModuleId ?? undefined}
      className={isModuleViewerOpen && drawerContainer
        ? "hidden"
        : "box-border flex h-full min-h-0 w-full min-w-0 flex-col px-2"}
    >
      <div className="flex min-h-0 flex-1">
        <WorkspaceBoardLazyAcceleratorCardPanel
          key={guideOverview ? "guide-overview" : "accelerator"}
          input={panelInput}
          overviewOnly={!hasAccess}
          workspaceOverviewNotice={!hasAccess ? (
            <FeatureUpgradeNotice title="Build with the Accelerator">
              Upgrade to unlock organization setup, guided lessons, checklists, and frameworks.
            </FeatureUpgradeNotice>
          ) : null}
          roadmapSections={roadmapSections}
          roadmapBasePath={WORKSPACE_ROADMAP_PATH}
          presentationMode="workspace-drawer"
          drawerContainer={drawerContainer}
          initialModuleViewerOpen={Boolean(requestedModuleId)}
          initialOpenModuleId={requestedModuleId}
          openStepRequest={openStepRequest}
          onOpenStepRequestHandled={onRequestHandled}
          onRuntimeChange={handleRuntimeChange}
          showEmbeddedClassPicker
          workspaceDrawerHeader={
            showBanner ? (
              <div className="contents">
                {introduction?.key === preferenceKey && !introduction.dismissed ? (
                  <WorkspaceAcceleratorBanner onDismiss={() => setIntroductionDismissed(true)} />
                ) : null}
                <OrganizationLaunchPanel input={organizationLaunch} hasAccess={hasAccess} />
              </div>
            ) : null
          }
        />
      </div>
    </div>
  )
}
