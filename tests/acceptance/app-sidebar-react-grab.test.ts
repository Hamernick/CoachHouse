import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import MessageCircleIcon from "lucide-react/dist/esm/icons/message-circle"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SidebarBody } from "@/components/app-sidebar"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { SidebarProvider } from "@/components/ui/sidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/tasks",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("app sidebar react grab", () => {
  it("tags main nav items with semantic ownership metadata and sidebar class assembly", () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })

    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(NavMain, {
          items: [{ title: "Tasks", href: "/tasks", icon: ClipboardListIcon }],
        })
      )
    )

    expect(markup).toContain('data-react-grab-anchor="AppSidebarMainNavItem"')
    expect(markup).toContain(
      'data-react-grab-owner-id="app-sidebar:main:tasks"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-source="src/components/nav-main.tsx"'
    )
    expect(markup).toContain(
      'data-react-grab-canonical-owner-source="src/components/nav-main.tsx"'
    )

    expect(window.__REACT_GRAB_SURFACES__?.["app-sidebar:main:tasks"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: "AppSidebarMainNavItem",
          slot: "sidebar-menu-button-trigger",
          source: "src/components/nav-main.tsx",
          surfaceKind: "trigger",
          classAssemblyFile: "src/components/ui/sidebar/layout.tsx",
          primitiveImport: "@/components/ui/sidebar",
        }),
      ])
    )
  })

  it("tags resource nav items with semantic ownership metadata and sidebar class assembly", () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })

    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(NavDocuments, {
          items: [
            {
              name: "Community",
              url: "/community",
              icon: MessageCircleIcon,
            },
          ],
        })
      )
    )

    expect(markup).toContain(
      'data-react-grab-anchor="AppSidebarResourceNavItem"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-id="app-sidebar:resources:community"'
    )
    expect(markup).toContain(
      'data-react-grab-owner-source="src/components/nav-documents.tsx"'
    )

    expect(
      window.__REACT_GRAB_SURFACES__?.["app-sidebar:resources:community"]
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: "AppSidebarResourceNavItem",
          slot: "sidebar-menu-button-trigger",
          source: "src/components/nav-documents.tsx",
          surfaceKind: "trigger",
          classAssemblyFile: "src/components/ui/sidebar/layout.tsx",
          primitiveImport: "@/components/ui/sidebar",
        }),
      ])
    )
  })

  it("renders active admin destinations inside the Admin accordion", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(NavMain, {
          items: [
            { title: "Find", href: "/" },
            {
              title: "Admin",
              children: [
                { title: "Organizations", href: "/organizations" },
                { title: "Tasks", href: "/tasks", icon: ClipboardListIcon },
              ],
            },
          ],
        })
      )
    )

    expect(markup.indexOf(">Find<")).toBeLessThan(markup.indexOf(">Admin<"))
    expect(markup).toContain('aria-label="Collapse Admin"')
    expect(markup).toContain('href="/tasks"')
    expect(markup).toContain(
      'data-react-grab-owner-id="app-sidebar:main:tasks"'
    )
  })

  it("does not render the onboarding-locked Welcome nav item", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(SidebarBody, {
          isAdmin: false,
          isTester: false,
          user: {
            name: "Coach House User",
            title: null,
            email: null,
            avatar: null,
          },
          onboardingLocked: true,
          onboardingIntentFocus: "build",
        })
      )
    )

    expect(markup).not.toContain(">Welcome<")
    expect(markup).not.toContain("/onboarding?source=onboarding")
    expect(markup).not.toContain("app-sidebar:onboarding:welcome")
  })

  it("renders an upgrade CTA above resources for signed-in free users", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(SidebarBody, {
          isAdmin: false,
          isTester: false,
          user: {
            name: "Free User",
            title: null,
            email: "free@example.test",
            avatar: null,
          },
          hasActiveSubscription: false,
          showMemberWorkspace: false,
        })
      )
    )

    const upgradeIndex = markup.indexOf("Upgrade account")
    const resourcesIndex = markup.indexOf(">Resources<")

    expect(upgradeIndex).toBeGreaterThan(-1)
    expect(resourcesIndex).toBeGreaterThan(-1)
    expect(upgradeIndex).toBeLessThan(resourcesIndex)
    expect(markup).toContain(
      "/?paywall=organization&amp;plan=organization&amp;source=sidebar_upgrade&amp;redirect=%2Fworkspace&amp;cancel=%2F&amp;paywall_preview=1"
    )
  })

  it("does not render the free upgrade CTA for paid workspace users", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(SidebarBody, {
          isAdmin: false,
          isTester: false,
          user: {
            name: "Paid User",
            title: null,
            email: "paid@example.test",
            avatar: null,
          },
          hasActiveSubscription: true,
          showMemberWorkspace: true,
        })
      )
    )

    expect(markup).not.toContain("Upgrade account")
    expect(markup).not.toContain("source=sidebar_upgrade")
  })

  it("renders the upgrade CTA for platform admins so they can test checkout placement", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(SidebarBody, {
          isAdmin: true,
          isTester: false,
          user: {
            name: "Platform Admin",
            title: null,
            email: "admin@example.test",
            avatar: null,
          },
          hasActiveSubscription: true,
          showMemberWorkspace: true,
        })
      )
    )

    expect(markup).toContain("Upgrade account")
    expect(markup).toContain("source=sidebar_upgrade")
  })
})
