/** Personal inspection state, not source permissions or persisted plan state. */
export type ParticleSelectionOptions = {
  restoreFocus?: boolean
  preserveSelection?: boolean
  calendarEntryId?: string
  view?: "details" | "share" | "preview"
  shareParticleIds?: readonly string[]
}
