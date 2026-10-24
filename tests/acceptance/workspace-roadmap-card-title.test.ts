import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("workspace roadmap card title", () => {
  it("keeps the workspace card title concise while the roadmap navigator uses the Core Documents label", () => {
    const toc = readSource(
      "src/components/roadmap/roadmap-editor/components/roadmap-editor-toc.tsx"
    )
    const navigator = readSource(
      "src/components/roadmap/roadmap-navigator-section.tsx"
    )
    const roadmapCard = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-tool-card-roadmap.tsx"
    )
    const nodeCard = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card.tsx"
    )
    const resolvedRenderer = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-resolved-renderer.tsx"
    )
    const cardFrame = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-card-frame.tsx"
    )
    const frameContentClassName = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-frame-content-class-name.ts"
    )
    const cardHeader = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-card-header.tsx"
    )

    expect(navigator).toContain(
      '"text-[15px] leading-5 font-semibold tracking-tight text-foreground"'
    )
    expect(navigator).toContain("ROADMAP_TOC_TITLE_CLASS_NAME")
    expect(navigator).toContain("ROADMAP_NAVIGATOR_HEADER_BUTTON_CLASS_NAME")

    expect(navigator).toContain("<header")
    expect(navigator).toContain(
      '<span className="truncate">Core Documents</span>'
    )
    expect(navigator).not.toContain(
      'import WaypointsIcon from "lucide-react/dist/esm/icons/waypoints"'
    )
    expect(navigator).not.toContain(
      '<WaypointsIcon className="size-4 shrink-0" aria-hidden />'
    )
    expect(navigator).toContain(
      'aria-controls="roadmap-section-picker-trigger"'
    )
    expect(navigator).toContain("handleCollapsedChange")
    expect(navigator).toContain("showHeader ?")
    expect(toc).not.toContain("ROADMAP_TOC_TITLE_CLASS_NAME")
    expect(toc).not.toContain("Strategic Roadmap")
    expect(toc).toContain("--roadmap-toc-rail-offset")
    expect(toc).toContain("left-[var(--roadmap-toc-rail-offset)]")
    expect(toc).toContain(
      'className="relative w-full min-w-0 space-y-1.5 pr-2 pl-4 text-sm"'
    )
    expect(toc).not.toContain("RoadmapTocRailConnectionCable")
    expect(toc).not.toContain("railConnectionCableEndX")
    expect(navigator).not.toContain("RoadmapTocRailConnectionCable")
    expect(navigator).not.toContain("railConnectionCableEndX")
    expect(toc).toContain("--roadmap-toc-content-offset")
    expect(toc).toContain(
      'import CheckIcon from "lucide-react/dist/esm/icons/check"'
    )
    expect(toc).not.toContain(
      'import BadgeCheckIcon from "lucide-react/dist/esm/icons/badge-check"'
    )
    expect(toc).not.toContain(
      'import DollarSignIcon from "lucide-react/dist/esm/icons/dollar-sign"'
    )
    expect(toc).toContain("RoadmapTocCompletionCheck")
    expect(toc).toContain('if (status !== "complete") return null')
    expect(toc).toContain("text-muted-foreground/70")
    expect(toc).toContain(
      '<CheckIcon className="h-3.5 w-3.5" strokeWidth={2} />'
    )
    expect(toc).not.toContain("RoadmapTocMilestoneIcons")
    expect(toc).toContain("ROADMAP_TOC_INLINE_ICON_CLASS_NAME")
    expect(toc).not.toContain("ROADMAP_TOC_MILESTONE_ICON_CLASS_NAME")
    expect(toc).toContain(
      '"text-muted-foreground/70 ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center"'
    )
    expect(toc).not.toContain(
      '<DollarSignIcon className="h-3.5 w-3.5" strokeWidth={2} />'
    )
    expect(toc).not.toContain(
      '<BadgeCheckIcon className="h-3.5 w-3.5" strokeWidth={2} />'
    )
    expect(toc).not.toContain("resolveRoadmapTocMilestoneIconClassName")
    expect(toc).not.toContain('milestone: "fundable"')
    expect(toc).not.toContain('milestone: "verified"')
    expect(toc).not.toContain("rounded-full border transition-colors")
    expect(toc).not.toContain("bg-amber-500 text-white")
    expect(toc).not.toContain("bg-emerald-500 text-white")
    expect(toc).not.toContain("bg-sky-500 text-white")
    expect(toc).not.toContain("text-muted-foreground/45")
    expect(toc).not.toContain(
      'className="ml-auto inline-flex shrink-0 items-center gap-1"'
    )
    expect(toc).toContain("resolveRoadmapTocButtonStateClassName")
    expect(toc).toContain('status === "complete"')
    expect(toc).toContain("data-status={itemStatus}")
    expect(toc).toContain("data-status={childStatus}")
    expect(toc).toContain("RoadmapTocCompletedRailSegment")
    expect(toc).toContain(
      "pointer-events-none absolute top-0 left-[calc(var(--roadmap-toc-rail-offset)-var(--roadmap-toc-content-offset))] z-10 h-full w-[2px]"
    )
    expect(toc).toContain('itemStatus === "complete"')
    expect(toc).toContain('childStatus === "complete"')
    expect(toc).not.toContain("<RoadmapTocMilestoneIcons />")
    expect(toc).not.toContain(
      "<RoadmapTocMilestoneIcons status={itemStatus} />"
    )
    expect(toc).not.toContain(
      "<RoadmapTocMilestoneIcons status={childStatus} />"
    )
    expect(toc).toContain("<RoadmapTocCompletionCheck status={itemStatus} />")
    expect(toc).toContain("<RoadmapTocCompletionCheck status={childStatus} />")
    expect(toc).toContain("group relative flex items-center gap-2")
    expect(toc).toContain("group relative flex snap-start snap-always")
    expect(toc).not.toContain("tocContentPaddingClassName")
    expect(toc).not.toContain("railStartMarker")
    expect(navigator).not.toContain(
      "text-xs font-semibold text-muted-foreground"
    )
    expect(roadmapCard).toContain("showHeader={false}")
    expect(roadmapCard).toContain("collapsed={collapsed}")
    expect(roadmapCard).toContain('className="px-1 pb-3"')
    expect(navigator).toContain("requestWorkspaceRoadmapDrawer(next.slug)")
    expect(roadmapCard).not.toContain(
      'resolveCardDimensions(cardSize, "roadmap")'
    )
    expect(roadmapCard).not.toContain("ROADMAP_CARD_TOC_LEFT_OFFSET")
    expect(roadmapCard).not.toContain("shouldShowConnectionCable")
    expect(roadmapCard).not.toContain("railConnectionCableEndX")
    expect(roadmapCard).not.toContain("showConnectionCable")
    expect(roadmapCard).toContain('tocRailOffset="0.25rem"')
    expect(roadmapCard).not.toContain("tocContentPaddingClassName")
    expect(nodeCard).toContain('cardId === "roadmap" ||')
    expect(nodeCard).toContain("roadmapNavigatorCollapsed")
    expect(resolvedRenderer).toContain("title={cardMeta.title}")
    expect(resolvedRenderer).not.toContain(
      'cardId === "roadmap" ? "Strategic Roadmap" : cardMeta.title'
    )
    expect(cardFrame).not.toContain("compactHeaderSpacing")
    expect(cardFrame).toContain('compactTitleBottomGap={cardId === "roadmap"}')
    expect(cardFrame).toContain(
      'cardId === "organization-overview" ? "pt-0" : "pt-1"'
    )
    expect(frameContentClassName).toContain(
      'if (cardId === "roadmap") return "px-0 pt-0 pb-0"'
    )
    expect(navigator).toContain('"pt-0 pb-2.5"')
    expect(navigator).not.toContain('"pt-0 pb-0"')
    expect(navigator).not.toContain('"pt-0 pb-1.5"')
    expect(navigator).not.toContain("railStartMarker")
    expect(navigator).not.toContain("tocContentPaddingClassName")
    expect(cardHeader).toContain('"px-4 pt-3 pb-2"')
    expect(cardHeader).toContain("compactTitleBottomGap")
    expect(cardHeader).toContain('"pb-1.5"')
    expect(cardHeader).toContain('"min-w-0 truncate"')
    expect(cardHeader).toContain("WORKSPACE_TEXT_STYLES.cardTitle")
    expect(cardHeader).toContain("PencilIcon")
    expect(cardHeader).toContain('aria-label="Edit card"')
    expect(cardHeader).toContain('variant="ghost"')
    expect(cardHeader).toContain('size="icon"')
    expect(cardHeader).toContain('className="nodrag nopan relative"')
    expect(cardHeader).toContain(
      'surface === "card" && CARD_SURFACE_ICON_BUTTON_HOVER_CLASS_NAME'
    )
    expect(cardHeader).not.toContain(
      '<span className="truncate">{title}</span>'
    )
    expect(cardHeader).not.toContain("compactHeaderSpacing")
    expect(cardHeader).toContain(
      '"inline-flex min-w-0 flex-wrap items-center gap-1.5"'
    )
    expect(cardHeader).not.toContain("titleIconPlacement")
    expect(cardHeader).not.toContain("rail-start")
    expect(cardFrame).not.toContain("titleIconPlacement")
    expect(resolvedRenderer).not.toContain(
      'import WaypointsIcon from "lucide-react/dist/esm/icons/waypoints"'
    )
    expect(resolvedRenderer).not.toContain(
      '<WaypointsIcon className="size-4" aria-hidden />'
    )
    expect(resolvedRenderer).not.toContain(
      'hideTitle={cardId === "accelerator"}'
    )
    expect(resolvedRenderer).not.toContain(
      'titleIcon={cardId === "accelerator"'
    )
    expect(resolvedRenderer).toContain('if (cardId === "accelerator")')
    expect(resolvedRenderer).toContain("WorkspaceBoardAcceleratorCard")
    expect(resolvedRenderer).toContain('if (cardId === "fiscal-sponsorship")')
    expect(resolvedRenderer).toContain(
      'aria-controls="roadmap-section-picker-trigger"'
    )
    expect(resolvedRenderer).toContain("collapsed={roadmapNavigatorCollapsed}")
    expect(resolvedRenderer).not.toContain(
      "showConnectionCable={!isCanvasFullscreen && !presentationMode}"
    )
    expect(resolvedRenderer).toContain(
      "onRoadmapNavigatorCollapsedChange(!roadmapNavigatorCollapsed)"
    )
  })
})
