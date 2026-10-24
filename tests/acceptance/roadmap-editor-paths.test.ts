import { afterEach, describe, expect, it, vi } from "vitest"
import { listenForWorkspaceAcceleratorDrawerRequests, requestWorkspaceAcceleratorDrawer, listenForWorkspaceRoadmapDrawerRequests, requestWorkspaceRoadmapDrawer } from "@/lib/workspace/data-drawer-events"
import { getDocumentEditorHref, getOrganizationLaunchReturnHref, resolveEditorReturnDestination, withEditorReturnTo } from "@/lib/workspace/editor-navigation"

import { resolveRoadmapBasePath } from "@/components/roadmap/roadmap-editor/paths"

describe("resolveRoadmapBasePath", () => {
  it("uses the workspace roadmap as the canonical default", () => {
    expect(resolveRoadmapBasePath(undefined)).toBe("/workspace/roadmap")
    expect(resolveRoadmapBasePath(null)).toBe("/workspace/roadmap")
  })

  it("normalizes legacy roadmap routes to the workspace roadmap base", () => {
    expect(resolveRoadmapBasePath("/roadmap/origin-story")).toBe(
      "/workspace/roadmap",
    )
    expect(resolveRoadmapBasePath("/accelerator/roadmap/origin-story")).toBe(
      "/workspace/roadmap",
    )
    expect(resolveRoadmapBasePath("/my-organization/roadmap")).toBe(
      "/workspace/roadmap",
    )
  })

  it("keeps the workspace roadmap path stable", () => {
    expect(resolveRoadmapBasePath("/workspace/roadmap")).toBe(
      "/workspace/roadmap",
    )
    expect(resolveRoadmapBasePath("/workspace/roadmap/origin-story")).toBe(
      "/workspace/roadmap",
    )
  })
})


describe("editor return links", () => {
  it("preserves the write action and Documents destination without a legacy redirect", () => {
    const href = new URL(getDocumentEditorHref("origin-story", true), "https://workspace.local")
    expect(href.pathname).toBe("/workspace/roadmap/origin-story")
    expect(href.searchParams.get("write")).toBe("1")
    expect(resolveEditorReturnDestination(href.searchParams.get("returnTo"))).toEqual({ href: "/workspace?drawer=documents", label: "Documents" })
  })

  it("returns to the exact Accelerator lesson and step", () => {
    const parent = "/workspace?drawer=accelerator&module=m-1&step=m-1%3Aassignment&group=formation"
    const href = new URL(withEditorReturnTo("/workspace?drawer=roadmap&section=mission", parent), "https://workspace.local")
    expect(href.searchParams.get("section")).toBe("mission")
    expect(resolveEditorReturnDestination(href.searchParams.get("returnTo"))).toEqual({ href: parent, label: "Accelerator" })
  })

  it("falls back to Documents for external, invalid or unrelated return destinations", () => {
    for (const value of [undefined, "https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)", "/admin", "/workspace?drawer=roadmap"]) {
      expect(resolveEditorReturnDestination(value)).toEqual({ href: "/workspace?drawer=documents", label: "Documents" })
    }
  })
})


describe("roadmap drawer navigation", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("opens the Accelerator window without changing pages and preserves the current canvas", () => {
    const browser = Object.assign(new EventTarget(), {
      location: { href: "https://workspace.local/workspace?canvas=board&drawer=documents&step=old&guide=1" },
      history: { pushState: vi.fn() },
    })
    vi.stubGlobal("window", browser)
    const opened = vi.fn(() => true)
    const dispose = listenForWorkspaceAcceleratorDrawerRequests(opened)
    expect(requestWorkspaceAcceleratorDrawer("module-1")).toBe(true)
    expect(opened).toHaveBeenCalledWith("module-1")
    expect(browser.history.pushState).toHaveBeenCalledWith(null, "", "/workspace?canvas=board&drawer=accelerator&module=module-1")
    dispose()
    browser.history.pushState.mockClear()
    expect(requestWorkspaceAcceleratorDrawer("module-1")).toBe(false)
    expect(browser.history.pushState).not.toHaveBeenCalled()
  })

  it("leaves Notes open when the workspace cannot resolve the associated lesson", () => {
    const browser = Object.assign(new EventTarget(), { history: { pushState: vi.fn() } })
    vi.stubGlobal("window", browser)
    const dispose = listenForWorkspaceAcceleratorDrawerRequests(() => false)
    expect(requestWorkspaceAcceleratorDrawer("missing-module")).toBe(false)
    expect(browser.history.pushState).not.toHaveBeenCalled()
    dispose()
  })

  it("records a copyable section URL and a concrete Accelerator return destination", () => {
    const browser = Object.assign(new EventTarget(), {
      location: { href: "https://workspace.local/workspace" },
      history: { pushState: vi.fn(), replaceState: vi.fn() },
    })
    vi.stubGlobal("window", browser)
    const opened = vi.fn()
    const dispose = listenForWorkspaceRoadmapDrawerRequests(opened)
    const parent = "/workspace?drawer=accelerator&module=m-1&step=m-1%3Aassignment"
    expect(requestWorkspaceRoadmapDrawer("mission", parent)).toBe(true)
    expect(opened).toHaveBeenCalledWith({ tab: "roadmap", roadmapSectionSlug: "mission" })
    expect(browser.history.replaceState).toHaveBeenCalledWith(null, "", parent)
    const href = browser.history.pushState.mock.calls[0][2]
    const url = new URL(href, "https://workspace.local")
    expect(url.searchParams.get("section")).toBe("mission")
    expect(url.searchParams.get("returnTo")).toBe(parent)
    dispose()
  })

  it("does not mutate history when no workspace drawer handles the request", () => {
    const browser = Object.assign(new EventTarget(), {
      location: { href: "https://workspace.local/workspace" },
      history: { pushState: vi.fn(), replaceState: vi.fn() },
    })
    vi.stubGlobal("window", browser)
    expect(requestWorkspaceRoadmapDrawer("mission")).toBe(false)
    expect(browser.history.pushState).not.toHaveBeenCalled()
  })
})


it("returns to the checklist only for an explicit launch flow with a safe Accelerator destination", () => {
  const returnTo = "/workspace?drawer=accelerator&focus=organization-launch&group=formation"
  expect(getOrganizationLaunchReturnHref(new URLSearchParams({ from: "organization-launch", returnTo }).toString())).toBe(returnTo)
  expect(getOrganizationLaunchReturnHref(new URLSearchParams({ returnTo }).toString())).toBeNull()
  expect(getOrganizationLaunchReturnHref("from=organization-launch&returnTo=https://example.com")).toBeNull()
  expect(getOrganizationLaunchReturnHref("from=organization-launch&returnTo=/admin")).toBeNull()
})
