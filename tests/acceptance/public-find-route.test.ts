import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

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
  it("owns discovery at /resources and keeps the marketing home separate with legacy redirects", () => {
    const rootRoute = readRoute("src/app/(public)/page.tsx")
    const resourcesRoute = readRoute("src/app/(public)/resources/page.tsx")
    const mapRoute = readRoute("src/app/(public)/map/page.tsx")
    const landing = readRoute("src/features/build-collect-navigation/components/public-home-landing.tsx")
    const nextConfig = readRoute("next.config.ts")

    expect(rootRoute).toContain("<PublicHomeLanding")
    expect(rootRoute).not.toContain("PublicHomeResourceExplorer")
    expect(rootRoute).toContain("resolvePublicAuthCallbackHref")
    expect(landing).toContain("<PublicHomeLandingHeader")
    expect(readRoute("src/features/build-collect-navigation/components/public-home-landing-header.tsx")).toContain("<BuildCollectPublicHeader")
    expect(landing).toContain('<main aria-label="Home"')
    expect(landing).toContain("<PublicMapFooter showClaim={false}")
    expect(landing).not.toContain("PublicFindRoute")
    expect(resourcesRoute).toContain("<PublicHomeResourceExplorer")
    expect(resourcesRoute).toContain('canonical: "/resources"')
    expect(mapRoute).toContain("permanentRedirect(buildFindHref(params))")
    expect(nextConfig).toContain('source: "/map"')
    expect(nextConfig).toContain('source: "/find"')
    expect(nextConfig).toContain('destination: "/resources"')
    expect(nextConfig).toContain('destination: "/resources?organization=:slug"')
    expect(nextConfig.match(/permanent: true/g)).toHaveLength(3)
    expect(readRoute("src/app/sitemap.ts")).toContain("${origin}/resources")
    expect(readRoute("src/lib/organization/reserved-public-slugs.ts")).toContain('"resources"')
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
    expect(runtimeSource).toContain("publicMapViewOptions(themeRef.current)")
    const optionsSource = readRoute("src/components/public/public-map-index/map-view-options.ts")
    const previewSource = readRoute("src/components/public/public-map-index/public-map-preview.tsx")
    expect(optionsSource).toContain("resolvePublicMapBasemapConfig(theme)")
    expect(optionsSource).toContain('projection: "globe"')
    expect(previewSource).toContain("publicMapViewOptions(theme)")
    expect(previewSource).not.toContain("openfreemap")
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

  it("never mixes synthetic resource seeds into live find routes", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]

    for (const routeFile of routeFiles) {
      expect(readRoute(routeFile)).not.toContain("includeSeedResources")
    }
  })

  it("preserves public organization detail wiring for signed-out visitors", () => {
    const source = readRoute(PUBLIC_FIND_ROUTE)
    expect(source).toContain("initialPublicSlug={initialPublicSlug}")
    expect(source).toContain("<HomeCanvasFindShell>")
    expect(source).toContain("if (shellState?.userPresent && shellState.isAdmin)")
    expect(source).toContain('redirect("/workspace")')
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

  it("keeps the public map full bleed", () => {
    const routeFiles = [PUBLIC_FIND_ROUTE]
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

    expect(mapSurfaceSource).toContain("h-full min-h-0 w-full min-w-0 flex-1")
    expect(publicMapSource).not.toContain("resolvePublicMapPresentationFlags")
    expect(publicMapChromeSource).not.toContain("PublicMapDirectoryRail")
    expect(publicMapChromeSource).not.toContain("PublicMapRightRail")
    expect(mapViewHelpersSource).toContain('return "drawer"')
    expect(sidebarSource).toContain("dismissible={false}")
    expect(sidebarSource).toContain("<PublicMapMemberRail")
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
    expect(appShellSource).toContain("isMobile")
    expect(shellMainContentSource).toContain(
      "rounded-none border-0 md:rounded-[28px] md:border md:border-[color:var(--shell-border)]"
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
      "const hasGuides = showGuidesTab && Boolean(onGuideSelect)"
    )
    const tabTriggers = readRoute("src/components/public/public-map-index/member-tab-triggers.tsx")
    expect(memberRailSource).toContain("<PublicMapMemberTabTriggers")
    expect(tabTriggers).toContain(">Find</span>")
    expect(tabTriggers).toContain(">Guides</span>")
    expect(tabTriggers).toContain("<PublicMapCollectedTabLabel")
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
    expect(searchCardSource).toContain("onActiveGroupChange")
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
    expect(searchCardSource).toContain('aria-label={canCancel ? "Cancel search" : "Clear search"}')
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
    expect(organizationListSource).toContain("No listings match")
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
    expect(publicMapSource).toContain("filteredItems={activeSearchContext?.items ?? filterState.filteredItems}")
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

    expect(viewerStateSource).toContain('from "@/server/auth/server-user"')
    expect(viewerStateSource).toContain("getServerUser(supabase)")
    expect(readRoute("src/server/auth/server-user.ts")).toContain(
      "supabase.auth.getUser()"
    )
    expect(viewerStateSource).not.toContain('.from("profiles")')
    expect(viewerStateSource).not.toContain("buildOnboardingFlowDefaults")
    expect(viewerStateSource).not.toContain("memberProfile")
  })
})

const entryMocks = vi.hoisted(() => ({
  viewer: vi.fn(),
  dashboard: vi.fn(),
  organizations: vi.fn(),
}))
vi.mock("@/components/app-shell/dashboard-layout-state", () => ({ resolveDashboardLayoutState: entryMocks.dashboard }))
vi.mock("@/components/app-shell/sidebar-state-server", () => ({ readAppSidebarDefaultOpen: async () => true }))
vi.mock("@/features/find-map/components/authenticated-find-shell", () => ({ AuthenticatedFindShell: () => null }))
vi.mock("@/actions/public-map-organization-curation", () => ({ updatePublicMapOrganizationCurationAction: vi.fn() }))
vi.mock("@/features/resource-map-admin", () => ({ updateResourceMapCanonicalStateAction: vi.fn() }))
vi.mock("@/features/find-map/viewer-state", () => ({ fetchPublicMapViewerState: entryMocks.viewer }))
vi.mock("@/lib/queries/public-map-index", () => ({ fetchPublicMapOrganizations: entryMocks.organizations }))
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`) } }))
vi.mock("@/components/public/home-canvas-find-shell", () => ({ HomeCanvasFindShell: () => null }))
vi.mock("@/components/public/public-map-index", () => ({ PublicMapIndex: () => null }))
vi.mock("@/features/find-map/components/find-render-diagnostic", () => ({ FindRenderDiagnostic: () => null }))

describe("signed-in root entry", () => {
  beforeEach(() => {
    entryMocks.dashboard.mockReset().mockResolvedValue({ userPresent: true, isAdmin: false })
    entryMocks.viewer.mockReset().mockResolvedValue({ viewer: null })
    entryMocks.organizations.mockReset().mockResolvedValue([])
  })

  it.each([{}, { member_onboarding: "1", source: "signup" }, { q: "table", org: "example" }])("redirects signed-in reloads before fetching map data: %j", async (params) => {
    entryMocks.viewer.mockResolvedValue({ viewer: { id: "free-user", email: "test@example.com" } })
    const { PublicFindRoute } = await import("@/features/find-map/components/public-find-route")
    await expect(PublicFindRoute({ searchParams: Promise.resolve(params) })).rejects.toThrow("redirect:/workspace")
    expect(entryMocks.organizations).not.toHaveBeenCalled()
  })

  it("retains the existing curation surface for platform admins", async () => {
    entryMocks.viewer.mockResolvedValue({ viewer: { id: "admin-user" } })
    entryMocks.dashboard.mockResolvedValue({ userPresent: true, isAdmin: true, memberMapOnboarding: { hasOrganizationSwitcher: true } })
    const { PublicFindRoute } = await import("@/features/find-map/components/public-find-route")
    const result = await PublicFindRoute()
    const shell = result.props.children
    const map = shell.props.children
    expect(map.props.canManageResourceMap).toBe(true)
    expect(map.props.organizationCurationAction).toBeTypeOf("function")
    expect(map.props.resourceMapCurationAction).toBeTypeOf("function")
    expect(entryMocks.organizations).toHaveBeenCalledOnce()
  })

  it("keeps the map available to signed-out visitors", async () => {
    const { PublicFindRoute } = await import("@/features/find-map/components/public-find-route")
    await expect(PublicFindRoute()).resolves.toBeDefined()
    expect(entryMocks.organizations).toHaveBeenCalledOnce()
  })

  it("processes email confirmation callbacks before workspace routing", async () => {
    const { PublicFindRoute } = await import("@/features/find-map/components/public-find-route")
    await expect(PublicFindRoute({ searchParams: Promise.resolve({ code: "confirmation-code" }) })).rejects.toThrow("redirect:/auth/callback?code=confirmation-code")
    expect(entryMocks.viewer).not.toHaveBeenCalled()
    expect(entryMocks.organizations).not.toHaveBeenCalled()
  })
})
