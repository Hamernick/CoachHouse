import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NavUserMenuContent } from "@/components/nav-user/nav-user-menu-content"

vi.mock("react-dom", async (importOriginal) => ({ ...await importOriginal<typeof import("react-dom")>(), createPortal: (children: unknown) => children }))
afterEach(() => vi.unstubAllGlobals())

const ROOT = process.cwd()

describe("nav user menu content", () => {
  it.each([true, false])("renders the optional upgrade button in the account menu (%s)", (showUpgrade) => {
    vi.stubGlobal("document", { body: {} })
    const markup = renderToStaticMarkup(createElement(NavUserMenuContent, {
      accountMenuContent: createElement("button", null, "Switch organization marker"),
      open: true, menuRef: { current: null }, menuStyle: null, user: {}, displayName: "Ada", displayEmail: "ada@example.test", avatarFallback: "A",
      isAdmin: false, showOrgAdmin: false, canAccessOrgAdmin: false, signOutPending: false, showUpgrade, planLabel: showUpgrade ? "Free" : "Paid plan",
      onOpenUpgrade: () => undefined, onCloseMenu: () => undefined, onOpenSettings: () => undefined, onSignOut: () => undefined,
    }))
    expect(markup).toContain("Switch organization marker")
    expect(markup.indexOf("Switch organization marker")).toBeLessThan(markup.indexOf("Public profile"))
    expect(markup.includes("Upgrade")).toBe(showUpgrade)
    expect(markup.includes("lucide-gift")).toBe(showUpgrade)
    expect(markup).not.toContain("source=sidebar_upgrade")
    expect(markup).toContain(showUpgrade ? "Free" : "Paid plan")
  })

  it("owns the org admin link in the avatar menu instead of stale sidebar menu rows", () => {
    const menuSource = readFileSync(
      join(ROOT, "src/components/nav-user/nav-user-menu-content.tsx"),
      "utf8",
    )
    const navUserSource = readFileSync(
      join(ROOT, "src/components/nav-user.tsx"),
      "utf8",
    )
    const sidebarSource = readFileSync(
      join(ROOT, "src/components/app-sidebar.tsx"),
      "utf8",
    )
    const workspaceSurfaceViewSource = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx",
      ),
      "utf8",
    )
    const accountMenuActionsSource = readFileSync(
      join(
        ROOT,
        "src/components/app-shell/account-menu-actions-context.tsx",
      ),
      "utf8",
    )
    const appShellSource = readFileSync(
      join(
        ROOT,
        "src/components/app-shell/app-shell-inner.tsx",
      ),
      "utf8",
    )

    expect(menuSource).toContain("showOrgAdmin && canAccessOrgAdmin")
    expect(menuSource).toContain('href="/admin"')
    expect(menuSource).toContain("ShieldIcon")
    expect(menuSource).toMatch(/>\s*Admin\s*<\/Link>/)

    expect(menuSource).not.toContain('href="/coaching"')
    expect(menuSource).not.toContain("Book coaching")
    expect(menuSource).not.toContain("Submit feedback")
    expect(menuSource).not.toContain("mailto:joel@coachhousesolutions.org")

    expect(menuSource).toContain(
      "accountMenuActions?: AppShellAccountMenuAction[]"
    )
    expect(menuSource).toContain("accountMenuActions.map((action)")
    expect(menuSource).toContain("const ActionIcon = action.icon")
    expect(menuSource).toContain("action.onSelect()")
    expect(menuSource).toContain("{action.label}")
    expect(menuSource).not.toContain("workspaceTutorialRestartAction")
    expect(menuSource).not.toContain("RotateCcwIcon")

    expect(navUserSource).toContain(
      "useAppShellAccountMenuActions"
    )
    expect(navUserSource).toContain(
      "resolveAppShellAccountMenuActionsForUser"
    )
    expect(navUserSource).toContain(
      "accountMenuActions={accountMenuActions}"
    )
    expect(navUserSource).not.toContain("workspace-tutorial-restart-context")
    expect(navUserSource).not.toContain("showTutorialRestart")
    expect(navUserSource).toContain("showOrgAdmin={showOrgAdmin}")
    expect(navUserSource).toContain("canAccessOrgAdmin={canAccessOrgAdmin}")
    expect(sidebarSource).toContain("showOrgAdmin={showOrgAdmin}")
    expect(sidebarSource).toContain("canAccessOrgAdmin={canAccessOrgAdmin}")

    expect(workspaceSurfaceViewSource).toContain(
      "useRegisterAppShellAccountMenuAction"
    )
    expect(workspaceSurfaceViewSource).toContain(
      "const tutorialRestartAccountMenuAction ="
    )
    expect(workspaceSurfaceViewSource).toContain(
      'id: "workspace-tutorial-restart"'
    )
    expect(workspaceSurfaceViewSource).toContain('label: "Restart guide"')
    expect(workspaceSurfaceViewSource).toContain('visibility: "platform-admin"')
    expect(workspaceSurfaceViewSource).toContain("icon: RotateCcwIcon")
    expect(workspaceSurfaceViewSource).not.toContain(
      "absolute bottom-4 left-4 z-30"
    )
    expect(workspaceSurfaceViewSource).not.toContain(
      "border-border/70 bg-card/92 pointer-events-auto rounded-xl shadow-sm backdrop-blur"
    )
    expect(workspaceSurfaceViewSource).not.toContain(
      "useRegisterAppShellWorkspaceTutorialRestart"
    )

    expect(appShellSource).toContain(
      "AppShellAccountMenuActionsProvider"
    )
    expect(accountMenuActionsSource).toContain(
      "AppShellAccountMenuActionsProvider"
    )
    expect(accountMenuActionsSource).toContain(
      "useRegisterAppShellAccountMenuAction"
    )
    expect(accountMenuActionsSource).toContain(
      "useAppShellAccountMenuActions"
    )
    expect(accountMenuActionsSource).toContain(
      "resolveAppShellAccountMenuActionsForUser"
    )
    expect(accountMenuActionsSource).toContain(
      'action.visibility !== "platform-admin" || isAdmin'
    )
    expect(accountMenuActionsSource).not.toContain("workspace")
  })
})
