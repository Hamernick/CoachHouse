import type { WorkspaceBoardNodeData } from "./workspace-board-node"

type WorkspaceBoardCardProps = {
  data: WorkspaceBoardNodeData
  selected?: boolean
  yPos?: number
}

export function workspaceBoardCardPropsEqual(
  previous: WorkspaceBoardCardProps,
  next: WorkspaceBoardCardProps
) {
  const prevData = previous.data
  const nextData = next.data

  if (previous.selected !== next.selected) return false
  if (previous.yPos !== next.yPos) return false
  if (prevData === nextData) return true
  if (prevData.cardId !== nextData.cardId) return false
  if (prevData.size !== nextData.size) return false
  if (prevData.canEdit !== nextData.canEdit) return false
  if (prevData.presentationMode !== nextData.presentationMode) return false
  if (prevData.isCanvasFullscreen !== nextData.isCanvasFullscreen) return false
  if (prevData.seed !== nextData.seed) return false
  if (prevData.isJourneyTarget !== nextData.isJourneyTarget) return false
  if (prevData.onSizeChange !== nextData.onSizeChange) return false
  if (prevData.onCommunicationsChange !== nextData.onCommunicationsChange)
    return false
  if (prevData.onTrackerChange !== nextData.onTrackerChange) return false
  if (prevData.onFocusCard !== nextData.onFocusCard) return false
  if (prevData.onOpenCard !== nextData.onOpenCard) return false
  if (prevData.onHideCard !== nextData.onHideCard) return false
  if (prevData.ontologyRootControl !== nextData.ontologyRootControl)
    return false
  if (prevData.onMeasuredHeightChange !== nextData.onMeasuredHeightChange) {
    return false
  }
  if (prevData.onToggleCanvasFullscreen !== nextData.onToggleCanvasFullscreen)
    return false
  if (prevData.organizationEditorData !== nextData.organizationEditorData)
    return false
  if (prevData.cardId === "organization-overview") {
    if (
      prevData.organizationShortcutItems !== nextData.organizationShortcutItems
    ) {
      return false
    }
    if (
      prevData.organizationMapButtonCallout !==
      nextData.organizationMapButtonCallout
    ) {
      return false
    }
    if (
      prevData.onOrganizationMapButtonTutorialComplete !==
      nextData.onOrganizationMapButtonTutorialComplete
    ) {
      return false
    }
  }

  if (prevData.tutorialStepId !== nextData.tutorialStepId) return false

  if (prevData.cardId === "communications") {
    if (prevData.communications !== nextData.communications) return false
  }

  if (prevData.cardId === "accelerator") {
    if (prevData.acceleratorState !== nextData.acceleratorState) return false
    if (
      prevData.onAcceleratorStateChange !== nextData.onAcceleratorStateChange
    ) {
      return false
    }
    if (
      prevData.acceleratorStepNodeVisible !==
      nextData.acceleratorStepNodeVisible
    ) {
      return false
    }
    if (
      prevData.onOpenAcceleratorStepNode !== nextData.onOpenAcceleratorStepNode
    ) {
      return false
    }
    if (
      prevData.onHideAcceleratorStepNode !== nextData.onHideAcceleratorStepNode
    ) {
      return false
    }
    if (
      prevData.onAcceleratorRuntimeChange !==
      nextData.onAcceleratorRuntimeChange
    ) {
      return false
    }
    if (
      prevData.onAcceleratorRuntimeActionsChange !==
      nextData.onAcceleratorRuntimeActionsChange
    ) {
      return false
    }
    if (
      prevData.acceleratorTutorialCallout !==
      nextData.acceleratorTutorialCallout
    ) {
      return false
    }
    if (
      prevData.acceleratorTutorialInteractionPolicy !==
      nextData.acceleratorTutorialInteractionPolicy
    ) {
      return false
    }
    if (
      prevData.onAcceleratorTutorialActionComplete !==
      nextData.onAcceleratorTutorialActionComplete
    ) {
      return false
    }
    if (
      prevData.onWorkspaceOnboardingSubmit !==
      nextData.onWorkspaceOnboardingSubmit
    ) {
      return false
    }
    if (prevData.journeyGuideState !== nextData.journeyGuideState) return false
  }

  return true
}
