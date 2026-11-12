// Ask the existing mounted editors whether leaving would lose a draft. This
// cancelable probe does not unload the document or display a browser prompt.
// Reusing their beforeunload listeners covers Notes, profile, forms and sharing.
export function hasWorkspaceUnsavedChanges(target: EventTarget): boolean {
  return !target.dispatchEvent(new Event("beforeunload", { cancelable: true }))
}

export function isCurrentWorkspace(href: string, currentHref: string): boolean {
  const current = new URL(currentHref)
  const next = new URL(href, current)
  return current.pathname === next.pathname &&
    current.searchParams.get("workspace") === next.searchParams.get("workspace")
}

/** Retain the explicitly enabled canvas-chat preview across workspace switches. */
export function preserveCanvasChatNavigation(href: string, currentHref: string): string {
  const current = new URL(currentHref)
  const next = new URL(href, current)
  if (next.origin !== current.origin || next.pathname !== "/workspace" ||
    current.searchParams.get("canvasChat") !== "1" || next.searchParams.has("canvasChat")) return href
  next.searchParams.set("canvasChat", "1")
  return `${next.pathname}${next.search}${next.hash}`
}
