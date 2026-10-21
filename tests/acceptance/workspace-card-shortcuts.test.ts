import React from "react"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { buildWorkspaceCardShortcutItemModels } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/shortcuts/workspace-card-shortcut-model"
import { WorkspaceCardShortcutButton } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/shortcuts/workspace-card-shortcut-button"

describe("workspace card shortcuts", () => {
  it("does not expose the organization card as a shortcut button", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
    })

    expect(items.some((item) => item.id === "organization-overview")).toBe(
      false
    )
    expect(items.some((item) => item.title === "Organization")).toBe(false)
  })

  it("hides the standalone activity shortcut", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
    })

    expect(items.some((item) => item.id === "programs")).toBe(false)
    expect(items.some((item) => item.title === "Activity")).toBe(false)
  })

  it("orders the workspace shortcut buttons while keeping roadmap in the right rail", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
    })

    expect(items.map((item) => item.id)).toEqual([])
    expect(items.some((item) => item.id === "accelerator")).toBe(false)
    expect(items.some((item) => item.id === "roadmap")).toBe(false)
  })

  it("keeps calendar off the live shortcut rail outside the tutorial", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
    })

    expect(items.some((item) => item.id === "calendar")).toBe(false)
  })

  it("forces the tutorial shortcut button to advance without triggering a competing card focus", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const onTutorialAdvance = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["accelerator"],
      selectedCardId: "accelerator",
      onToggle,
      onFocusCard,
      tutorialTargetCardId: "accelerator",
      tutorialInstruction: "Click the Accelerator button and continue.",
      onTutorialAdvance,
    })

    const acceleratorItem = items.find((item) => item.id === "accelerator")

    expect(acceleratorItem?.tutorialCallout?.instruction).toContain(
      "Accelerator button"
    )
    acceleratorItem?.onPress()

    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
    expect(onTutorialAdvance).toHaveBeenCalledTimes(1)
  })

  it("does not resurrect calendar in the shortcut rail for tutorial-owned flows", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: ["calendar"],
      visibleCardIds: ["organization-overview"],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
      tutorialTargetCardId: "calendar",
      tutorialInstruction: "Click the Calendar button and continue.",
      onTutorialAdvance: vi.fn(),
    })

    expect(items.some((item) => item.id === "calendar")).toBe(false)
  })

  it("does not toggle a board-visible tutorial target closed when the tutorial scene has not revealed it yet", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const onTutorialAdvance = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["organization-overview"],
      selectedCardId: null,
      onToggle,
      onFocusCard,
      tutorialTargetCardId: "accelerator",
      tutorialInstruction: "Click the Accelerator button and continue.",
      onTutorialAdvance,
    })

    const acceleratorItem = items.find((item) => item.id === "accelerator")

    expect(acceleratorItem).toBeDefined()
    acceleratorItem?.onPress()

    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
    expect(onTutorialAdvance).toHaveBeenCalledTimes(1)
  })

  it("keeps the accelerator off the live shortcut rail", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["organization-overview", "accelerator"],
      selectedCardId: "organization-overview",
      onToggle,
      onFocusCard,
    })

    const acceleratorItem = items.find((item) => item.id === "accelerator")

    expect(acceleratorItem).toBeUndefined()
    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
  })

  it("keeps selected programs out of the shortcut rail", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["organization-overview", "programs", "accelerator"],
      selectedCardId: "accelerator",
      onToggle,
      onFocusCard,
    })

    const programsItem = items.find((item) => item.id === "programs")

    expect(programsItem).toBeUndefined()

    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
  })

  it("does not expose roadmap actions from the shortcut rail", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["organization-overview", "roadmap"],
      selectedCardId: "organization-overview",
      onToggle,
      onFocusCard,
    })

    expect(items.some((item) => item.id === "roadmap")).toBe(false)
    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
  })

  it("does not restore the accelerator shortcut from legacy hidden state", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: ["accelerator"],
      visibleCardIds: ["organization-overview"],
      selectedCardId: "organization-overview",
      onToggle,
      onFocusCard,
    })

    const acceleratorItem = items.find((item) => item.id === "accelerator")

    expect(acceleratorItem).toBeUndefined()
    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
  })

  it("does not restore a programs shortcut from saved hidden state", () => {
    const onToggle = vi.fn()
    const onFocusCard = vi.fn()
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: ["programs"],
      visibleCardIds: ["organization-overview", "accelerator"],
      selectedCardId: "accelerator",
      onToggle,
      onFocusCard,
    })

    const programsItem = items.find((item) => item.id === "programs")

    expect(programsItem).toBeUndefined()

    expect(onToggle).not.toHaveBeenCalled()
    expect(onFocusCard).not.toHaveBeenCalled()
  })

  it("does not restore hidden shortcuts during the tutorial intro step", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      visibleCardIds: ["organization-overview"],
      selectedCardId: "organization-overview",
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
      tutorialHighlightAll: true,
    })

    expect(items).toEqual([])
    expect(items.every((item) => item.tutorialHighlighted)).toBe(true)
    expect(items.every((item) => item.tutorialCallout === null)).toBe(true)
    expect(items.some((item) => item.id === "calendar")).toBe(false)
  })

  it("uses the blue highlight treatment for the tutorial tools step", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceCardShortcutButton, {
        item: {
          id: "accelerator",
          title: "Accelerator",
          icon: Building2Icon,
          visible: false,
          selected: false,
          comingSoon: false,
          tutorialHighlighted: true,
          tutorialCallout: null,
          onPress: vi.fn(),
        },
      })
    )

    expect(markup).toContain("bg-sky-50/85")
    expect(markup).toContain("dark:bg-sky-500/14")
  })

  it("matches the viewport control button treatment for shortcut triggers", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceCardShortcutButton, {
        item: {
          id: "accelerator",
          title: "Accelerator",
          icon: Building2Icon,
          visible: true,
          selected: false,
          comingSoon: false,
          tutorialHighlighted: false,
          tutorialCallout: null,
          onPress: vi.fn(),
        },
      })
    )

    expect(markup).toContain("hover:bg-accent")
    expect(markup).toContain("hover:text-accent-foreground")
    expect(markup).toContain("size-9 h-9 w-9 rounded-xl")
    expect(markup).toContain("h-4 w-4 transition-opacity")
    expect(markup).not.toContain("bg-secondary")
    expect(markup).not.toContain("size-10")
  })

  it("anchors the accelerator tutorial callout on the right edge of the shortcut button", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceCardShortcutButton, {
        item: {
          id: "accelerator",
          title: "Accelerator",
          icon: Building2Icon,
          visible: false,
          selected: false,
          comingSoon: false,
          tutorialHighlighted: false,
          tutorialCallout: {
            instruction: "Click the Accelerator button and continue.",
          },
          onPress: vi.fn(),
        },
      })
    )

    expect(markup).toContain(
      'style="right:0;top:50%;transform:translate(0px, calc(-50% + 0px))"'
    )
  })

  it("hides fundraising and communications from the live shortcut rail", () => {
    const items = buildWorkspaceCardShortcutItemModels({
      hiddenCardIds: [],
      selectedCardId: null,
      onToggle: vi.fn(),
      onFocusCard: vi.fn(),
    })

    expect(items.some((item) => item.id === "economic-engine")).toBe(false)
    expect(items.some((item) => item.id === "communications")).toBe(false)
  })
})
