import { useMemo } from "react"
import type { CoachHouseCompanionInput } from "../types"

export function useCoachHouseCompanionController(input: CoachHouseCompanionInput) {
  return useMemo(() => ({ input }), [input])
}
