import { getFindResourceCatalogResponse } from "../../../../../features/find-resource-index/server/catalog-route"

import { NextResponse } from "next/server"

import {
  FIND_RESOURCE_INDEX_CACHE_CONTROL,
  FIND_RESOURCE_INDEX_VERSION,
  parseFindResourceIndexCursor,
  parseFindResourceIndexLimit,
} from "@/features/find-resource-index"
import { fetchFindResourceIndexPage } from "../../../../../features/find-resource-index/server/actions"

export const revalidate = 300

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  if (searchParams.has("mode")) return getFindResourceCatalogResponse(request)
  const limit = parseFindResourceIndexLimit(searchParams.get("limit"))
  if (limit === null) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 500" },
      { status: 400 }
    )
  }

  const cursor = parseFindResourceIndexCursor(searchParams.get("cursor"))
  if (cursor === undefined) {
    return NextResponse.json({ error: "invalid cursor" }, { status: 400 })
  }
  const page = await fetchFindResourceIndexPage({
    cursor,
    limit,
  })
  const hasMore = page.items.length > limit
  const resourceItems = page.items.slice(0, limit)
  const payload = {
    version: FIND_RESOURCE_INDEX_VERSION,
    resourceItems,
    page: {
      hasMore,
      limit,
      nextCursor: hasMore ? (resourceItems.at(-1)?.id ?? null) : null,
      totalCount: page.totalCount,
    },
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": FIND_RESOURCE_INDEX_CACHE_CONTROL,
    },
  })
}
