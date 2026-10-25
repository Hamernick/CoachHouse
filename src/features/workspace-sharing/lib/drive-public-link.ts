/** Preserve a verified Drive file identity and its optional link-sharing key.
 * Drop account hints, OAuth/query tokens, fragments and arbitrary redirect paths.
 * This builds a provider link only; it never grants access or fetches bytes. */
export function canonicalDrivePublicLink(value: string, expectedFileId?: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null
    let id: string | null = null
    let path: string | null = null
    if (url.hostname === "docs.google.com") {
      const match = url.pathname.match(/^\/(document|spreadsheets|presentation|drawings)\/d\/([A-Za-z0-9_-]{10,200})(?:\/(?:edit|view|preview))?\/?$/)
      if (match) { id = match[2]; path = `/${match[1]}/d/${id}/edit` }
    } else if (url.hostname === "drive.google.com") {
      const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/(?:view|preview|edit))?\/?$/)
      id = match?.[1] ?? (url.pathname === "/open" ? url.searchParams.get("id") : null)
      if (id && /^[A-Za-z0-9_-]{10,200}$/.test(id)) path = `/file/d/${id}/view`
    }
    if (!id || !path || (expectedFileId !== undefined && expectedFileId !== id)) return null
    const result = new URL(path, url.origin)
    const key = url.searchParams.get("resourcekey")
    if (key !== null) {
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(key) || url.searchParams.getAll("resourcekey").length !== 1) return null
      result.searchParams.set("resourcekey", key)
    }
    return result.toString()
  } catch { return null }
}
