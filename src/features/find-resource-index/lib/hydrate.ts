import type { FindResourceIndexItem } from "../types"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

export function hydrateFindResourceIndexItem(
  item: FindResourceIndexItem
): ExternalResourceMapItem {
  const address = [item.addressStreet, item.city, item.state, item.country]
    .filter(Boolean)
    .join(", ")

  return {
    ...item,
    description: null,
    address: address || null,
    addressStreet: item.addressStreet ?? null,
    orgCategory: null,
    sourceLabel: null,
    sourceUrl: null,
    lastVerifiedAt: null,
    availability: item.availability
      ? {
          ...item.availability,
          nextOpenAt: null,
          nextCloseAt: null,
          timezone: null,
          label: null,
          notes: null,
          appointmentRequired: false,
          sourceStatus: null,
          temporaryClosedUntil: null,
        }
      : undefined,
  }
}

