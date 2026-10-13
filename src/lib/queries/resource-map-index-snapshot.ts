import { createClient } from "@supabase/supabase-js"
import { unstable_cache } from "next/cache"

import { env } from "@/lib/env"
import { buildExternalResourceMapItemFromPublicRow } from "@/lib/public-map/resource-map-public-item-adapter"
import { shouldShowPublicMapResourceItem } from "@/lib/public-map/resource-item-visibility"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { Database } from "@/lib/supabase/types"
import { fetchPublicResourceMapItems, isResourceMapPublicDbEnabled } from "./resource-map-public-items"

// Detail bodies, contact arrays, documents and links stay on the detail endpoint.
export const PUBLIC_RESOURCE_INDEX_COLUMNS = "item_id,title,subtitle,organization_name,latitude,longitude,city,state,country,resource_categories,primary_resource_category,verification_status,logo_url,favicon_url,source_label,source_url,source_attribution,last_verified_at,hours,timezone,appointment_required,availability_status,availability_notes,temporary_closed_until" as const
const PAGE_SIZE = 500

export async function readPublicResourceIndexPage(cursor: string | null) {
  const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  let request = db.from("resource_map_public_items")
    .select(PUBLIC_RESOURCE_INDEX_COLUMNS)
    .order("item_id", { ascending: true }).limit(PAGE_SIZE)
  if (cursor) request = request.gt("item_id", cursor)
  const { data, error } = await request
  if (error) throw new Error(`Resource index unavailable: ${error.code}`)
  return data ?? []
}

const readIndexPage = unstable_cache(readPublicResourceIndexPage, ["public-resource-index-projection-v1"], { revalidate: 300 })

export async function fetchPublicResourceIndexSnapshot(): Promise<ExternalResourceMapItem[]> {
  if (env.RESOURCE_MAP_LOCAL_PREVIEW_FILE?.trim()) {
    return fetchPublicResourceMapItems()
  }
  if (!isResourceMapPublicDbEnabled()) return []
  const items: ExternalResourceMapItem[] = []
  let cursor: string | null = null
  for (;;) {
    const rows = await readIndexPage(cursor)
    for (const row of rows) {
      const item = buildExternalResourceMapItemFromPublicRow(row)
      if (item && shouldShowPublicMapResourceItem(item)) items.push(item)
    }
    if (rows.length < PAGE_SIZE) break
    const next = rows.at(-1)!.item_id
    if (next === cursor) throw new Error("Resource index cursor did not advance")
    cursor = next
  }
  return items
}
