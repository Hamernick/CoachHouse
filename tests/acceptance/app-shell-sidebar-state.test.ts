import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  APP_SIDEBAR_DEFAULT_OPEN,
  APP_SIDEBAR_STATE_COOKIE,
  parseAppSidebarStateCookie,
  resolveAppSidebarDefaultOpen,
} from "@/components/app-shell/sidebar-state"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("app shell sidebar state", () => {
  it("defaults to expanded while respecting a saved collapsed preference", () => {
    expect(APP_SIDEBAR_DEFAULT_OPEN).toBe(true)
    expect(APP_SIDEBAR_STATE_COOKIE).toBe("sidebar_state")

    expect(parseAppSidebarStateCookie("true")).toBe(true)
    expect(parseAppSidebarStateCookie("false")).toBe(false)
    expect(parseAppSidebarStateCookie("TRUE")).toBeNull()
    expect(parseAppSidebarStateCookie("")).toBeNull()
    expect(parseAppSidebarStateCookie(undefined)).toBeNull()

    expect(resolveAppSidebarDefaultOpen("true")).toBe(true)
    expect(resolveAppSidebarDefaultOpen("false")).toBe(false)
    expect(resolveAppSidebarDefaultOpen(undefined)).toBe(true)
    expect(resolveAppSidebarDefaultOpen("invalid")).toBe(true)
  })

  it("reads the saved sidebar preference on every app shell route layout", () => {
    const layoutPaths = [
      "src/app/(dashboard)/layout.tsx",
      "src/app/(admin)/layout.tsx",
      "src/app/(internal)/layout.tsx",
    ]

    for (const layoutPath of layoutPaths) {
      const source = readSource(layoutPath)

      expect(source).toContain("readAppSidebarDefaultOpen")
      expect(source).toContain("defaultSidebarOpen")
      expect(source).toContain("defaultSidebarOpen={defaultSidebarOpen}")
    }
  })

  it("keeps the cookie read server-only and outside the client shell", () => {
    const serverSource = readSource(
      "src/components/app-shell/sidebar-state-server.ts"
    )
    const shellSource = readSource(
      "src/components/app-shell/app-shell-inner.tsx"
    )

    expect(serverSource).toContain('import "server-only"')
    expect(serverSource).toContain('from "next/headers"')
    expect(serverSource).toContain("await cookies()")
    expect(shellSource).not.toContain('from "next/headers"')
  })

  it("passes the resolved desktop default to the sidebar provider without accelerator auto-collapse", () => {
    const shellSource = readSource(
      "src/components/app-shell/app-shell-inner.tsx"
    )
    const propsSource = readSource("src/components/app-shell/types.ts")

    expect(propsSource).toContain("defaultSidebarOpen?: boolean")
    expect(shellSource).toContain("defaultSidebarOpen = true")
    expect(shellSource).toContain("defaultOpen={defaultSidebarOpen}")
    expect(shellSource).not.toContain("defaultOpen={!isAcceleratorContext}")
    expect(shellSource).not.toContain("SidebarAutoCollapse")
  })

  it("keeps the sidebar cookie shared while mobile open state starts closed", () => {
    const constantsSource = readSource("src/components/ui/sidebar/constants.ts")
    const contextSource = readSource("src/components/ui/sidebar/context.tsx")

    expect(constantsSource).toContain(
      'export const SIDEBAR_COOKIE_NAME = "sidebar_state"'
    )
    expect(constantsSource).not.toContain('"use client"')
    expect(contextSource).toContain(
      "const [openMobile, setOpenMobile] = React.useState(false)"
    )
    expect(contextSource).toContain(
      "document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`"
    )
  })

  it("keeps coaching available as a mini item when the desktop sidebar collapses", () => {
    const sidebarSource = readSource("src/components/app-sidebar.tsx")
    const coachingItemSource = readSource(
      "src/components/coaching/coach-scheduling-sidebar-item.tsx"
    )

    expect(sidebarSource).toContain("<CoachSchedulingCard />")
    expect(sidebarSource).toContain("<CoachSchedulingSidebarItem />")
    expect(sidebarSource).toContain(
      "[@media(min-height:56rem)]:hidden group-data-[collapsible=icon]:!block"
    )
    expect(coachingItemSource).toContain("SidebarMenuButton")
    expect(coachingItemSource).toContain('tooltip={buildAppSidebarTooltipProps({')
  })
})
