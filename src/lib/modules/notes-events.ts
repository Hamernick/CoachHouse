export const NOTES_CHANGED_EVENT = "coach-house:notes-changed"

export function notifyNotesChanged(moduleId?: string, origin?: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(NOTES_CHANGED_EVENT, { detail: { moduleId, origin } })
    )
}
