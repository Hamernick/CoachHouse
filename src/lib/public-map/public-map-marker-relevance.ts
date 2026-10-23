import { resolvePublicMapResourceTopLevelCategory } from "./resource-categories"
import {
  parsePublicMapOrganizationIds,
  type PublicMapPointFeature,
} from "./public-map-geojson"
export type PublicMapMarkerRelevanceTier = 0 | 1 | 2 | 3
type PublicMapMarkerUserCoordinates = {
  latitude: number
  longitude: number
}

const PUBLIC_MAP_MARKER_RELEVANCE_LEVELS = [
  { limit: 8, tier: 0, tileZoom: 4 },
  { limit: 4, tier: 1, tileZoom: 7 },
  { limit: 4, tier: 2, tileZoom: 10 },
] as const

const MAX_MERCATOR_LATITUDE = 85.051129

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function resolveTileKey({
  coordinates,
  zoom,
}: {
  coordinates: [number, number]
  zoom: number
}) {
  const [longitude, latitude] = coordinates
  const scale = 2 ** zoom
  const normalizedLongitude = clamp(longitude, -180, 180)
  const normalizedLatitude = clamp(
    latitude,
    -MAX_MERCATOR_LATITUDE,
    MAX_MERCATOR_LATITUDE
  )
  const latitudeRadians = (normalizedLatitude * Math.PI) / 180
  const x = clamp(
    Math.floor(((normalizedLongitude + 180) / 360) * scale),
    0,
    scale - 1
  )
  const y = clamp(
    Math.floor(
      ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale
    ),
    0,
    scale - 1
  )
  return `${zoom}:${x}:${y}`
}

function resolveDistanceScore({
  coordinates,
  userCoordinates,
}: {
  coordinates: [number, number]
  userCoordinates: PublicMapMarkerUserCoordinates | null
}) {
  if (!userCoordinates) return 0
  const [longitude, latitude] = coordinates
  const latitudeDelta = latitude - userCoordinates.latitude
  const longitudeScale = Math.cos((userCoordinates.latitude * Math.PI) / 180)
  const longitudeDelta =
    (longitude - userCoordinates.longitude) * longitudeScale
  return latitudeDelta ** 2 + longitudeDelta ** 2
}

function compareRepresentativeCandidates({
  boostCoolingCenters,
  first,
  second,
  userCoordinates,
}: {
  boostCoolingCenters: boolean
  first: PublicMapPointFeature
  second: PublicMapPointFeature
  userCoordinates: PublicMapMarkerUserCoordinates | null
}) {
  if (boostCoolingCenters) {
    const weatherEligibilityDifference =
      Number(second.properties.weatherEligible === true) -
      Number(first.properties.weatherEligible === true)
    if (weatherEligibilityDifference !== 0) return weatherEligibilityDifference
  }
  const distanceDifference =
    resolveDistanceScore({
      coordinates: first.geometry.coordinates as [number, number],
      userCoordinates,
    }) -
    resolveDistanceScore({
      coordinates: second.geometry.coordinates as [number, number],
      userCoordinates,
    })
  if (distanceDifference !== 0) return distanceDifference

  const verificationDifference =
    Number(second.properties.verificationStatus === "verified_platform") -
    Number(first.properties.verificationStatus === "verified_platform")
  if (verificationDifference !== 0) return verificationDifference
  return first.properties.itemId.localeCompare(second.properties.itemId)
}

// Round-robin finer geographic cells before taking additional pins from a
// dense neighborhood. Priority still chooses the first pin within each cell.
function selectRepresentatives(
  candidates: PublicMapPointFeature[],
  tileZoom: number,
  limit: number
) {
  const cells = new Map<string, PublicMapPointFeature[]>()
  for (const feature of candidates) {
    const key = resolveTileKey({
      coordinates: feature.geometry.coordinates as [number, number],
      zoom: tileZoom + 3,
    })
    const cell = cells.get(key) ?? []
    cell.push(feature)
    cells.set(key, cell)
  }
  const selected: PublicMapPointFeature[] = []
  for (let depth = 0; selected.length < limit; depth += 1) {
    let found = false
    for (const cell of cells.values()) {
      if (cell[depth]) {
        selected.push(cell[depth])
        found = true
        if (selected.length === limit) return selected
      }
    }
    if (!found) break
  }
  return selected
}

function isSavedFeature(
  feature: PublicMapPointFeature,
  favoriteOrganizationIds: ReadonlySet<string>
) {
  return parsePublicMapOrganizationIds(feature.properties.organizationIds).some(
    (organizationId) => favoriteOrganizationIds.has(organizationId)
  )
}

export function buildPublicMapMarkerRelevance({
  boostCoolingCenters = false,
  favoriteOrganizationIds = new Set<string>(),
  features,
  userCoordinates = null,
}: {
  boostCoolingCenters?: boolean
  favoriteOrganizationIds?: ReadonlySet<string>
  features: PublicMapPointFeature[]
  userCoordinates?: PublicMapMarkerUserCoordinates | null
}) {
  const relevanceTierByItemId = new Map<string, PublicMapMarkerRelevanceTier>(
    features.map((feature) => [feature.properties.itemId, 3])
  )

  for (const level of PUBLIC_MAP_MARKER_RELEVANCE_LEVELS) {
    const candidatesByBucket = new Map<string, PublicMapPointFeature[]>()
    for (const feature of features) {
      const category = resolvePublicMapResourceTopLevelCategory(
        feature.properties.primaryResourceCategory
      )
      const tileKey = resolveTileKey({
        coordinates: feature.geometry.coordinates as [number, number],
        zoom: level.tileZoom,
      })
      const bucketKey = `${tileKey}:${category}`
      const candidates = candidatesByBucket.get(bucketKey) ?? []
      candidates.push(feature)
      candidatesByBucket.set(bucketKey, candidates)
    }

    for (const candidates of candidatesByBucket.values()) {
      const ordered = [...candidates].sort((first, second) =>
        compareRepresentativeCandidates({
          boostCoolingCenters,
          first,
          second,
          userCoordinates,
        })
      )
      selectRepresentatives(ordered, level.tileZoom, level.limit).forEach(
        (feature) => {
          const currentTier =
            relevanceTierByItemId.get(feature.properties.itemId) ?? 3
          relevanceTierByItemId.set(
            feature.properties.itemId,
            Math.min(currentTier, level.tier) as PublicMapMarkerRelevanceTier
          )
        }
      )
    }
  }

  const priorityByItemId = new Map(
    [...features]
      .sort((first, second) =>
        compareRepresentativeCandidates({
          boostCoolingCenters,
          first,
          second,
          userCoordinates,
        })
      )
      .map((feature, index) => [
        feature.properties.itemId,
        index / Math.max(1, features.length),
      ])
  )
  return features.map((feature) => {
    const tier = relevanceTierByItemId.get(feature.properties.itemId) ?? 3
    return {
      ...feature,
      properties: {
        ...feature.properties,
        isSaved: isSavedFeature(feature, favoriteOrganizationIds),
        markerRelevanceTier:
          relevanceTierByItemId.get(feature.properties.itemId) ?? 3,
        markerSortKey:
          tier * 2 + (priorityByItemId.get(feature.properties.itemId) ?? 0),
      },
    } satisfies PublicMapPointFeature
  })
}

export function resolvePublicMapMarkerRelevanceTier(
  zoom: number
): PublicMapMarkerRelevanceTier {
  if (!Number.isFinite(zoom) || zoom < 5) return 0
  if (zoom < 8) return 1
  if (zoom < 12) return 2
  return 3
}
