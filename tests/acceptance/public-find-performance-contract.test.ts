import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("public Find performance contract", () => {
  it("uses Supabase's lockless browser auth coordination", () => {
    const packageJson = JSON.parse(readSource("package.json")) as {
      dependencies?: Record<string, string>
    }
    const clientSource = readSource("src/lib/supabase/client.ts")

    expect(packageJson.dependencies?.["@supabase/supabase-js"]).toBe("2.107.0")
    expect(clientSource).not.toMatch(/\block\s*:/)
  })

  it("uses measured 200-item pages without pre-rendering the pricing surface", () => {
    const source = readSource(
      "src/features/find-map/components/public-find-route.tsx"
    )

    expect(source).toContain("/api/public/resource-map/index?limit=200")
    expect(source).not.toContain("PricingSurface")
    expect(source).not.toContain("pricingPanel=")
  })

  it("uses a dedicated shell that excludes hidden home and authentication panels", () => {
    const source = readSource(
      "src/components/public/home-canvas-find-shell.tsx"
    )

    expect(source).toContain("HomeCanvasPreviewHeader")
    expect(source).toContain("HomeCanvasPreviewSidebar")
    expect(source).not.toContain("CanvasAuthPanel")
    expect(source).not.toContain("HomeSectionPanel")
    expect(source).not.toContain("PricingSurface")
  })

  it("loads the account sheet only after the user opens it", () => {
    const source = readSource(
      "src/components/public/public-map-index/map-surface.tsx"
    )

    expect(source).toContain('dynamic(() =>\n  import("./auth-sheet")')
    expect(source).toContain("{authSheetOpen ? (")
    expect(source).not.toContain(
      'import { PublicMapAuthSheet } from "./auth-sheet"'
    )
  })

  it("loads resource detail panels only after a result is opened", () => {
    const sidebarSource = readSource(
      "src/components/public/public-map-index/sidebar.tsx"
    )
    const panelsSource = readSource(
      "src/components/public/public-map-index/sidebar-panels.tsx"
    )

    const lazyPanelsSource = readSource(
      "src/components/public/public-map-index/sidebar-lazy-detail-panels.tsx"
    )

    expect(sidebarSource).toContain('from "./sidebar-lazy-detail-panels"')
    expect(lazyPanelsSource).toContain('import("./sidebar-detail-panels")')
    expect(sidebarSource).not.toContain('from "./sidebar-detail-panels"')
    expect(lazyPanelsSource).not.toContain('from "./sidebar-detail-panels"')
    expect(panelsSource).not.toContain('from "./sidebar-detail-panels"')
  })

  it("starts Mapbox immediately on desktop and touch devices", () => {
    const source = readSource(
      "src/components/public/public-map-index/public-map-index-runtime.ts"
    )
    const surfaceSource = readSource(
      "src/components/public/public-map-index/map-surface.tsx"
    )

    expect(source).toContain("mapStartRef.current = startMap\n    startMap()")
    expect(source).toContain("if (cancelled || initializationStarted) return")
    expect(source).not.toContain("PUBLIC_MAP_INTERACTION_READY_DELAY_MS")
    expect(source).not.toContain("hasCoarsePointer")
    expect(source).not.toContain('addEventListener("pointerdown", startMap')
    expect(surfaceSource).toContain('role="region"')
    expect(surfaceSource).toContain("tabIndex={embedded && (!mapReady || mapError || screen.mapHidden) ? -1 : 0}")
  })

  it("renders the intended location consent state in the initial shell", () => {
    const source = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )

    expect(source).toContain(
      "const [controlOpen, setControlOpen] = useState(false)"
    )
    expect(source).toContain(
      "const storedGrant = hasGrantedPublicMapLocation(window.sessionStorage)"
    )
    expect(source).toContain("setControlOpen(!storedGrant)")
  })

  it("enforces a dedicated first-load JavaScript budget for Find", () => {
    const source = readSource("scripts/performance-route-budgets.mjs")

    expect(source).toContain('routeKey: "/(public)/page"')
    expect(source).toContain('urlLabel: "/"')
    expect(source).toContain('shell: "public find"')
  })
})
