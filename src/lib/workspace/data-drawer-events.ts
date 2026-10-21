import { withEditorReturnTo } from "./editor-navigation"
import { getWorkspaceDrawerPath, getWorkspaceRoadmapDrawerPath } from "./routes"

const WORKSPACE_ACCELERATOR_DRAWER_REQUEST_EVENT = "coach-house:workspace-accelerator-drawer-request"

export function requestWorkspaceAcceleratorDrawer(moduleId: string): boolean {
  if (typeof window === "undefined" || !moduleId.trim()) return false
  const event = new CustomEvent(WORKSPACE_ACCELERATOR_DRAWER_REQUEST_EVENT, {
    cancelable: true, detail: { moduleId: moduleId.trim() },
  })
  window.dispatchEvent(event)
  if (event.defaultPrevented) {
    const destination = new URL(window.location.href)
    destination.searchParams.set("drawer", "accelerator")
    destination.searchParams.set("module", moduleId.trim())
    for (const key of ["step", "group", "guide", "focus"]) destination.searchParams.delete(key)
    window.history.pushState(null, "", `${destination.pathname}${destination.search}`)
  }
  return event.defaultPrevented
}

export function listenForWorkspaceAcceleratorDrawerRequests(listener: (moduleId: string) => boolean) {
  if (typeof window === "undefined") return () => {}
  const handleRequest: EventListener = (event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail?.moduleId !== "string" || !event.detail.moduleId.trim()) return
    if (listener(event.detail.moduleId.trim())) event.preventDefault()
  }
  window.addEventListener(WORKSPACE_ACCELERATOR_DRAWER_REQUEST_EVENT, handleRequest)
  return () => window.removeEventListener(WORKSPACE_ACCELERATOR_DRAWER_REQUEST_EVENT, handleRequest)
}

export type WorkspaceRoadmapDrawerRequest = {
  tab: "roadmap"
  roadmapSectionSlug: string
}

const WORKSPACE_ROADMAP_DRAWER_REQUEST_EVENT =
  "coach-house:workspace-roadmap-drawer-request"

function isWorkspaceRoadmapDrawerRequest(
  value: unknown
): value is WorkspaceRoadmapDrawerRequest {
  if (!value || typeof value !== "object") return false

  const request = value as Partial<WorkspaceRoadmapDrawerRequest>
  return (
    request.tab === "roadmap" &&
    typeof request.roadmapSectionSlug === "string" &&
    request.roadmapSectionSlug.trim().length > 0
  )
}

export function requestWorkspaceRoadmapDrawer(slug: string, returnTo?: string): boolean {
  const roadmapSectionSlug = slug.trim()
  if (typeof window === "undefined" || !roadmapSectionSlug) return false

  const event = new CustomEvent<WorkspaceRoadmapDrawerRequest>(
    WORKSPACE_ROADMAP_DRAWER_REQUEST_EVENT,
    {
      cancelable: true,
      detail: {
        tab: "roadmap",
        roadmapSectionSlug,
      },
    }
  )
  window.dispatchEvent(event)
  if (event.defaultPrevented) {
    const current = new URL(window.location.href)
    const parent = returnTo || current.searchParams.get("returnTo") ||
      (current.pathname === "/workspace" && !current.searchParams.has("drawer")
        ? getWorkspaceDrawerPath({ tab: "accelerator" })
        : `${current.pathname}${current.search}`)
    const href = withEditorReturnTo(getWorkspaceRoadmapDrawerPath(roadmapSectionSlug), parent)
    if (`${current.pathname}${current.search}` !== href) {
      // Give Back a concrete drawer destination when the canvas had no URL state.
      if (current.pathname === "/workspace" && !current.searchParams.has("drawer")) {
        window.history.replaceState(null, "", new URL(href, current).searchParams.get("returnTo"))
      }
      window.history.pushState(null, "", href)
    }
  }
  return event.defaultPrevented
}

export function listenForWorkspaceRoadmapDrawerRequests(
  listener: (request: WorkspaceRoadmapDrawerRequest) => void
) {
  if (typeof window === "undefined") return () => {}

  const handleRequest: EventListener = (event) => {
    if (
      !(event instanceof CustomEvent) ||
      !isWorkspaceRoadmapDrawerRequest(event.detail)
    ) {
      return
    }

    listener(event.detail)
    event.preventDefault()
  }

  window.addEventListener(WORKSPACE_ROADMAP_DRAWER_REQUEST_EVENT, handleRequest)
  return () =>
    window.removeEventListener(
      WORKSPACE_ROADMAP_DRAWER_REQUEST_EVENT,
      handleRequest
    )
}
