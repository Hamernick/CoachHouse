import type { z } from "zod"
import type { particleWidgetSchema } from "./particle-widget-schema"
import type { Particle, ParticleBatch } from "../types"
import { workspaceNoteContentDiffers } from "./particle-notes"

export type EventWidget = Extract<z.infer<typeof particleWidgetSchema>, { kind: "event" }>
export type EventDraft = { title: string; date: string; time: string; location: string; guests: string }
export const EMPTY_EVENT_DRAFT: EventDraft = { title: "", date: "", time: "", location: "", guests: "" }

/** Explicit local fields, not natural-language interpretation. Reject browser
 * normalization (invalid dates/DST gaps) rather than saving a different time. */
export function eventDraftInput(draft: EventDraft) {
  if (!draft.title.trim()) throw new Error("Give your event a title.")
  if (!draft.date || !draft.time) throw new Error("Choose a date and time to add this event to the calendar.")
  const when = draft.date && draft.time ? `${draft.date}T${draft.time}` : ""
  if (when) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) throw new Error("Choose a valid date and time.")
    const date = new Date(when)
    const local = (value: number) => String(value).padStart(2, "0")
    if (!Number.isFinite(date.getTime()) ||
        `${date.getFullYear()}-${local(date.getMonth() + 1)}-${local(date.getDate())}T${local(date.getHours())}:${local(date.getMinutes())}` !== when)
      throw new Error("This local time is unavailable. Choose another time.")
  }
  const guests = [...new Set(draft.guests.split(",").map(name => name.trim()).filter(Boolean))]
  if (draft.title.trim().length > 240 || draft.location.trim().length > 500 || guests.length > 50 || guests.some(name => name.length > 120))
    throw new Error("Use a shorter title/place and at most 50 names of 120 characters each.")
  return { title: draft.title.trim(), fields: { when, location: draft.location, guests: draft.guests } }
}

export function eventDraftError(draft: EventDraft) {
  try { eventDraftInput(draft); return null }
  catch (error) { return error instanceof Error ? error.message : "Check the event details." }
}

/** Keep unknown creation receipts immutable when a local draft changes. */
export function particleCreationContentDiffers(left: Particle, right: Particle) {
  if (workspaceNoteContentDiffers(left, right)) return true
  if (left.type !== "activity" || right.type !== "activity") return false
  const a = left.data.widget, b = right.data.widget
  if (a?.kind === "form" || b?.kind === "form") {
    if (a?.kind !== "form" || b?.kind !== "form") return true
    return left.title !== right.title || (left.description ?? "") !== (right.description ?? "") ||
      JSON.stringify(a.definition) !== JSON.stringify(b.definition)
  }
  if (a?.kind !== "event" || b?.kind !== "event") return false
  return left.title !== right.title || a.startsAt !== b.startsAt ||
    (a.location ?? "") !== (b.location ?? "") || JSON.stringify(a.attendees ?? []) !== JSON.stringify(b.attendees ?? [])
}

export function particleCreationConflict(prepared: Particle | undefined, existing: Particle | undefined, retry: ParticleBatch | null) {
  if (!prepared) return null
  if (existing && particleCreationContentDiffers(prepared, existing))
    return "This Particle was already added with different content. Your edited draft remains in the library."
  const previous = retry?.operations.find(operation => operation.kind === "put_particle" && operation.particle.id === prepared.id)
  if (previous?.kind === "put_particle" && particleCreationContentDiffers(prepared, previous.particle))
    return "An earlier placement is unconfirmed. Use Retry to confirm it first; your edited draft remains in the library."
  return null
}
