"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { buildPublicOrganizationProfileHref, FIND_PATH } from "@/lib/find/routes"
import { publicResourceProfileHref, publicResourceProfileItemId } from "@/lib/public-map/resource-profile-href"
import { usePublicMapIndexNavigationHandlers, usePublicMapListItemSelection } from "./public-map-index-selection"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

type Options = Omit<Parameters<typeof usePublicMapListItemSelection>[0], "navigateToProfile"> & {
  embedded: boolean
  beforeProfileNavigation: () => void
  organizationById: Map<string, PublicMapOrganization>
  onSameLocationSelectionChange: Parameters<typeof usePublicMapListItemSelection>[0]["setSameLocationSelection"]
}

export function resolveEmbeddedProfileId(pathname: string, organizations: ReadonlyMap<string, Pick<PublicMapOrganization, "id" | "publicSlug">>) {
  const organization = [...organizations.values()].find((item) => buildPublicOrganizationProfileHref(item) === pathname)
  if (organization) return organization.id
  const match = /^\/find\/resources\/([^/]+)$/.exec(pathname)
  return match ? publicResourceProfileItemId(match[1]) : null
}

export function usePublicMapNavigation(options: Options) {
  const router = useRouter()
  const { embedded, beforeProfileNavigation, organizationById, setSelectedOrgId, setSelectedListItemId, setSidebarMode } = options
  const selectProfile = useCallback((id: string | null) => {
    setSelectedOrgId(id && organizationById.has(id) ? id : null)
    setSelectedListItemId(id)
    setSidebarMode(id ? "details" : "search")
  }, [organizationById, setSelectedOrgId, setSelectedListItemId, setSidebarMode])
  const navigateToProfile = useCallback((id: string) => {
    if (!embedded) return false
    const organization = organizationById.get(id)
    const href = organization ? buildPublicOrganizationProfileHref(organization) : publicResourceProfileHref(id)
    if (!href) return false
    beforeProfileNavigation()
    if (window.location.pathname !== href) {
      // Next's native history integration updates the URL without remounting the shell.
      window.history.pushState({ homeProfileNavigation: true }, "", `${href}${window.location.search}`)
    }
    selectProfile(id)
    return true
  }, [embedded, beforeProfileNavigation, organizationById, selectProfile])
  useEffect(() => {
    if (!embedded) return
    const restore = () => selectProfile(resolveEmbeddedProfileId(window.location.pathname, organizationById))
    window.addEventListener("popstate", restore)
    return () => window.removeEventListener("popstate", restore)
  }, [embedded, organizationById, selectProfile])
  const navigation = usePublicMapIndexNavigationHandlers({ ...options, navigateToProfile })
  const selection = usePublicMapListItemSelection({ ...options, navigateToProfile, setSameLocationSelection: options.onSameLocationSelectionChange })
  const resetSelection = navigation.handleBackToSearch
  const handleBackToSearch = useCallback(() => {
    if (embedded && window.location.pathname !== FIND_PATH && !window.history.state?.homeProfileNavigation) {
      // A directly loaded profile owns a framed server layout. Navigate to the
      // resources route so its unframed layout replaces that shell as well.
      router.replace(`${FIND_PATH}${window.location.search}`)
      return
    }
    resetSelection()
    // Unpublished or synthetic directory items open locally without a profile URL.
    if (!embedded || window.location.pathname === FIND_PATH) return
    window.history.back()
  }, [embedded, resetSelection, router])
  return { ...navigation, ...selection, handleBackToSearch }
}
