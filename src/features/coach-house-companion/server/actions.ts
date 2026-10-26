"use server"

import { normalizeCoachHouseCompanionInput } from "../lib"
import type { CoachHouseCompanionInput } from "../types"

export async function saveCoachHouseCompanion(input: CoachHouseCompanionInput) {
  const normalized = normalizeCoachHouseCompanionInput(input)
  // Persist with DB layer here.
  return normalized
}
