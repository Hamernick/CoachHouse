import { shouldShowPublicMapResourceRow } from "@/lib/public-map/resource-item-visibility"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

import type { PublicMapClaimListingOption } from "../types"

const CLAIM_LISTING_SEARCH_LIMIT = 8
const CLAIM_LISTING_CANDIDATE_LIMIT = 80

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80)
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export async function searchPublicMapClaimListings(
  value: string
): Promise<PublicMapClaimListingOption[]> {
  const query = normalizeQuery(value)
  if (query.length < 2) return []

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("resource_map_public_items")
    .select("organization_id, organization_name, platform_org_id, source_label, title, source_url")
    .is("platform_org_id", null)
    .not("source_label", "is", null)
    .ilike("organization_name", `%${escapeLikePattern(query)}%`)
    .order("organization_name", { ascending: true })
    .order("organization_id", { ascending: true })
    .limit(CLAIM_LISTING_CANDIDATE_LIMIT)

  if (error) throw new Error("Unable to search claimable listings.")

  const options = new Map<string, PublicMapClaimListingOption>()
  for (const row of data ?? []) {
    const id = row.organization_id?.trim()
    const name = row.organization_name?.trim()
    if (!id || !name || row.platform_org_id || !row.source_label || !shouldShowPublicMapResourceRow(row)) continue
    const nameKey = name.toLocaleLowerCase()
    if (!options.has(nameKey)) options.set(nameKey, { id, name })
  }

  const normalizedQuery = query.toLocaleLowerCase()
  return [...options.values()]
    .sort((left, right) => {
      const leftStarts = left.name
        .toLocaleLowerCase()
        .startsWith(normalizedQuery)
      const rightStarts = right.name
        .toLocaleLowerCase()
        .startsWith(normalizedQuery)
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
      return left.name.localeCompare(right.name)
    })
    .slice(0, CLAIM_LISTING_SEARCH_LIMIT)
}
