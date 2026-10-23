export const COACHING_SLOT_UNAVAILABLE = "COACHING_SLOT_UNAVAILABLE" as const
export const COACHING_SLOT_UNAVAILABLE_MESSAGE = "That slot was just taken. Pick another time."

export function isCoachingSlotUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === COACHING_SLOT_UNAVAILABLE || candidate.code === "23P01" ||
    candidate.message?.startsWith("That slot was just taken") === true
}
