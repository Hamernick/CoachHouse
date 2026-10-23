import { resourceStreetKey } from "./resource-street-key"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { formatFullOrganizationLocation } from "@/lib/location/organization-location"

const SAME_LOCATION_COORDINATE_PRECISION = 6

export type PublicMapSameLocationCapableOrganization = Pick<
  PublicMapOrganization,
  | "id"
  | "name"
  | "latitude"
  | "longitude"
  | "address"
  | "addressStreet"
  | "city"
  | "state"
  | "country"
> & {
  latitude: number
  longitude: number
}

export type PublicMapSameLocationGroup<
  T extends PublicMapSameLocationCapableOrganization = PublicMapSameLocationCapableOrganization,
> = {
  key: string
  coordinates: [number, number]
  locationLabel: string | null
  organizations: T[]
}

export type PublicMapSameLocationSelection = {
  key: string
  organizationIds: string[]
  locationLabel: string | null
}

export function resolveSameLocationGroupKey({
  longitude,
  latitude,
}: {
  longitude: number
  latitude: number
}) {
  return `${longitude.toFixed(SAME_LOCATION_COORDINATE_PRECISION)}:${latitude.toFixed(SAME_LOCATION_COORDINATE_PRECISION)}`
}

export function resolveSameLocationLabel(
  organization: Pick<
    PublicMapOrganization,
    "address" | "addressStreet" | "city" | "state" | "country"
  >,
) {
  const directAddress = organization.address?.trim()
  if (directAddress) return directAddress

  const locality = formatFullOrganizationLocation({
    city: organization.city,
    state: organization.state,
    country: organization.country,
  })
  const fallback = [organization.addressStreet?.trim(), locality]
    .filter((entry): entry is string => Boolean(entry && entry.length > 0))
    .join(", ")

  return fallback.length > 0 ? fallback : null
}

export function buildSameLocationGroups<
  T extends PublicMapSameLocationCapableOrganization,
>(organizations: T[]) {
  const groupsByKey = new Map<string, PublicMapSameLocationGroup<T>>()

  const groupsByCoordinates = new Map<string, PublicMapSameLocationGroup<T>>()
  const groupsByAddress = new Map<string, PublicMapSameLocationGroup<T>[]>()
  for (const organization of [...organizations].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = resolveSameLocationGroupKey({
      longitude: organization.longitude,
      latitude: organization.latitude,
    })
    const addressKey = resourceStreetKey(organization)
    // One building can be geocoded to different entrances. Keep each listing;
    // combine only its marker, with a short distance guard against bad addresses.
    const existing = groupsByCoordinates.get(key) ?? (addressKey ? groupsByAddress.get(addressKey)?.find((group) =>
      group.organizations.every((other) => {
        const dy = (organization.latitude - other.latitude) * 111_320
        const dx = (((organization.longitude - other.longitude + 540) % 360) - 180) * 111_320 * Math.cos((organization.latitude + other.latitude) * Math.PI / 360)
        return Math.hypot(dx, dy) <= 250
      })
    ) : undefined)
    if (existing) {
      if (!existing.organizations.some((item) => item.id === organization.id)) existing.organizations.push(organization)
      groupsByCoordinates.set(key, existing)
      if (addressKey) {
        const addressed = groupsByAddress.get(addressKey) ?? []
        if (!addressed.includes(existing)) groupsByAddress.set(addressKey, [...addressed, existing])
      }
      continue
    }

    const group: PublicMapSameLocationGroup<T> = {
      key,
      coordinates: [organization.longitude, organization.latitude],
      locationLabel: resolveSameLocationLabel(organization),
      organizations: [organization],
    }
    groupsByKey.set(key, group)
    groupsByCoordinates.set(key, group)
    if (addressKey) groupsByAddress.set(addressKey, [...(groupsByAddress.get(addressKey) ?? []), group])
  }

  return Array.from(groupsByKey.values()).sort((left, right) =>
    left.key.localeCompare(right.key),
  )
}
