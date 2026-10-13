import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  resolveWorkspaceAcceleratorDrawerRequest,
  resolveWorkspaceDataDrawerRequest,
  resolveWorkspaceOrganizationDrawerRequest,
  resolveWorkspaceRoadmapDrawerRequest,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs"
import {
  resolveWorkspaceDataDrawerSnapPoint,
  resolveWorkspaceDataDrawerRequestSnapPoint,
  resolveWorkspaceDataDrawerViewportHeight,
  resolveWorkspaceFloatingDrawerHeight,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-state"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  const source = readFileSync(join(ROOT, relativePath), "utf8")
  const folder = relativePath.slice(0, relativePath.lastIndexOf("/"))
  const composed = relativePath.endsWith("/workspace-canvas-overlay-drawer.tsx")
    ? [
        "workspace-canvas-overlay-drawer-header.tsx",
        "workspace-canvas-overlay-drawer-trigger.tsx",
        "use-workspace-drawer-navigation.ts",
        "workspace-drawer-shell.ts",
        "workspace-overlay-drawer-props.ts",
        "use-workspace-drawer-controls.ts",
      ]
    : relativePath.endsWith("/workspace-canvas-overlay-drawer-tabs-view.tsx")
      ? ["workspace-drawer-navigation-view.tsx", "workspace-drawer-content.tsx"]
      : []
  return [
    source,
    ...composed.map((file) => readFileSync(join(ROOT, folder, file), "utf8")),
  ].join("\n")
}

describe("workspace canvas overlay drawer", () => {
  it("keeps the floating dock 16px above the canvas at every detent", () => {
    const canvasHeight = 800
    const composerHeight = 58
    for (const snap of ["68px", 0.48, 1] as const) {
      const visibleHeight = resolveWorkspaceFloatingDrawerHeight(
        canvasHeight,
        snap,
        composerHeight
      )
      const vaulSnap =
        snap === "68px" ? 90 + composerHeight : canvasHeight * snap
      const shellTop = 16 + canvasHeight - vaulSnap
      expect(shellTop + visibleHeight).toBe(canvasHeight - 16)
    }
    expect(
      resolveWorkspaceFloatingDrawerHeight(canvasHeight, "68px", composerHeight)
    ).toBe(116)
    expect(
      resolveWorkspaceFloatingDrawerHeight(canvasHeight, "68px", 100)
    ).toBe(158)
  })

  it("accounts for touch-sized chrome without losing the floating gap", () => {
    const header = 44
    const tabs = 44
    const border = 2
    const composer = 66
    const visible = resolveWorkspaceFloatingDrawerHeight(
      800,
      "68px",
      composer,
      header + tabs + border
    )
    expect(visible).toBe(156)
    const vaulOffset = 800 - (visible + 32)
    expect(16 + vaulOffset + visible).toBe(784)
    expect(visible - header - border).toBe(tabs + composer)
  })

  it("opens the launch return URL at full height while preserving other snap defaults", () => {
    const request = resolveWorkspaceDataDrawerRequest(
      "/workspace?drawer=accelerator&focus=organization-launch"
    )
    expect(request).toMatchObject({ tab: "accelerator", focusKey: "organization-launch" })
    const snapPoint = resolveWorkspaceDataDrawerRequestSnapPoint(request)
    expect(snapPoint).toBe(1)
    expect(resolveWorkspaceDataDrawerViewportHeight(snapPoint)).toBe("calc(100% - 2rem)")
    expect(resolveWorkspaceDataDrawerRequestSnapPoint({ tab: "accelerator" })).toBe(0.48)
    expect(resolveWorkspaceDataDrawerRequestSnapPoint({ tab: "organization", organizationEditMode: true })).toBe(1)
    expect(resolveWorkspaceDataDrawerRequestSnapPoint({ tab: "roadmap" })).toBe(1)
    expect(resolveWorkspaceDataDrawerRequestSnapPoint(null)).toBe("68px")
  })

  it("uses the existing shadcn drawer as a container-scoped bottom sheet", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const tabsViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )
    const stateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-state.ts"
    )

    expect(source).toContain('from "@/components/ui/drawer"')
    expect(source).toContain("DatabaseIcon")
    expect(source).toContain("DrawerHandle")
    expect(source).not.toContain('from "@/components/ui/toggle"')
    expect(source).toContain("useWorkspaceCanvasOverlayDrawerContainer")
    expect(source).toContain('direction="bottom"')
    expect(source).toContain("container={canvasContainer ?? undefined}")
    expect(source).toContain("disablePreventScroll")
    expect(source).toContain("dismissible={false}")
    expect(source).toContain("fadeFromIndex={2}")
    expect(source).toContain("modal={false}")
    expect(source).toContain("noBodyStyles")
    expect(source).toContain("...WORKSPACE_DATA_DRAWER_SNAP_POINTS")
    expect(source).toContain("snapToSequentialPoint")
    expect(source).toContain("shouldScaleBackground={false}")
    expect(source.replace(/\s+/g, " ")).toContain(
      "particleComposer && drawerCollapsed ? composerPeek : activeSnapPoint"
    )
    expect(source).toContain("setActiveSnapPoint={handleActiveSnapPointChange}")
    expect(source).toContain("readWorkspaceBoardUiPreferences")
    expect(source).toContain("patchWorkspaceBoardUiPreferences")
    expect(source).toContain("dataDrawerSnapPoint: storedSnapPoint")
    expect(source).toContain("resolvedSnapPoint === composerPeek")
    expect(source).toContain(
      "return current ?? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT"
    )
    expect(resolveWorkspaceDataDrawerSnapPoint("68px")).toBe("68px")
    expect(resolveWorkspaceDataDrawerSnapPoint(0.479)).toBe(0.48)
    expect(resolveWorkspaceDataDrawerSnapPoint(0.99)).toBe(1)
    expect(resolveWorkspaceDataDrawerSnapPoint(undefined)).toBeNull()
    expect(resolveWorkspaceDataDrawerViewportHeight("68px")).toBe(
      "calc(68px - 2rem)"
    )
    expect(resolveWorkspaceDataDrawerViewportHeight(0.48)).toBe(
      "calc(48% - 2rem)"
    )
    expect(resolveWorkspaceDataDrawerViewportHeight(1)).toBe(
      "calc(100% - 2rem)"
    )
    expect(resolveWorkspaceDataDrawerViewportHeight(undefined)).toBe(
      "calc(48% - 2rem)"
    )
    expect(stateSource).toContain(
      'WORKSPACE_DATA_DRAWER_SNAP_POINTS = ["68px", 0.48, 1] as const'
    )
    expect(stateSource).toContain(
      "const WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT ="
    )
    expect(stateSource).toContain(
      "const WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_MAX = 0.11"
    )
    expect(stateSource).toContain(
      "const WORKSPACE_DATA_DRAWER_FULLSCREEN_SNAP_TOLERANCE = 0.01"
    )
    expect(stateSource).toContain(
      "function isWorkspaceDataDrawerCollapsedSnapPoint("
    )
    expect(stateSource).toContain(
      "function isWorkspaceDataDrawerFullscreenSnapPoint("
    )
    expect(stateSource).toContain("Number(snapPoint)")
    expect(stateSource).toContain(
      "const WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT ="
    )
    expect(stateSource).toContain(
      "const WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT ="
    )
    expect(source).toContain('data-workspace-canvas-overlay-drawer="true"')
    expect(source).toContain(
      'overlayClassName="pointer-events-none absolute inset-0 !z-10'
    )
    expect(source).toContain("absolute right-0 bottom-0 left-0 !z-20")
    expect(source).toContain('ownerId: "workspace-card-shortcut:data"')
    expect(source).toContain('component: "WorkspaceCardShortcutButton"')
    expect(source).toContain('variant: "data"')
    expect(source).toContain('primitiveImport: "@/components/ui/button"')
    expect(source).toContain(
      "nodrag nopan text-foreground size-9 h-9 w-9 rounded-xl"
    )
    expect(source).toContain("onClick={handleDataShortcutClick}")
    expect(source).toContain("!isDrawerCollapsed(current)")
    expect(source).not.toContain("[open]")
    expect(source).toContain("aria-label={dataShortcutLabel}")
    expect(source).toContain('"Collapse workspace data"')
    expect(source).toContain('"Open workspace data"')
    expect(source).toContain(
      "absolute right-0 bottom-0 left-0 !z-20 h-full max-h-full w-full"
    )
    expect(source).not.toContain("--workspace-drawer-toolbar-safe-left")
    expect(source).toContain("h-full max-h-full w-full")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:inset-x-0")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:bottom-0")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:h-full")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:max-h-full")
    expect(source).toContain(
      'data-workspace-data-drawer-content-viewport="true"'
    )
    expect(source.replace(/\s+/g, " ")).toContain(
      'desktop || drawerCollapsed ? "overflow-visible" : "overflow-hidden"'
    )
    expect(source).toContain(
      "resolveWorkspaceDataDrawerViewportHeight(activeSnapPoint)"
    )
    expect(
      tabsViewSource.match(
        /mx-auto flex min-h-0 w-full max-w-(?:7xl|none) min-w-0 flex-1 flex-col/g
      ) ?? []
    ).toHaveLength(4)
    expect(source).toContain(
      "data-[vaul-drawer-direction=bottom]:rounded-t-[20px]"
    )
    expect(source).not.toContain(
      "data-[vaul-drawer-direction=bottom]:rounded-t-[24px]"
    )
    expect(source).toContain(
      "bg-background !z-40 backdrop-blur-none data-[vaul-drawer-direction=bottom]:rounded-t-none data-[vaul-drawer-direction=bottom]:border-t-0"
    )
    expect(source).not.toContain("container={container")
    expect(source).not.toContain("w-[min(38rem,calc(100%-1rem))]")
    expect(source).not.toContain(
      "absolute right-0 bottom-0 left-0 !z-20 mx-auto"
    )
    expect(source).not.toContain("DrawerClose")
    expect(source).not.toContain("PanelBottomOpenIcon")
    expect(source).not.toContain('direction={isMobile ? "bottom" : "right"}')
    expect(source).not.toContain("data-[vaul-drawer-direction=right]")
    expect(source).not.toContain(
      "data-[vaul-drawer-direction=bottom]:h-[min(24rem,calc(100%-0.75rem))]"
    )
  })

  it("collapses to a compact handle snap point instead of fully closing", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const tabsViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )
    const drawerPrimitiveSource = readSource("src/components/ui/drawer.tsx")

    expect(source).toContain("setOpen(true)")
    expect(source).not.toContain("setOpen(false)")
    expect(source).toContain("const [open, setOpen] = useState(true)")
    expect(source).toContain(
      "const drawerContentMounted = Boolean(canvasContainer)"
    )
    expect(source).toContain(
      "() => guideState?.snapPoint ?? resolveWorkspaceDataDrawerRequestSnapPoint(request)"
    )
    expect(source).toContain('guideState?.tab ?? request?.tab ?? "organization"')
    expect(source).toContain("if (request || guideState) return")
    expect(source).toContain("if (restoredPreferencesScopeRef.current === scopeKey) return")
    expect(source).toContain("state: guideState, setOpen, setTab, setSnap: setActiveSnapPoint")
    expect(source).toContain("const drawerContentMounted =")
    expect(source).not.toContain("setHasOpened")
    expect(source).not.toContain("rightRailSettled")
    expect(source).not.toContain("useRightRailPresence()")
    expect(source).not.toContain("useAppShellRightRailControls()")
    expect(source).toContain("open={canvasContainer ? open : false}")
    expect(source).toContain(
      "handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)"
    )
    expect(source).toContain(
      "current ?? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT"
    )
    expect(source).toContain("? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT")
    expect(source).toContain(": WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT")
    expect(source).toContain("showHandle={false}")
    expect(source).toContain(
      "relative grid shrink-0 grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] items-center px-3"
    )
    expect(source).toContain(
      '<DrawerTitle className="sr-only">Workspace drawer</DrawerTitle>'
    )
    expect(source).not.toContain(
      "pointer-events-none ml-[var(--workspace-drawer-toolbar-safe-left)] min-w-0 justify-self-start truncate"
    )
    expect(source).not.toContain(">Storage</DrawerTitle>")
    expect(source).not.toContain('<span aria-hidden className="h-0.5 w-32" />')
    expect(source).not.toContain("px-4 pt-3 pb-1.5")
    expect(source).not.toContain("px-4 pt-3.5 pb-1.5")
    expect(source).not.toContain("px-4 pt-4 pb-2")
    expect(source).not.toContain("absolute top-3 right-3")
    expect(source).not.toContain(
      "pointer-events-none absolute top-1/2 left-[calc(1rem+var(--workspace-drawer-toolbar-safe-left))] -translate-y-1/2"
    )
    expect(source).toContain("<DrawerHandle")
    expect(source).toContain("preventCycle")
    expect(source).not.toContain("preventCycle={false}")
    expect(source).toContain("onCollapse")
    expect(source).toContain(
      "handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)"
    )
    expect(source).toContain("onDoubleClick={(event) =>")
    expect(source).toContain(
      '"bg-foreground/18 col-start-2 mt-0 block !h-[3px] !w-32 justify-self-center rounded-full"'
    )
    expect(source).not.toContain(
      'className="bg-foreground/18 mt-0 block h-0.5 w-24 rounded-full"'
    )
    expect(source).not.toContain(
      'className="bg-foreground/18 mt-0 block h-1 w-20 rounded-full"'
    )
    expect(source).not.toContain("h-1.5 w-12 rounded-full")
    expect(drawerPrimitiveSource).toContain(
      "bg-muted mx-auto hidden !h-[3px] !w-32 shrink-0 rounded-full"
    )
    expect(drawerPrimitiveSource).not.toContain("h-2 w-[100px]")
    expect(source).toContain("handleOnly")
    expect(source).toContain("const drawerCollapsed =")
    expect(source).toContain("const drawerFullscreen =")
    expect(source).toContain("open && isDrawerCollapsed(activeSnapPoint)")
    expect(source).toContain("open && !isDrawerCollapsed(activeSnapPoint)")
    expect(source).toContain("open && isDrawerFullscreen(activeSnapPoint)")
    expect(source).toContain('"Restore data drawer height"')
    expect(source).toContain('"Expand data drawer to full canvas height"')
    expect(source).toContain("WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT")
    expect(source).toContain("data-workspace-canvas-drawer-fullscreen={")
    expect(source).not.toContain("WorkspaceDrawerExpandControl")
    expect(source).not.toContain(
      'data-workspace-data-drawer-fullscreen-trigger="true"'
    )
    expect(source).not.toContain("absolute top-3 right-3")
    expect(source).not.toContain(
      "absolute top-4 right-4 z-10 size-8 min-w-8 rounded-md bg-transparent"
    )
    expect(source).not.toContain("pointer-events-auto nodrag nopan")
    expect(source).not.toContain(
      "absolute top-1/2 right-4 z-10 size-8 min-w-8 -translate-y-1/2"
    )
    expect(source).not.toContain(
      "after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5"
    )
    expect(source).not.toContain("after:bg-foreground/70")
    expect(source).not.toContain("data-[state=on]:after:scale-x-100")
    expect(source).not.toContain("motion-reduce:after:transition-none")
    expect(source).not.toContain("expandControl={expandControl}")
    expect(source.indexOf("<WorkspaceDrawerHeader")).toBeLessThan(
      source.indexOf("<WorkspaceDrawerTabs")
    )
    expect(source).not.toContain("handleDataDrawerFullscreenClick")
    expect(source).not.toContain("aria-pressed={drawerFullscreen}")
    expect(source).not.toContain(
      "nodrag nopan absolute top-1/2 right-4 size-8 h-8 w-8"
    )
    expect(source).not.toContain(
      "relative size-8 min-w-8 rounded-md bg-transparent px-1.5"
    )
    expect(source).not.toContain(
      "activeSnapPoint === WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT"
    )
    expect(source).not.toContain(
      "activeSnapPoint !== WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT"
    )
    expect(source).toContain("{drawerContentMounted ? (")
    expect(source).not.toContain("drawerCollapsed ? null : (")
    expect(tabsViewSource).toContain('data-workspace-data-drawer-body="true"')
    expect(tabsViewSource).toContain(
      "inert={drawerCollapsed ? true : undefined}"
    )
    expect(tabsViewSource.replace(/\s+/g, " ")).toContain(
      'contentPresent ? "opacity-100" : "pointer-events-none opacity-0"'
    )
    expect(tabsViewSource.replace(/\s+/g, " ")).toContain(
      'drawerCollapsed || props.windowState?.geometry ? "overflow-visible" : "overflow-hidden"'
    )
    expect(source).toContain("repositionInputs={false}")
    expect(source).toContain("drawerCollapsed={drawerCollapsed}")
    expect(tabsViewSource).toContain("onOpen={handleTabOpen}")
    expect(source).toContain("handleTabOpen={handleTabOpen}")
    expect(source).toContain("requestWorkspaceDrawerNavigation(")
    expect(source).toContain("if (next === current) return")
  })

  it("shows only production-ready workspace drawer tabs", () => {
    const drawerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )
    const tabSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs.ts"
    )

    expect(tabSource).toContain(
      "export type WorkspaceCanvasDrawerTab = WorkspaceDrawerTab"
    )
    expect(source).toContain('value="organization"')
    expect(source).toContain('value="accelerator"')
    expect(source).toContain('value="roadmap"')
    expect(source).toContain('value="people"')
    expect(source).toContain('value="documents"')
    expect(source).not.toContain('value="finance"')
    expect(source).toContain('value="tools"')
    expect(source).not.toContain('<WorkspaceDrawerTabTrigger value="roadmap">')
    const organizationTabIndex = source.indexOf('value="organization"')
    const peopleTabIndex = source.indexOf('value="people"')
    const documentsTabIndex = source.indexOf('value="documents"')
    const financeTabIndex = source.indexOf('value="finance"')
    const toolsTabIndex = source.indexOf('value="tools"')
    const acceleratorTabIndex = source.indexOf('value="accelerator"')
    expect(organizationTabIndex).toBeGreaterThanOrEqual(0)
    expect(financeTabIndex).toBe(-1)
    expect(peopleTabIndex).toBeGreaterThan(organizationTabIndex)
    expect(documentsTabIndex).toBeGreaterThan(peopleTabIndex)
    expect(toolsTabIndex).toBeGreaterThan(documentsTabIndex)
    expect(acceleratorTabIndex).toBeGreaterThan(toolsTabIndex)
    expect(source).toContain("<TabsList")
    expect(source).toContain('variant="line"')
    expect(source).toContain("ref={tabsListRef}")
    expect(source).toContain(
      '"h-11 w-full min-w-0 justify-start overflow-x-auto p-0 [scrollbar-width:none] group-data-[orientation=horizontal]/tabs:!h-11 md:h-7 md:w-auto md:group-data-[orientation=horizontal]/tabs:!h-7 [&::-webkit-scrollbar]:hidden"'
    )
    expect(source).not.toContain(
      'className="h-auto w-full min-w-0 self-end p-0 sm:w-auto"'
    )
    expect(source).toContain(
      "border-border/60 relative flex min-w-0 shrink-0 items-end px-4 pb-0.5 md:px-8"
    )
    expect(source).toContain(
      'drawerCollapsed ? "-mt-3 pt-0" : "border-b pt-0.5"'
    )
    expect(source).not.toContain(
      "border-border/60 relative flex min-w-0 shrink-0 items-end border-b px-4 pt-2 pb-1.5 md:px-8"
    )
    expect(source).not.toContain(
      "border-border/60 relative flex shrink-0 items-end border-b pt-5 pr-[calc(1rem+var(--workspace-drawer-toolbar-safe-left))] pb-1.5 pl-[calc(1rem+var(--workspace-drawer-toolbar-safe-left))]"
    )
    expect(source).not.toContain(
      "border-border/60 relative flex shrink-0 items-end border-b pt-5 pr-4 pb-1.5"
    )
    expect(source).not.toContain(
      "border-border/60 relative flex shrink-0 items-center border-b pt-5 pr-4 pb-3"
    )
    expect(source).toContain("pt-0.5")
    expect(source).not.toContain("pt-5")
    expect(source).toContain(
      "h-11 min-w-0 flex-none gap-2 px-3 py-2 text-left after:hidden md:h-7 md:px-2 md:py-1"
    )
    expect(source).not.toContain(
      "h-auto min-w-0 flex-1 gap-2 px-2 py-1.5 text-left after:hidden sm:flex-none"
    )
    expect(tabSource).toContain("const tabsHeaderRef = useRef<HTMLDivElement")
    expect(tabSource).toContain("const tabsListRef = useRef<HTMLDivElement")
    expect(tabSource).toContain("updateTabIndicator")
    expect(drawerSource).toContain(
      "export const WorkspaceCanvasOverlayDrawer = memo("
    )
    expect(drawerSource).toContain("function WorkspaceCanvasOverlayDrawer({")
    expect(drawerSource).toContain(
      "const [, startTabTransition] = useTransition()"
    )
    expect(drawerSource).toContain("const handleTabChange = useCallback(")
    expect(drawerSource).toContain("startTabTransition(() => {")
    expect(source).toContain('value={showSelectedTab ? tab : ""}')
    expect(source).toContain("onValueChange={handleTabChange}")
    expect(drawerSource).toContain("onSnap(next.snapPoint)")
    expect(source).not.toContain(
      "onValueChange={(value) =>\n                setTab(value as WorkspaceCanvasDrawerTab)\n              }"
    )
    expect(tabSource).toContain(
      '[data-slot="tabs-trigger"][data-state="active"]'
    )
    expect(source).toContain('data-workspace-data-drawer-tab-indicator="true"')
    expect(source).toContain(
      "bg-foreground absolute bottom-[-1px] left-0 z-10 h-0.5 rounded-full"
    )
    expect(source).toContain("transition-[transform,width,opacity]")
    expect(source).toContain("motion-reduce:transition-none")
    expect(source).toContain("width: `${tabIndicator.width}px`")
    expect(source).toContain("transform: `translateX(${tabIndicator.left}px)`")
    expect(source).toContain(
      "mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
    )
    expect(source).toContain(
      "mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
    )
    expect(source.match(/max-w-7xl/g)).toHaveLength(4)
    expect(source.match(/max-w-none/g)).toHaveLength(1)
    expect(source).not.toContain('value="finance"')
    expect(source).not.toContain('{tab === "finance" ? (')
    expect(source).not.toContain("<WorkspaceFinancePanel")
    expect(source).not.toContain("input={financeInput}")
    expect(source).toContain("WorkspaceToolsPanel")
    expect(source).toContain("financeInput.stripeConnection")
    expect(source).not.toContain("buildWorkspaceFinanceProgramInputs(")
    expect(source).not.toContain("programs.map((program)")
    expect(source).toContain("WorkspacePeopleDrawerPanel")
    expect(source).toContain("WorkspaceCanvasOverlayOrganizationPanel")
    expect(source).toContain("WorkspaceCanvasOverlayAcceleratorPanel")
    expect(source).toContain("WorkspaceCanvasOverlayRoadmapPanel")
    expect(source).not.toContain(
      "text-foreground truncate text-sm font-semibold"
    )
    expect(source).not.toContain("text-muted-foreground text-xs")
    expect(source).not.toContain("{people.length}")
    expect(source).not.toContain(">Workspace</p>")
    expect(source).not.toContain("UsersRoundIcon")
    expect(source).not.toContain("FileTextIcon")
    expect(source).not.toContain("icon:")
    expect(source).not.toContain("icon={<")
    expect(source).not.toContain("bg-muted/70 grid h-9 w-full grid-cols-2")
    expect(source).not.toContain("data-[state=active]:bg-background")
    expect(source).not.toContain(
      "flex h-auto w-full min-w-0 bg-transparent p-0 sm:w-auto"
    )
    expect(source).not.toContain("after:bottom-[-13px]")
    expect(source).not.toContain(
      "hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-accent"
    )
    expect(source).not.toContain("pt-4")
  })

  it("opens exact Accelerator deep links in the lazy drawer panel", () => {
    const drawerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const panelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-accelerator-panel.tsx"
    )
    const ontologySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-ontology.ts"
    )
    const nodeCardSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card.tsx"
    )
    const acceleratorPanelSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel.tsx"
    )
    const acceleratorPanelTypesSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel-types.ts"
    )
    const lazySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-accelerator-lazy.tsx"
    )

    expect(
      resolveWorkspaceAcceleratorDrawerRequest(
        "/workspace/accelerator?step=module-1%3Avideo&module=module-1&group=formation"
      )
    ).toEqual({
      tab: "accelerator",
      focusKey: null,
      acceleratorStepId: "module-1:video",
      acceleratorModuleId: "module-1",
      acceleratorLessonGroupKey: "formation",
    })
    expect(
      resolveWorkspaceAcceleratorDrawerRequest(
        "/workspace?drawer=accelerator&step=module-1%3Avideo&module=module-1&group=formation"
      )
    ).toEqual({
      tab: "accelerator",
      focusKey: null,
      acceleratorStepId: "module-1:video",
      acceleratorModuleId: "module-1",
      acceleratorLessonGroupKey: "formation",
    })
    expect(
      resolveWorkspaceAcceleratorDrawerRequest("/workspace/roadmap")
    ).toBeNull()

    expect(drawerSource).toContain('request?.tab ?? "organization"')
    expect(drawerSource).toContain("pendingAcceleratorRequest")
    expect(drawerSource).toContain("handledAcceleratorRequestIdRef")
    expect(drawerSource).toContain("dataDrawerTab: request.tab")
    expect(panelSource).toContain("WorkspaceBoardLazyAcceleratorCardPanel")
    expect(panelSource).toContain("WorkspaceAcceleratorBanner")
    expect(panelSource).toContain(
      "const showBanner = guideOverview || (!requestedModuleId && !isModuleViewerOpen)"
    )
    expect(panelSource).toContain(
      "introduction?.key === preferenceKey"
    )
    expect(panelSource).toContain("onRuntimeChange={handleRuntimeChange}")
    expect(panelSource).toContain("workspaceDrawerHeader={")
    expect(panelSource).toContain('presentationMode="workspace-drawer"')
    expect(panelSource).toContain(
      "initialModuleViewerOpen={Boolean(requestedModuleId)}"
    )
    expect(panelSource).toContain("initialOpenModuleId={requestedModuleId}")
    expect(panelSource).toContain("openStepRequest={openStepRequest}")
    expect(panelSource).toContain(
      "initialCurrentStepId: openStepRequest.stepId"
    )
    expect(panelSource).toContain("Build with the Accelerator")
    expect(lazySource).toContain("WorkspaceBoardAcceleratorCardPanelFallback")
    expect(lazySource).toContain("dynamic<WorkspaceAcceleratorCardPanelProps>")
    expect(ontologySource).toContain("resolveWorkspaceDataDrawerRequest")
    expect(ontologySource).toContain("activation.href")
    expect(ontologySource).toContain("onOpenDataDrawer(dataDrawerRequest)")
    expect(nodeCardSource).toContain("openWorkspaceDataDrawer({")
    expect(nodeCardSource).toContain('tab: "accelerator"')
    expect(nodeCardSource).toContain("acceleratorStepId: step.id")
    expect(nodeCardSource).toContain("router.push(href, { scroll: false })")
    expect(acceleratorPanelTypesSource).toContain(
      'presentationMode?: "embedded" | "fullscreen-route" | "workspace-drawer"'
    )
    expect(acceleratorPanelSource).toContain("onOpenStepRequestHandled")
    expect(acceleratorPanelSource).toContain(
      "if (overviewOnly || !initialOpenModuleId || openStepRequest) return"
    )
    expect(acceleratorPanelSource).toContain(
      'workspaceDrawerEmbedded\n              ? "grid-cols-1"'
    )
    expect(acceleratorPanelSource).toContain(
      '!(workspaceDrawerEmbedded && isModuleViewerOpen)'
    )
    expect(acceleratorPanelSource).toContain(
      "data-workspace-accelerator-drawer-scroll={"
    )
    expect(acceleratorPanelSource).toContain("<ScrollFadeEffect")
    expect(acceleratorPanelSource).toContain(
      "enabled={workspaceDrawerHasScrollableOverflow && !workspaceDrawerEmbedded}"
    )
    expect(acceleratorPanelSource).toContain(
      "fillAvailableHeight={!workspaceDrawerEmbedded}"
    )
    expect(acceleratorPanelSource).toContain(
      "touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
    )
    expect(acceleratorPanelSource).not.toContain(
      "[--mask-height:1.5rem]"
    )
    expect(acceleratorPanelSource).toContain(
      "{workspaceDrawerEmbedded ? workspaceDrawerHeader : null}"
    )
    expect(acceleratorPanelSource).not.toContain(
      "grid-cols-1 lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)]"
    )
    expect(acceleratorPanelSource).not.toContain(
      'workspaceDrawerEmbedded && isModuleViewerOpen && "hidden lg:flex"'
    )
  })

  it("opens roadmap sections in the workspace drawer without a return button", () => {
    const drawerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const panelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-roadmap-panel.tsx"
    )
    const tabsViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )
    const navigatorSource = readSource(
      "src/components/roadmap/roadmap-navigator-section.tsx"
    )
    const editorShellSource = readSource(
      "src/components/roadmap/roadmap-editor/components/roadmap-editor-shell.tsx"
    )
    const editorStateSource = readSource(
      "src/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state.ts"
    )
    const drawerHookSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-accelerator-drawer.ts"
    )

    expect(
      resolveWorkspaceRoadmapDrawerRequest(
        "/workspace?drawer=roadmap&section=origin-story"
      )
    ).toEqual({
      tab: "roadmap",
      roadmapSectionSlug: "origin-story",
    })
    expect(
      resolveWorkspaceRoadmapDrawerRequest("/workspace/roadmap/origin-story")
    ).toEqual({
      tab: "roadmap",
      roadmapSectionSlug: "origin-story",
    })
    expect(
      resolveWorkspaceRoadmapDrawerRequest("/workspace/accelerator")
    ).toBeNull()

    expect(drawerSource).toContain(
      "data-workspace-data-drawer-request-roadmap-section="
    )
    expect(tabsViewSource).not.toContain(
      '<WorkspaceDrawerTabTrigger value="roadmap">'
    )
    expect(tabsViewSource).toMatch(
      /<WorkspaceRetainedPanel[^>]+value="roadmap"/
    )
    expect(panelSource).toContain("<RoadmapEditor")
    expect(panelSource).toContain('navigationMode="embedded"')
    expect(panelSource).toContain("showRightRail={false}")
    expect(panelSource).toContain("initialSectionId={initialSectionId}")
    expect(editorShellSource).toContain("{showRightRail ? (")
    expect(editorStateSource).toContain(
      "initialSectionId === activeIdRef.current"
    )
    expect(navigatorSource).toContain("getWorkspaceRoadmapDrawerPath")
    expect(navigatorSource).toContain(
      "requestWorkspaceRoadmapDrawer(next.slug)"
    )
    expect(drawerHookSource).toContain(
      "listenForWorkspaceRoadmapDrawerRequests"
    )
    expect(drawerHookSource).toContain("open(nextRequest)")
    expect(editorShellSource).not.toContain("Return To Workspace")
    expect(editorShellSource).not.toContain("roadmapReturnButton")
  })

  it("opens organization editor deep links in the first drawer tab", () => {
    const drawerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const panelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-organization-panel.tsx"
    )
    const drawerTabsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs.ts"
    )
    const tabsViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )
    const editorViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/my-organization-editor-view.tsx"
    )
    const deepLinkFocusSource = readSource(
      "src/components/organization/org-profile-card/organization-deep-link-focus.ts"
    )
    const controllerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-accelerator-drawer.ts"
    )
    const pageSource = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx"
    )
    const pageStateSource = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-state.ts"
    )
    const nodeCardSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card.tsx"
    )
    const cardHeaderSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-card-header.tsx"
    )
    const profileHeaderControlsSource = readSource(
      "src/components/organization/org-profile-card/header-controls.tsx"
    )

    expect(
      resolveWorkspaceOrganizationDrawerRequest(
        "/workspace?view=editor&tab=programs&programId=program-1"
      )
    ).toEqual({
      tab: "organization",
      organizationTab: "programs",
      organizationProgramId: "program-1",
      organizationFocus: null,
      organizationEditMode: true,
    })
    expect(
      resolveWorkspaceOrganizationDrawerRequest(
        "/workspace?view=editor&tab=company&focus=mission"
      )
    ).toEqual({
      tab: "organization",
      organizationTab: "company",
      organizationProgramId: null,
      organizationFocus: "mission",
      organizationEditMode: true,
    })
    expect(
      resolveWorkspaceOrganizationDrawerRequest(
        "/workspace?drawer=organization"
      )
    ).toEqual({
      tab: "organization",
      organizationTab: "company",
      organizationProgramId: null,
      organizationFocus: null,
      organizationEditMode: false,
    })
    expect(resolveWorkspaceOrganizationDrawerRequest("/workspace")).toBeNull()

    expect(tabsViewSource).toMatch(
      /<WorkspaceDrawerTabTrigger\s+value="organization"/
    )
    expect(tabsViewSource).toContain('value="organization"')
    expect(tabsViewSource).toContain("<WorkspaceCanvasOverlayOrganizationPanel")
    expect(panelSource).toContain("MyOrganizationEditorView")
    expect(panelSource).toContain("dynamic<")
    expect(panelSource).not.toContain("organization-request:${request.id}")
    expect(panelSource).toContain("navigationRequestId={destination?.id}")
    expect(panelSource).toContain("resolveRetainedDrawerRequest(")
    expect(panelSource).toContain("!programEditorOpen")
    expect(panelSource).toContain("initialTab={")
    expect(panelSource).toContain("initialProgramId={")
    expect(panelSource).toContain("initialProgramStep={")
    expect(panelSource).toContain("initialFocus={")
    expect(panelSource).toContain("initialEditMode={")
    expect(drawerTabsSource).toContain(
      "organizationProgramStep?: number | null"
    )
    expect(editorViewSource).toContain("initialProgramStep?: number | null")
    expect(editorViewSource).toContain(
      "initialProgramStep={initialProgramStep}"
    )
    expect(editorViewSource).toContain(
      'data-organization-scroll-viewport="true"'
    )
    expect(deepLinkFocusSource).toContain(
      "scrollOrganizationFocusTarget(target)"
    )
    expect(deepLinkFocusSource).toContain("viewport.scrollTo({")
    expect(deepLinkFocusSource).toContain(
      "target.focus({ preventScroll: true })"
    )
    expect(panelSource).toContain(
      'className="mx-auto box-border w-full max-w-3xl min-w-0 p-2 select-text sm:p-3 [&_[data-slot=organization-profile-section]]:grid-cols-1 [&_div:has(>[data-slot=organization-profile-field])]:grid-cols-1"'
    )
    expect(controllerSource).toContain(
      "organizationEditorData.initialProfileTab"
    )
    expect(controllerSource).toContain("organizationEditorData.initialEditMode")
    expect(controllerSource).toContain('tab: "organization"')
    expect(nodeCardSource).toContain("handleOrganizationEditorOpen")
    expect(nodeCardSource).toContain('tab: "organization"')
    expect(nodeCardSource).toContain("organizationEditMode: true")
    expect(cardHeaderSource).toContain("onEditorOpen")
    expect(cardHeaderSource).toContain("event.preventDefault()")
    expect(pageStateSource).toContain("const organizationEditorRequested =")
    expect(pageStateSource).toContain("initialProfileTab:")
    expect(pageSource).toContain("resolveInitialWorkspaceDrawerData")
    expect(pageSource).not.toContain("showLegacyEditor")
    expect(profileHeaderControlsSource).toContain("View map profile")
    expect(profileHeaderControlsSource).toContain(
      'className="flex flex-wrap items-center justify-end gap-2 pb-3"'
    )
    expect(profileHeaderControlsSource).not.toContain(
      'className="absolute top-6 left-1/2 flex -translate-x-1/2 gap-2"'
    )
    expect(profileHeaderControlsSource).not.toContain("Return to workspace")
    expect(profileHeaderControlsSource).not.toContain("onCloseToWorkspace")
  })

  it("round-trips every canonical workspace drawer URL", () => {
    const drawerHookSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-accelerator-drawer.ts"
    )

    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=organization")
    ).toMatchObject({ tab: "organization" })
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=accelerator")
    ).toMatchObject({ tab: "accelerator" })
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=roadmap")
    ).toMatchObject({ tab: "roadmap" })
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=people")
    ).toEqual({ tab: "people" })
    expect(
      resolveWorkspaceDataDrawerRequest(
        "/workspace?drawer=documents&focus=state+filing"
      )
    ).toEqual({ tab: "documents", focusKey: "state filing" })
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=finance")
    ).toBeNull()
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=tools")
    ).toEqual({ tab: "tools" })
    expect(drawerHookSource).toContain('initialDrawerTab === "finance"')
    expect(drawerHookSource).toContain('return { tab: "finance" }')
    expect(drawerHookSource).toContain('initialDrawerTab === "tools"')
    expect(drawerHookSource).toContain('return { tab: "tools" }')
    expect(
      resolveWorkspaceDataDrawerRequest("/workspace?drawer=unknown")
    ).toBeNull()
    expect(
      resolveWorkspaceDataDrawerRequest(
        "/workspace?drawer=accelerator&view=editor&tab=company"
      )
    ).toMatchObject({ tab: "accelerator" })
  })

  it("retains Documents after first selection and scopes its request identity", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )
    const tabsViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs-view.tsx"
    )

    expect(tabsViewSource).toContain(
      'import { DocumentsTab } from "@/components/organization/org-profile-card/tabs/documents-tab"'
    )
    expect(source).toContain("DocumentsTabData")
    expect(source).toContain("viewerId: string")
    expect(source).toContain("documentsTab: DocumentsTabData")
    expect(tabsViewSource).toMatch(
      /<WorkspaceRetainedPanel[^>]+value="documents"/
    )
    expect(tabsViewSource).toContain("<DocumentsTab")
    expect(tabsViewSource).toContain("userId={viewerId}")
    expect(tabsViewSource).toContain("{...documentsTab}")
    expect(tabsViewSource).toContain("editMode={canEdit}")
    expect(source).toContain("request?: WorkspaceDataDrawerRequest | null")
    expect(source).toContain("setTab(request.tab)")
    expect(source).toContain(
      "resolveWorkspaceDataDrawerRequestSnapPoint(request)"
    )
    expect(source).toContain("useLayoutEffect(() => {")
    expect(tabsViewSource).toContain("focusRequestId={documentsRequest?.id}")
    expect(tabsViewSource).toContain("initialFocusKey={")
    expect(tabsViewSource).toContain("overflow-y-auto overscroll-contain")
    expect(tabsViewSource).not.toContain("<WorkspaceBoardVaultCard")
    expect(tabsViewSource).not.toContain("mode={vaultViewMode}")
    expect(tabsViewSource).not.toContain("onModeChange={onVaultViewModeChange}")
  })

  it("persists people segments with tap, picker, and drag grouping affordances", () => {
    const tableLayoutSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-table-layout.tsx"
    )
    const tableFillSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-table-fill.tsx"
    )
    const addMenuSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-add-menu.tsx"
    )
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-panel.tsx"
    )
    const peopleFilteringSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-filtering.ts"
    )
    const tableSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table.tsx"
    )
    const tableContractSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-contract.ts"
    )
    const tableBodySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-body.tsx"
    )
    const controlsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-controls.tsx"
    )
    const segmentPersonPickerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-segment-person-picker.tsx"
    )
    const tableCellsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-cells.tsx"
    )
    const canvasCellSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-people-drawer-canvas-cell.tsx"
    )
    const tableColumnsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-columns.tsx"
    )
    const tableMultiValueCellsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-multi-value-cells.tsx"
    )
    const tableMultiValuePreviewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-multi-value-preview.tsx"
    )
    const tagBadgeSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-tag-badge.tsx"
    )
    const tagEditorSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-tag-editor-dialog.tsx"
    )
    const tagStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-people-tags.ts"
    )
    const tagActionsSource = readSource("src/actions/people-tags.ts")
    const tagMigrationSource = readSource(
      "supabase/migrations/20260801143000_add_organization_people_tags.sql"
    )
    const tableToolbarSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-toolbar.tsx"
    )
    const tableSizingSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-sizing.tsx"
    )
    const tablePreferencesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-preferences.ts"
    )
    const tableSelectionActionsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-selection-actions.tsx"
    )
    const peopleDndSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-dnd.ts"
    )
    const peopleTablePaginationSource = readSource(
      "src/components/people/people-table-pagination.tsx"
    )
    const segmentTypesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-segment-types.ts"
    )
    const railSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-segment-rail.tsx"
    )
    const contentHeaderSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-segment-content-header.tsx"
    )
    const segmentStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-people-segments.ts"
    )
    const segmentActionsSource = readSource("src/actions/people-segments.ts")
    const segmentLoaderSource = readSource(
      "src/app/(dashboard)/my-organization/_lib/workspace-people-segments.ts"
    )
    const segmentMigrationSource = readSource(
      "supabase/migrations/20260801130500_add_organization_people_segments.sql"
    )

    expect(source).toContain("WorkspacePeopleSegmentRail")
    expect(source).not.toContain("WorkspacePeopleSegmentContentHeader")
    expect(railSource).toContain("WorkspacePeopleSegmentActions")
    expect(source).toContain("editingSegmentId")
    expect(source).toContain("handleCreateSegment")
    expect(source).toContain("setEditingSegmentId(nextSegment.id)")
    expect(source).toContain("handleRenameSegment")
    expect(source).toContain("handleRemoveSegment")
    expect(source).toContain("memberIds")
    expect(source).toContain("WORKSPACE_PERSON_DRAG_TYPE")
    expect(source).toContain("writeWorkspaceCanvasPersonDragPayload")
    expect(source).toContain("readWorkspaceCanvasPersonDragPayload")
    expect(source).toContain(
      "writeWorkspaceCanvasPersonDragPayload(\n          event.dataTransfer,\n          normalizedPersonIds\n        )"
    )
    expect(segmentStateSource).toContain(
      "addOrganizationPeopleSegmentMembersAction"
    )
    expect(segmentStateSource).toContain(
      "removeOrganizationPeopleSegmentMembersAction"
    )
    expect(segmentStateSource).toContain(
      "createOrganizationPeopleSegmentAction"
    )
    expect(segmentStateSource).toContain(
      "const nextSegments = buildInitialCustomSegments(initialSegments)"
    )
    expect(segmentStateSource).toContain("setCustomSegments(nextSegments)")
    expect(segmentStateSource).toContain(
      "createWorkspacePeopleMutationCoordinator"
    )
    expect(segmentStateSource).toContain("mutationCoordinator.run(mutationKey")
    expect(segmentStateSource).toContain(
      "renameOrganizationPeopleSegmentAction"
    )
    expect(segmentStateSource).toContain(
      "deleteOrganizationPeopleSegmentAction"
    )
    expect(segmentActionsSource).toContain("resolveSegmentManagementAccess")
    expect(segmentActionsSource).toContain("canEditOrganization(role)")
    expect(segmentActionsSource).not.toContain(
      "ORGANIZATION_PEOPLE_SEGMENTS_PROFILE_KEY"
    )
    expect(segmentActionsSource).not.toContain("writeFallbackSegments")
    expect(segmentLoaderSource).not.toContain(
      "ORGANIZATION_PEOPLE_SEGMENTS_PROFILE_KEY"
    )
    expect(segmentLoaderSource).toContain(
      '.from("organization_people_segments")'
    )
    expect(segmentLoaderSource).toContain(
      '.from("organization_people_segment_members")'
    )
    expect(segmentMigrationSource).toContain(
      "alter table organization_people_segments force row level security"
    )
    expect(segmentMigrationSource).toContain(
      'create policy "organization_people_segments_update"'
    )
    expect(segmentMigrationSource).toContain(
      'create policy "organization_people_segment_members_insert"'
    )
    expect(source).toContain("setActiveSegmentDropId(segment.id)")
    expect(source).toContain("addPeopleToSegment(segmentId, personIds)")
    expect(source).not.toContain(
      "addPeopleToSegment(segmentId, personIds)\n        setSelectedSegmentId(segmentId)"
    )
    expect(source).toContain("canManageSegments={canEdit}")
    expect(peopleDndSource).toContain("WORKSPACE_CANVAS_PERSON_DRAG_TYPE")
    expect(peopleDndSource).toContain("WORKSPACE_CANVAS_PEOPLE_DRAG_TYPE")
    expect(peopleDndSource).toContain(
      "export function writeWorkspaceCanvasPersonDragPayload"
    )
    expect(peopleDndSource).toContain("JSON.stringify(normalizedPersonIds)")
    expect(peopleDndSource).toContain(
      "export function readWorkspaceCanvasPersonDragPayload"
    )
    expect(peopleDndSource).toContain(
      "personId?.trim() ? normalizeWorkspaceCanvasPersonIds([personId]) : []"
    )
    expect(source).toContain("useDeferredValue")
    expect(source).toContain("const [peopleSearch, setPeopleSearch]")
    expect(source).toContain(
      "const deferredPeopleSearch = useDeferredValue(peopleSearch)"
    )
    expect(peopleFilteringSource).toContain("function personMatchesSearch(")
    expect(peopleFilteringSource).toContain("function personMatchesCategory(")
    expect(peopleFilteringSource).toContain("function buildPersonTagLabels(")
    expect(source).not.toContain("hydratePeopleTags")
    expect(peopleFilteringSource).toContain(
      "if (!query) return categoryFilteredPeople"
    )
    expect(source).toContain("filteredSelectedPeople")
    expect(source).not.toContain("filteredAvailablePeople")
    expect(source).not.toContain("People available for")
    expect(source.match(/<WorkspacePeopleDrawerTable/g) ?? []).toHaveLength(1)
    expect(source).toContain(
      "const [peopleCategoryFilter, setPeopleCategoryFilter] = useState<"
    )
    expect(peopleFilteringSource).toContain(
      "personMatchesCategory(person, categoryFilter)"
    )
    expect(source).toContain("No people match your search.")
    expect(source).toContain("WorkspacePeopleDrawerControls")
    expect(source).toContain("people={people}")
    expect(source).toContain("canEdit={canEdit}")
    expect(source).toContain("searchValue={peopleSearch}")
    expect(source).toContain("onSearchChange={setPeopleSearch}")
    expect(source).toContain("categoryFilter={peopleCategoryFilter}")
    expect(source).toContain("onCategoryFilterChange={setPeopleCategoryFilter}")
    expect(source).toContain("customSegment={selectedCustomSegment}")
    expect(source).toContain("availablePeople={availablePeople}")
    expect(source).toContain("onAddPeopleToSegment={handleAddPeople}")
    expect(source).toContain(
      "No people in ${selectedCustomSegment.label} yet. Use Add people"
    )
    expect(controlsSource).toContain('from "@/components/ui/input"')
    expect(controlsSource).toContain('from "@/features/people-roles/client"')
    expect(addMenuSource).toContain(
      'from "@/components/people/create-person-dialog"'
    )
    expect(controlsSource).toContain('from "@/lib/people/roles"')
    expect(controlsSource).toContain(
      "export const WorkspacePeopleDrawerControls"
    )
    expect(controlsSource).toContain(
      "flex min-w-0 flex-wrap items-center gap-1.5"
    )
    expect(controlsSource).toContain('id="workspace-people-search"')
    expect(controlsSource).toContain('placeholder="Search people…"')
    expect(controlsSource).toContain('className="h-8 rounded-xl pl-8 text-sm"')
    expect(controlsSource).toContain('aria-label="Search workspace people"')
    expect(controlsSource).toContain("WorkspacePeopleSegmentPersonPicker")
    expect(controlsSource).toContain("customSegment && canEdit ? (")
    expect(controlsSource).toContain("PersonRoleFilter")
    const roleFilterSource = readFileSync(join(process.cwd(), "src/features/people-roles/components/person-role-filter.tsx"), "utf8")
    expect(roleFilterSource).toContain('aria-label="Filter workspace people by role"')
    expect(roleFilterSource).toContain("CommandInput")
    expect(roleFilterSource).toContain("All roles")
    expect(source).toContain("WorkspacePeopleAddMenu")
    expect(controlsSource).not.toContain("WorkspacePeopleAddMenu")
    expect(addMenuSource).toContain("Add segment")
    expect(addMenuSource).toContain("Add contact")
    expect(addMenuSource).toContain("onCloseAutoFocus")
    expect(addMenuSource).toContain("open={contactOpen}")
    expect(controlsSource).not.toContain('from "@/components/ui/table"')
    expect(
      segmentPersonPickerSource.match(/<CommandInput/g) ?? []
    ).toHaveLength(1)
    expect(segmentPersonPickerSource).toContain("PopoverAnchor")
    expect(segmentPersonPickerSource).not.toContain("PopoverTrigger")
    expect(segmentPersonPickerSource).toContain("CommandItem")
    expect(segmentPersonPickerSource.indexOf("<CommandInput")).toBeLessThan(
      segmentPersonPickerSource.indexOf("<PopoverContent")
    )
    expect(segmentPersonPickerSource).toContain(
      "`Add people to ${segmentLabel}…`"
    )
    expect(segmentPersonPickerSource).toContain('aria-multiselectable="true"')
    expect(segmentPersonPickerSource).toContain("selectedPersonIds")
    expect(segmentPersonPickerSource).toContain(
      "onSelect={() => togglePerson(person.id)}"
    )
    expect(segmentPersonPickerSource).toContain(
      'data-workspace-people-segment-add-control="true"'
    )
    expect(segmentPersonPickerSource).toContain(
      "onAddPeople(selectedPersonIds)"
    )
    expect(segmentPersonPickerSource).toContain(
      "Add ${selectedPersonIds.length}"
    )
    expect(segmentPersonPickerSource).toContain(
      "w-[var(--radix-popover-trigger-width)]"
    )
    expect(canvasCellSource).toContain("GripVerticalIcon")
    expect(canvasCellSource).toContain(
      'data-workspace-people-drag-handle="true"'
    )
    expect(tableBodySource).toContain(
      'data-workspace-person-placed={placed ? "true" : undefined}'
    )
    expect(tableBodySource).toContain("data-workspace-person-dragging={")
    expect(canvasCellSource).toContain("On workspace")
    expect(canvasCellSource).toContain(
      'className="ml-auto flex items-center justify-end"'
    )
    expect(canvasCellSource).not.toContain(
      'className="flex items-center justify-center"'
    )
    expect(tableCellsSource).toContain("Add to segment")
    expect(tableCellsSource).toContain("Remove from segment")
    expect(tableCellsSource).toContain("Add to canvas")
    expect(tableCellsSource).toContain("Remove from canvas")
    expect(tableCellsSource).toContain("WorkspacePeopleDrawerActionCell")
    expect(tableCellsSource).toContain("DropdownMenuTrigger")
    expect(tableCellsSource).toContain("DropdownMenuGroup")
    expect(tableCellsSource).toContain("DropdownMenuItem")
    expect(tableCellsSource).toContain("EllipsisIcon")
    expect(tableCellsSource).toContain("updatePersonCategoryAction")
    expect(tableCellsSource).toContain("<PersonRolePicker")
    expect(tableCellsSource).toContain("throw new Error(result.error)")
    expect(tableColumnsSource).toContain("canEdit={canEdit}")
    expect(tableColumnsSource).toContain('role: "Role"')
    expect(tableColumnsSource).toContain('segments: "Segments"')
    expect(tableColumnsSource).toContain('tags: "Tags"')
    expect(tableColumnsSource).toContain("WorkspacePeopleDrawerSegmentsCell")
    expect(tableColumnsSource).toContain("WorkspacePeopleDrawerTagsCell")
    expect(tableMultiValueCellsSource).toContain('aria-multiselectable="true"')
    expect(tableMultiValueCellsSource).toContain("onAdd(segment.id, person.id)")
    expect(tableMultiValueCellsSource).toContain(
      "onRemove(segment.id, person.id)"
    )
    expect(tableMultiValueCellsSource).toContain("Find tags…")
    expect(tableMultiValueCellsSource).toContain("Find or create segments…")
    expect(tableMultiValueCellsSource).toContain(
      "controlledOpen ?? uncontrolledOpen"
    )
    expect(tableSource).toContain("openSegmentMenuPersonId")
    expect(tableSource).toContain("openTagMenuPersonId")
    expect(tableColumnsSource).toContain(
      "open={openSegmentMenuPersonId === row.original.id}"
    )
    expect(tableColumnsSource).toContain(
      "open={openTagMenuPersonId === row.original.id}"
    )
    expect(tableMultiValueCellsSource).toContain("Create “{normalizedQuery}”")
    expect(tableMultiValueCellsSource).toContain(
      '<PopoverContent align="start" className="w-72 p-0">'
    )
    expect(source).toContain("handleCreateSegmentForPerson")
    expect(source).toContain(
      "createSegment(label, () => undefined, [personId])"
    )
    expect(segmentActionsSource).toContain("memberIds: normalizedPersonIds")
    expect(tableMultiValueCellsSource).toContain("WorkspacePeopleTagBadge")
    expect(tableMultiValuePreviewSource).toContain("const visibleCount = 1")
    expect(tableMultiValuePreviewSource).toContain("visibleItems.map")
    expect(tableMultiValuePreviewSource).toContain("PreviewOverflowBadge")
    expect(tableMultiValuePreviewSource).toContain("hiddenLabels.join")
    expect(tableMultiValuePreviewSource).toContain(
      'className="h-5 w-fit min-w-0 shrink-0 rounded-full px-2 tabular-nums"'
    )
    expect(tableMultiValuePreviewSource).toContain(
      'cn("w-fit min-w-0 shrink", pillMaxWidth)'
    )
    expect(tableMultiValuePreviewSource).not.toContain(
      '"w-full max-w-none justify-start"'
    )
    expect(tableMultiValueCellsSource).toContain(
      '"h-auto min-h-7 w-fit max-w-full min-w-0 justify-start rounded-lg bg-transparent p-0 shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"'
    )
    expect(tableMultiValueCellsSource).toContain(
      'labels.length === 0 && "h-8 w-full px-1"'
    )
    expect(tableMultiValueCellsSource).toContain(
      'selectedTags.length === 0 && "h-8 w-full px-1"'
    )
    expect(tableMultiValueCellsSource).not.toContain(
      'emptyLabel="Add to segment"'
    )
    expect(tableMultiValueCellsSource).not.toContain(
      '<span className="text-muted-foreground">Add tags</span>'
    )
    expect(
      tableMultiValueCellsSource.match(
        /<PlusIcon className="text-muted-foreground\/45" aria-hidden \/>/g
      )
    ).toHaveLength(2)
    expect(tableMultiValuePreviewSource).toContain(
      "inline-flex w-fit max-w-full"
    )
    expect(tableMultiValueCellsSource).toContain(
      "WorkspacePeopleTagEditorDialog"
    )
    expect(tagBadgeSource).toContain("<Badge")
    expect(tagEditorSource).toContain("ORGANIZATION_PEOPLE_TAG_COLOR_OPTIONS")
    expect(tagEditorSource).toContain("Delete tag")
    expect(tagStateSource).toContain("createOrganizationPeopleTagAction")
    expect(tagStateSource).toContain("updateOrganizationPeopleTagAction")
    expect(tagStateSource).toContain("deleteOrganizationPeopleTagAction")
    expect(tagStateSource).toContain("createWorkspacePeopleMutationCoordinator")
    expect(tagStateSource).toContain("confirmedTags")
    expect(tagStateSource).toContain("mutationCoordinator.run(mutationKey")
    expect(tagStateSource).toContain(
      "mutationCoordinator.isLatest(mutationToken)"
    )
    expect(tagActionsSource).toContain("resolveTagManagementAccess")
    expect(tagActionsSource).toContain("resolveOrganizationPeopleTagId")
    expect(tagActionsSource).toContain("isOrganizationPeopleTagUuid")
    expect(tagActionsSource).not.toContain("getLegacyOrganizationPeopleTagKey")
    expect(tagMigrationSource).toContain(
      "alter table organization_people_tags force row level security"
    )
    expect(tagMigrationSource).toContain(
      'create policy "organization_people_tag_members_insert"'
    )
    expect(tableCellsSource).toContain(
      "aria-label={`Actions for ${person.name}`}"
    )
    expect(tableCellsSource).toContain('size="icon"')
    expect(canvasCellSource).toContain(
      "Drag to place ${person.name}, or double-click to show on canvas"
    )
    expect(canvasCellSource).toContain(
      "onDoubleClick={(event) => {"
    )
    expect(tableCellsSource).toContain(
      "border-border bg-muted/40 text-muted-foreground inline-flex h-6 items-center gap-2 rounded-lg border px-2 text-xs font-medium"
    )
    expect(tableCellsSource).toContain('"size-1.5 shrink-0 rounded-full"')
    expect(tableCellsSource).toContain("PERSON_CATEGORY_META[person.category].dotClass")
    expect(tableCellsSource).not.toContain("categoryMeta.badgeClass")
    expect(railSource).toContain("ToggleGroup")
    expect(source).toContain("canManageSegments")
    expect(railSource).toContain("canManageSegments: boolean")
    expect(railSource).toContain("canManageSegments,")
    expect(railSource).toContain("canManageSegments ? (")
    expect(railSource).toContain("spacing={1}")
    expect(railSource).toContain("Editable")
    expect(railSource).toContain("EditableInput")
    expect(railSource).toContain("EditableSubmit")
    expect(railSource).toContain("EditableCancel")
    expect(railSource).not.toContain("data-workspace-people-segment-add")
    expect(source).toContain("onCreateSegment={handleCreateSegment}")
    expect(railSource).toContain("overflow-x-auto")
    expect(railSource).toContain("bg-muted/70 h-8 w-max rounded-xl p-1 shadow-none")
    expect(railSource).toContain("motion-safe:animate-in")
    expect(railSource).toContain(
      "onDragOver={(event) => onSegmentDragOver(segment, event)}"
    )
    expect(railSource).toContain(
      "onDragEnter={(event) => onSegmentDragEnter(segment, event)}"
    )
    expect(railSource).toContain(
      "onDragLeave={(event) => onSegmentDragLeave(segment.id, event)}"
    )
    expect(railSource).toContain("data-workspace-people-segment-drop-target={")
    expect(railSource).toContain("Drop ${draggingPersonCount === 1")
    expect(railSource).toContain("onDrop={(event) => {")
    expect(railSource).toContain("if (custom) onPersonDrop(segment.id, event)")
    expect(railSource).toContain(
      "const selectedCustomSegment = custom && selectedSegmentId === segment.id"
    )
    expect(railSource).toContain(
      "{selectedCustomSegment && canManageSegments ? ("
    )
    expect(railSource).toContain("onEditSegment={onEditSegment}")
    expect(railSource).toContain("onRemoveSegment={onRemoveSegment}")
    expect(railSource).not.toContain("PencilIcon")
    expect(railSource).not.toContain("Trash2Icon")
    expect(railSource).not.toContain("rounded-r-none")
    expect(contentHeaderSource).toContain("Popover")
    expect(contentHeaderSource).toContain("canManageSegments: boolean")
    expect(contentHeaderSource).toContain("canManageSegments,")
    expect(contentHeaderSource).toContain("canManageSegments ? (")
    expect(contentHeaderSource).toContain("PopoverTrigger")
    expect(contentHeaderSource).toContain("PopoverContent")
    expect(contentHeaderSource).toContain("PopoverClose")
    expect(contentHeaderSource).toContain('from "@/components/ui/alert-dialog"')
    expect(contentHeaderSource).toContain("AlertDialog")
    expect(contentHeaderSource).toContain("AlertDialogContent")
    expect(contentHeaderSource).toContain("AlertDialogTitle")
    expect(contentHeaderSource).toContain("AlertDialogDescription")
    expect(contentHeaderSource).toContain("AlertDialogCancel")
    expect(contentHeaderSource).toContain("AlertDialogAction")
    expect(contentHeaderSource).toContain("MoreHorizontalIcon")
    expect(contentHeaderSource).toContain("PencilIcon")
    expect(contentHeaderSource).toContain("Trash2Icon")
    expect(contentHeaderSource).toContain("Manage ${segment.label}")
    expect(contentHeaderSource).toContain("onEditSegment(segment.id)")
    expect(contentHeaderSource).toContain(
      "const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)"
    )
    expect(contentHeaderSource).toContain("handleConfirmRemoveSegment")
    expect(contentHeaderSource).toContain(
      "onClick={() => setConfirmRemoveOpen(true)}"
    )
    expect(contentHeaderSource).not.toContain(
      "onClick={() => onRemoveSegment(segment.id)}"
    )
    expect(contentHeaderSource).toContain("Delete {segment.label}?")
    expect(contentHeaderSource).toContain(
      "This deletes the custom segment only."
    )
    expect(contentHeaderSource).toContain("Delete segment")
    expect(contentHeaderSource).toContain("onRemoveSegment(segment.id)")
    expect(contentHeaderSource).not.toContain("segment.count === 1")
    expect(source).not.toContain('from "@/components/ui/table"')
    expect(tableSource).toContain('from "@/components/ui/table"')
    expect(tableSource).not.toContain('from "@/components/ui/dropdown-menu"')
    expect(tableToolbarSource).toContain('from "@/components/ui/dropdown-menu"')
    expect(tableColumnsSource).toContain('from "@/components/ui/checkbox"')
    expect(source).toContain("WorkspacePeopleDrawerTable")
    expect(source).toContain("onAddPeopleToCanvas")
    expect(source).toContain("viewerId={viewerId}")
    expect(source).toContain('from "./workspace-canvas-overlay-people-table"')
    expect(source).toContain(
      'from "./workspace-canvas-overlay-people-controls"'
    )
    expect(source).toContain('from "./workspace-canvas-people-segment-types"')
    expect(source).not.toContain("export type WorkspacePeopleSegment")
    expect(source).not.toContain("export type WorkspaceCustomPeopleSegment")
    expect(segmentTypesSource).toContain("export type WorkspacePeopleSegment")
    expect(segmentTypesSource).toContain(
      "export type WorkspaceCustomPeopleSegment"
    )
    expect(railSource).toContain(
      'from "./workspace-canvas-people-segment-types"'
    )
    expect(contentHeaderSource).toContain(
      'from "./workspace-canvas-people-segment-types"'
    )
    expect(railSource).not.toContain(
      'from "./workspace-canvas-overlay-people-panel"'
    )
    expect(contentHeaderSource).not.toContain(
      'from "./workspace-canvas-overlay-people-panel"'
    )
    expect(source).toContain("export const WorkspacePeopleDrawerPanel = memo(")
    expect(source).toContain("function WorkspacePeopleDrawerPanel({")
    expect(source).toContain(
      "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    )
    expect(tableLayoutSource).toContain(
      'className="min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden"'
    )
    expect(tableLayoutSource).toContain(
      'viewportClassName="h-full max-w-full overscroll-contain touch-pan-x touch-pan-y [&>div]:!h-full [&>div]:!block [&>div]:!w-full [&>div]:!max-w-full [&>div]:!min-w-0"'
    )
    expect(tableLayoutSource).toContain(
      'contentClassName="flex h-full min-h-0 max-w-full flex-col [&>*]:min-w-0"'
    )
    expect(source).not.toContain(
      "const WorkspacePeopleDrawerTable = memo(function WorkspacePeopleDrawerTable"
    )
    expect(tableSource).toContain(
      "export const WorkspacePeopleDrawerTable = memo("
    )
    expect(tableSource).toContain("function WorkspacePeopleDrawerTable(props")
    expect(tableSource).toContain(
      "function WorkspacePeopleDrawerTableContent({"
    )
    expect(tableSource).toContain("buildWorkspacePeopleDrawerColumns")
    expect(tableSource).toContain("WorkspacePeopleDrawerTableToolbar")
    expect(tableSource).toContain("PeopleTablePagination")
    expect(tableContractSource).toContain("allPeople: OrgPersonWithImage[]")
    expect(tableContractSource).toContain("viewerId: string")
    expect(tableContractSource).toContain(
      "onAddPeopleToCanvas: (personIds: string[]) => number"
    )
    expect(tableContractSource).toContain(
      "onRemovePersonFromCanvas: (personId: string) => void"
    )
    expect(tableSource).toContain("const peopleById = useMemo(")
    expect(tableSource).toContain("        peopleById,")
    expect(tableSource).toContain("viewerId={viewerId}")
    expect(tableSource).toContain("canEdit={canEdit}")
    expect(tableSource).toContain("onAddPeopleToCanvas={onAddPeopleToCanvas}")
    expect(tableSource).toContain(
      "        onRemovePersonFromCanvas,"
    )
    expect(tableContractSource).toContain(
      "onDragStart: (personIds: string[], event: DragEvent<HTMLElement>) => void"
    )
    expect(tableBodySource).toContain("const resolveRowDragPersonIds =")
    expect(tableBodySource).toContain("row?.getIsSelected()")
    expect(tableBodySource).toContain(".getSelectedRowModel()")
    expect(tableBodySource).toContain(
      "onDragStart(resolveRowDragPersonIds(person), event)"
    )
    expect(tableSource).toContain("onAddToSegment={(personIds) => personIds.forEach(onAdd)}")
    expect(tableSource).toContain("personIds.forEach(onAdd)")
    expect(tableSource).toContain("onRemoveFromSegment={(personIds) => personIds.forEach(onRemove)}")
    expect(tableSource).toContain("personIds.forEach(onRemove)")
    expect(tableSource).toContain('className="flex min-h-full w-full flex-col border-collapse"')
    expect(tableSource).toContain("const columnSizeVars = useMemo(")
    expect(tableSizingSource).toContain(
      "sizeVars[`--header-${header.id}-size`]"
    )
    expect(tableSizingSource).toContain(
      "sizeVars[`--col-${header.column.id}-size`]"
    )
    expect(tableFillSource).toContain("calc(var(--col-${columnId}-size) * 1px)")
    expect(tableBodySource).toContain("workspacePeopleColumnStyle(cell.column.id, cell.column.getCanResize())")
    expect(tableBodySource).not.toContain("cell.column.getSize()")
    expect(tableBodySource).toContain("tableBodyPropsAreEqual")
    expect(tableBodySource).toContain(
      "previous.columnDefinitions === next.columnDefinitions"
    )
    expect(tableSource).toContain("columnDefinitions={columns}")
    expect(tableBodySource).toContain(
      '"border-border flex min-w-0 shrink-0 items-center overflow-hidden border-r px-3 py-1 last:border-r-0 [&>*]:max-w-full"'
    )
    expect(tableBodySource).toContain('"break-words whitespace-normal"')
    expect(tableBodySource).toContain('"break-all"')
    expect(tableBodySource).toContain(": { minHeight: resolvedRowHeight }")
    expect(tableSource).toContain('columnResizeMode: "onChange"')
    expect(tableSource).toContain("enableColumnResizing: true")
    expect(tableSource).toContain("WorkspacePeopleColumnResizeHandle")
    expect(tablePreferencesSource).toContain(
      "readStoredWorkspacePeopleColumnSizing"
    )
    expect(tablePreferencesSource).toContain("storeWorkspacePeopleColumnSizing")
    expect(tableSizingSource).toContain('role="separator"')
    expect(tableSizingSource).toContain('event.key === "ArrowLeft"')
    expect(tableSizingSource).toContain('event.key === "ArrowRight"')
    expect(tableSizingSource).toContain("onColumnAutoSize(column.id)")
    expect(tablePreferencesSource).toContain(
      "coachhouse:workspace-people-table:column-sizing:v1"
    )
    expect(tableToolbarSource).toContain("Row height")
    expect(tableToolbarSource).toContain("Cell content")
    expect(tableToolbarSource).toContain("Wrap previews")
    expect(tableToolbarSource).toContain("Truncate previews")
    expect(tableToolbarSource).toContain(
      '<DropdownMenuRadioItem value="compact">'
    )
    expect(tableToolbarSource).toContain(
      '<DropdownMenuRadioItem value="spacious">'
    )
    expect(tableToolbarSource).toContain("Reset column widths")
    expect(tableSizingSource).toContain("WorkspacePeopleRowResizeHandle")
    expect(tableSizingSource).toContain(
      "action: { size: 80, minSize: 72, maxSize: 192, enableResizing: true }"
    )
    expect(tableSource).toMatch(
      /header\.column\.id === "action" &&\s+"justify-start text-left"/
    )
    expect(tableSource).not.toContain('header.column.id !== "action"')
    expect(tableSizingSource).toContain(
      "person: { size: 216, minSize: 176, maxSize: 480, enableResizing: true }"
    )
    expect(tableSizingSource).toContain(
      "canvas: { size: 48, minSize: 48, maxSize: 48, enableResizing: false }"
    )
    expect(tableBodySource).toContain(
      "sticky left-0 z-20 grid place-items-center"
    )
    expect(tableSource).toContain("flex h-9 shrink-0 items-center border-r px-3 py-1.5")
    expect(tableSource).toContain("grid place-items-center border-r p-0")
    expect(tableColumnsSource).toContain(
      'className="grid w-full place-items-center"'
    )
    expect(tablePreferencesSource).toContain("storedCandidate === 240")
    expect(tableSizingSource).toContain('aria-orientation="horizontal"')
    expect(tableSizingSource).toContain('event.key === "ArrowUp"')
    expect(tableSizingSource).toContain('event.key === "ArrowDown"')
    expect(tableSizingSource).toContain("onPointerDown={handlePointerDown}")
    expect(tableBodySource).toContain("WorkspacePeopleRowResizeHandle")
    expect(tablePreferencesSource).toContain(
      "readStoredWorkspacePeopleRowSizing"
    )
    expect(tablePreferencesSource).toContain(
      "storeWorkspacePeopleRowPreferences"
    )
    expect(tableSource).toContain('<TableHeader className="bg-muted sticky top-0 z-30 grid shrink-0">')
    expect(tableSource).toContain('header.column.id === "person"')
    expect(tableSource).toContain('header.column.id === "action"')
    expect(tableBodySource).toContain("sticky left-0")
    expect(tableBodySource).toContain(
      'actionCell && "grid place-items-center overflow-visible p-0"'
    )
    expect(tableBodySource).toContain("sticky right-0 z-20 border-l px-2")
    expect(tableBodySource).not.toContain("actionCell\n                    ? {")
    expect(tableBodySource).not.toContain("sticky z-20 justify-end border-l")
    expect(tableBodySource).toContain(
      "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted sticky right-0"
    )
    expect(tableSizingSource).toContain("const resolveColumnSize =")
    expect(tableSizingSource).toContain("const visibleTableWidth = table")
    expect(tableSizingSource).toContain(
      "totalWidth + resolveColumnSize(column.id)"
    )
    expect(tableSource).toContain(
      'minWidth: "calc(var(--workspace-people-table-width) * 1px)"'
    )
    expect(tableSizingSource).toContain('resolveColumnSize("canvas")')
    expect(tableSizingSource).toContain(
      "Math.min(maxSize, Math.max(minSize, requestedSize))"
    )
    expect(tableSource).not.toContain(
      "columnSizing.canvas ?? canvasColumn?.getSize()"
    )
    expect(tableSizingSource).toContain("measureWorkspacePeopleColumnWidth")
    expect(tableToolbarSource).toContain("Auto-fit columns")
    expect(tableToolbarSource).toContain("Reset one column")
    expect(tableToolbarSource).toContain("Save current layout")
    expect(tableToolbarSource).toContain("Apply saved layout")
    expect(tablePreferencesSource).toContain(
      "coachhouse:workspace-people-table:saved-column-sizing:v1"
    )
    expect(tablePreferencesSource).toContain(
      "coachhouse:workspace-people-table:content-mode:v1"
    )
    expect(tablePreferencesSource).toContain(
      "readStoredWorkspacePeopleContentMode"
    )
    expect(tableBodySource).toContain(
      'import { useVirtualizer } from "@tanstack/react-virtual"'
    )
    expect(tableBodySource).toContain("rows.length >= 100")
    expect(tableBodySource).toContain(".getVirtualItems()")
    expect(tableBodySource).toContain("rowVirtualizer.getTotalSize()")
    expect(tableSource).toContain("pageSizeOptions={[10, 20, 50, 100]}")
    expect(tableSource).not.toContain("WorkspacePeopleMobileList")
    expect(tableSource).not.toContain("will-change-auto md:block")
    expect(tableSource).toContain("max-md:!left-auto")
    expect(peopleTablePaginationSource).toContain("pageSizeOptions?: number[]")
    expect(tableColumnsSource).toContain(
      "export function buildWorkspacePeopleDrawerColumns"
    )
    expect(tableToolbarSource).toContain(
      "export function WorkspacePeopleDrawerTableToolbar"
    )
    expect(tableToolbarSource).toContain(
      'className="text-foreground hover:text-foreground h-8 w-auto shrink-0 gap-1.5 rounded-xl px-2.5"'
    )
    expect(tableToolbarSource).not.toContain(
      "text-muted-foreground hover:text-foreground dark:text-foreground/80"
    )
    expect(source).not.toContain(
      "const WorkspacePeopleDrawerRow = memo(function WorkspacePeopleDrawerRow"
    )
    expect(tableCellsSource).toContain(
      "const WorkspacePersonAvatar = memo(function WorkspacePersonAvatar"
    )
    expect(source).toContain(
      "const [, startSegmentTransition] = useTransition()"
    )
    expect(source).toContain("const handleSegmentChange = useCallback(")
    expect(source).toContain("startSegmentTransition(() => {")
    expect(source).toContain("onSegmentChange={handleSegmentChange}")
    expect(source).toContain("const handlePersonDragEnd = useCallback(")
    expect(source).toContain("onDragEnd={handlePersonDragEnd}")
    expect(tableSource).toContain("const customSegmentMemberIds = useMemo(")
    expect(tableCellsSource).toContain("customSegmentMemberIds?.has(person.id)")
    expect(tableSource).not.toContain(
      "customSegmentLabel={customSegment?.label ?? null}"
    )
    expect(tableSource).toContain(
      "bg-background flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    )
    expect(tableSource).toContain(
      "block min-h-0 max-w-full flex-1 overflow-auto overscroll-contain touch-pan-x touch-pan-y will-change-auto"
    )
    expect(tableSource.indexOf("hidden min-h-0 max-w-full flex-1")).toBeLessThan(
      tableSource.indexOf('className="flex min-h-full w-full flex-col border-collapse"')
    )
    expect(tableSizingSource).toContain(
      "export const WORKSPACE_PEOPLE_DEFAULT_ROW_HEIGHTS"
    )
    expect(tableSource).toContain("<Table")
    expect(tableSource).toContain("<TableHeader")
    expect(tableSource).toContain("<TableHead")
    expect(tableColumnsSource).toContain('role: "Role"')
    expect(tableColumnsSource).toContain('action: "Action"')
    expect(tableColumnsSource).toContain("WorkspacePeopleDrawerActionCell")
    expect(tableColumnsSource).toContain("Canvas status and drag")
    expect(tableColumnsSource).not.toContain("draggable: boolean")
    expect(tableColumnsSource).not.toContain("if (draggable)")
    expect(
      tableColumnsSource.indexOf("Canvas status and drag")
    ).toBeGreaterThan(
      tableColumnsSource.indexOf("WorkspacePeopleDrawerActionCell")
    )
    expect(source).not.toContain("draggable={canEdit}")
    expect(tableBodySource).toContain("draggable")
    expect(tableBodySource).toContain(
      '"group flex cursor-grab transition-colors active:cursor-grabbing"'
    )
    expect(source).toContain("placedPersonIds={placedPersonIds}")
    expect(tableContractSource).toContain("DragEvent<HTMLElement>")
    expect(tableSource).toContain("useReactTable")
    expect(tableSource).toContain("getCoreRowModel")
    expect(tableSource).toContain("getPaginationRowModel")
    expect(tableSource).toContain(
      "getPaginationRowModel: getPaginationRowModel()"
    )
    expect(tableSource).toContain("type RowSelectionState")
    expect(tableSource).toContain("type VisibilityState")
    expect(tableSource).toContain("const [rowSelection, setRowSelection]")
    expect(tableSource).toContain(
      "const [columnVisibility, setColumnVisibility]"
    )
    expect(tableSource).toContain("enableMultiRowSelection: true")
    expect(tableSource).toContain("getRowId: (row) => row.id")
    expect(tableBodySource).toContain("row.getVisibleCells().map")
    expect(tableSource).toContain("<PeopleTablePagination")
    expect(tableSource).toContain("filteredCount={people.length}")
    expect(tableSource).toContain(
      'className="border-border/60 shrink-0 border-t px-3 py-2"'
    )
    expect(peopleTablePaginationSource).toContain(
      "export function PeopleTablePagination<TData>"
    )
    expect(peopleTablePaginationSource).toContain("table: ReactTable<TData>")
    expect(peopleTablePaginationSource).toContain("className?: string")
    expect(peopleTablePaginationSource).toContain(
      "showSelectionCount?: boolean"
    )
    expect(peopleTablePaginationSource).toContain(
      "showSelectionCount = canEdit"
    )
    expect(peopleTablePaginationSource).toContain("Label")
    expect(peopleTablePaginationSource).toContain("Rows per page")
    expect(peopleTablePaginationSource).toContain('compactMobile && "sr-only sm:not-sr-only"')
    expect(peopleTablePaginationSource).toContain("SelectTrigger")
    expect(peopleTablePaginationSource).toContain("table.setPageSize")
    expect(peopleTablePaginationSource).toContain("table.previousPage()")
    expect(peopleTablePaginationSource).toContain("table.nextPage()")
    expect(tableToolbarSource).toContain("DropdownMenuCheckboxItem")
    expect(tableToolbarSource).toContain("DropdownMenuGroup")
    expect(tableToolbarSource).toContain(
      "WorkspacePeopleDrawerSelectionActions"
    )
    expect(tableToolbarSource).toContain("getSelectedRowModel()")
    expect(tableToolbarSource).toContain(
      "onClearSelection={() => table.resetRowSelection()}"
    )
    expect(tableToolbarSource).toContain(
      "onAddPeopleToCanvas={onAddPeopleToCanvas}"
    )
    expect(tableToolbarSource).toContain("viewerId={viewerId}")
    expect(tableToolbarSource).toContain("onAddToSegment={onAddToSegment}")
    expect(tableToolbarSource).toContain(
      "onRemoveFromSegment={onRemoveFromSegment}"
    )
    expect(tableToolbarSource).toContain("flex-wrap")
    expect(tableSelectionActionsSource).toContain('from "@/actions/people"')
    expect(tableSelectionActionsSource).toContain("deletePersonAction")
    expect(tableSelectionActionsSource).toContain("CreatePersonDialog")
    expect(tableSelectionActionsSource).toContain(
      'from "@/components/ui/alert-dialog"'
    )
    expect(tableSelectionActionsSource).toContain(
      "export function WorkspacePeopleDrawerSelectionActions"
    )
    expect(tableSelectionActionsSource).toContain("singleSelectedPerson")
    expect(tableSelectionActionsSource).toContain("canvasActionLabel")
    expect(tableSelectionActionsSource).toContain("Add to canvas")
    expect(tableSelectionActionsSource).toContain("Show on canvas")
    expect(tableSelectionActionsSource).toContain(
      "const placedCount = onAddPeopleToCanvas(selectedIds)"
    )
    expect(tableSelectionActionsSource).not.toContain(
      "onAddPeopleToCanvas(selectedUnplacedIds)"
    )
    expect(tableSelectionActionsSource).toContain("{canvasActionLabel}")
    expect(tableSelectionActionsSource).toContain(
      "Showing selected people on canvas"
    )
    expect(tableSelectionActionsSource).toContain(
      "Unable to show selected people on canvas."
    )
    expect(tableSelectionActionsSource).not.toContain(
      "Selected people are already on the canvas."
    )
    expect(tableSelectionActionsSource).not.toContain(
      "canEdit && selectedUnplacedIds.length > 0"
    )
    expect(tableSelectionActionsSource).not.toContain(
      "{selectedUnplacedIds.length > 0 ? ("
    )
    expect(tableSelectionActionsSource).toContain("Add to segment")
    expect(tableSelectionActionsSource).not.toContain(
      "canEdit && customSegment && selectedAvailableSegmentIds.length > 0"
    )
    expect(tableSelectionActionsSource).toContain("Remove")
    expect(tableSelectionActionsSource).not.toContain(
      "canEdit && customSegment && selectedSegmentMemberIds.length > 0"
    )
    expect(tableSelectionActionsSource).toContain("Delete")
    expect(tableSelectionActionsSource).not.toContain(">Clear<")
    expect(tableSelectionActionsSource).toContain("viewerId: string")
    expect(tableSelectionActionsSource).toContain("deletableSelectedPeople")
    expect(tableSelectionActionsSource).toContain("person.id !== viewerId")
    expect(tableSelectionActionsSource).toContain("selectedOwnRecord")
    expect(tableSelectionActionsSource).toContain(
      "Your own record is protected and will stay in People."
    )
    expect(tableSelectionActionsSource).toContain("AlertDialog")
    expect(tableSelectionActionsSource).toContain("AlertDialogTitle")
    expect(tableSelectionActionsSource).toContain("AlertDialogAction")
    expect(tableSelectionActionsSource).toContain("handleDeleteSelected")
    expect(tableSelectionActionsSource).toContain("router.refresh()")
    expect(tableSelectionActionsSource).toContain("onClearSelection()")
    expect(tableSelectionActionsSource).toContain("toast.success")
    expect(tableColumnsSource).toContain('aria-label="Select all people"')
    expect(tableColumnsSource).toContain(
      "header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.reportsTo"
    )
    expect(tableColumnsSource).toContain(
      "header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.email"
    )
    expect(tableColumnsSource).toContain(
      "header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.linkedin"
    )
    expect(tableColumnsSource).toContain('reportsTo: "Reports To"')
    expect(tableColumnsSource).toContain("if (showReportsTo)")
    expect(tableSource).toContain("        showReportsTo,")
    expect(peopleFilteringSource).toContain('segment.category === "staff"')
    expect(tableColumnsSource).toContain('linkedin: "Social Media"')
    expect(tableSizingSource).toContain(
      "linkedin: { size: 136, minSize: 112, maxSize: 240"
    )
    expect(tableColumnsSource).toContain("WorkspacePeopleDrawerReportsToCell")
    expect(tableColumnsSource).toContain("WorkspacePeopleDrawerSocialMediaCell")
    expect(tableCellsSource).toContain(
      "export function WorkspacePeopleDrawerReportsToCell"
    )
    expect(tableCellsSource).toContain('person.category !== "staff"')
    expect(tableCellsSource).toContain("peopleById.get(person.reportsToId)")
    expect(tableCellsSource).toContain(
      "export function WorkspacePeopleDrawerSocialMediaCell"
    )
    expect(tableCellsSource).toContain("<PersonSocialBrandIcon")
    expect(tableCellsSource).toContain("visiblePlatforms.map")
    expect(tableCellsSource).toContain("onEditPerson(person)")
    expect(tableCellsSource).toContain("onOpenPerson(person)")
    expect(tableColumnsSource).toContain("onOpenPerson={onEditPerson}")
    expect(tableSource).toContain("<CreatePersonDialog")
    expect(tableSource).toContain("onEditPerson={setEditingPerson}")
    expect(tableSource).toContain("readOnly={!props.canEdit}")
    expect(tableCellsSource).toContain(
      'const title = person.title || "No title"'
    )
    expect(tableCellsSource).toContain("line-clamp-2")
    expect(tableCellsSource).toContain('contentMode === "wrap"')
    expect(tableCellsSource).not.toContain('{person.email || "No email"}')
    expect(tableSource).not.toContain(">Title</TableHead>")
    expect(tableSource).not.toContain("WorkspacePeopleDrawerItem")
    expect(tableSource).not.toContain('role="list"')
    expect(tableSource).not.toContain('role="listitem"')
    expect(tableSource).not.toContain("customSegment?.memberIds.includes")
    expect(source).not.toContain("onDragEnd={() => setDraggingPersonId(null)}")
    expect(tableSource).not.toContain("Badge")
    expect(tableCellsSource).not.toContain("Badge")
    expect(tableSource).not.toContain(
      "rounded-2xl border border-border/60 bg-background/72 p-2.5"
    )
    expect(tableSource).not.toContain(
      "rounded-[24px] border border-dashed border-border/80 bg-muted/35 p-2 transition-colors"
    )
    expect(source).not.toContain("Empty segment")
    expect(railSource).toContain(
      "export const WorkspacePeopleSegmentRail = memo("
    )
    expect(railSource).toContain("function WorkspacePeopleSegmentRail({")
    expect(railSource).toContain(
      "const WorkspacePeopleSegmentTab = memo(function WorkspacePeopleSegmentTab"
    )
    expect(railSource).toContain(
      "const WorkspacePeopleCustomSegmentEditor = memo("
    )
    expect(railSource).toContain(
      "function WorkspacePeopleCustomSegmentEditor({"
    )
    expect(contentHeaderSource).toContain(
      "export const WorkspacePeopleSegmentActions = memo("
    )
    expect(contentHeaderSource).toContain(
      "function WorkspacePeopleSegmentActions({"
    )
  })

  it("keeps the trigger in the shortcut rail but portals the sheet to the React Flow canvas frame", () => {
    const rendererSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-resolved-renderer.tsx"
    )
    const surfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2.tsx"
    )
    const peopleStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-people-state.ts"
    )
    const dragHandlersSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-drag-handlers.ts"
    )
    const surfaceTypesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-types.ts"
    )
    const canvasBodySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-body.tsx"
    )
    const flowSurfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-flow-surface.tsx"
    )
    const panelSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel.tsx"
    )
    const supportSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel-support.tsx"
    )
    const viewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx"
    )
    const viewTypesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view-types.ts"
    )
    const mobileShortcutOverlaySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-mobile-shortcut-overlay.tsx"
    )
    const peoplePlacementControllerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-people-placement-controller.ts"
    )
    const peoplePlacementStorageSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-stored-workspace-person-placements.ts"
    )
    const personFitRequestSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-fit-request.ts"
    )
    const peopleNodeModelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-node-model.ts"
    )
    const peopleNodeSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-node.tsx"
    )
    const nodeBuildersSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-node-builders.ts"
    )
    const renderNodesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-render-nodes.ts"
    )
    const renderStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-render-state.ts"
    )
    const reconcileSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-reconcile.ts"
    )
    const reconcilePersonSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-reconcile-person.ts"
    )
    const shortcutRailSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/shortcuts/workspace-card-shortcut-rail.tsx"
    )
    const controlsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel.tsx"
    )

    expect(peopleStateSource).toContain(
      "const workspaceDataDrawerPeople = useMemo("
    )
    expect(viewSource).toContain("people={workspaceDataDrawerPeople}")
    expect(surfaceSource).toContain(
      "workspaceDataDrawerViewerId: seed.viewerId"
    )
    expect(surfaceSource).toContain("workspaceDataDrawerCanEdit,")
    expect(viewSource).toContain("canEdit={workspaceDataDrawerCanEdit}")
    expect(surfaceSource).toContain(
      "workspaceDataDrawerDocuments: organizationEditorData.documentsTab"
    )
    expect(viewSource).toContain("documentsTab={workspaceDataDrawerDocuments}")
    expect(viewSource).toContain("request={workspaceDataDrawerRequest}")
    expect(surfaceTypesSource).toContain("workspaceDataDrawerCanEdit: boolean")
    expect(canvasBodySource).toContain(
      "const workspaceDataDrawerCanEdit =\n    !seed.presentationMode && (seed.canEdit || seed.isPlatformAdmin === true)"
    )
    expect(canvasBodySource).toContain(
      "workspaceDataDrawerCanEdit={workspaceDataDrawerCanEdit}"
    )
    expect(flowSurfaceSource).toContain("workspaceDataDrawerCanEdit: boolean")
    expect(flowSurfaceSource).toContain(
      "workspaceDataDrawerCanEdit={props.workspaceDataDrawerCanEdit}"
    )
    expect(surfaceSource).toContain("placedWorkspacePersonIds")
    expect(peopleStateSource).toContain(
      "useWorkspaceCanvasPeoplePlacementController"
    )
    expect(surfaceSource).toContain("uiPreferencesScope,")
    expect(peopleStateSource).toContain("const allowPeopleCanvasInteraction =")
    expect(peopleStateSource).toContain(
      "allowEditing || workspaceDataDrawerCanEdit"
    )
    expect(surfaceSource).toContain("allowPeopleCanvasInteraction,")
    expect(surfaceSource).toContain("tutorialActive,")
    expect(surfaceSource).toContain(
      "peopleCanvasInteractionEnabled: allowPeopleCanvasInteraction"
    )
    expect(surfaceSource).toContain("handleCanvasSelectionDragStop")
    expect(dragHandlersSource).toContain(
      "handleWorkspacePersonNodesDragStop(draggedNodes)"
    )
    expect(surfaceSource).toContain(
      "onSelectionDragStop: handleCanvasSelectionDragStop"
    )
    expect(surfaceSource).toContain(
      "allowEditing || allowPeopleCanvasInteraction || tutorialActive"
    )
    expect(peoplePlacementControllerSource).toContain(
      "allowPeopleCanvasInteraction: boolean"
    )
    expect(peoplePlacementControllerSource).toContain(
      "uiPreferencesScope: WorkspaceBoardUiPreferenceScope"
    )
    expect(peoplePlacementStorageSource).toContain(
      "readWorkspaceBoardUiPreferences"
    )
    expect(peoplePlacementControllerSource).toContain(
      "patchWorkspaceBoardUiPreferences"
    )
    expect(peoplePlacementControllerSource).toContain(
      "workspacePersonPlacements"
    )
    expect(peoplePlacementControllerSource).toContain(
      "const commitWorkspacePersonPlacements = useCallback"
    )
    expect(peoplePlacementControllerSource).toContain(
      "if (!canMutatePeople || !flowInstance) return 0"
    )
    expect(peoplePlacementControllerSource).toContain(
      "canMutateWorkspaceCanvasPeople"
    )
    expect(nodeBuildersSource).toContain(
      "allowPeopleCanvasInteraction: boolean"
    )
    expect(nodeBuildersSource).toContain(
      "canEdit: allowPeopleCanvasInteraction"
    )
    expect(nodeBuildersSource).not.toContain("canEdit: allowEditing")
    expect(renderNodesSource).toContain("allowPeopleCanvasInteraction: boolean")
    expect(renderNodesSource).toContain("allowPeopleCanvasInteraction,")
    expect(renderStateSource).toContain("allowPeopleCanvasInteraction: boolean")
    expect(renderStateSource).toContain("allowPeopleCanvasInteraction,")
    expect(reconcileSource).toContain("allowPeopleCanvasInteraction: boolean")
    expect(reconcilePersonSource).toContain(
      "canEdit: allowPeopleCanvasInteraction"
    )
    expect(reconcileSource).not.toContain("canEdit: allowEditing")
    expect(peopleNodeModelSource).toContain("draggable: canEdit")
    expect(peopleNodeModelSource).toContain("selectable: canEdit")
    expect(peopleNodeSource).toContain("{canEdit ? (")
    expect(peopleNodeSource).toContain("onClick={() => onRemove(person.id)}")
    expect(peoplePlacementControllerSource).not.toContain(
      "if (!allowEditing || tutorialActive"
    )
    expect(peoplePlacementControllerSource).toContain("screenToFlowPosition")
    expect(peoplePlacementControllerSource).toContain(
      "buildWorkspacePeopleDropPlacements"
    )
    expect(peoplePlacementControllerSource).toContain(
      "resolveWorkspacePeopleRelationshipFocusPersonId"
    )
    expect(peoplePlacementControllerSource).toContain(
      "resolveWorkspacePeopleRelationshipGraphPersonIds"
    )
    expect(peoplePlacementControllerSource).toContain(
      "buildWorkspacePeopleRelationshipPlacementLayout"
    )
    expect(peoplePlacementControllerSource).toContain(
      "useWorkspaceCanvasPersonFitRequest"
    )
    expect(peoplePlacementControllerSource).toContain(
      "const requestWorkspacePersonFit = useCallback"
    )
    expect(peoplePlacementControllerSource).toContain(
      "resolveWorkspacePeopleRelationshipGraphPersonIds({"
    )
    expect(peoplePlacementControllerSource).toContain(
      "const requestedPersonIds = normalizeWorkspaceCanvasPersonIds"
    )
    expect(peoplePlacementControllerSource).toContain(
      "const relationshipPersonIds ="
    )
    expect(peoplePlacementControllerSource).toContain(
      "requestWorkspacePersonFit(relationshipPersonIds)"
    )
    expect(peoplePlacementControllerSource).toContain(
      "if (!placedWorkspacePersonIds.has(personId))"
    )
    expect(peoplePlacementControllerSource).toContain(
      "shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards"
    )
    expect(peoplePlacementControllerSource).toContain(
      "placements: buildWorkspacePeopleRelationshipPlacementLayout"
    )
    expect(peoplePlacementControllerSource).toContain(
      "return requestedPersonIds.length"
    )
    expect(peoplePlacementControllerSource).toContain(
      "handleWorkspacePersonNodesDragStop"
    )
    expect(peoplePlacementControllerSource).not.toContain(
      "if (unplacedPersonIds.length === 0) return 0"
    )
    expect(personFitRequestSource).toContain("flowInstance.fitView")
    expect(viewTypesSource).toContain("workspaceDataDrawerViewerId: string")
    expect(viewTypesSource).toContain("workspaceDataDrawerCanEdit: boolean")
    expect(viewTypesSource).toContain("peopleCanvasInteractionEnabled: boolean")
    expect(viewSource).toContain("const nodesSelectable = !tutorialActive")
    expect(viewSource).toContain("const selectNodesOnDrag =")
    expect(viewSource).toContain(
      "!tutorialActive && (allowEditing || peopleCanvasInteractionEnabled)"
    )
    expect(viewSource).toContain("elementsSelectable={nodesSelectable}")
    expect(viewSource).toContain('selectionKeyCode="Shift"')
    expect(viewSource).toContain(
      'multiSelectionKeyCode={["Shift", "Meta", "Control"]}'
    )
    expect(viewSource).toContain("selectionMode={SelectionMode.Partial}")
    expect(viewSource).toContain("{...selectionGestures}")
    expect(viewSource).toContain('panActivationKeyCode="Space"')
    expect(viewSource).toContain("selectNodesOnDrag={selectNodesOnDrag}")
    expect(viewSource).toContain(
      "createWorkspaceParticleFlowHandlers(particles"
    )
    const particleHandlers = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-particle-flow-handlers.ts"
    )
    expect(particleHandlers).toContain(
      "legacy.onSelectionDragStop(event, legacyNodes)"
    )
    expect(viewSource).toContain("if (!peopleCanvasInteractionEnabled) return")
    expect(viewSource).not.toContain("if (!allowEditing) return")
    expect(viewSource).toContain(
      "const personIds = readWorkspaceCanvasPersonDragPayload(event.dataTransfer)"
    )
    expect(viewSource).toContain("if (personIds.length === 0) return")
    expect(viewSource).toContain("if (personIds.length === 1)")
    expect(viewSource).toContain("const personId = personIds[0]")
    expect(viewSource).toContain("onAddWorkspacePeopleToCanvas({")
    expect(viewTypesSource).toContain(
      "workspaceDataDrawerDocuments: DocumentsTabData"
    )
    expect(viewSource).toContain("<WorkspaceCardShortcutRail")
    expect(viewSource).toContain("dataAction={")
    expect(viewSource).toContain("<WorkspaceCanvasOverlayDrawer")
    expect(viewSource).toContain("people={workspaceDataDrawerPeople}")
    expect(viewSource).toContain("placedPersonIds={placedWorkspacePersonIds}")
    expect(viewSource).toContain("viewerId={workspaceDataDrawerViewerId}")
    expect(viewSource).toContain("documentsTab={workspaceDataDrawerDocuments}")
    expect(viewSource).toContain("canEdit={workspaceDataDrawerCanEdit}")
    expect(viewSource).not.toContain("canEdit={allowEditing}")
    expect(viewSource).toContain("uiPreferencesScope={uiPreferencesScope}")
    expect(viewSource).toContain("handleAddWorkspacePeopleToCanvas")
    expect(viewSource).toContain("flowFrameContainer.getBoundingClientRect()")
    expect(viewSource).not.toContain("centeredIndex * horizontalOffset")
    expect(viewSource).not.toContain("centeredIndex * verticalOffset")
    expect(viewSource).toContain("onAddWorkspacePeopleToCanvas({")
    expect(viewSource).toContain("peopleCanvasActions={{")
    expect(viewSource).toContain("add: handleAddWorkspacePeopleToCanvas")
    expect(viewSource).toContain("remove: onRemoveWorkspacePersonFromCanvas")
    expect(surfaceSource).toContain(
      "onRemoveWorkspacePersonFromCanvas: handleRemoveWorkspacePersonPlacement"
    )
    expect(viewSource).toContain("hasWorkspaceCanvasPersonDragPayload")
    expect(viewSource).toContain("readWorkspaceCanvasPersonDragPayload")
    expect(viewSource).toContain("onWorkspacePersonDropToCanvas")
    expect(shortcutRailSource).toContain("dataAction?: ReactNode")
    expect(shortcutRailSource).toContain("{dataAction}")
    expect(shortcutRailSource).toContain(
      "pointer-events-none absolute left-4 top-1/2 z-10"
    )
    expect(mobileShortcutOverlaySource).toContain(
      "pointer-events-none absolute bottom-4 left-4 z-10 md:hidden"
    )
    expect(controlsSource).toContain("absolute right-4 bottom-[84px] z-10")
    expect(controlsSource).toContain("md:top-4 md:bottom-auto")
    expect(rendererSource).not.toContain("<WorkspaceCanvasOverlayDrawer")
    expect(rendererSource).not.toContain("headerPickerAction")
    expect(rendererSource).not.toContain("container={container}")
    expect(panelSource).not.toContain("headerPickerAction")
    expect(panelSource).not.toContain("headerAction={")
    expect(supportSource).not.toContain(
      "export type WorkspaceAcceleratorHeaderPickerAction"
    )
    expect(panelSource).not.toContain("setPanelContainer")
    expect(panelSource).not.toContain("container: panelContainer")
    expect(supportSource).not.toContain("headerPickerAction")
    expect(supportSource).not.toContain("setRailContainer")
    expect(supportSource).not.toContain("container: railContainer")
    expect(viewSource).toContain(
      "WorkspaceCanvasOverlayDrawerContainerProvider"
    )
    expect(viewSource).toContain("container={flowFrameContainer}")
    expect(viewSource).toContain("setFlowFrameContainer")
    expect(viewSource).toContain('data-workspace-canvas-flow-frame="true"')
    expect(viewSource).toContain(
      "workspace-layout-surface group/workspace-canvas-surface relative min-h-[min(820px,calc(100svh-9.5rem))] w-full max-w-full min-w-0"
    )
    expect(viewSource).toContain(
      'className="absolute inset-0 max-w-full min-w-0 overflow-hidden"'
    )
    expect(canvasBodySource).toContain(
      'className="relative flex min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"'
    )
    expect(controlsSource).not.toContain("<WorkspaceCanvasOverlayDrawer")
  })

  it("registers scalable person canvas nodes without extending fixed card ids", () => {
    const nodeTypesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-node-types.tsx"
    )
    const modelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-node-model.ts"
    )
    const nodeSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-node.tsx"
    )
    const cardContractSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-constants.ts"
    )

    expect(nodeTypesSource).toContain(
      '"workspace-person": WorkspaceCanvasPersonNode'
    )
    expect(nodeTypesSource).toContain(
      "WORKSPACE_CANVAS_PERSON_RELATIONSHIP_EDGE_TYPE"
    )
    expect(nodeTypesSource).toContain("WorkspaceCanvasPersonRelationshipEdge")
    expect(modelSource).toContain("getWorkspaceCanvasPersonNodeId")
    expect(modelSource).toContain("workspace-person:${personId}")
    expect(modelSource).toContain("WorkspaceCanvasPersonPlacement")
    expect(modelSource).toContain("buildWorkspaceCanvasPersonNode")
    expect(modelSource).toContain(
      'dragHandle: ".workspace-person-node-drag-handle"'
    )
    expect(nodeSource).toContain('data-workspace-canvas-person-node="true"')
    expect(nodeSource).toContain("relative flex h-16 w-[244px] items-center")
    expect(nodeSource).toContain(
      "workspace-person-node-drag-handle flex h-full min-w-0 flex-1"
    )
    expect(nodeSource).not.toContain("relative min-h-16")
    expect(nodeSource).toContain("workspace-person-node-drag-handle")
    expect(nodeSource).toContain("Remove ${person.name} from canvas")
    expect(cardContractSource).not.toContain('"workspace-person"')
  })
})
