import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { directoryItemSchema, nonprofitDirectoryMapItem } from "@/features/find-resource-index"
import { env } from "@/lib/env"
import { publicResourceProfileItemId } from "@/lib/public-map/resource-profile-href"
import type { Database } from "@/lib/supabase/types"
import { fetchPublicResourceMapItemById } from "./resource-map-public-items"

export const fetchPublicResourceProfile = unstable_cache(async (id: string) => {
  const itemId = publicResourceProfileItemId(id)
  if (!itemId) return null
  if (itemId.startsWith("resource_map:")) return fetchPublicResourceMapItemById(itemId)
  // Anonymous access to the published projection only. No raw IRS/source tables.
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  })
  const { data, error } = await client.rpc("get_nonprofit_directory", { p_ein: id })
  if (error) throw new Error("The public organization profile is temporarily unavailable")
  if (data === null) return null
  const item = directoryItemSchema.parse(data)
  if (item.ein !== id) return null
  return nonprofitDirectoryMapItem(item)
}, ["public-resource-profile-v3"], { revalidate: 300 })
