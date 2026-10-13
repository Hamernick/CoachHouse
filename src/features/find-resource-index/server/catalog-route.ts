import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { parseFindResourceCatalogQuery, queryFindResourceCatalog } from "../lib/catalog-query"
import { getFindResourceCatalog } from "./catalog"

export async function getFindResourceCatalogResponse(request: Request) {
  const options = parseFindResourceCatalogQuery(new URL(request.url).searchParams)
  if (!options) return NextResponse.json({ error: "Invalid resource query" }, { status: 400 })
  try {
    const catalog = await getFindResourceCatalog()
    const etag = `"${createHash("sha256").update(catalog.revision + JSON.stringify(options)).digest("hex").slice(0, 32)}"`
    const headers = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", ETag: etag }
    if (request.headers.get("if-none-match")?.split(",").map((tag) => tag.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers })
    }
    return NextResponse.json(queryFindResourceCatalog(catalog, options), { headers })
  } catch {
    return NextResponse.json({ error: "Resource directory unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
