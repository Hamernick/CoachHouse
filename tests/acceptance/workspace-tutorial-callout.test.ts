import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TOOLTIP_ARROW_CLASSNAME } from "@/components/ui/tooltip"
import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"

const ROOT = process.cwd()

describe("workspace tutorial callout", () => {
  it("renders an inspectable indicator wrapper for the arrow callout", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceTutorialCallout, {
        mode: "indicator",
        tapHereLabel: "Open the Accelerator",
      })
    )

    expect(markup).toContain('data-slot="workspace-tutorial-indicator-anchor"')
    expect(markup).toContain("aria-describedby=")
    expect(markup).toContain('data-state="instant-open"')
    expect(markup).toContain('aria-hidden="true"')

    expect(TOOLTIP_ARROW_CLASSNAME).toContain("rotate-45")
    expect(TOOLTIP_ARROW_CLASSNAME).toContain("rounded-[2px]")
    expect(TOOLTIP_ARROW_CLASSNAME).toContain("bg-foreground")
    expect(markup).not.toContain("workspace-tutorial-pointer")
    expect(markup).not.toContain(
      "rounded-xl border border-border/70 bg-popover/95"
    )
  })

  it("keeps the default labeled indicator arrow before the text with compact spacing", () => {
    const source = readFileSync(
      join(ROOT, "src/components/workspace/workspace-tutorial-callout.tsx"),
      "utf8"
    )
    expect(
      source.indexOf('{indicatorIconPosition === "before" || !tapHereLabel')
    ).toBeLessThan(source.indexOf("{indicatorLabel}"))
    expect(source.indexOf("{indicatorLabel}")).toBeLessThan(
      source.indexOf('{indicatorIconPosition === "after" && tapHereLabel')
    )
    expect(source).toContain('"flex items-center whitespace-nowrap"')
    expect(source).toContain('? "gap-1.5"')
    expect(source).not.toContain("WORKSPACE_TUTORIAL_INDICATOR_TRIGGER_SIZE")
    expect(source).not.toContain("width: tapHereLabel")
  })

  it("can place the labeled indicator arrow after the text for viewport controls", () => {
    const source = readFileSync(
      join(ROOT, "src/components/workspace/workspace-tutorial-callout.tsx"),
      "utf8"
    )

    expect(source).toContain('indicatorIconPosition = "before"')
    expect(source).toContain("data-workspace-tutorial-indicator-icon-position=")
    expect(source).toContain(
      '{indicatorIconPosition === "after" && tapHereLabel'
    )
  })

  it("keeps the calendar indicator bubble compact", () => {
    const source = readFileSync(
      join(
        ROOT,
        "src/components/app-shell/components/app-shell-calendar-action.tsx"
      ),
      "utf8"
    )
    const viewportControls = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel.tsx"
      ),
      "utf8"
    )

    expect(source).toContain('tapHereLabel="Open calendar"')
    expect(source).toContain('indicatorIconPosition="after"')
    expect(source).toContain("!px-2 !py-1")
    expect(source).toContain("indicatorSideOffset={6}")
    expect(source).toContain("if (!onTutorialCalendarButtonComplete)")
    expect(source).toContain("onTutorialCalendarButtonComplete()")
    expect(viewportControls).toContain("useRegisterAppShellCalendarTutorial")
  })

  it("supports explicit indicator anchor geometry without class-based offsets", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceTutorialCallout, {
        mode: "indicator",
        indicatorAnchorAlign: "start",
        indicatorOffsetX: 24,
        indicatorOffsetY: -12,
      })
    )

    expect(markup).toContain(
      'style="left:0;top:0;transform:translate(24px, -12px)"'
    )
  })

  it("can center the persistent indicator vertically while keeping the bubble on the right", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceTutorialCallout, {
        mode: "indicator",
        tapHereLabel: "Open the Accelerator",
        indicatorSide: "right",
        indicatorAnchorVerticalAlign: "center",
      })
    )

    expect(markup).toContain(
      'style="left:50%;top:50%;transform:translate(calc(-50% + 0px), calc(-50% + 0px))"'
    )
  })
})
