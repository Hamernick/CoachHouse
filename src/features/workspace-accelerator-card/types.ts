import type {
  ModuleAssignmentField,
  ModuleAssignmentSubmission,
  ModuleResource,
} from "@/lib/modules"
import type { AcceleratorReadinessSummary } from "@/lib/accelerator/readiness"
import type { OnboardingFlowDefaults } from "@/components/onboarding/onboarding-dialog/types"

export const WORKSPACE_ACCELERATOR_STEP_STATUS = [
  "not_started",
  "in_progress",
  "completed",
] as const
export type WorkspaceAcceleratorStepStatus =
  (typeof WORKSPACE_ACCELERATOR_STEP_STATUS)[number]

export type WorkspaceAcceleratorCardSize = "sm" | "md" | "lg"
export const WORKSPACE_ACCELERATOR_STEP_KIND = [
  "lesson",
  "video",
  "resources",
  "assignment",
  "deck",
  "complete",
] as const
export type WorkspaceAcceleratorStepKind =
  (typeof WORKSPACE_ACCELERATOR_STEP_KIND)[number]

export type WorkspaceAcceleratorCardStepResource = {
  id: string
  title: string
  url: string
  kind: string
}

export type WorkspaceAcceleratorCardStep = {
  id: string
  moduleId: string
  published?: boolean
  moduleSlug?: string | null
  moduleTitle: string
  stepKind: WorkspaceAcceleratorStepKind
  stepTitle: string
  stepDescription: string | null
  assignmentSectionId?: string | null
  href: string
  status: WorkspaceAcceleratorStepStatus
  stepSequenceIndex: number
  stepSequenceTotal: number
  moduleSequenceIndex: number
  moduleSequenceTotal: number
  groupTitle: string
  groupOrder?: number | null
  videoUrl: string | null
  durationMinutes: number | null
  resources: WorkspaceAcceleratorCardStepResource[]
  hasAssignment: boolean
  hasDeck: boolean
  moduleContext?: WorkspaceAcceleratorModuleContext | null
}

export type WorkspaceAcceleratorModuleContext = {
  classTitle: string
  lessonNotesContent: string | null
  moduleResources: ModuleResource[]
  assignmentFields: ModuleAssignmentField[]
  assignmentSubmission: ModuleAssignmentSubmission | null
  completeOnSubmit: boolean
  workspaceOnboarding?: {
    view: "welcome" | "organization-setup"
    defaults?: OnboardingFlowDefaults | null
  } | null
}

export type WorkspaceAcceleratorTimelineModuleSeed = {
  completedStepIds?: string[]
  id: string
  published?: boolean
  slug?: string | null
  title: string
  description: string | null
  href: string
  status: WorkspaceAcceleratorStepStatus
  groupTitle: string
  groupOrder?: number | null
  videoUrl: string | null
  durationMinutes: number | null
  resources: WorkspaceAcceleratorCardStepResource[]
  hasAssignment: boolean
  hasDeck: boolean
  moduleContext?: WorkspaceAcceleratorModuleContext | null
}

export type WorkspaceAcceleratorCardInput = {
  steps: WorkspaceAcceleratorCardStep[]
  size: WorkspaceAcceleratorCardSize
  readinessSummary?: AcceleratorReadinessSummary | null
  linkHrefOverride?: string | null
  allowAutoResize?: boolean
  storageKey?: string
  onSizeChange?: (nextSize: WorkspaceAcceleratorCardSize) => void
  initialCurrentStepId?: string | null
  initialCompletedStepIds?: string[]
  onStepComplete?: (moduleId: string, stepId: string) => Promise<{ ok: true } | { error: string }>
  onModuleComplete?: (moduleId: string) => Promise<{ ok: true } | { error: string }>
  onProgressChange?: (state: WorkspaceAcceleratorCardProgressState) => void
  onWorkspaceOnboardingSubmit?: (form: FormData) => Promise<void>
}

export type WorkspaceAcceleratorCardProgressState = {
  currentStepId: string | null
  completedStepIds: string[]
}

export type WorkspaceAcceleratorOpenStepRequest = {
  id: number
  stepId: string
  moduleId: string
  lessonGroupKey?: string | null
}

export type WorkspaceAcceleratorLessonGroupSummary = {
  key: string
  label: string
}

export type WorkspaceAcceleratorCardRuntimeSnapshot = {
  currentStep: WorkspaceAcceleratorCardStep | null
  currentIndex: number
  totalSteps: number
  canGoPrevious: boolean
  canGoNext: boolean
  currentModuleStepIndex: number
  currentModuleStepTotal: number
  currentModuleCompletedCount: number
  isCurrentModuleCompleted: boolean
  isCurrentStepCompleted: boolean
  selectedLessonGroupKey?: string | null
  selectedLessonGroupLabel?: string | null
  lessonGroupOptions?: WorkspaceAcceleratorLessonGroupSummary[]
  firstVisibleChecklistStepId?: string | null
  isModuleViewerOpen?: boolean
  openModuleId?: string | null
  placeholderVideoUrl?: string | null
  readinessSummary?: AcceleratorReadinessSummary | null
  checklistModuleCount?: number
  filteredStepCount?: number
  filteredProgressPercent?: number
}

export type WorkspaceAcceleratorTutorialFocus =
  | "picker"
  | "progress"
  | "first-module"
  | "close-module"

export type WorkspaceAcceleratorTutorialCallout = {
  focus: WorkspaceAcceleratorTutorialFocus
  title: string
  instruction: string
}

export const WORKSPACE_ACCELERATOR_TUTORIAL_BLOCKED_MESSAGE =
  "We'll go over this soon, I promise! :)"
export const WORKSPACE_ACCELERATOR_TUTORIAL_BLOCKED_MESSAGE_DURATION_MS = 3000

export type WorkspaceAcceleratorTutorialBlockedAction =
  | "class-selection"
  | "step-selection"
  | "module-open"
  | "preview-navigation"
  | "preview-close"
  | "preview-link"
  | "preview-submit"

export type WorkspaceAcceleratorTutorialInteractionPolicy = {
  stepId:
    | "accelerator"
    | "accelerator-picker"
    | "accelerator-first-module"
    | "accelerator-close-module"
  allowedClassGroupKey: string
  allowClassDropdownOpen: boolean
  allowClassSelection: boolean
  allowAccordionToggle: boolean
  allowedModuleId: string | null
  allowedStepId: string | null
  allowPreviewPlayback: boolean
  allowPreviewNavigation: boolean
  allowPreviewClose: boolean
  allowPreviewLinks: boolean
  allowPreviewSubmit: boolean
  blockedMessage: string
  blockedMessageDurationMs: number
}

export type WorkspaceAcceleratorCardRuntimeActions = {
  goPrevious: () => void
  goNext: () => void
  markCurrentStepComplete: () => Promise<boolean>
  selectLessonGroup: (nextLessonGroupKey: string) => void
}
