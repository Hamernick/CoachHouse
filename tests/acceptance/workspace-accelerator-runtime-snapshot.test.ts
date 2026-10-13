import { describe, expect, it } from "vitest"

import { areWorkspaceAcceleratorRuntimeSnapshotsEqual } from "@/features/workspace-accelerator-card"
import type { WorkspaceAcceleratorCardRuntimeSnapshot } from "@/features/workspace-accelerator-card"

function buildRuntimeSnapshot(
  overrides: Partial<WorkspaceAcceleratorCardRuntimeSnapshot> = {},
): WorkspaceAcceleratorCardRuntimeSnapshot {
  return {
    currentStep: {
      id: "workspace-onboarding-welcome:lesson",
      moduleId: "workspace-onboarding-welcome",
      moduleSlug: "welcome",
      moduleTitle: "Welcome",
      stepKind: "lesson",
      stepTitle: "Welcome",
      stepDescription: null,
      href: "/accelerator/class/formation/module/welcome",
      status: "in_progress",
      stepSequenceIndex: 1,
      stepSequenceTotal: 8,
      moduleSequenceIndex: 1,
      moduleSequenceTotal: 8,
      groupTitle: "Formation",
      groupOrder: 1,
      videoUrl: null,
      durationMinutes: null,
      resources: [],
      hasAssignment: false,
      hasDeck: false,
      moduleContext: null,
    },
    currentIndex: 0,
    totalSteps: 8,
    canGoPrevious: false,
    canGoNext: true,
    currentModuleStepIndex: 0,
    currentModuleStepTotal: 1,
    currentModuleCompletedCount: 0,
    isCurrentModuleCompleted: false,
    isCurrentStepCompleted: false,
    selectedLessonGroupKey: "formation",
    selectedLessonGroupLabel: "Formation",
    lessonGroupOptions: [{ key: "formation", label: "Formation" }],
    firstVisibleChecklistStepId: "workspace-onboarding-welcome:lesson",
    isModuleViewerOpen: false,
    openModuleId: "workspace-onboarding-welcome",
    placeholderVideoUrl: "https://cdn.example.com/welcome.mp4",
    readinessSummary: {
      score: 13,
      progressPercent: 13,
      fundableCheckpoint: 60,
      verifiedCheckpoint: 100,
      fundable: false,
      verified: false,
      fundableMissing: [],
      verifiedMissing: [],
      fundableChecklist: [],
      verifiedChecklist: [],
    },
    checklistModuleCount: 8,
    filteredStepCount: 8,
    ...overrides,
  }
}

describe("workspace accelerator runtime snapshot equality", () => {
  it("treats snapshots with the same semantic runtime state as equal", () => {
    const left = buildRuntimeSnapshot()
    const right = buildRuntimeSnapshot({
      lessonGroupOptions: [{ key: "formation", label: "Formation" }],
      readinessSummary: {
        score: 13,
        progressPercent: 13,
        fundableCheckpoint: 60,
        verifiedCheckpoint: 100,
        fundable: false,
        verified: false,
        fundableMissing: [],
        verifiedMissing: [],
        fundableChecklist: [],
        verifiedChecklist: [],
      },
    })

    expect(areWorkspaceAcceleratorRuntimeSnapshotsEqual(left, right)).toBe(
      true,
    )
  })

  it("detects changes that affect tutorial accelerator presentation state", () => {
    const base = buildRuntimeSnapshot()

    expect(
      areWorkspaceAcceleratorRuntimeSnapshotsEqual(
        base,
        buildRuntimeSnapshot({ isModuleViewerOpen: true }),
      ),
    ).toBe(false)
    expect(
      areWorkspaceAcceleratorRuntimeSnapshotsEqual(
        base,
        buildRuntimeSnapshot({ selectedLessonGroupKey: "operations" }),
      ),
    ).toBe(false)
    expect(
      areWorkspaceAcceleratorRuntimeSnapshotsEqual(
        base,
        buildRuntimeSnapshot({ filteredStepCount: 6 }),
      ),
    ).toBe(false)
  })
})
