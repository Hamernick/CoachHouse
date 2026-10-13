import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

vi.mock("@/components/public/legacy-home-sections", () => ({
  LEGACY_HOME_SECTION_NAV: [
    { id: "hero", label: "Hero", icon: () => null },
    { id: "platform", label: "Platform", icon: () => null },
    { id: "accelerator", label: "Accelerator", icon: () => null },
    { id: "process", label: "Process", icon: () => null },
    { id: "team", label: "Team", icon: () => null },
  ],
}))

import { VISIBLE_CANVAS_NAV } from "@/components/public/home-canvas-preview-config"
import { resolveHomeCanvasSectionTransition } from "@/components/public/home-canvas-preview-navigation"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("home canvas preview navigation", () => {
  it("keeps the hero section available to explicit navigation", () => {
    expect(VISIBLE_CANVAS_NAV.map((item) => item.id)).toContain("hero")
  })

  it("still syncs hidden auth panels when the section changes via URL", () => {
    expect(resolveHomeCanvasSectionTransition("signup", "login")).toEqual({
      shouldChange: true,
      direction: null,
    })
    expect(resolveHomeCanvasSectionTransition("login", "hero")).toEqual({
      shouldChange: true,
      direction: null,
    })
  })

  it("preserves directional transitions for visible sections", () => {
    expect(resolveHomeCanvasSectionTransition("hero", "platform")).toEqual({
      shouldChange: true,
      direction: 1,
    })
    expect(resolveHomeCanvasSectionTransition("platform", "hero")).toEqual({
      shouldChange: true,
      direction: -1,
    })
  })

  it("keeps shell controls while delegating public navigation to the shared header", () => {
    const source = readSource(
      "src/components/public/home-canvas-preview-shell.tsx"
    )
    const publicHeaderSource = readSource(
      "src/features/build-collect-navigation/components/build-collect-public-header.tsx"
    )

    expect(source).not.toContain("function HomeCanvasMobileHeaderBrand")
    expect(source).toContain("function HomeCanvasBrandLink")
    expect(source).toContain("function HomeCanvasSidebarHeader")
    expect(source).toContain("function HomeCanvasMobileSidebarTrigger")
    expect(source).toContain(
      "const { isMobile, openMobile, toggleSidebar } = useSidebar()"
    )
    expect(source).toContain('"Close sidebar"')
    expect(source).toContain('"Open sidebar"')
    expect(source).toContain("aria-expanded={openMobile}")
    expect(source).toContain("onClick={toggleSidebar}")
    expect(source).toContain("size-11")
    expect(source).toContain("showShellSidebar ? <HomeCanvasMobileSidebarTrigger /> : null")
    expect(source).toContain("<BuildCollectPublicHeader")
    expect(source).toContain("hideBrandOnDesktop={showShellSidebar}")
    expect(source).not.toContain('onClick={() => changeSection("signup")}')
    expect(publicHeaderSource).toContain(
      'activeArea === "build"\n      ? { href: "/sign-up?intent=build", label: "Start free" }'
    )
    expect(publicHeaderSource).toContain(': { href: "/sign-up?intent=build", label: "Sign up" }')
    expect(source.indexOf("<HomeCanvasMobileSidebarTrigger")).toBeGreaterThan(
      source.indexOf("<HomeCanvasLoginButton")
    )
  })
})
