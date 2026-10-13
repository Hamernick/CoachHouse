import type { OrganizationLaunchInput } from "../types"

export type LaunchGlobeLocation = { latitude: number; longitude: number }

export function resolveLaunchGlobeLocation(input: Pick<OrganizationLaunchInput, "latitude" | "longitude" | "locationType">): LaunchGlobeLocation | null {
  const { latitude, longitude } = input
  if (input.locationType === "online" || typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
