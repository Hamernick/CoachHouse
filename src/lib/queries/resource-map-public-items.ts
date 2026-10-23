import { withPublicResourceEins } from "./public-resource-ein"
import { existsSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

import { createClient } from "@supabase/supabase-js"

import { env } from "@/lib/env"
import { shouldShowPublicMapResourceItem } from "@/lib/public-map/resource-item-visibility"
import { buildExternalResourceMapItemFromLocalPreviewRecord } from "@/lib/public-map/resource-map-local-preview-adapter"
import { buildExternalResourceMapItemFromPublicRow } from "@/lib/public-map/resource-map-public-item-adapter"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { ResourceMapPublicItemsView } from "@/lib/supabase/schema/views"
import type { Database } from "@/lib/supabase/types"

export type FetchPublicResourceMapItemsOptions = {
  enabled?: boolean
  ignoreLocalPreviewFile?: boolean
  includeDiscoveryCandidates?: boolean
  localEnginePreviewFile?: string | null
  localPreviewFile?: string | null
  limit?: number
}

export type FetchPublicResourceMapItemsPageResult = {
  items: ExternalResourceMapItem[]
  totalCount: number
}

export const DEFAULT_RESOURCE_MAP_LOCAL_PREVIEW_LIMIT = 10000
export const DEFAULT_RESOURCE_MAP_PUBLIC_DB_LIMIT = 5000
export const RESOURCE_MAP_PUBLIC_DB_PAGE_SIZE = 500
const RESOURCE_MAP_PUBLIC_ITEM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LocalResourceMapPreviewCacheEntry = {
  signature: string
  itemsPromise: Promise<ExternalResourceMapItem[]>
}

const localResourceMapPreviewCache = new Map<
  string,
  LocalResourceMapPreviewCacheEntry
>()

export function isResourceMapPublicDbEnabled(
  value = env.RESOURCE_MAP_PUBLIC_DB_ENABLED
) {
  return value?.trim().toLowerCase() === "true"
}

export function isResourceMapLocalDiscoveryPreviewEnabled(
  value = env.RESOURCE_MAP_LOCAL_PREVIEW_INCLUDE_DISCOVERY
) {
  return value?.trim().toLowerCase() === "true"
}

function normalizeLocalPreviewFile(value: string | null | undefined) {
  const filePath = value?.trim()
  if (!filePath) return null
  // Curated preview files exist only on the operator's local filesystem.
  // Do not trace the checkout or bundle its files into deployed routes.
  return isAbsolute(filePath)
    ? filePath
    : resolve(/* turbopackIgnore: true */ process.cwd(), filePath)
}

function parseLocalPreviewRows(raw: string): unknown[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.resources)
      ) {
        return parsed.resources
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.records)
      ) {
        return parsed.records
      }
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        return parsed.items
      }
      return [parsed]
    } catch (error) {
      if (!trimmed.includes("\n")) {
        throw new Error(
          `Invalid resource-map local preview JSON: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(
          `Invalid resource-map local preview JSONL at line ${index + 1}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    })
}

export function clearResourceMapLocalPreviewCache() {
  localResourceMapPreviewCache.clear()
}

async function loadLocalResourceMapPreviewItems(filePath: string) {
  const fileMetadata = await stat(/* turbopackIgnore: true */ filePath)
  const signature = `${fileMetadata.mtimeMs}:${fileMetadata.size}`
  const cached = localResourceMapPreviewCache.get(filePath)
  if (cached?.signature === signature) return cached.itemsPromise

  const itemsPromise = readFile(/* turbopackIgnore: true */ filePath, "utf8").then(
    (raw) =>
      parseLocalPreviewRows(raw)
        .map((row, index) =>
          row && typeof row === "object"
            ? buildExternalResourceMapItemFromLocalPreviewRecord(
                row as Record<string, unknown>,
                index
              )
            : null
        )
        .filter((item): item is ExternalResourceMapItem => item !== null)
  )
  const entry = { signature, itemsPromise }
  localResourceMapPreviewCache.set(filePath, entry)

  try {
    return await itemsPromise
  } catch (error) {
    if (localResourceMapPreviewCache.get(filePath) === entry) {
      localResourceMapPreviewCache.delete(filePath)
    }
    throw error
  }
}

async function fetchLocalResourceMapPreviewItems({
  filePath,
  includeDiscoveryCandidates = false,
  limit = DEFAULT_RESOURCE_MAP_LOCAL_PREVIEW_LIMIT,
}: {
  filePath: string
  includeDiscoveryCandidates?: boolean
  limit?: number
}) {
  return (await loadLocalResourceMapPreviewItems(filePath))
    .filter(
      (item) =>
        includeDiscoveryCandidates || shouldShowPublicMapResourceItem(item)
    )
    .slice(0, limit)
}

async function fetchPublicResourceMapItemsUncached({
  limit = DEFAULT_RESOURCE_MAP_PUBLIC_DB_LIMIT,
}: {
  limit?: number
}): Promise<ExternalResourceMapItem[]> {
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  )

  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 5000)
    : DEFAULT_RESOURCE_MAP_PUBLIC_DB_LIMIT
  const rows: ResourceMapPublicItemsView["Row"][] = []
  for (
    let offset = 0;
    offset < normalizedLimit;
    offset += RESOURCE_MAP_PUBLIC_DB_PAGE_SIZE
  ) {
    const pageLimit = Math.min(
      RESOURCE_MAP_PUBLIC_DB_PAGE_SIZE,
      normalizedLimit - offset
    )
    const { data, error } = await supabase.rpc(
      "get_resource_map_public_items_page",
      {
        p_category_keys: null,
        p_latitude: null,
        p_limit: pageLimit,
        p_longitude: null,
        p_offset: offset,
        p_query: null,
        p_radius_miles: null,
      }
    )

    if (error?.code === "42883" && offset === 0) {
      const fallback = await supabase.rpc("get_resource_map_public_items", {
        p_category_keys: null,
        p_latitude: null,
        p_limit: Math.min(normalizedLimit, 1000),
        p_longitude: null,
        p_query: null,
        p_radius_miles: null,
      })
      if (fallback.error || !fallback.data) {
        console.warn(
          "[resource-map] public RPC unavailable; using seed fallback",
          {
            code: fallback.error?.code,
            message: fallback.error?.message,
          }
        )
        return []
      }
      rows.push(...fallback.data)
      break
    }

    if (error || !data) {
      console.warn(
        "[resource-map] public RPC unavailable; using seed fallback",
        {
          code: error?.code,
          message: error?.message,
        }
      )
      return []
    }

    rows.push(...data)
    if (data.length < pageLimit) break
  }

  if (rows.length === 0) {
    return []
  }

  return rows
    .map(buildExternalResourceMapItemFromPublicRow)
    .filter((item): item is ExternalResourceMapItem => item !== null)
    .filter(shouldShowPublicMapResourceItem)
}

export async function fetchPublicResourceMapItems(
  options: FetchPublicResourceMapItemsOptions = {}
): Promise<ExternalResourceMapItem[]> {
  const includeDiscoveryCandidates =
    options.includeDiscoveryCandidates ??
    isResourceMapLocalDiscoveryPreviewEnabled()
  const localPreviewFile = options.ignoreLocalPreviewFile
    ? null
    : normalizeLocalPreviewFile(
        options.localPreviewFile ?? env.RESOURCE_MAP_LOCAL_PREVIEW_FILE
      )
  if (localPreviewFile) {
    try {
      return await fetchLocalResourceMapPreviewItems({
        filePath: localPreviewFile,
        includeDiscoveryCandidates,
        limit: options.limit,
      })
    } catch (error) {
      console.warn("[resource-map] local preview file unavailable", {
        filePath: localPreviewFile,
        message: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  const localEnginePreviewFile = normalizeLocalPreviewFile(
    options.localEnginePreviewFile
  )
  if (
    localEnginePreviewFile &&
    existsSync(/* turbopackIgnore: true */ localEnginePreviewFile)
  ) {
    try {
      const items = await fetchLocalResourceMapPreviewItems({
        filePath: localEnginePreviewFile,
        includeDiscoveryCandidates,
        limit: options.limit,
      })
      if (items.length > 0) return items
    } catch (error) {
      console.warn("[resource-map] local engine preview file unavailable", {
        filePath: localEnginePreviewFile,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const enabled = options.enabled ?? isResourceMapPublicDbEnabled()
  if (!enabled) return []

  return fetchPublicResourceMapItemsUncached({
    limit: options.limit,
  })
}

export async function fetchPublicResourceMapItemById(
  id: string,
  options: FetchPublicResourceMapItemsOptions = {}
): Promise<ExternalResourceMapItem | null> {
  const normalizedId = id.trim()
  if (!normalizedId) return null

  const localPreviewFile = normalizeLocalPreviewFile(
    options.localPreviewFile ?? env.RESOURCE_MAP_LOCAL_PREVIEW_FILE
  )
  const localEnginePreviewFile = normalizeLocalPreviewFile(
    options.localEnginePreviewFile
  )
  if (
    localPreviewFile ||
    (localEnginePreviewFile &&
      existsSync(/* turbopackIgnore: true */ localEnginePreviewFile))
  ) {
    const items = await fetchPublicResourceMapItems(options)
    return items.find((item) => item.id === normalizedId) ?? null
  }

  const enabled = options.enabled ?? isResourceMapPublicDbEnabled()
  if (!enabled || !normalizedId.startsWith("resource_map:")) return null
  const itemId = normalizedId.slice("resource_map:".length)
  if (!RESOURCE_MAP_PUBLIC_ITEM_UUID_PATTERN.test(itemId)) return null

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase
    .from("resource_map_public_items")
    .select("*")
    .eq("item_id", itemId)
    .maybeSingle()
  if (error || !data) {
    if (error) {
      console.warn("[resource-map] public item lookup unavailable", {
        code: error.code,
        message: error.message,
      })
    }
    return null
  }

  const item = buildExternalResourceMapItemFromPublicRow(data)
  if (!item || !shouldShowPublicMapResourceItem(item)) return null
  return (await withPublicResourceEins([item]))[0] ?? null
}

export async function fetchPublicResourceMapItemsByIds(
  ids: string[],
  options: FetchPublicResourceMapItemsOptions = {}
): Promise<ExternalResourceMapItem[]> {
  const normalizedIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean))
  ).slice(0, 120)
  if (normalizedIds.length === 0) return []

  const localPreviewFile = normalizeLocalPreviewFile(
    options.localPreviewFile ?? env.RESOURCE_MAP_LOCAL_PREVIEW_FILE
  )
  const localEnginePreviewFile = normalizeLocalPreviewFile(
    options.localEnginePreviewFile
  )
  if (
    localPreviewFile ||
    (localEnginePreviewFile &&
      existsSync(/* turbopackIgnore: true */ localEnginePreviewFile))
  ) {
    const requestedIds = new Set(normalizedIds)
    return (await fetchPublicResourceMapItems(options)).filter((item) =>
      requestedIds.has(item.id)
    )
  }

  const enabled = options.enabled ?? isResourceMapPublicDbEnabled()
  if (!enabled) return []
  const itemIds = normalizedIds.flatMap((id) => {
    if (!id.startsWith("resource_map:")) return []
    const itemId = id.slice("resource_map:".length)
    return RESOURCE_MAP_PUBLIC_ITEM_UUID_PATTERN.test(itemId) ? [itemId] : []
  })
  if (itemIds.length === 0) return []

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase
    .from("resource_map_public_items")
    .select("*")
    .in("item_id", itemIds)
    .returns<ResourceMapPublicItemsView["Row"][]>()
  if (error) {
    console.warn("[resource-map] public item batch lookup unavailable", {
      code: error.code,
      message: error.message,
    })
    return []
  }

  const itemById = new Map(
    (data ?? []).flatMap((row) => {
      const item = buildExternalResourceMapItemFromPublicRow(row)
      return item && shouldShowPublicMapResourceItem(item)
        ? ([[item.id, item]] as const)
        : []
    })
  )
  return withPublicResourceEins(normalizedIds.flatMap((id) => {
    const item = itemById.get(id)
    return item ? [item] : []
  }))
}

export async function fetchPublicResourceMapItemsPageById({
  cursor,
  limit,
  options = {},
}: {
  cursor: string | null
  limit: number
  options?: FetchPublicResourceMapItemsOptions
}): Promise<FetchPublicResourceMapItemsPageResult> {
  const localPreviewFile = normalizeLocalPreviewFile(
    options.localPreviewFile ?? env.RESOURCE_MAP_LOCAL_PREVIEW_FILE
  )
  const localEnginePreviewFile = normalizeLocalPreviewFile(
    options.localEnginePreviewFile
  )
  if (
    localPreviewFile ||
    (localEnginePreviewFile &&
      existsSync(/* turbopackIgnore: true */ localEnginePreviewFile))
  ) {
    const items = (await fetchPublicResourceMapItems(options)).sort(
      (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    )
    const startIndex = cursor ? items.findIndex((item) => item.id > cursor) : 0
    return {
      items:
        startIndex === -1
          ? []
          : items.slice(startIndex, startIndex + limit + 1),
      totalCount: items.length,
    }
  }

  const enabled = options.enabled ?? isResourceMapPublicDbEnabled()
  if (!enabled) return { items: [], totalCount: 0 }

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  let query = supabase
    .from("resource_map_public_items")
    .select("*", { count: "exact" })
    .order("item_id", { ascending: true })
    .limit(limit + 1)
  if (cursor?.startsWith("resource_map:")) {
    const itemId = cursor.slice("resource_map:".length)
    if (RESOURCE_MAP_PUBLIC_ITEM_UUID_PATTERN.test(itemId)) {
      query = query.gt("item_id", itemId)
    }
  }

  const { data, error, count } = await query
  if (error || !data) {
    console.warn("[resource-map] public item page unavailable", {
      code: error?.code,
      message: error?.message,
    })
    return { items: [], totalCount: 0 }
  }

  return {
    items: data
      .map(buildExternalResourceMapItemFromPublicRow)
      .filter((item): item is ExternalResourceMapItem => item !== null)
      .filter(shouldShowPublicMapResourceItem),
    totalCount: count ?? data.length,
  }
}
