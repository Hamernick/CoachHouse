import { redirect } from "next/navigation"

import { updatePublicMapOrganizationCurationAction } from "@/actions/public-map-organization-curation"
import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"
import { readAppSidebarDefaultOpen } from "@/components/app-shell/sidebar-state-server"
import { updateResourceMapCanonicalStateAction } from "@/features/resource-map-admin"
import { AuthenticatedFindShell } from "./authenticated-find-shell"

import { resolvePublicAuthCallbackHref } from "@/components/public/public-auth-callback"
import { HomeCanvasFindShell } from "@/components/public/home-canvas-find-shell"
import { PublicMapIndex } from "@/components/public/public-map-index"
import { FIND_ORGANIZATION_QUERY_KEY, FIND_PATH } from "@/lib/find/routes"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

import { fetchPublicMapViewerState } from "../viewer-state"
import { FindRenderDiagnostic } from "./find-render-diagnostic"

const PUBLIC_RESOURCE_MAP_ITEMS_ENDPOINT =
  "/api/public/resource-map/index?limit=200"

export type PublicFindRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  embedded?: boolean
  initialOrganization?: PublicMapOrganization
  initialResource?: ExternalResourceMapItem
}

function firstString(value: string | string[] | undefined) {
  if (typeof value === "string") return value
  return Array.isArray(value) ? value[0] : undefined
}

async function PublicFindRouteContent({
  searchParams,
  embedded = false,
  initialOrganization,
  initialResource,
}: PublicFindRouteProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const callbackParams = new URLSearchParams()
  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (typeof value === "string") callbackParams.set(key, value)
    if (Array.isArray(value)) {
      for (const item of value) callbackParams.append(key, item)
    }
  }
  const authCallbackHref = resolvePublicAuthCallbackHref({
    pathname: FIND_PATH,
    searchParams: callbackParams,
  })
  if (authCallbackHref) redirect(authCallbackHref)

  const viewerState = await fetchPublicMapViewerState()
  const shellState = viewerState.viewer && !embedded
    ? await resolveDashboardLayoutState()
    : null
  if (viewerState.viewer && !embedded && !shellState?.isAdmin) redirect("/workspace")

  const requestedPublicSlug = initialOrganization ? (initialOrganization.publicSlug || initialOrganization.id) : firstString(
    resolvedSearchParams?.[FIND_ORGANIZATION_QUERY_KEY]
  )
    ?.trim()
    .toLowerCase()
  const organizations = await fetchPublicMapOrganizations()
  const initialPublicSlug = requestedPublicSlug
    ? (organizations.find(
        (organization) =>
          (organization.publicSlug || organization.id).trim().toLowerCase() === requestedPublicSlug
      ) ? requestedPublicSlug : undefined)
    : undefined
  const candidateTokens = [
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    process.env.MAPBOX_TOKEN,
  ]
  const publicToken = candidateTokens
    .map((value) => value?.trim() ?? "")
    .find((value) => value.length > 0 && value.startsWith("pk."))

  if (embedded) {
    return (
      <PublicMapIndex
        embedded
        organizations={organizations}
        resourceItemsEndpoint={PUBLIC_RESOURCE_MAP_ITEMS_ENDPOINT}
        mapboxToken={publicToken}
        initialPublicSlug={initialPublicSlug}
        initialResource={initialResource}
        resourceItems={initialResource ? [initialResource] : undefined}
        viewer={viewerState.viewer}
      />
    )
  }

  // Keep the existing administrative curation surface; members start in Workspace.
  if (shellState?.userPresent && shellState.isAdmin) {
    const defaultSidebarOpen = await readAppSidebarDefaultOpen()
    return (
      <AuthenticatedFindShell
        state={shellState}
        defaultSidebarOpen={defaultSidebarOpen}
        organizationDetail={Boolean(initialPublicSlug)}
      >
        <PublicMapIndex
          presentationMode="app-shell"
          organizations={organizations}
          resourceItemsEndpoint={PUBLIC_RESOURCE_MAP_ITEMS_ENDPOINT}
          mapboxToken={publicToken}
          initialPublicSlug={initialPublicSlug}
          viewer={viewerState.viewer}
          canManageResourceMap={shellState.isAdmin}
          organizationCurationAction={updatePublicMapOrganizationCurationAction}
          resourceMapCurationAction={updateResourceMapCanonicalStateAction}
          adminOnboardingPreview={{
            canToggle: true,
            hasOrganizationSwitcher: shellState.memberMapOnboarding.hasOrganizationSwitcher,
          }}
        />
      </AuthenticatedFindShell>
    )
  }

  return (
    <HomeCanvasFindShell>
      <div className="relative h-full">
        <PublicMapIndex
          organizations={organizations}
          resourceItemsEndpoint={PUBLIC_RESOURCE_MAP_ITEMS_ENDPOINT}
          mapboxToken={publicToken}
          initialPublicSlug={initialPublicSlug}
          viewer={viewerState.viewer}
        />
      </div>
    </HomeCanvasFindShell>
  )
}

export async function PublicFindRoute(props: PublicFindRouteProps = {}) {
  const content = await PublicFindRouteContent(props)
  return <FindRenderDiagnostic>{content}</FindRenderDiagnostic>
}
