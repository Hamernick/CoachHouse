import { describe, expect, it } from "vitest"

import { resolveWorkspaceCanvasTutorialCalendarButtonProps } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-support-helpers"
import {
  buildWorkspaceCanvasTutorialCompletionHiddenCardIds,
  clampWorkspaceCanvasTutorialStepIndex,
  isWorkspaceCanvasTutorialFinalStep,
  isWorkspaceCanvasTutorialStepAcknowledged,
  isWorkspaceCanvasTutorialStepOpened,
  resolveWorkspaceCanvasTutorialCallout,
  resolveWorkspaceCanvasTutorialContinueMode,
  resolveWorkspaceCanvasTutorialProgressPercent,
  resolveWorkspaceCanvasTutorialPromptTargetCardId,
  resolveWorkspaceCanvasTutorialSceneFocusCardIds,
  resolveWorkspaceCanvasTutorialSelectedCardId,
  resolveWorkspaceCanvasTutorialShortcutInstruction,
  resolveWorkspaceCanvasTutorialStep,
  resolveWorkspaceCanvasTutorialStepCount,
  resolveWorkspaceCanvasTutorialTrimmedStepIds,
  resolveWorkspaceCanvasTutorialVisibleCardIds,
} from "@/features/workspace-canvas-tutorial"

describe("workspace canvas tutorial", () => {
  it("starts with a centered welcome state that reveals no cards", () => {
    const step = resolveWorkspaceCanvasTutorialStep(0)

    expect(step.id).toBe("welcome")
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(0)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialPromptTargetCardId(0)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialVisibleCardIds(0)).toEqual([])
  })

  it("reveals the expected card for each guided step", () => {
    expect(resolveWorkspaceCanvasTutorialStep(1).id).toBe("organization")
    expect(resolveWorkspaceCanvasTutorialVisibleCardIds(1)).toEqual([
      "organization-overview",
    ])

    expect(resolveWorkspaceCanvasTutorialStep(2).id).toBe("tool-buttons")
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(2)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialVisibleCardIds(2)).toEqual([
      "organization-overview",
    ])

    expect(resolveWorkspaceCanvasTutorialStep(3).id).toBe("accelerator")
    expect(resolveWorkspaceCanvasTutorialPromptTargetCardId(3)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(3)).toBe("accelerator")
    expect(resolveWorkspaceCanvasTutorialVisibleCardIds(3)).toEqual([
      "accelerator",
    ])

    expect(resolveWorkspaceCanvasTutorialStep(4).id).toBe("accelerator-picker")
    expect(resolveWorkspaceCanvasTutorialVisibleCardIds(4)).toEqual([
      "accelerator",
    ])
  })

  it("keeps every tool step on guide-owned Continue progression", () => {
    expect(resolveWorkspaceCanvasTutorialContinueMode(2)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialStep(2).highlightShortcutButtons).toBe(
      true
    )
    expect(resolveWorkspaceCanvasTutorialContinueMode(3)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialShortcutInstruction(3)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(3)).toBe("accelerator")
    expect(resolveWorkspaceCanvasTutorialContinueMode(4, ["accelerator"])).toBe(
      "next"
    )
    expect(resolveWorkspaceCanvasTutorialContinueMode(5, ["accelerator"])).toBe(
      "next"
    )
    expect(resolveWorkspaceCanvasTutorialContinueMode(6, ["accelerator"])).toBe(
      "next"
    )
    expect(resolveWorkspaceCanvasTutorialContinueMode(7)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialShortcutInstruction(7)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialPromptTargetCardId(7)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(7)).toBe("calendar")
    expect(resolveWorkspaceCanvasTutorialContinueMode(8)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialShortcutInstruction(8)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(8)).toBe("programs")
    expect(resolveWorkspaceCanvasTutorialContinueMode(9)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialShortcutInstruction(9)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialSelectedCardId(9)).toBe("roadmap")
    expect(resolveWorkspaceCanvasTutorialContinueMode(10)).toBe("next")
    expect(resolveWorkspaceCanvasTutorialContinueMode(1)).toBe("next")
  })

  it("keeps legacy opened-step ids from changing the current Continue step", () => {
    const openedStepIds = ["accelerator"] as const

    expect(isWorkspaceCanvasTutorialStepOpened(3, [...openedStepIds])).toBe(
      true
    )
    expect(
      resolveWorkspaceCanvasTutorialContinueMode(3, [...openedStepIds])
    ).toBe("next")
    expect(
      resolveWorkspaceCanvasTutorialPromptTargetCardId(3, [...openedStepIds])
    ).toBeNull()
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(3, [...openedStepIds])
    ).toBe("accelerator")
    expect(
      resolveWorkspaceCanvasTutorialSceneFocusCardIds(3, [...openedStepIds])
    ).toEqual(["accelerator"])
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(3, [...openedStepIds])
    ).toEqual(["accelerator"])
  })

  it("shows the current component even when prior legacy steps were opened", () => {
    const openedStepIds = ["accelerator"] as const

    expect(
      resolveWorkspaceCanvasTutorialContinueMode(7, [...openedStepIds])
    ).toBe("next")
    expect(
      resolveWorkspaceCanvasTutorialPromptTargetCardId(7, [...openedStepIds])
    ).toBeNull()
    expect(
      resolveWorkspaceCanvasTutorialSceneFocusCardIds(7, [...openedStepIds])
    ).toEqual(["calendar"])
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(7, [...openedStepIds])
    ).toEqual(["calendar"])
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(7, [...openedStepIds])
    ).toBe("calendar")
  })

  it("highlights the header calendar button without requiring a separate calendar action", () => {
    const callout = resolveWorkspaceCanvasTutorialCallout(7)
    const calendarButtonProps =
      resolveWorkspaceCanvasTutorialCalendarButtonProps({
        tutorialCallout: callout,
        onTutorialComplete: () => {},
      })

    expect(callout).toEqual({
      kind: "calendar-viewport-button",
      cardId: "calendar",
      label: "Calendar",
      instruction:
        "The calendar lives in the header here, so it is always available from the workspace.",
      requiresAction: false,
    })
    expect(calendarButtonProps).toEqual({
      tutorialCalendarButtonCallout: {
        title: "Calendar",
        instruction:
          "The calendar lives in the header here, so it is always available from the workspace.",
      },
      onTutorialCalendarButtonComplete: undefined,
    })
    expect(resolveWorkspaceCanvasTutorialPromptTargetCardId(7)).toBeNull()
    expect(resolveWorkspaceCanvasTutorialShortcutInstruction(7)).toBeNull()
  })

  it("keeps accelerator internal steps focused on the accelerator card only", () => {
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(4, ["accelerator"])
    ).toEqual(["accelerator"])
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(5, ["accelerator"])
    ).toEqual(["accelerator"])
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(6, [
        "accelerator",
        "accelerator-first-module",
      ])
    ).toEqual(["accelerator"])
  })

  it("shows only the current tool once a later shortcut step is opened", () => {
    const openedStepIds = ["accelerator", "calendar"] as const

    expect(
      resolveWorkspaceCanvasTutorialContinueMode(7, [...openedStepIds])
    ).toBe("next")
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(7, [...openedStepIds])
    ).toEqual(["calendar"])
    expect(
      resolveWorkspaceCanvasTutorialSceneFocusCardIds(7, [...openedStepIds])
    ).toEqual(["calendar"])
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(7, [...openedStepIds])
    ).toBe("calendar")
  })

  it("opens each later shortcut step into its own selected card phase", () => {
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(8, [
        "accelerator",
        "calendar",
        "programs",
      ])
    ).toBe("programs")
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(9, [
        "accelerator",
        "calendar",
        "programs",
        "roadmap",
      ])
    ).toBe("roadmap")
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(10, [
        "accelerator",
        "calendar",
        "programs",
        "roadmap",
      ])
    ).toBeNull()
  })

  it("trims later opened steps back to the destination step snapshot", () => {
    const openedStepIds = ["accelerator", "calendar"] as const

    expect(
      resolveWorkspaceCanvasTutorialTrimmedStepIds(3, [...openedStepIds])
    ).toEqual(["accelerator"])
    expect(
      resolveWorkspaceCanvasTutorialVisibleCardIds(3, [...openedStepIds])
    ).toEqual(["accelerator"])
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(3, [...openedStepIds])
    ).toBe("accelerator")
  })

  it("tracks acknowledged steps separately from shortcut-opened steps", () => {
    expect(isWorkspaceCanvasTutorialStepAcknowledged(3, ["accelerator"])).toBe(
      true
    )
    expect(resolveWorkspaceCanvasTutorialContinueMode(3, [])).toBe("next")
  })

  it("keeps accelerator callouts informational while Continue owns progression", () => {
    expect(resolveWorkspaceCanvasTutorialCallout(4, ["accelerator"])).toEqual({
      kind: "accelerator-picker",
      label: "Class tracks",
      instruction:
        "Class tracks update the lesson list and focus on a different part of the Accelerator.",
    })
    expect(resolveWorkspaceCanvasTutorialCallout(5, ["accelerator"])).toBeNull()
    expect(resolveWorkspaceCanvasTutorialCallout(6, ["accelerator"])).toBeNull()
    expect(resolveWorkspaceCanvasTutorialStep(6)).toMatchObject({
      title: "Lesson preview",
      message:
        "This is what an accelerator lesson looks like inside the workspace. Select Continue when you're ready to move on.",
    })
  })

  it("anchors the collaboration step to the team access header action", () => {
    expect(resolveWorkspaceCanvasTutorialStep(10).id).toBe("collaboration")
    expect(resolveWorkspaceCanvasTutorialCallout(10)).toEqual({
      kind: "team-access",
      label: "Team Access",
      instruction:
        "Team Access is where members are invited and workspace permissions are managed.",
    })
    expect(
      resolveWorkspaceCanvasTutorialSelectedCardId(10, [
        "accelerator",
        "calendar",
        "programs",
        "roadmap",
      ])
    ).toBeNull()
    expect(
      resolveWorkspaceCanvasTutorialSceneFocusCardIds(10, [
        "accelerator",
        "calendar",
        "programs",
        "roadmap",
      ])
    ).toEqual(["organization-overview"])
  })

  it("clamps out-of-range step indices safely", () => {
    const lastIndex = resolveWorkspaceCanvasTutorialStepCount() - 1

    expect(clampWorkspaceCanvasTutorialStepIndex(-8)).toBe(0)
    expect(clampWorkspaceCanvasTutorialStepIndex(99)).toBe(lastIndex)
    expect(resolveWorkspaceCanvasTutorialStep(99).id).toBe("collaboration")
  })

  it("reports tutorial progress as a rounded percentage", () => {
    const stepCount = resolveWorkspaceCanvasTutorialStepCount()

    expect(resolveWorkspaceCanvasTutorialProgressPercent(0, stepCount)).toBe(
      Math.round(100 / stepCount)
    )
    expect(resolveWorkspaceCanvasTutorialProgressPercent(1, stepCount)).toBe(
      Math.round(200 / stepCount)
    )
    expect(
      resolveWorkspaceCanvasTutorialProgressPercent(stepCount - 1, stepCount)
    ).toBe(100)
  })

  it("returns the connected workspace resting state when the tutorial completes", () => {
    expect(
      isWorkspaceCanvasTutorialFinalStep(
        resolveWorkspaceCanvasTutorialStepCount() - 1
      )
    ).toBe(true)
    expect(buildWorkspaceCanvasTutorialCompletionHiddenCardIds()).toEqual([
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "atlas",
      "fiscal-sponsorship",
    ])
  })
})
