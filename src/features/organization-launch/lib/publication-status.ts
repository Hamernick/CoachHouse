export type PublicationLocationInput = {
  isPublic: boolean
  online: boolean
  hasAddress: boolean
  latitude: number | null
  longitude: number | null
}

// Coordinates describe saved placement, never an indexing job or a verified service.
export function resolvePublicationLocation(input: PublicationLocationInput) {
  if (input.online) return { label: "Online organization", detail: "Your profile does not need a physical map pin." }
  if (!input.hasAddress) return { label: "No public location", detail: "You can publish your profile without adding an address." }
  const located = typeof input.latitude === "number" && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90 &&
    typeof input.longitude === "number" && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180
  if (!located) return { label: "Location not resolved", detail: "Your address has no map coordinates yet. Check it in your profile; publishing is still available." }
  return input.isPublic
    ? { label: "Public map location", detail: "Your saved public location is available to the map. Search and map results may take a moment to refresh." }
    : { label: "Location ready", detail: "This location will be shared when you publish your profile." }
}
