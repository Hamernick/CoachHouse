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
