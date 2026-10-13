import { useMemo } from "react"
import { resolveOrganizationLaunch } from "../lib"
import type { OrganizationLaunchInput } from "../types"

export function useOrganizationLaunchController(input: OrganizationLaunchInput) {
  return useMemo(() => resolveOrganizationLaunch(input), [input])
}
