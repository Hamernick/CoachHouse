import { COACHING_JOINT_COACH_LABEL } from "./index"

/** The booking owner's saved name, never an organization or guessed email name. */
export function normalizeCoachingClientName(value: string | null | undefined) {
  const name = value?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  return name || null
}

export function buildCoachingCalendarTitle(clientName?: string | null) {
  return `${normalizeCoachingClientName(clientName) ?? "Client"} — Coach House meeting with ${COACHING_JOINT_COACH_LABEL}`
}
