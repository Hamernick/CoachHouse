"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ProfileTab } from "@/components/organization/org-profile-card/types"
import {
  normalizeWorkspaceDrawerTab,
  WORKSPACE_ACCELERATOR_PATH,
  WORKSPACE_PATH,
  WORKSPACE_ROADMAP_PATH,
  type WorkspaceDrawerTab,
} from "@/lib/workspace/routes"

export type WorkspaceCanvasDrawerTab = WorkspaceDrawerTab

export type WorkspaceDataDrawerRequest = {
  id: number
  tab: WorkspaceCanvasDrawerTab
  focusKey?: string | null
  organizationTab?: ProfileTab | null
  organizationProgramId?: string | null
  organizationProgramStep?: number | null
  organizationFocus?: string | null
  organizationEditMode?: boolean
  acceleratorStepId?: string | null
  acceleratorModuleId?: string | null
  acceleratorLessonGroupKey?: string | null
  roadmapSectionSlug?: string | null
}

const WORKSPACE_ORGANIZATION_DRAWER_PATHS = new Set([
  WORKSPACE_PATH,
  "/organization",
])

function decodeWorkspacePathSegment(value: string) {
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.trim()
  }
}

function isWorkspaceOrganizationProfileTab(
  value: string | null
): value is ProfileTab {
  return (
    value === "company" ||
    value === "programs" ||
    value === "people" ||
    value === "supporters"
  )
}

export function resolveWorkspaceOrganizationDrawerRequest(
  href: string
): Omit<WorkspaceDataDrawerRequest, "id"> | null {
  let destination: URL
  try {
    destination = new URL(href, "https://workspace.local")
  } catch {
    return null
  }

  if (!WORKSPACE_ORGANIZATION_DRAWER_PATHS.has(destination.pathname)) {
    return null
  }

  const requestedTab = destination.searchParams.get("tab")
  const organizationTab = isWorkspaceOrganizationProfileTab(requestedTab)
    ? requestedTab
    : null
  const organizationProgramId = destination.searchParams.get("programId")
  const organizationFocus = destination.searchParams.get("focus")
  const requestedDrawerTab = normalizeWorkspaceDrawerTab(
    destination.searchParams.get("drawer")
  )
  if (requestedDrawerTab && requestedDrawerTab !== "organization") return null
  const editorRequested =
    requestedDrawerTab === "organization" ||
    destination.searchParams.get("view") === "editor" ||
    organizationTab !== null ||
    organizationProgramId !== null

  if (!editorRequested) return null

  return {
    tab: "organization",
    organizationTab:
      organizationTab ?? (organizationProgramId ? "programs" : "company"),
    organizationProgramId,
    organizationFocus,
    organizationEditMode: destination.searchParams.get("view") === "editor",
  }
}

export function resolveWorkspaceAcceleratorDrawerRequest(
  href: string
): Omit<WorkspaceDataDrawerRequest, "id"> | null {
  let destination: URL
  try {
    destination = new URL(href, "https://workspace.local")
  } catch {
    return null
  }

  const acceleratorRequested =
    destination.pathname === WORKSPACE_ACCELERATOR_PATH ||
    (destination.pathname === WORKSPACE_PATH &&
      normalizeWorkspaceDrawerTab(destination.searchParams.get("drawer")) ===
        "accelerator")
  if (!acceleratorRequested) return null

  return {
    tab: "accelerator",
    acceleratorStepId: destination.searchParams.get("step"),
    acceleratorModuleId: destination.searchParams.get("module"),
    acceleratorLessonGroupKey: destination.searchParams.get("group"),
  }
}

export function resolveWorkspaceRoadmapDrawerRequest(
  href: string
): Omit<WorkspaceDataDrawerRequest, "id"> | null {
  let destination: URL
  try {
    destination = new URL(href, "https://workspace.local")
  } catch {
    return null
  }

  const directSectionSlug = destination.pathname.startsWith(
    "/workspace/roadmap/"
  )
    ? decodeWorkspacePathSegment(
        destination.pathname.slice("/workspace/roadmap/".length)
      )
    : null
  const roadmapDrawerRequested =
    destination.pathname === WORKSPACE_PATH &&
    normalizeWorkspaceDrawerTab(destination.searchParams.get("drawer")) ===
      "roadmap"
  const drawerSectionSlug = roadmapDrawerRequested
    ? destination.searchParams.get("section")?.trim() || null
    : null
  const roadmapRequested =
    destination.pathname === WORKSPACE_ROADMAP_PATH ||
    directSectionSlug !== null ||
    roadmapDrawerRequested

  if (!roadmapRequested) return null

  return {
    tab: "roadmap",
    roadmapSectionSlug: directSectionSlug || drawerSectionSlug,
  }
}

export function resolveWorkspaceDataDrawerRequest(
  href: string
): Omit<WorkspaceDataDrawerRequest, "id"> | null {
  const detailedRequest =
    resolveWorkspaceOrganizationDrawerRequest(href) ??
    resolveWorkspaceAcceleratorDrawerRequest(href) ??
    resolveWorkspaceRoadmapDrawerRequest(href)
  if (detailedRequest) return detailedRequest

  let destination: URL
  try {
    destination = new URL(href, "https://workspace.local")
  } catch {
    return null
  }
  if (destination.pathname !== WORKSPACE_PATH) return null

  const tab = normalizeWorkspaceDrawerTab(
    destination.searchParams.get("drawer")
  )
  if (
    tab === "people" ||
    tab === "finance" ||
    tab === "tools" ||
    tab === "particles"
  )
    return { tab }
  if (tab === "documents") {
    return {
      tab,
      focusKey: destination.searchParams.get("focus"),
    }
  }
  return null
}

export type WorkspaceDataDrawerTabIndicator = {
  left: number
  width: number
  visible: boolean
}

const WORKSPACE_DATA_DRAWER_EMPTY_TAB_INDICATOR: WorkspaceDataDrawerTabIndicator =
  {
    left: 0,
    width: 0,
    visible: false,
  }

export function useWorkspaceDataDrawerTabIndicator({
  tab,
}: {
  tab: WorkspaceCanvasDrawerTab
}) {
  const tabsHeaderRef = useRef<HTMLDivElement | null>(null)
  const tabsListRef = useRef<HTMLDivElement | null>(null)
  const [tabIndicator, setTabIndicator] =
    useState<WorkspaceDataDrawerTabIndicator>(
      WORKSPACE_DATA_DRAWER_EMPTY_TAB_INDICATOR
    )

  const updateTabIndicator = useCallback(() => {
    const tabsHeader = tabsHeaderRef.current
    const activeTabTrigger =
      tabsListRef.current?.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]'
      ) ?? null

    if (!tabsHeader || !activeTabTrigger) {
      setTabIndicator(WORKSPACE_DATA_DRAWER_EMPTY_TAB_INDICATOR)
      return
    }

    const headerRect = tabsHeader.getBoundingClientRect()
    const activeTriggerRect = activeTabTrigger.getBoundingClientRect()
    const nextIndicator = {
      left: activeTriggerRect.left - headerRect.left,
      width: activeTriggerRect.width,
      visible: true,
    }

    setTabIndicator((current) => {
      const leftChanged = Math.abs(current.left - nextIndicator.left) > 0.5
      const widthChanged = Math.abs(current.width - nextIndicator.width) > 0.5

      if (
        current.visible === nextIndicator.visible &&
        !leftChanged &&
        !widthChanged
      ) {
        return current
      }

      return nextIndicator
    })
  }, [])

  useEffect(() => {
    updateTabIndicator()

    const animationFrame = window.requestAnimationFrame(updateTabIndicator)
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateTabIndicator)

    if (tabsHeaderRef.current) resizeObserver?.observe(tabsHeaderRef.current)
    if (tabsListRef.current) resizeObserver?.observe(tabsListRef.current)

    window.addEventListener("resize", updateTabIndicator)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateTabIndicator)
    }
  }, [tab, updateTabIndicator])

  return {
    tabIndicator,
    tabsHeaderRef,
    tabsListRef,
  }
}
