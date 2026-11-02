export const WORKSPACE_CALENDAR_CHANGED = "coach-house:workspace-calendar-changed"

export function notifyWorkspaceCalendarChanged(orgId: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(WORKSPACE_CALENDAR_CHANGED, { detail: { orgId } }))
}

export const WORKSPACE_CALENDAR_OPEN = "coach-house:workspace-calendar-open"
export function openWorkspaceCalendar(at: number) {
  if (typeof window !== "undefined" && Number.isFinite(at))
    window.dispatchEvent(new CustomEvent(WORKSPACE_CALENDAR_OPEN, { detail: { at }, cancelable: true }))
}
