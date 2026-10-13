import { Suspense } from "react"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { buildPublicMapItems } from "@/lib/public-map/resource-map-items"
import { getHomeOrganizationBadgeIds } from "./server/home-organization-badges"
import { toHomeResource } from "./lib/home-resource-preview"
import { HomeResourcePreviewLoader } from "./components/home-resource-preview-loader"
import { HomeResourcePreviewSkeleton } from "./components/home-resource-preview-skeleton"

async function HomeResourcePreviewData() {
  const organizations = await fetchPublicMapOrganizations().catch(() => [])
  const badgeIds = await getHomeOrganizationBadgeIds(organizations)
  const items = buildPublicMapItems({ organizations }).map((item) => {
    const resource = toHomeResource(item)
    return { ...resource, organizationBadge: resource.kind === "organization" && badgeIds.has(resource.id) }
  })
  return <HomeResourcePreviewLoader organizations={items} />
}

export function HomeResourcePreview() {
  return <Suspense fallback={<HomeResourcePreviewSkeleton />}><HomeResourcePreviewData /></Suspense>
}
