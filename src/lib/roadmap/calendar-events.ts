export const WORKSPACE_CALENDAR_CHANGED = "coach-house:workspace-calendar-changed"

export function notifyWorkspaceCalendarChanged(orgId: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(WORKSPACE_CALENDAR_CHANGED, { detail: { orgId } }))
}
