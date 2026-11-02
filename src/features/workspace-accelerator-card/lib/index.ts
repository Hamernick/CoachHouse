import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorCardSize,
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorStepKind,
  WorkspaceAcceleratorCardStepResource,
  WorkspaceAcceleratorStepStatus,
  WorkspaceAcceleratorTimelineModuleSeed,
} from "../types"
import {
  buildAssignmentSections,
  type AssignmentSection,
} from "@/lib/modules/assignment-sections"
import { WORKSPACE_ACCELERATOR_PATH } from "@/lib/workspace/routes"

export {
  buildWorkspaceAcceleratorChecklistModules,
  buildWorkspaceAcceleratorLessonGroupKey,
  buildWorkspaceAcceleratorLessonGroupOptions,
  calculateWorkspaceAcceleratorChecklistProgressPercent,
  formatWorkspaceAcceleratorModuleCompletionLabel,
  isWorkspaceAcceleratorChecklistModuleComplete,
  resolveWorkspaceAcceleratorOpenModuleId,
  resolveWorkspaceAcceleratorLessonGroupTitle,
  resolveWorkspaceAcceleratorGuidedFirstModuleStepId,
  isWorkspaceAcceleratorOrganizationSetupStep,
  shouldHideWorkspaceAcceleratorFormationAddOnStep,
} from "./checklist"
export {
  areWorkspaceAcceleratorRuntimeSnapshotsEqual,
  buildWorkspaceAcceleratorRuntimeStepSignature,
} from "./runtime-snapshot"
export type {
  WorkspaceAcceleratorChecklistModule,
  WorkspaceAcceleratorLessonGroupOption,
} from "./checklist"

const EMPTY_ACCELERATOR_STEPS: WorkspaceAcceleratorCardStep[] = []
const EMPTY_COMPLETED_STEP_IDS: string[] = []

export function isWorkspaceAcceleratorControllerStepVisible(
  step: WorkspaceAcceleratorCardStep
) {
  return (
    (step.stepKind !== "lesson" ||
      Boolean(step.moduleContext?.workspaceOnboarding)) &&
    step.stepKind !== "complete"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeStepStatus(value: unknown): WorkspaceAcceleratorStepStatus {
  if (value === "completed" || value === "in_progress") return value
  return "not_started"
}

function resolveDerivedStepStatus(
  moduleStatus: WorkspaceAcceleratorStepStatus,
  stepKind: WorkspaceAcceleratorStepKind
): WorkspaceAcceleratorStepStatus {
  if (moduleStatus === "completed") return "completed"
  if (moduleStatus === "not_started") return "not_started"
  if (stepKind === "lesson" || stepKind === "video") return "in_progress"
  return "not_started"
}

function buildModuleStepKinds(
  module: WorkspaceAcceleratorTimelineModuleSeed
): WorkspaceAcceleratorStepKind[] {
  if (module.moduleContext?.workspaceOnboarding) {
    return ["lesson"]
  }

  const hasAssignmentOverview = buildAssignmentStepSections(module).some(
    (section) => section.id === "assignment-overview"
  )
  const next: WorkspaceAcceleratorStepKind[] = ["lesson"]
  if (module.videoUrl) next.push("video")
  if (
    !hasAssignmentOverview &&
    (module.resources.length > 0 || module.hasDeck)
  ) {
    next.push("resources")
  }
  if (module.hasAssignment) next.push("assignment")
  next.push("complete")
  return next
}

function resolveStepTitle(stepKind: WorkspaceAcceleratorStepKind) {
  if (stepKind === "lesson") return "Class"
  if (stepKind === "video") return "Video"
  if (stepKind === "resources") return "Resources"
  if (stepKind === "assignment") return "Assignment"
  if (stepKind === "complete") return "Complete"
  return "Deck"
}

function resolveStepDescription({
  stepKind,
  moduleDescription,
  resourceCount,
  hasDeck,
}: {
  stepKind: WorkspaceAcceleratorStepKind
  moduleDescription: string | null
  resourceCount: number
  hasDeck: boolean
}) {
  if (stepKind === "lesson") return moduleDescription
  if (stepKind === "video") return "Watch the core walkthrough for this class."
  if (stepKind === "resources") {
    if (resourceCount > 0 && hasDeck)
      return `${resourceCount} linked resources and deck materials`
    if (resourceCount > 0) return `${resourceCount} linked resources`
    if (hasDeck) return "Deck materials available."
    return "No resources attached yet."
  }
  if (stepKind === "assignment")
    return "Complete the assignment to move this lesson forward."
  if (stepKind === "complete")
    return "Mark this lesson complete and continue to the next lesson."
  if (hasDeck) return "Review supporting deck materials."
  return null
}

function buildAssignmentStepSections(
  module: WorkspaceAcceleratorTimelineModuleSeed
): AssignmentSection[] {
  const fields = module.moduleContext?.assignmentFields ?? []
  if (fields.length === 0) return []
  return buildAssignmentSections(fields).tabSections.filter(
    (section) =>
      section.fields.length > 0 ||
      Boolean(section.title?.trim() || section.description?.trim())
  )
}

function normalizeResourceKind(value: unknown) {
  if (typeof value !== "string") return "link"
  const normalized = value.trim().toLowerCase()
  if (!normalized) return "link"
  return normalized
}

function normalizeResourceTitle(
  record: Record<string, unknown>,
  index: number,
  fallbackUrl: string
) {
  const candidate =
    typeof record.title === "string"
      ? record.title
      : typeof record.label === "string"
        ? record.label
        : typeof record.name === "string"
          ? record.name
          : ""

  if (candidate.trim()) return candidate.trim()
  try {
    const parsed = new URL(fallbackUrl)
    return parsed.hostname.replace(/^www\./, "") || `Resource ${index + 1}`
  } catch {
    return `Resource ${index + 1}`
  }
}

export function normalizeWorkspaceAcceleratorResources(
  value: unknown
): WorkspaceAcceleratorCardStepResource[] {
  if (!Array.isArray(value)) return []

  const dedupe = new Set<string>()
  const next: WorkspaceAcceleratorCardStepResource[] = []

  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index]
    if (!isRecord(entry)) continue
    const url =
      typeof entry.url === "string"
        ? entry.url.trim()
        : typeof entry.href === "string"
          ? entry.href.trim()
          : ""
    if (!url) continue

    const dedupeKey = `${url.toLowerCase()}::${index}`
    if (dedupe.has(dedupeKey)) continue
    dedupe.add(dedupeKey)

    const title = normalizeResourceTitle(entry, index, url)
    const kind = normalizeResourceKind(entry.kind ?? entry.type)
    const id =
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : `resource-${index + 1}-${url}`

    next.push({
      id,
      title,
      url,
      kind,
    })
  }

  return next
}

export function buildWorkspaceAcceleratorCardSteps(
  modules: WorkspaceAcceleratorTimelineModuleSeed[]
): WorkspaceAcceleratorCardStep[] {
  const safeModules = modules.filter(
    (timelineModule) =>
      timelineModule.id && timelineModule.title && timelineModule.href
  )
  const moduleTotal = safeModules.length

  const flattened: WorkspaceAcceleratorCardStep[] = []
  for (
    let moduleIndex = 0;
    moduleIndex < safeModules.length;
    moduleIndex += 1
  ) {
    const timelineModule = safeModules[moduleIndex]!
    const moduleStatus = normalizeStepStatus(timelineModule.status)
    const moduleStepKinds = buildModuleStepKinds(timelineModule)

    for (const stepKind of moduleStepKinds) {
      const assignmentSections =
        stepKind === "assignment"
          ? buildAssignmentStepSections(timelineModule)
          : []
      if (stepKind === "assignment" && assignmentSections.length > 1) {
        assignmentSections.forEach((section, sectionIndex) => {
          flattened.push({
            id: `${timelineModule.id}:assignment:${section.id}`,
            moduleId: timelineModule.id,
            published: timelineModule.published,
            moduleSlug: timelineModule.slug ?? null,
            moduleTitle: timelineModule.title,
            stepKind,
            stepTitle: section.title ?? `Assignment ${sectionIndex + 1}`,
            stepDescription:
              section.description ??
              resolveStepDescription({
                stepKind,
                moduleDescription: timelineModule.description,
                resourceCount: timelineModule.resources.length,
                hasDeck: timelineModule.hasDeck,
              }),
            assignmentSectionId: section.id,
            href: timelineModule.href,
            status: resolveDerivedStepStatus(moduleStatus, stepKind),
            stepSequenceIndex: 0,
            stepSequenceTotal: 0,
            moduleSequenceIndex: moduleIndex + 1,
            moduleSequenceTotal: moduleTotal,
            groupTitle: timelineModule.groupTitle || "Accelerator",
            groupOrder: timelineModule.groupOrder ?? null,
            videoUrl: timelineModule.videoUrl,
            durationMinutes:
              typeof timelineModule.durationMinutes === "number"
                ? timelineModule.durationMinutes
                : null,
            resources: timelineModule.resources,
            hasAssignment: Boolean(timelineModule.hasAssignment),
            hasDeck: Boolean(timelineModule.hasDeck),
            moduleContext: timelineModule.moduleContext ?? null,
          })
        })
        continue
      }

      const workspaceOnboarding =
        timelineModule.moduleContext?.workspaceOnboarding ?? null
      const stepTitle =
        workspaceOnboarding && stepKind === "lesson"
          ? timelineModule.title
          : resolveStepTitle(stepKind)

      flattened.push({
        id: `${timelineModule.id}:${stepKind}`,
        moduleId: timelineModule.id,
        published: timelineModule.published,
        moduleSlug: timelineModule.slug ?? null,
        moduleTitle: timelineModule.title,
        stepKind,
        stepTitle,
        stepDescription: resolveStepDescription({
          stepKind,
          moduleDescription: timelineModule.description,
          resourceCount: timelineModule.resources.length,
          hasDeck: timelineModule.hasDeck,
        }),
        assignmentSectionId:
          stepKind === "assignment"
            ? (assignmentSections[0]?.id ?? null)
            : null,
        href: timelineModule.href,
        status: resolveDerivedStepStatus(moduleStatus, stepKind),
        stepSequenceIndex: 0,
        stepSequenceTotal: 0,
        moduleSequenceIndex: moduleIndex + 1,
        moduleSequenceTotal: moduleTotal,
        groupTitle: timelineModule.groupTitle || "Accelerator",
        groupOrder: timelineModule.groupOrder ?? null,
        videoUrl: timelineModule.videoUrl,
        durationMinutes:
          typeof timelineModule.durationMinutes === "number"
            ? timelineModule.durationMinutes
            : null,
        resources: timelineModule.resources,
        hasAssignment: Boolean(timelineModule.hasAssignment),
        hasDeck: Boolean(timelineModule.hasDeck),
        moduleContext: timelineModule.moduleContext ?? null,
      })
    }
  }

  const stepTotal = flattened.length
  const savedStepIds = new Set(safeModules.flatMap((module) => module.completedStepIds ?? []))
  return flattened.map((step, index) => ({
    ...step,
    status: savedStepIds.has(step.id) ? "completed" : step.status,
    stepSequenceIndex: index + 1,
    stepSequenceTotal: stepTotal,
  }))
}

export function resolveWorkspaceAcceleratorCardTargetSize(
  _step: WorkspaceAcceleratorCardStep | null
): WorkspaceAcceleratorCardSize {
  return "sm"
}

export function normalizeWorkspaceAcceleratorCardInput(
  input: WorkspaceAcceleratorCardInput
): WorkspaceAcceleratorCardInput {
  const normalizedSteps = Array.isArray(input.steps)
    ? input.steps
    : EMPTY_ACCELERATOR_STEPS
  const resolveInitialCurrentStepId = (value: unknown): string | null => {
    if (typeof value !== "string" || value.trim().length === 0) return null
    const trimmed = value.trim()
    if (normalizedSteps.some((step) => step.id === trimmed)) return trimmed
    if (trimmed.endsWith(":assignment")) {
      return (
        normalizedSteps.find((step) => step.id.startsWith(`${trimmed}:`))?.id ??
        null
      )
    }
    return trimmed
  }
  const normalizeInitialCompletedStepIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return EMPTY_COMPLETED_STEP_IDS
    if (value.length === 0) return EMPTY_COMPLETED_STEP_IDS

    let needsFilteredCopy = false
    for (const entry of value) {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        needsFilteredCopy = true
        break
      }
    }

    if (!needsFilteredCopy) return value as string[]

    const next: string[] = []
    for (const entry of value) {
      if (typeof entry !== "string") continue
      if (entry.trim().length === 0) continue
      next.push(entry)
    }
    return next
  }

  const explicitCompletedStepIds = normalizeInitialCompletedStepIds(
    input.initialCompletedStepIds
  )
  const completedStepIdsFromStatuses = normalizedSteps
    .filter((step) => step.status === "completed")
    .map((step) => step.id)
  const initialCompletedStepIds = Array.from(
    new Set([...explicitCompletedStepIds, ...completedStepIdsFromStatuses])
  )

  return {
    steps: normalizedSteps,
    size: input.size === "md" || input.size === "lg" ? input.size : "sm",
    readinessSummary: input.readinessSummary ?? null,
    linkHrefOverride:
      typeof input.linkHrefOverride === "string" &&
      input.linkHrefOverride.trim().length > 0
        ? input.linkHrefOverride
        : null,
    allowAutoResize: Boolean(input.allowAutoResize),
    storageKey:
      typeof input.storageKey === "string" ? input.storageKey : undefined,
    onSizeChange: input.onSizeChange,
    initialCurrentStepId: resolveInitialCurrentStepId(
      input.initialCurrentStepId
    ),
    initialCompletedStepIds,
    onModuleComplete: input.onModuleComplete,
    onStepComplete: input.onStepComplete,
    onProgressChange: input.onProgressChange,
    onWorkspaceOnboardingSubmit: input.onWorkspaceOnboardingSubmit,
  }
}

export function buildWorkspaceAcceleratorRuntimeActionsSignature({
  currentStepId,
  canGoPrevious,
  canGoNext,
  isCurrentStepCompleted,
  totalSteps,
  selectedLessonGroupKey,
  lessonGroupCount,
}: {
  currentStepId: string | null
  canGoPrevious: boolean
  canGoNext: boolean
  isCurrentStepCompleted: boolean
  totalSteps: number
  selectedLessonGroupKey?: string | null
  lessonGroupCount?: number
}) {
  return JSON.stringify({
    currentStepId,
    canGoPrevious,
    canGoNext,
    isCurrentStepCompleted,
    totalSteps,
    selectedLessonGroupKey: selectedLessonGroupKey ?? null,
    lessonGroupCount: lessonGroupCount ?? 0,
  })
}

export function buildWorkspaceAcceleratorFullscreenHref({
  stepId,
  moduleId,
  lessonGroupKey,
  basePath = WORKSPACE_ACCELERATOR_PATH,
}: {
  stepId?: string | null
  moduleId?: string | null
  lessonGroupKey?: string | null
  basePath?: string
}) {
  const nextParams = new URLSearchParams()
  if (stepId) {
    nextParams.set("step", stepId)
  }
  if (moduleId) {
    nextParams.set("module", moduleId)
  }
  if (lessonGroupKey) {
    nextParams.set("group", lessonGroupKey)
  }

  const query = nextParams.toString()
  if (!query) {
    return basePath
  }

  return `${basePath}?${query}`
}
