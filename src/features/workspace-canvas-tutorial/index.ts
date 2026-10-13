export {
  WorkspaceCanvasTutorialNode,
  WorkspaceCanvasTutorialPanel,
} from "./public-components"
export {
  WORKSPACE_CANVAS_TUTORIAL_MANAGED_CARD_IDS,
  buildWorkspaceCanvasTutorialCompletionHiddenCardIds,
  clampWorkspaceCanvasTutorialStepIndex,
  resolveWorkspaceCanvasTutorialCallout,
  isWorkspaceCanvasTutorialFinalStep,
  isWorkspaceCanvasTutorialGatedStep,
  isWorkspaceCanvasTutorialStepAcknowledged,
  isWorkspaceCanvasTutorialStepCompleted,
  isWorkspaceCanvasTutorialStepOpened,
  resolveWorkspaceCanvasTutorialActiveVisibleCardIds,
  resolveWorkspaceCanvasTutorialContinueMode,
  resolveWorkspaceCanvasTutorialHighlightShortcutButtons,
  resolveWorkspaceCanvasTutorialProgressPercent,
  resolveWorkspaceCanvasTutorialPromptTargetCardId,
  resolveWorkspaceCanvasTutorialSceneFocusCardIds,
  resolveWorkspaceCanvasTutorialSelectedCardId,
  resolveWorkspaceCanvasTutorialShortcutInstruction,
  resolveWorkspaceCanvasTutorialStep,
  resolveWorkspaceCanvasTutorialStepCount,
  resolveWorkspaceCanvasTutorialTrimmedStepIds,
  resolveWorkspaceCanvasTutorialVisibleCardIds,
} from "./lib"
export type {
  WorkspaceCanvasTutorialCallout,
  WorkspaceCanvasTutorialCardId,
  WorkspaceCanvasTutorialNodeData,
  WorkspaceCanvasTutorialPresentationSurface,
  WorkspaceCanvasTutorialPresentationChrome,
  WorkspaceCanvasTutorialPresentationMaskLayout,
  WorkspaceCanvasTutorialNodeVariant,
  WorkspaceCanvasTutorialProgress,
  WorkspaceCanvasTutorialSceneId,
  WorkspaceCanvasTutorialStep,
  WorkspaceCanvasTutorialStepId,
} from "./types"

export { WorkspaceSetupGuide } from "./components/workspace-setup-guide"

export { setupGuideStackViewport } from "./lib/setup-guide-stack"
