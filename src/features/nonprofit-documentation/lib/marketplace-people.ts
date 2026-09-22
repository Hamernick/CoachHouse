export function marketplacePersonHref(handle: string) {
  return `/documentation/marketplace/people/@${encodeURIComponent(handle)}`
}

export function marketplacePeoplePageHref(search: string, page: number) {
  const params = new URLSearchParams(search)
  params.set("view", "people")
  params.set("peoplePage", String(page))
  return `?${params}`
}

export function decodeMarketplacePersonHandle(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ""
  }
}
