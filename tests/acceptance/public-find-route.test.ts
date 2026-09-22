import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  MAP_STYLE,
  PUBLIC_MAP_BASEMAP_VISIBILITY,
  PUBLIC_MAP_SPACE_FOG,
  PUBLIC_MAP_STANDARD_STYLE,
  resolvePublicMapBasemapConfig,
  resolvePublicMapStyleForTheme,
} from "@/components/public/public-map-index/constants"

const ROOT = process.cwd()
const PUBLIC_FIND_ROUTE =
  "src/features/find-map/components/public-find-route.tsx"

function readRoute(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("public find routes", () => {
  it("owns Find at the root and permanently redirects legacy links", () => {
    const rootRoute = readRoute("src/app/(public)/page.tsx")
    const findRoute = readRoute(PUBLIC_FIND_ROUTE)
    const nextConfig = readRoute("next.config.ts")
    const sitemap = readRoute("src/app/sitemap.ts")

    expect(rootRoute).toContain("<PublicFindRoute")
    expect(rootRoute).toContain('alternates: { canonical: "/" }')
    expect(findRoute).toContain("FIND_ORGANIZATION_QUERY_KEY")
    expect(findRoute).toContain("initialPublicSlug={initialPublicSlug}")
    expect(nextConfig).toContain('source: "/find"')
    expect(nextConfig).toContain('destination: "/"')
    expect(nextConfig).toContain('source: "/find/:slug"')
    expect(nextConfig).toContain('destination: "/?organization=:slug"')
    expect(nextConfig.match(/permanent: true/g)).toHaveLength(2)
    expect(sitemap).toContain("fetchPublishedPublicHandles")
  })

  it("uses the Mapbox Standard day and night basemap with streets", () => {
    expect(PUBLIC_MAP_STANDARD_STYLE).toBe("mapbox://styles/mapbox/standard")
    expect(MAP_STYLE).toBe(PUBLIC_MAP_STANDARD_STYLE)
    expect(resolvePublicMapStyleForTheme("light")).toBe(
      PUBLIC_MAP_STANDARD_STYLE
    )
    expect(resolvePublicMapStyleForTheme("dark")).toBe(
      PUBLIC_MAP_STANDARD_STYLE
    )
    expect(resolvePublicMapBasemapConfig("light")).toEqual({
      ...PUBLIC_MAP_BASEMAP_VISIBILITY,
      lightPreset: "day",
    })
    expect(resolvePublicMapBasemapConfig("dark")).toEqual({
      ...PUBLIC_MAP_BASEMAP_VISIBILITY,
      lightPreset: "night",
    })
    expect(PUBLIC_MAP_BASEMAP_VISIBILITY).toMatchObject({
      show3dObjects: false,
      showPedestrianRoads: true,
      showPlaceLabels: false,
      showPointOfInterestLabels: false,
      showRoadLabels: true,
      showTransitLabels: false,
    })
    expect(PUBLIC_MAP_BASEMAP_VISIBILITY).not.toHaveProperty("colorMotorways")
    expect(PUBLIC_MAP_BASEMAP_VISIBILITY).not.toHaveProperty("colorRoads")
    expect(PUBLIC_MAP_BASEMAP_VISIBILITY).not.toHaveProperty("colorTrunks")
    expect(PUBLIC_MAP_SPACE_FOG["space-color"]).toBe("#05070d")
    expect(PUBLIC_MAP_SPACE_FOG["star-intensity"]).toBeGreaterThan(0)
    expect(PUBLIC_MAP_SPACE_FOG.range).toEqual([0.8, 8])

    const constantsSource = readRoute(
      "src/components/public/public-map-index/constants.ts"
    )
    const runtimeSource = readRoute(
      "src/components/public/public-map-index/public-map-index-runtime.ts"
    )
    expect(constantsSource).not.toContain("cmm8y8rq600o201s5ctyi8y27")
    expect(constantsSource).not.toContain("satellite-v9")
    expect(constantsSource).not.toContain("streets-v12")
    expect(constantsSource).toContain("PUBLIC_MAP_SPACE_FOG")
    expect(constantsSource).toContain("map.setFog(PUBLIC_MAP_SPACE_FOG)")
    expect(runtimeSource).toContain("applyPublicMapSpaceFog(map)")
    expect(runtimeSource).toContain("applyPublicMapGlobePresentation(map)")
    expect(runtimeSource).not.toContain("setStyle(")
    expect(runtimeSource).toContain("resolvePublicMapBasemapConfig")
    expect(runtimeSource).toContain("themeRef.current = theme")
    expect(runtimeSource).toContain(
      "applyPublicMapBasemapConfig(map, themeRef.current)"
    )
  })

  it("does not render the workspace onboarding card on the map", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile)
      expect(source).not.toContain("OnboardingWorkspaceCard")
      expect(source).not.toContain("completeOnboardingAction")
    }
  })

  it("starts resource discovery with the measured 200-item page size", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]

    for (const routeFile of routeFiles) {
      expect(readRoute(routeFile)).toContain(
        '"/api/public/resource-map/index?limit=200"'
      )
    }
  })

  it("wires onboarding-locked free/member users into the map-native intro", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
    const publicMapSource = [
      readRoute("src/components/public/public-map-index.tsx"),
      readRoute(
        "src/components/public/public-map-index/public-map-index-state.ts"
      ),
    ].join("\n")
    const previewControlsSource = readRoute(
      "src/components/public/public-map-index/member-onboarding-preview-controls.tsx"
    )
    const overlaySource = readRoute(
      "src/components/public/public-map-index/member-onboarding-overlay.tsx"
    )
    const mapSurfaceSource = readRoute(
      "src/components/public/public-map-index/map-surface.tsx"
    )

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile)
      expect(source).toContain("completeMemberMapOnboardingAction")
      expect(source).toContain("memberOnboarding={")
      expect(source).toContain("memberMapOnboarding.hasOrganizationSwitcher")
    }

    expect(publicMapSource).toContain("usePublicMapMemberOnboardingMapOverlay")
    expect(publicMapSource).toContain(
      "mapOverlay={memberOnboardingState.overlay}"
    )
    expect(mapSurfaceSource).toContain('data-public-map-overlay-layer=""')
    expect(mapSurfaceSource).toContain(
      'className="pointer-events-none absolute inset-0"'
    )
    expect(mapSurfaceSource.match(/{mapOverlay}/g)).toHaveLength(1)
    expect(previewControlsSource).toContain("PublicMapMemberOnboardingOverlay")
    expect(previewControlsSource).toContain("md:left-1/2 md:z-30 md:-translate-x-1/2")
    expect(overlaySource).toContain("absolute inset-0 z-50")
    expect(overlaySource).not.toContain("OnboardingWorkspaceCard")
    expect(overlaySource).toContain("Welcome to Find")
    expect(overlaySource).toContain("Search resources")
    expect(overlaySource).toContain("Search by organization")
    expect(overlaySource).toContain("Save locations")
    expect(overlaySource).toContain("Notifications")
  })

  it("lets platform admins preview the map intro from authenticated find", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
    const publicMapSource = [
      readRoute("src/components/public/public-map-index.tsx"),
      readRoute(
        "src/components/public/public-map-index/public-map-index-state.ts"
      ),
    ].join("\n")
    const previewControlsSource = readRoute(
      "src/components/public/public-map-index/member-onboarding-preview-controls.tsx"
    )
    const previewSource = readRoute(
      "src/components/public/public-map-index/member-onboarding-preview.ts"
    )

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile)
      expect(source).toContain("adminOnboardingPreview={")
      expect(source).toContain("shellState.isAdmin")
      expect(source).toContain("canToggle: true")
      expect(source).toContain("memberMapOnboarding.hasOrganizationSwitcher")
    }

    expect(publicMapSource).toContain("usePublicMapMemberOnboardingMapOverlay")
    expect(publicMapSource).toContain(
      "mapOverlay={memberOnboardingState.overlay}"
    )
    expect(previewControlsSource).toContain(
      "PublicMapMemberOnboardingPreviewToggle"
    )
    expect(previewControlsSource).toContain("Welcome")
    expect(previewControlsSource).toContain("[html.light_&]:!text-zinc-950")
    expect(previewControlsSource).not.toContain("Hide welcome")
    expect(previewControlsSource).toContain(
      "onDismiss={() => handleToggleAdminOnboardingPreview(false)}"
    )
    expect(previewSource).toContain(
      'PUBLIC_MAP_MEMBER_ONBOARDING_PREVIEW_SOURCE = "admin_preview"'
    )
    expect(previewSource).toContain(
      'PUBLIC_MAP_MEMBER_ONBOARDING_QUERY_KEY = "member_onboarding"'
    )
  })

  it("renders authenticated users inside the app shell without moving find under workspace", () => {
    const source = readRoute(PUBLIC_FIND_ROUTE)
    expect(source).toContain("AuthenticatedFindShell")
    expect(source).toContain('presentationMode="app-shell"')
    expect(source).not.toContain("/workspace/find")
  })

  it("never mixes synthetic resource seeds into live find routes", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]

    for (const routeFile of routeFiles) {
      expect(readRoute(routeFile)).not.toContain("includeSeedResources")
    }
  })

  it("preserves selected organization detail wiring on the root query route", () => {
    const source = readRoute(PUBLIC_FIND_ROUTE)
    const authenticatedBranchIndex = source.indexOf("<AuthenticatedFindShell")
    const publicBranchIndex = source.indexOf("<HomeCanvasFindShell")
    const firstInitialSlugIndex = source.indexOf(
      "initialPublicSlug={initialPublicSlug}"
    )
    const secondInitialSlugIndex = source.indexOf(
      "initialPublicSlug={initialPublicSlug}",
      firstInitialSlugIndex + 1
    )

    expect(authenticatedBranchIndex).toBeGreaterThan(-1)
    expect(publicBranchIndex).toBeGreaterThan(-1)
    expect(source).toContain("organizationDetail={Boolean(initialPublicSlug)}")
    expect(firstInitialSlugIndex).toBeGreaterThan(authenticatedBranchIndex)
    expect(firstInitialSlugIndex).toBeLessThan(publicBranchIndex)
    expect(secondInitialSlugIndex).toBeGreaterThan(publicBranchIndex)
  })

  it("clears selected organization state when returning from detail to search", () => {
    const publicMapSource = readRoute(
      "src/components/public/public-map-index.tsx"
    )
    const publicMapSelectionSource = readRoute(
      "src/components/public/public-map-index/public-map-index-selection.ts"
    )
    const mapSurfaceSource = readRoute(
      "src/components/public/public-map-index/map-surface.tsx"
    )
    const sidebarSource = [
      readRoute("src/components/public/public-map-index/sidebar.tsx"),
      readRoute("src/components/public/public-map-index/sidebar-drawer.tsx"),
    ].join("\n")
    expect(publicMapSelectionSource).toContain(
      "const handleBackToSearch = useCallback"
    )
    expect(publicMapSelectionSource).toContain("setSelectedOrgId(null)")
    expect(publicMapSource).toContain("onBackToSearch={handleBackToSearch}")
    expect(mapSurfaceSource).toContain("onBackToSearch")
    expect(sidebarSource).toContain("onBack={onBackToSearch}")
  })

  it("restores the saved sidebar preference in authenticated find", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
    const shellSource = readRoute(
      "src/features/find-map/components/authenticated-find-shell.tsx"
    )
    const appShellInnerSource = readRoute(
      "src/components/app-shell/app-shell-inner.tsx"
    )
    const appShellTypesSource = readRoute("src/components/app-shell/types.ts")

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile)
      expect(source).toContain("readAppSidebarDefaultOpen")
      expect(source).toContain("defaultSidebarOpen")
      expect(source).toContain("defaultSidebarOpen={defaultSidebarOpen}")
    }

    expect(appShellInnerSource).toContain("defaultSidebarOpen = false")
    expect(appShellTypesSource).toContain("defaultSidebarOpen?: boolean")
    expect(appShellInnerSource).toContain("defaultOpen={defaultSidebarOpen}")
    expect(shellSource).toContain('contentPresentation="full-bleed"')
  })

  it("keeps authenticated find full bleed inside a responsive shell frame", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
    const shellSource = readRoute(
      "src/features/find-map/components/authenticated-find-shell.tsx"
    )
    const mapSurfaceSource = readRoute(
      "src/components/public/public-map-index/map-surface.tsx"
    )
    const publicMapSource = readRoute(
      "src/components/public/public-map-index.tsx"
    )
    const publicMapChromeSource = readRoute(
      "src/components/public/public-map-index/public-map-index-chrome.tsx"
    )
    const sidebarSource = [
      readRoute("src/components/public/public-map-index/sidebar.tsx"),
      readRoute("src/components/public/public-map-index/sidebar-drawer.tsx"),
    ].join("\n")
    const mapViewHelpersSource = readRoute(
      "src/components/public/public-map-index/map-view-helpers.ts"
    )
    const appShellSource = readRoute(
      "src/components/app-shell/app-shell-inner.tsx"
    )
    const shellMainContentSource = readRoute(
      "src/components/app-shell/components/shell-main-content.tsx"
    )

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile)
      expect(source).not.toContain("FindMapFrame")
      expect(source).not.toContain("rounded-lg border border-border/70")
    }

    expect(shellSource).toContain('contentPresentation="full-bleed"')
    expect(mapSurfaceSource).toContain("h-full min-h-0 w-full min-w-0 flex-1")
    expect(publicMapSource).not.toContain("resolvePublicMapPresentationFlags")
    expect(publicMapChromeSource).not.toContain("PublicMapDirectoryRail")
    expect(publicMapChromeSource).not.toContain("PublicMapRightRail")
    expect(mapViewHelpersSource).toContain('return "drawer"')
    expect(sidebarSource).toContain("dismissible={false}")
    expect(sidebarSource).toContain("<PublicMapMemberRail")
    expect(shellSource).toContain("resizableRightRail")
    expect(appShellSource).toContain(
      "!isMobile && hasRightRail && rightOpen && resizableRightRail"
    )
    expect(appShellSource).not.toContain('derivedContext !== "public"')
    expect(publicMapSource).toContain("guides={resourceGuides}")
    expect(publicMapSource).toContain("savedOrganizations={savedOrganizations}")
    expect(publicMapSource).not.toContain("w-[23rem]")
    expect(publicMapSource).not.toContain("manageShellSidebarOpen={false}")
    expect(shellMainContentSource).toContain("data-shell-mode={")
    expect(shellMainContentSource).toContain(
      'useFullBleedContent ? "full-bleed" : "default"'
    )
    expect(appShellSource).toContain(
      "md:[--shell-right-rail-width:min(22rem,36vw)]"
    )
    expect(shellSource).toContain(
      "showWorkspaceHome={state.showMemberWorkspace}"
    )
    expect(shellSource).toContain(
      "showMemberWorkspace={state.showMemberWorkspace}"
    )
    expect(shellSource).toContain("sidebarHeaderContent={")
    expect(shellSource).toContain("MemberWorkspaceOrgSwitcher")
    expect(shellSource).toContain("state.memberWorkspaceHeader")
    expect(appShellSource).toContain("isMobile")
    expect(shellMainContentSource).toContain('"rounded-none border-0"')
    expect(shellMainContentSource).toContain(
      '"border-[color:var(--shell-border)] md:rounded-[28px] md:border"'
    )
    expect(appShellSource).not.toContain("useFullBleedContent || isMobile")
  })

  it("uses the same Find, Guides, and My Map drawer for public and authenticated find", () => {
    const chromeSource = readRoute(
      "src/components/public/public-map-index/public-map-index-chrome.tsx"
    )
    const memberRailSource = readRoute(
      "src/components/public/public-map-index/member-rail.tsx"
    )
    const sidebarSource = [
      readRoute("src/components/public/public-map-index/sidebar.tsx"),
      readRoute("src/components/public/public-map-index/sidebar-drawer.tsx"),
    ].join("\n")
    const sidebarThemeSource = readRoute(
      "src/components/public/public-map-index/sidebar-theme.ts"
    )
    const statusPillSource = readRoute(
      "src/components/public/public-map-index/directory-status-pill.tsx"
    )
    const welcomeControlSource = readRoute(
      "src/components/public/public-map-index/member-onboarding-preview-controls.tsx"
    )
    const mapSurfaceSource = readRoute(
      "src/components/public/public-map-index/map-surface.tsx"
    )

    expect(chromeSource).not.toContain("HomeCanvasSidebarSlot")
    expect(chromeSource).not.toContain("PublicMapRightRail")
    expect(sidebarSource).toContain("<PublicMapMemberRail")
    expect(sidebarSource).toContain("directoryRail={drawerDirectoryPanel}")
    expect(sidebarSource).toContain("dismissible={false}")
    expect(sidebarSource).toContain('setDrawerTab("directory")')
    expect(sidebarSource).toContain("resolvePublicMapDrawerSnapPointIndex({")
    expect(sidebarSource).not.toContain("snapPoints.findIndex")
    expect(sidebarThemeSource).toContain(
      "bg-background/88 text-foreground backdrop-blur-xl"
    )
    expect(sidebarThemeSource).toContain("dark:border-input dark:bg-input/35")
    expect(sidebarThemeSource).not.toContain('"dark border-input')
    expect(sidebarSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(statusPillSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(welcomeControlSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(mapSurfaceSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(mapSurfaceSource).toContain(
      "pointer-events-none absolute inset-0 z-50 transform-gpu overflow-hidden"
    )
    expect(sidebarSource).not.toContain("bg-card/92")
    expect(sidebarSource).not.toContain("dark:bg-input/30")
    expect(sidebarSource).toContain(
      "data-[vaul-drawer-direction=bottom]:rounded-t-[28px]"
    )
    expect(sidebarSource).toContain("data-public-map-drawer-mode={")
    expect(sidebarSource).toContain(
      'drawerIsFullscreen ? "fullscreen" : "floating"'
    )
    expect(sidebarSource).toContain(
      'data-public-map-drawer-content-viewport=""'
    )
    expect(sidebarSource).toContain("style={{ height: drawerViewportHeight }}")
    expect(sidebarSource).toContain('height: "100%"')
    expect(sidebarSource).not.toContain(
      "data-[vaul-drawer-direction=bottom]:rounded-t-none"
    )
    expect(sidebarSource).not.toContain("bg-background/95")
    expect(sidebarSource).not.toContain("backdrop-blur-2xl")
    expect(sidebarThemeSource).toContain("backdrop-blur-xl")
    expect(memberRailSource).toContain('data-public-map-tabbed-rail=""')
    expect(memberRailSource).toContain('data-public-map-tab-list=""')
    expect(memberRailSource).toContain(
      "const hasGuides = Boolean(onGuideSelect)"
    )
    expect(memberRailSource).toContain(">Find</span>")
    expect(memberRailSource).toContain(">Guides</span>")
    expect(memberRailSource).toContain(">My Map</span>")
  })

  it("wires category filtering through the search rail and map markers", () => {
    const publicMapSource = readRoute(
      "src/components/public/public-map-index.tsx"
    )
    const searchCardSource = readRoute(
      "src/components/public/public-map-index/search-card.tsx"
    )
    const categoryFilterSource = readRoute(
      "src/components/public/public-map-index/category-filter.tsx"
    )
    const sidebarThemeSource = readRoute(
      "src/components/public/public-map-index/sidebar-theme.ts"
    )
    const resourceCategoryIconSource = readRoute(
      "src/components/public/public-map-index/resource-category-icon.tsx"
    )
    const markerIconSource = readRoute(
      "src/lib/public-map/public-map-marker-icons.ts"
    )
    const filterUrlStateSource = readRoute(
      "src/components/public/public-map-index/filter-url-state.ts"
    )
    const filterUrlHookSource = readRoute(
      "src/components/public/public-map-index/use-filter-url-state.ts"
    )
    const filterStateSource = readRoute(
      "src/components/public/public-map-index/public-map-index-filter-state.ts"
    )

    expect(publicMapSource).toContain("usePublicMapFilterUrlState")
    expect(publicMapSource).toContain(
      "onFilterChange: clearMapTransientSelection"
    )
    expect(publicMapSource).toContain(
      "const deferredQuery = useDeferredValue(query)"
    )
    expect(filterUrlHookSource).toContain("resolvePublicMapFilterUrlState")
    expect(filterUrlHookSource).toContain("buildPublicMapFilterHref")
    expect(filterUrlHookSource).toContain("const pathname = usePathname()")
    expect(filterUrlHookSource).toContain("filterStateRef")
    expect(filterUrlHookSource).toContain("window.history.replaceState")
    expect(filterUrlHookSource).toContain("PUBLIC_MAP_FILTER_URL_SYNC_DELAY_MS")
    expect(filterUrlHookSource).not.toContain("useRouter")
    expect(filterUrlHookSource).toContain(
      "const [query, setQuery] = useState(initialFilterState.query)"
    )
    expect(filterUrlHookSource).toContain("initialFilterState.activeGroup")
    expect(filterStateSource).toContain("buildPublicMapGroupFilterCounts")
    expect(filterStateSource).toContain("buildPublicMapItems")
    expect(publicMapSource).toContain(
      "organizations: filterState.filteredOrganizations"
    )
    expect(publicMapSource).toContain(
      "filteredOrganizations={filterState.filteredOrganizations}"
    )
    expect(searchCardSource).toContain("PublicMapCategoryFilter")
    expect(categoryFilterSource).toContain(
      'aria-label="Filter resources by category"'
    )
    expect(categoryFilterSource).toContain("PUBLIC_MAP_RESOURCE_CATEGORY_ORDER")
    expect(categoryFilterSource).toContain("PublicMapResourceCategoryIcon")
    expect(categoryFilterSource).toContain("PublicMapAllCategoryIcon")
    expect(categoryFilterSource).toContain(
      'data-public-map-category-filter-icon=""'
    )
    expect(categoryFilterSource).toContain("aria-pressed={selected}")
    expect(categoryFilterSource).toContain("resolvePublicMapGroupFilterParam")
    expect(categoryFilterSource).toContain("PUBLIC_MAP_FILTER_PILL_CLASSNAME")
    expect(sidebarThemeSource).toContain("border-input bg-input/30")
    expect(sidebarThemeSource).toContain("rounded-full border px-2.5")
    expect(sidebarThemeSource).toContain("backdrop-blur")
    expect(categoryFilterSource).not.toContain("shadow-sm backdrop-blur")
    expect(categoryFilterSource).toContain("!bg-input/50 text-foreground")
    expect(categoryFilterSource).toContain('selected ? "text-foreground"')
    expect(categoryFilterSource).not.toContain("hover:text-white")
    expect(categoryFilterSource).toContain("hover:!bg-input/50")
    expect(categoryFilterSource).toContain("focus-visible:!bg-input/50")
    expect(categoryFilterSource).toContain(
      "transition-[background-color,border-color,color,opacity]"
    )
    expect(categoryFilterSource).not.toContain("dark:bg-foreground")
    expect(categoryFilterSource).not.toContain("dark:bg-background/18")
    expect(categoryFilterSource).not.toContain("dark:text-background")
    expect(categoryFilterSource).not.toContain(
      "bg-foreground text-background hover:bg-foreground"
    )
    expect(categoryFilterSource).not.toContain(
      "text-muted-foreground dark:text-background/72"
    )
    expect(categoryFilterSource).not.toContain("dark:hover:!bg-muted/50")
    expect(categoryFilterSource).not.toContain("dark:hover:bg-accent/50")
    expect(categoryFilterSource).not.toContain("lucide-react")
    expect(resourceCategoryIconSource).toContain("resource-category-icon-paths")
    expect(markerIconSource).toContain("resource-category-icon-paths")
    expect(resourceCategoryIconSource).not.toContain("lucide-react")
    expect(filterUrlStateSource).toContain('PUBLIC_MAP_QUERY_PARAM = "q"')
    expect(filterUrlStateSource).toContain(
      'PUBLIC_MAP_CATEGORY_PARAM = "category"'
    )
    expect(filterUrlStateSource).toContain("buildPublicMapFilterHref")
  })

  it("expands search into a responsive, stateful drawer experience", () => {
    const sidebarSource = [
      readRoute("src/components/public/public-map-index/sidebar.tsx"),
      readRoute("src/components/public/public-map-index/sidebar-drawer.tsx"),
    ].join("\n")
    const searchCardSource = readRoute(
      "src/components/public/public-map-index/search-card.tsx"
    )
    const searchResultsStatusSource = readRoute(
      "src/components/public/public-map-index/search-results-status.tsx"
    )
    const organizationListSource = readRoute(
      "src/components/public/public-map-index/organization-list.tsx"
    )
    const resourceItemsSource = readRoute(
      "src/components/public/public-map-index/use-resource-map-items.ts"
    )
    const drawerSearchHandlersSource = readRoute(
      "src/components/public/public-map-index/use-public-map-drawer-search-handlers.ts"
    )

    expect(sidebarSource).toContain("handleDrawerSearchEngage")
    expect(sidebarSource).toContain(
      "data-public-map-drawer-snap-index={activeSnapIndex}"
    )
    expect(drawerSearchHandlersSource).toContain(
      "setActiveSnapIndex((current) => (current === 0 ? 1 : current))"
    )
    expect(searchCardSource).toContain('aria-label="Clear search"')
    expect(searchCardSource).toContain("onFocus={onSearchEngage}")
    expect(searchCardSource).toContain("aria-busy={searchPending}")
    expect(searchResultsStatusSource).toContain(
      'data-public-map-search-results-status="true"'
    )
    expect(searchResultsStatusSource).toContain("Loading resources…")
    expect(organizationListSource).toContain(
      'data-public-map-search-loading="true"'
    )
    expect(organizationListSource).toContain(
      'data-public-map-search-empty="true"'
    )
    expect(organizationListSource).toContain("No matches for")
    expect(resourceItemsSource).toContain("resourceItemsLoadByEndpoint")
    expect(resourceItemsSource).toContain(
      "warmPublicMapListItemSearchCache(resourceItems)"
    )
  })

  it("wires resource marker selection into the shared list and detail surfaces", () => {
    const publicMapSource = readRoute(
      "src/components/public/public-map-index.tsx"
    )
    const publicMapSelectionSource = readRoute(
      "src/components/public/public-map-index/public-map-index-selection.ts"
    )
    const mapSurfaceSource = readRoute(
      "src/components/public/public-map-index/map-surface.tsx"
    )
    const resourceDetailSource = readRoute(
      "src/components/public/public-map-index/resource-detail.tsx"
    )
    const resourceDetailChromeSource = readRoute(
      "src/components/public/public-map-index/resource-detail-primary-sections.tsx"
    )
    const mapItemsStateSource = readRoute(
      "src/components/public/public-map-index/map-items-state.ts"
    )

    expect(publicMapSource).toContain("selectedListItemId")
    expect(publicMapSource).toContain("handleSelectMapMarker")
    expect(publicMapSource).toContain("handleSelectListItem")
    expect(publicMapSource).toContain(
      "preferNationalFallback: includeSeedResources && !initialPublicSlug"
    )
    expect(publicMapSource).toContain("filteredItems={directoryListItems}")
    expect(publicMapSource).toContain("selectedItemId={selectedListItemId}")
    expect(publicMapSource).toContain(
      "selectedResourceItem={selectedResourceItem}"
    )
    expect(publicMapSelectionSource).toContain('setSidebarMode("details")')
    expect(mapSurfaceSource).toContain("filteredItems")
    expect(mapSurfaceSource).toContain("onSelectItem")
    expect(resourceDetailSource).toContain("PublicMapResourceDetail")
    expect(resourceDetailSource).toContain("PublicMapResourceDetailChrome")
    expect(resourceDetailChromeSource).toContain("Back to search")
    expect(mapSurfaceSource).not.toContain("PublicMapResourcePreviewPopover")
    expect(mapItemsStateSource).toContain("resolvePublicMapItemSelectableId")
    expect(mapItemsStateSource).toContain("buildPublicMapListItems")
    expect(mapItemsStateSource).toContain(
      "resolvePublicMapListItemsFromSelectableIds"
    )
    expect(mapItemsStateSource).not.toContain("PreviewPopover")
  })

  it("renders unclustered organization markers when the resource adapter is empty", () => {
    const markerSource = readRoute(
      "src/components/public/public-map-index/use-public-map-markers.ts"
    )
    const markerArtworkSource = readRoute(
      "src/components/public/public-map-index/sync-public-map-marker-artwork.ts"
    )

    expect(markerSource).toContain("const resolvedMapItems = mapItems ?? []")
    expect(markerSource).toContain(
      "const shouldUseMapItems = resolvedMapItems.length > 0"
    )
    expect(markerSource).toContain("currentMapItems.length > 0")
    expect(markerSource).toContain(
      "buildPublicMapPointFeatures(organizationsRef.current, {"
    )
    expect(markerSource).toContain("features: pointFeatures")
    expect(markerSource).toContain("syncPublicMapMarkerArtwork")
    expect(markerArtworkSource).toContain("setPublicMapMarkerSourceData")
    expect(markerSource).not.toContain("createPublicMapClusterClient")
    expect(markerSource).not.toContain("getClusters")
  })

  it("does not render the member profile card in public or authenticated find rails", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
    const publicMapSource = readRoute(
      "src/components/public/public-map-index.tsx"
    )
    const rightRailSource = readRoute(
      "src/components/public/public-map-index/right-rail.tsx"
    )

    for (const routeFile of routeFiles) {
      expect(readRoute(routeFile)).not.toContain(
        "memberProfile={viewerState.memberProfile}"
      )
    }

    expect(publicMapSource).not.toContain("memberProfile")
    expect(rightRailSource).not.toContain("PublicMapMemberProfileCard")
    expect(rightRailSource).not.toContain("flex flex-col gap-3 p-4")
  })

  it("keeps authenticated find viewer detection lightweight", () => {
    const viewerStateSource = readRoute(
      "src/features/find-map/server/viewer-state.ts"
    )

    expect(viewerStateSource).toContain("supabase.auth.getUser()")
    expect(viewerStateSource).not.toContain('.from("profiles")')
    expect(viewerStateSource).not.toContain("buildOnboardingFlowDefaults")
    expect(viewerStateSource).not.toContain("memberProfile")
  })
})
