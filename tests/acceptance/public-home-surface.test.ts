import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { resolvePublicMapScreenMode } from "@/components/public/public-map-index/embedded-screen-state"

import { resolveEmbeddedProfileId } from "@/components/public/public-map-index/use-public-map-profile-navigation"

const ROOT = process.cwd()

describe("home profile history resolution", () => {
  const organizations = new Map([
    ["org-1", { id: "org-1", publicSlug: "manoextendida" }],
    ["org-2", { id: "org-2", publicSlug: null }],
  ])
  it("restores organization selections from public slugs or published ID fallbacks", () => {
    expect(resolveEmbeddedProfileId("/manoextendida", organizations)).toBe("org-1")
    expect(resolveEmbeddedProfileId("/org-2", organizations)).toBe("org-2")
    expect(resolveEmbeddedProfileId("/", organizations)).toBeNull()
    expect(resolveEmbeddedProfileId("/private-handle", organizations)).toBeNull()
  })
  it("restores supported directory identities and rejects malformed paths", () => {
    expect(resolveEmbeddedProfileId("/find/resources/010044660", organizations)).toBe("nonprofit:010044660")
    const id = "95601a05-635f-46cf-bbb0-41d7f648a440"
    expect(resolveEmbeddedProfileId(`/find/resources/${id}`, organizations)).toBe(`resource_map:${id}`)
    expect(resolveEmbeddedProfileId("/find/resources/not-public", organizations)).toBeNull()
    expect(resolveEmbeddedProfileId("/find/resources/010044660/extra", organizations)).toBeNull()
  })
})

describe("public map screen presentation", () => {
  const base = { embedded: true, detailsOpen: false }

  it("keeps the map present while the adjacent panel displays results", () => {
    expect(resolvePublicMapScreenMode(base)).toBe("map")
    expect(resolvePublicMapScreenMode({ ...base, detailsOpen: true })).toBe("detail")
    expect(resolvePublicMapScreenMode(base)).toBe("map")
  })

  it("uses the same profile surface for every embedded selection and preserves standalone map behavior", () => {
    expect(resolvePublicMapScreenMode({ ...base, detailsOpen: true })).toBe("detail")
    expect(resolvePublicMapScreenMode({ ...base, embedded: false, detailsOpen: true })).toBe("map")
  })

})

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("public marketing canvas", () => {
  it("keeps the established shell at the home-canvas route", () => {
    const routeSource = readSource("src/app/(public)/home-canvas/page.tsx")

    expect(routeSource).toContain("<HomeCanvasPreview")
    expect(routeSource).toContain("<PricingSurface embedded />")
    expect(routeSource).not.toContain("HomePageSurface")
  })

  it("leads with the real map and presents the complete product story inside canvas panels", () => {
    const source = readSource(
      "src/components/public/home-canvas-product-panels.tsx"
    )

    expect(source).toContain('data-public-home-hero=""')
    expect(source).toContain("<HomeFindMapMini")
    expect(source).not.toContain("next/image")
    expect(source).not.toContain(".webp")
    expect(source).toContain("Build, find, and fund nonprofit work.")
    expect(source).toContain("One workspace from board to team.")
    expect(source).toContain("Every document, next to the work it supports.")
    expect(source).toContain(
      "Qualified projects can apply for fiscal sponsorship"
    )
    expect(source).toContain(
      "Fiscal sponsorship is subject to eligibility review and approval."
    )
    expect(source).toContain("FiscalSponsorshipWorkspaceCardSurface")
    expect(source).toContain('import("@/features/fiscal-sponsorship")')
    expect(source).not.toContain(
      "FiscalSponsorshipWorkspaceCardSurface,\n  type FiscalSponsorshipProgramOption"
    )
    expect(source).not.toContain("HomeFundingPreview")
    expect(source).toContain("data-public-home-build-pricing")
    expect(source).toContain('action={FIND_PATH}')
    expect(source).toContain('href="/home-canvas?section=platform"')
  })

  it("keeps Find, Build, and Fund centered over the rounded canvas", () => {
    const source = readSource(
      "src/components/public/home-canvas-product-navigator.tsx"
    )
    const shellSource = readSource(
      "src/components/public/home-canvas-preview.tsx"
    )
    const sidebarSource = readSource(
      "src/components/public/home-canvas-preview-sidebar.tsx"
    )
    const headerSource = readSource(
      "src/components/public/home-canvas-preview-shell.tsx"
    )

    expect(source).toContain('href={FIND_PATH}')
    expect(source).toContain(
      'aria-current={activeSection === "hero" ? "true" : undefined}'
    )
    expect(source).toContain('aria-pressed={activeSection === "platform"}')
    expect(source).toContain('aria-pressed={activeSection === "accelerator"}')
    expect(source).toContain('changeSection("platform")')
    expect(source).toContain('changeSection("accelerator")')
    expect(source).toContain("grid-cols-3 rounded-full")
    expect(source).toContain("backdrop-blur-xl")
    expect(source).toContain('data-public-home-product-navigator=""')
    expect(source.match(/variant=\{null\}/g)).toHaveLength(3)
    expect(source).not.toContain("hover:")
    expect(shellSource).toContain("<HomeCanvasPreviewSidebar")
    expect(shellSource).toContain("showFindSidebarShell ? (")
    expect(shellSource).toContain("<ShellRightRail")
    expect(shellSource).toContain("<HomeCanvasProductNavigator")
    expect(shellSource).toContain("rounded-[28px]")
    expect(shellSource).not.toContain("onWheel=")
    expect(shellSource).not.toContain("goToAdjacentSection")
    expect(shellSource).not.toContain("Scroll down")
    expect(sidebarSource).not.toContain("SIDEBAR_CANVAS_NAV")
    expect(sidebarSource).not.toContain("About")
    expect(sidebarSource).not.toContain("Sign up")
    expect(headerSource).toContain("<BuildCollectPublicHeader")
    expect(headerSource).toContain(
      'activeArea={activeSection === "find" ? "collect" : "build"}'
    )
  })

  it("uses GSAP for focused reveals and respects reduced motion", () => {
    const source = readSource(
      "src/components/public/home-canvas-product-motion.tsx"
    )

    expect(source).toContain('import { gsap } from "gsap"')
    expect(source).toContain("prefers-reduced-motion: reduce")
    expect(source).toContain("IntersectionObserver")
    expect(source).toContain('ease: "power3.out"')
  })

  it("uses a bounded live product vignette instead of a raster map capture", () => {
    const previewSource = readSource(
      "src/components/public/home-find-map-mini.tsx"
    )
    const assetPath = join(ROOT, "public/home/find-map-preview.webp")
    const obsoleteMarkerPath = join(
      ROOT,
      "src/components/public/home-find-map-marker-canvas.ts"
    )

    expect(existsSync(assetPath)).toBe(false)
    expect(existsSync(obsoleteMarkerPath)).toBe(false)
    expect(previewSource).toContain('import("mapbox-gl")')
    expect(previewSource).toContain("PUBLIC_MAP_STANDARD_STYLE")
    expect(previewSource).toContain("HOME_MAP_DEVELOPMENT_FALLBACK_STYLE")
    expect(previewSource).toContain("https://tiles.openfreemap.org/styles/dark")
    expect(previewSource).toContain('map.on("idle", markGlobeReady)')
    expect(previewSource).toContain('process.env.NODE_ENV === "production"')
    expect(previewSource).toContain(
      '["localhost", "127.0.0.1"].includes(window.location.hostname)'
    )
    expect(previewSource).not.toContain('status !== "ready"')
    expect(previewSource).toContain("startSpinningMapGlobe")
    expect(previewSource).toContain("syncPublicMapMarkerArtwork")
    expect(previewSource.match(/showLabels: false/g)).toHaveLength(2)
    expect(previewSource).toContain("PublicMapPointFeature[]")
    expect(previewSource).not.toContain("HOME_MAP_POINTS")
    expect(previewSource).not.toContain("satellite-v9")
    expect(previewSource).toContain("interactive: false")
    expect(previewSource).toContain('logoPosition: "bottom-left"')
    expect(previewSource).toContain(
      "new mapboxgl.AttributionControl({ compact: false })"
    )
    expect(previewSource).not.toContain(
      "new mapboxgl.AttributionControl({ compact: true })"
    )
    expect(previewSource).toContain(
      'data-home-map-controls-position="bottom-right"'
    )
    expect(previewSource).toContain("<figure")
    expect(previewSource).toContain('<figcaption className="sr-only">')
    expect(previewSource).not.toContain('role="img"')
    expect(previewSource).not.toContain(
      'aria-label="Public organizations and community resources on a rotating globe"'
    )
    expect(previewSource).toContain("className={`absolute inset-0")
    expect(previewSource).not.toContain("mapboxgl-map absolute inset-0")
    expect(previewSource).toContain("[&_.mapboxgl-ctrl-attrib]:!text-[10px]")
    expect(previewSource).not.toContain("mapbox-improve-map]:hidden")
    expect(previewSource).not.toContain("mapboxgl-ctrl-top-left")
    expect(previewSource).toContain("mapRef.current?.remove()")
    expect(previewSource).not.toContain("PublicMapIndex")
    expect(previewSource).not.toContain("/api/public/resource-map/items")
    expect(previewSource).not.toContain("HomeMapFallback")
    expect(previewSource).not.toContain("FALLBACK_MARKERS")
    expect(previewSource).not.toContain("clip-path:polygon")
    expect(previewSource).not.toContain("HomeMapSelectedPreview")
    expect(previewSource).not.toContain("data-home-map-selected-preview")
    expect(previewSource).not.toContain("Public resource map")
    expect(previewSource).not.toContain("geolocation")
    expect(previewSource).not.toContain("usePublicMapUserLocation")
  })

  it("builds the home globe from a capped published marker preview", () => {
    const routeSource = readSource("src/app/(public)/home-canvas/page.tsx")
    const previewComponentSource = readSource(
      "src/components/public/home-find-map-mini.tsx"
    )
    const previewDataSource = readSource(
      "src/lib/public-map/home-map-preview.ts"
    )
    const previewQuerySource = readSource("src/lib/queries/home-map-preview.ts")

    expect(routeSource).not.toContain("fetchPublicMapOrganizations")
    expect(routeSource).not.toContain("fetchPublicResourceMapItems")
    expect(previewComponentSource).toContain(
      'fetch("/api/public/home-map-preview"'
    )
    expect(previewQuerySource).toContain("fetchPublicResourceMapItems")
    expect(previewQuerySource).toContain("ignoreLocalPreviewFile: true")
    expect(previewQuerySource).toContain("includeDiscoveryCandidates: false")
    expect(previewDataSource).toContain("HOME_MAP_PREVIEW_MARKER_LIMIT = 36")
    expect(previewDataSource).toContain("resolveCandidateSpreadScore")
    expect(previewDataSource).toContain("markerOverviewOffsetIndex")
    expect(previewDataSource).toContain('item.visibility === "published"')
    expect(previewDataSource).toContain("includeSeedItems: false")
    expect(previewDataSource).not.toContain("resource-seed-items")
  })

  it("keeps public fiscal sponsorship actions active", () => {
    const source = readSource(
      "src/components/public/home-canvas-product-panels.tsx"
    )

    expect(source).toContain(
      'openFlowHref="/home-canvas?section=signup&intent=fund"'
    )
  })

  it("only serializes a public Mapbox token into the home preview", () => {
    const tokenSource = readSource("src/lib/mapbox/token.ts")
    const routeSource = readSource("src/app/(public)/home-canvas/page.tsx")

    expect(tokenSource).toContain("getPublicMapboxToken")
    expect(tokenSource).toContain('startsWith("pk.")')
    expect(routeSource).toContain("mapboxToken={getPublicMapboxToken()}")
  })
})
