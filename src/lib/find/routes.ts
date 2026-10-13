export const FIND_PATH = "/resources"
export const LEGACY_FIND_PATH = "/find"
export const FIND_ORGANIZATION_QUERY_KEY = "organization"

export function buildPublicOrganizationProfileHref(organization: { id: string; publicSlug: string | null }) {
  return `/${encodeURIComponent(organization.publicSlug || organization.id)}`
}

export function buildFindHref(searchParams?: URLSearchParams) {
  const query = new URLSearchParams(searchParams).toString()
  return query ? `${FIND_PATH}?${query}` : FIND_PATH
}

export function buildFindOrganizationHref(
  publicSlug: string,
  searchParams?: URLSearchParams
) {
  const params = new URLSearchParams(searchParams)
  params.set(FIND_ORGANIZATION_QUERY_KEY, publicSlug)
  return buildFindHref(params)
}
