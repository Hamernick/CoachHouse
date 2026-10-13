import type { ReactNode } from "react"

import type { RoadmapSection } from "@/lib/roadmap"

import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorOpenStepRequest,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"

export type WorkspaceAcceleratorCardPanelProps = {
  overviewOnly?: boolean
  workspaceOverviewNotice?: ReactNode
  input: WorkspaceAcceleratorCardInput
  roadmapSections?: RoadmapSection[]
  roadmapBasePath?: string
  presentationMode?: "embedded" | "fullscreen-route" | "workspace-drawer"
  initialModuleViewerOpen?: boolean
  initialOpenModuleId?: string | null
  openStepRequest?: WorkspaceAcceleratorOpenStepRequest | null
  onOpenStepRequestHandled?: (requestId: number) => void
  onRuntimeChange?: (snapshot: WorkspaceAcceleratorCardRuntimeSnapshot) => void
  onRuntimeActionsChange?: (
    actions: WorkspaceAcceleratorCardRuntimeActions
  ) => void
  onRequestOpenStep?: (args: {
    step: WorkspaceAcceleratorCardStep
    selectedLessonGroupKey: string | null
  }) => boolean | void
  onModuleViewerClose?: () => void
  tutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  tutorialMode?: "module-preview" | null
  showEmbeddedClassPicker?: boolean
  drawerContainer?: HTMLElement | null
  workspaceDrawerHeader?: ReactNode
  onTutorialActionComplete?: (
    mode?: "complete" | "complete-and-advance"
  ) => void
}
