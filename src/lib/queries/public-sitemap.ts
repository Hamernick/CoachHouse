import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { env } from "@/lib/env"
import { getPublicSiteOrigin } from "@/lib/public-site-origin"
import { shouldShowPublicMapResourceRow } from "@/lib/public-map/resource-item-visibility"
import { publicResourceProfileHref } from "@/lib/public-map/resource-profile-href"
import { fetchPublishedPublicHandles } from "./public-profile-sitemap"

const PAGE_SIZE = 500
// Nine-digit EIN space, split below the 50,000-URL sitemap limit. Fixed key
// ranges avoid a full visibility-view count or increasingly expensive offsets.
const EIN_RANGE_SIZE = 50_000
const EIN_SITEMAP_COUNT = 1_000_000_000 / EIN_RANGE_SIZE
const kinds = ["profiles", "nonprofits", "resources", "roadmaps"] as const
type Kind = typeof kinds[number]

function enabled(kind: Kind) {
  if (kind === "roadmaps") return publicSharingEnabled
  if (kind === "resources") return env.RESOURCE_MAP_PUBLIC_DB_ENABLED?.trim().toLowerCase() === "true"
  return true
}

function xml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!)
}

function response(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
  })
}

function unavailable() {
  // Never cache a successful empty sitemap after a provider error.
  return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } })
}

async function countPages(kind: Kind, signal: AbortSignal) {
  if (kind === "nonprofits") return EIN_SITEMAP_COUNT
  const client = createSupabaseAdminClient()
  const query = kind === "profiles" ? client.from("public_handles").select("handle", { count: "exact", head: true })
    : kind === "resources" ? client.from("resource_map_public_items").select("item_id", { count: "exact", head: true })
    : client.from("organizations").select("user_id", { count: "exact", head: true }).eq("is_public_roadmap", true).not("public_slug", "is", null)
  const { count, error } = await query.abortSignal(signal)
  if (error || count === null) throw new Error("Sitemap count unavailable")
  return Math.ceil(count / PAGE_SIZE)
}

export async function publicSitemapIndexGET() {
  try {
    const origin = getPublicSiteOrigin()
    const signal = AbortSignal.timeout(10_000)
    const groups = await Promise.all(kinds.filter(enabled).map(async (kind) => {
      const pages = await countPages(kind, signal)
      return Array.from({ length: pages }, (_, page) => `${origin}/public-sitemaps/${kind}/${page}`)
    }))
    const urls = [`${origin}/sitemap.xml`, ...groups.flat()]
    if (urls.length > 50_000) throw new Error("Sitemap index capacity exceeded")
    return response(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${xml(url)}</loc></sitemap>`).join("")}</sitemapindex>`)
  } catch {
    return unavailable()
  }
}

async function pagePaths(kind: Kind, page: number) {
  if (kind === "profiles") {
    const profiles = await fetchPublishedPublicHandles({ page, strict: true })
    return profiles.map(({ handle }) => `/${encodeURIComponent(handle)}`)
  }
  const client = createSupabaseAdminClient()
  const signal = AbortSignal.timeout(10_000)
  const start = page * PAGE_SIZE
  if (kind === "nonprofits") {
    // Exact public projection: no raw imports, suppressed rows or claimed identities.
    const lower = String(page * EIN_RANGE_SIZE).padStart(9, "0")
    const upper = String((page + 1) * EIN_RANGE_SIZE - 1).padStart(9, "0")
    const paths: string[] = []
    let after: string | null = null
    while (true) {
      let query = client.from("nonprofit_directory_public").select("ein")
        .gte("ein", lower).lte("ein", upper).order("ein").limit(PAGE_SIZE).abortSignal(signal)
      if (after) query = query.gt("ein", after)
      const { data, error } = await query
      if (error) throw error
      const rows = data ?? []
      for (const { ein } of rows) {
        if (!/^\d{9}$/.test(ein) || ein < lower || ein > upper || (after && ein <= after)) throw new Error("Invalid sitemap cursor")
        paths.push(`/find/resources/${ein}`)
        after = ein
      }
      if (rows.length < PAGE_SIZE) return paths
    }
  }
  if (kind === "resources") {
    const { data, error } = await client.from("resource_map_public_items").select("item_id,title,organization_name,source_label,source_url").order("item_id").range(start, start + PAGE_SIZE - 1).abortSignal(signal)
    if (error) throw error
    return (data ?? []).filter((row) => row.title?.trim() && shouldShowPublicMapResourceRow(row)).flatMap(({ item_id }) => {
      const href = publicResourceProfileHref(`resource_map:${item_id}`)
      return href ? [href] : []
    })
  }
  const { data, error } = await client.from("organizations").select("public_slug").eq("is_public_roadmap", true).not("public_slug", "is", null).order("user_id").range(start, start + PAGE_SIZE - 1).abortSignal(signal)
  if (error) throw error
  return (data ?? []).flatMap(({ public_slug }) => public_slug ? [`/${encodeURIComponent(public_slug)}/roadmap`] : [])
}

export async function publicSitemapPageGET(_request: Request, { params }: { params: Promise<{ kind: string; page: string }> }) {
  const { kind, page } = await params
  if (!kinds.includes(kind as Kind) || !/^(0|[1-9]\d{0,6})$/.test(page) || !enabled(kind as Kind) || (kind === "nonprofits" && Number(page) >= EIN_SITEMAP_COUNT)) {
    return new Response("Not found", { status: 404 })
  }
  try {
    const origin = getPublicSiteOrigin()
    const paths = await pagePaths(kind as Kind, Number(page))
    return response(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${xml(origin + path)}</loc></url>`).join("")}</urlset>`)
  } catch {
    return unavailable()
  }
}
