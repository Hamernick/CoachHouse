import React from "react"
import { renderToStaticMarkup, renderToReadableStream } from "react-dom/server"
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
  it("opens grouped navigation as a menu button when the desktop rail is collapsed", async () => {
    const stream = await renderToReadableStream(
      React.createElement(
        SidebarProvider,
        { defaultOpen: false },
        React.createElement(NavMain, {
          items: [{
            title: "Admin Dashboard",
            href: "/admin/dashboard",
            icon: ClipboardListIcon,
            children: [{ title: "Tasks", href: "/tasks" }],
          }],
        })
      )
    )
    await stream.allReady
    const markup = await new Response(stream).text()

    expect(markup).toContain('aria-label="Admin Dashboard menu"')
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('data-active="true"')
    expect(markup).toContain('data-react-grab-owner-id="app-sidebar:main:admin-dashboard"')
    expect(markup).not.toContain('href="/admin/dashboard"')
    expect(markup).not.toContain('aria-label="Collapse Admin Dashboard"')
  })

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

  it("renders active admin destinations inside the Admin accordion", async () => {
    const stream = await renderToReadableStream(
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

    await stream.allReady
    const markup = await new Response(stream).text()

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

  it("shows the gift upgrade button above the profile for free users", () => {
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

    expect(markup).toContain(">Resources<")
    expect(markup).toContain('aria-label="Upgrade"')
    expect(markup).toContain("lucide-gift")
    expect(markup.indexOf('aria-label="Upgrade"')).toBeLessThan(markup.indexOf('data-tour="account-menu"'))
    expect(markup).not.toContain("source=sidebar_upgrade")

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

    expect(markup).not.toContain('aria-label="Upgrade"')
    expect(markup).not.toContain("source=sidebar_upgrade")
  })

  it("hides the free upgrade button for paid admins", () => {
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

    expect(markup).not.toContain('aria-label="Upgrade"')
    expect(markup).not.toContain("source=sidebar_upgrade")
  })
})
