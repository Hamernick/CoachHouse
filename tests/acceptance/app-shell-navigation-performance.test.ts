import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  isInternalPrefetchHref,
  uniqueInternalPrefetchHrefs,
} from "@/lib/navigation/internal-route-prefetch"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("app shell navigation performance", () => {
  it("keeps prefetching scoped to internal routes", () => {
    expect(isInternalPrefetchHref("/workspace")).toBe(true)
    expect(isInternalPrefetchHref("/find?group=all")).toBe(true)
    expect(isInternalPrefetchHref("mailto:joel@coachhousesolutions.org")).toBe(
      false
    )
    expect(isInternalPrefetchHref("https://coachhouse.app")).toBe(false)
    expect(isInternalPrefetchHref("//coachhouse.app")).toBe(false)
    expect(isInternalPrefetchHref("?paywall=organization")).toBe(false)
    expect(
      uniqueInternalPrefetchHrefs(["/workspace", "/workspace", "/tasks"])
    ).toEqual(["/workspace", "/tasks"])
  })

  it("animates route swaps without remounting shell content", () => {
    const shellSource = readSource(
      "src/components/app-shell/app-shell-inner.tsx"
    )
    const shellMainContentSource = readSource(
      "src/components/app-shell/components/shell-main-content.tsx"
    )
    const transitionHookSource = readSource(
      "src/components/app-shell/use-app-shell-route-transition.ts"
    )

    expect(shellSource).toContain("useAppShellRouteTransition")
    expect(shellMainContentSource).toContain("ref={routeTransitionRef}")
    expect(transitionHookSource).toContain("element.animate")
    expect(transitionHookSource).toContain("prefers-reduced-motion: reduce")
    expect(transitionHookSource).toContain("translate3d(0, 6px, 0)")
    expect(shellSource).not.toContain("key={pathname}")
  })

  it("prefetches internal nav and lesson destinations ahead of interaction", () => {
    const navSource = readSource("src/components/nav-main.tsx")
    const sidebarStepperSource = readSource(
      "src/components/app-sidebar/module-stepper.tsx"
    )
    const moduleStepperSource = readSource(
      "src/components/training/module-detail/module-stepper.tsx"
    )
    const moduleStepContentSource = readSource(
      "src/components/training/module-detail/module-stepper-active-step-content.tsx"
    )
    const acceleratorPanelSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel.tsx"
    )
    const acceleratorViewerTransitionSource = readSource(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-step-viewer-transition.tsx"
    )

    expect(navSource).toContain("useInternalRoutePrefetch")
    expect(navSource).toContain("onPointerEnter={() => prefetchHref")
    expect(sidebarStepperSource).toContain(
      "onFocus={() => onHover?.(step.href)}"
    )
    expect(sidebarStepperSource).toContain("prefetch={true}")
    expect(moduleStepperSource).toContain("router.prefetch(nextHref)")
    expect(moduleStepperSource).toContain("requestIdleCallback")
    expect(moduleStepContentSource).toContain("preloadAssignmentForm")
    expect(acceleratorPanelSource).toContain(
      "WorkspaceAcceleratorStepViewerTransition"
    )
    expect(acceleratorViewerTransitionSource).toContain(
      'key="accelerator-step-viewer"'
    )
    expect(acceleratorViewerTransitionSource).toContain("useReducedMotion")
  })

  it("keeps public find search and list updates responsive", () => {
    const publicMapSource = readSource(
      "src/components/public/public-map-index.tsx"
    )
    const searchIndexSource = readSource(
      "src/components/public/public-map-index/search-index.ts"
    )
    const organizationListSource = readSource(
      "src/components/public/public-map-index/organization-list.tsx"
    )
    const organizationDetailChromeSource = readSource(
      "src/components/public/public-map-index/organization-detail-shell-sections.tsx"
    )
    const actionsSource = readSource(
      "src/components/public/public-map-index/use-public-map-actions.ts"
    )

    expect(publicMapSource).toContain("useDeferredValue")
    expect(publicMapSource).toContain("deferredQuery,")
    expect(publicMapSource).toContain(
      "filteredMapItems: filterState.filteredItems"
    )
    expect(publicMapSource).toContain(
      "organizations: filterState.filteredOrganizations"
    )
    expect(publicMapSource).toContain("query,")
    expect(searchIndexSource).not.toContain("new Map(organizations.map")
    expect(searchIndexSource).toContain(
      "const favoriteIds = sortByFavorites ? new Set(favorites) : null"
    )
    expect(searchIndexSource).toContain("PUBLIC_MAP_NAME_COLLATOR")
    expect(organizationListSource).toMatch(
      /memo\(\s*PublicMapOrganizationListComponent\s*\)/
    )
    expect(organizationListSource).not.toContain("favoriteIds")
    expect(organizationListSource).not.toContain("favorite-button")
    expect(organizationDetailChromeSource).toContain(
      "aria-pressed={isFavorite}"
    )
    expect(actionsSource).toContain("useCallback")
  })
})
