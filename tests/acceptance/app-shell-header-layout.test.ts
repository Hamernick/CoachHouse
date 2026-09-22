import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("app shell header layout", () => {
  it("keeps header actions independent from right rail open state", () => {
    const headerSource = readSource(
      "src/components/app-shell/components/app-shell-header.tsx"
    )
    const rightRailSource = readSource(
      "src/components/app-shell/components/shell-right-rail.tsx"
    )

    expect(headerSource).toContain('id="site-header-actions-right"')
    expect(headerSource).toContain("pr-[var(--shell-content-pad)]")
    expect(headerSource).not.toContain("headerRightPadding")
    expect(headerSource).not.toContain("--shell-right-rail")
    expect(headerSource).not.toContain(
      "pr-[calc(var(--shell-content-pad)+var(--shell-right-rail))]"
    )
    expect(rightRailSource).toContain('"w-[var(--shell-right-rail-width)]"')
    expect(rightRailSource).toContain('<SheetDescription className="sr-only">')
    expect(rightRailSource).toContain(
      "Contextual details for the current workspace view."
    )
    expect(rightRailSource).toContain('"pointer-events-none w-0"')
  })

  it("keeps resizing scoped to the desktop find rail", () => {
    const appShellSource = readSource(
      "src/components/app-shell/app-shell-inner.tsx"
    )
    const appShellTypesSource = readSource("src/components/app-shell/types.ts")
    const rightRailStateSource = readSource(
      "src/components/app-shell/use-app-shell-right-rail-state.ts"
    )
    const authenticatedFindShellSource = readSource(
      "src/features/find-map/components/authenticated-find-shell.tsx"
    )
    const rightRailSource = readSource(
      "src/components/app-shell/components/shell-right-rail.tsx"
    )
    const shellMainContentSource = readSource(
      "src/components/app-shell/components/shell-main-content.tsx"
    )
    const headerSource = readSource(
      "src/components/app-shell/components/app-shell-header.tsx"
    )
    const globalSearchTriggersSource = readSource(
      "src/components/global-search/global-search-triggers.tsx"
    )
    const resizableSource = readSource("src/components/ui/resizable.tsx")

    expect(appShellSource).toContain("@/components/ui/resizable")
    expect(appShellSource).toContain("useDesktopResizableRightRail")
    expect(rightRailStateSource).toContain(
      "const [rightOpen, setRightOpen] = useState(false)"
    )
    expect(rightRailStateSource).not.toContain('typeof window === "undefined"')
    expect(appShellSource).toContain("resizableRightRail = false")
    expect(appShellSource).toContain(
      "!isMobile && hasRightRail && rightOpen && resizableRightRail"
    )
    expect(appShellSource).not.toContain('derivedContext !== "public"')
    expect(appShellTypesSource).toContain("resizableRightRail?: boolean")
    expect(authenticatedFindShellSource).toContain("resizableRightRail")
    expect(appShellSource).toContain('id="app-shell-right-rail-layout"')
    expect(appShellSource).toContain('id="app-shell-main-content-panel"')
    expect(appShellSource).toContain('id="app-shell-right-rail-panel"')
    expect(appShellSource).toContain('aria-label="Resize right rail"')
    expect(appShellSource).toContain(
      "text-foreground h-full min-h-0 min-w-0 overflow-hidden"
    )
    expect(appShellSource).toContain("flex min-h-0 min-w-0 flex-1")
    expect(appShellSource).toContain("flex h-full min-h-0 min-w-0 flex-col")
    expect(appShellSource).toContain("flex min-h-0 min-w-0 flex-1 gap-0")
    expect(appShellSource).toContain('className="min-h-0 min-w-0 flex-1"')
    expect(appShellSource).toContain(
      "className=\"before:bg-border z-40 -ml-px shrink-0 bg-transparent before:absolute before:inset-y-16 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:content-['']\""
    )
    expect(appShellSource).not.toContain("h-[calc(100%-1rem)]")
    expect(appShellSource).not.toContain("mx-1 w-2 bg-transparent")
    expect(appShellSource).not.toContain("after:w-2 after:bg-transparent")
    expect(appShellSource).toContain("defaultSize={rightRailDefaultSize}")
    expect(appShellSource).toContain('derivedContext === "public"')
    expect(appShellSource).toContain('? "24%"')
    expect(appShellSource).toContain('minSize="45%"')
    expect(appShellSource).toContain('minSize="18%"')
    expect(appShellSource).toContain('maxSize="42%"')
    expect(appShellSource).not.toContain("minSize={45}")
    expect(appShellSource).not.toContain("minSize={18}")
    expect(appShellSource).not.toContain("maxSize={42}")
    expect(rightRailSource).toContain("resizablePanel?: boolean")
    expect(rightRailSource).toContain("resizablePanel = false")
    expect(rightRailSource).toContain('"w-full"')
    expect(rightRailSource).toContain('"w-[var(--shell-right-rail-width)]"')
    expect(rightRailSource).toContain(
      '"h-full min-h-0 w-full px-[var(--shell-right-rail-pad,var(--shell-rail-padding))] pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"'
    )
    expect(rightRailSource).toContain('? "flex flex-col overflow-hidden"')
    expect(rightRailSource).toContain(': "overflow-y-auto"')
    expect(shellMainContentSource).toContain(
      "flex min-h-0 w-full min-w-0 flex-1 flex-col"
    )
    expect(shellMainContentSource).toContain(
      "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
    )
    expect(shellMainContentSource).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col"
    )
    expect(headerSource).toContain(
      "hidden min-w-0 items-center overflow-hidden"
    )
    expect(headerSource).toContain("shrink-0 flex-wrap items-center")
    expect(globalSearchTriggersSource).toContain("w-full max-w-[520px] min-w-0")
    expect(globalSearchTriggersSource).not.toContain("min-w-[240px]")
    expect(resizableSource).toContain("react-resizable-panels")
    expect(resizableSource).toContain("ResizablePanelGroup")
    expect(resizableSource).toContain("bg-border focus-visible:ring-ring")
    expect(resizableSource).toContain("bg-border z-10 flex h-4 w-3")
  })

  it("widens only the fixed workspace home rail", () => {
    const appShellSource = readSource(
      "src/components/app-shell/app-shell-inner.tsx"
    )

    expect(appShellSource).toContain(
      'const isWorkspaceHomeRoute = pathname === "/workspace"'
    )
    expect(appShellSource).toContain(
      'isWorkspaceHomeRoute && "[--shell-right-rail-width:17rem]"'
    )
  })
})
