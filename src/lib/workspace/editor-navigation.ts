import { getWorkspaceDrawerPath, getWorkspaceRoadmapSectionPath } from "./routes"

export function resolveEditorReturnDestination(value?: string | null) {
  const fallback = { href: getWorkspaceDrawerPath({ tab: "documents" }), label: "Documents" }
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback
  try {
    const url = new URL(value, "https://workspace.local")
    if (url.origin !== "https://workspace.local") return fallback
    const drawer = url.searchParams.get("drawer")
    const accelerator = url.pathname === "/workspace/accelerator" ||
      (url.pathname === "/workspace" && drawer === "accelerator")
    const documents = url.pathname === "/organization/documents" ||
      url.pathname === "/workspace/documents" ||
      (url.pathname === "/workspace" && drawer === "documents")
    const setup = url.pathname === "/workspace" && url.searchParams.get("guide") === "1"
    const preview = url.pathname === "/workspace/profile-preview"
    if (!accelerator && !documents && !setup && !preview) return fallback
    return { href: `${url.pathname}${url.search}`, label: setup ? "Setup" : preview ? "Public preview" : accelerator ? "Accelerator" : "Documents" }
  } catch {
    return fallback
  }
}

export function getDocumentEditorHref(slug: string, write = false) {
  const params = new URLSearchParams({ returnTo: getWorkspaceDrawerPath({ tab: "documents" }) })
  if (write) params.set("write", "1")
  return `${getWorkspaceRoadmapSectionPath(slug)}?${params}`
}

export function withEditorReturnTo(href: string, returnTo: string) {
  const url = new URL(href, "https://workspace.local")
  url.searchParams.set("returnTo", resolveEditorReturnDestination(returnTo).href)
  return `${url.pathname}${url.search}`
}

export function getOrganizationLaunchReturnHref(search: string) {
  const params = new URLSearchParams(search)
  if (!["organization-launch", "workspace-guide"].includes(params.get("from") ?? "")) return null
  const destination = resolveEditorReturnDestination(params.get("returnTo"))
  return ["Accelerator", "Setup", "Public preview"].includes(destination.label) ? destination.href : null
}
