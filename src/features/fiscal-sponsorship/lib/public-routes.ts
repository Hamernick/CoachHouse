export function buildPublicFiscalSponsorshipHref(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> = {}
) {
  const query = new URLSearchParams(searchParams instanceof URLSearchParams ? searchParams : undefined)
  for (const [key, value] of Object.entries(searchParams instanceof URLSearchParams ? {} : searchParams)) {
    if (typeof value === "string") query.append(key, value)
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    }
  }
  const suffix = query.toString()
  return `/documentation/fiscal-sponsorship${suffix ? `?${suffix}` : ""}`
}
