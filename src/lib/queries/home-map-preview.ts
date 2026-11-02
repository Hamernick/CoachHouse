import { buildHomeMapPreviewFeatures } from "@/lib/public-map/home-map-preview"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { fetchPublicResourceMapItems } from "@/lib/queries/resource-map-public-items"

export async function fetchHomeMapPreviewFeatures() {
  const [organizations, resourceItems] = await Promise.all([
    fetchPublicMapOrganizations(),
    fetchPublicResourceMapItems({
      ignoreLocalPreviewFile: true,
      includeDiscoveryCandidates: false,
      limit: 1_000,
    }),
  ])
  return buildHomeMapPreviewFeatures({ organizations, resourceItems })
}
