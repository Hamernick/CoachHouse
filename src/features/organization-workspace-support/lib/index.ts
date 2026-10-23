import type { WorkspaceSupportSearchRow } from "../types"

function searchKey(value: string) { return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") }

export function mapSupportOrganization(row: WorkspaceSupportSearchRow) {
  return { orgId: row.org_id, name: row.name, role: "admin" as const, imageUrl: row.image_url,
    publicSlug: row.public_slug, supportAccess: true, contactName: row.contact_name ?? row.owner_name,
    contactEmail: row.contact_email ?? row.owner_email }
}

export function mergeSupportSearchResults<T extends { orgId: string; name: string; publicSlug?: string | null; contactName?: string | null; contactEmail?: string | null }>(memberships: T[], matches: T[], query: string) {
  const search = query.trim().toLowerCase()
  const key = searchKey(search)
  const tokens = search.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const result = new Map(memberships.filter((entry) => {
    const text = [entry.name, entry.publicSlug, entry.contactName, entry.contactEmail].filter(Boolean).join(" ").toLowerCase()
    return !key || searchKey(text).includes(key) || tokens.every((token) => text.includes(token))
  }).map((entry) => [entry.orgId, entry]))
  if (key.length >= 2) for (const entry of matches) result.set(entry.orgId, { ...entry, ...result.get(entry.orgId), contactName: entry.contactName, contactEmail: entry.contactEmail })
  return [...result.values()]
}

export function createOrganizationScopedFetch(baseFetch: typeof fetch, organizationId: string, baseHref: string, supportAccess = false): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), baseHref)
    if (url.origin !== new URL(baseHref).origin) return baseFetch(input, init)
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    // Explicit document targets may differ from the surrounding admin workspace.
    // The server independently authorizes the target; ambient cookies must not retarget it.
    const explicitDocumentTarget = ["/api/account/document-collaboration", "/api/account/document-capabilities",
      "/api/account/document-presence"].includes(url.pathname)
      || (url.pathname === "/api/account/org-media" && ["roadmap", "roadmap-inline"].includes(url.searchParams.get("kind") ?? ""))
    if (!explicitDocumentTarget || !headers.has("x-coach-house-organization-id")) headers.set("x-coach-house-organization-id", organizationId)
    headers.set("x-coach-house-support-mode", supportAccess ? "1" : "0")
    return baseFetch(input, { ...init, headers })
  }
}
