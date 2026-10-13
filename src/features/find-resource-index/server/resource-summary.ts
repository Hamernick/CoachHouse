import "server-only"
import { NextResponse } from "next/server"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { getFindResourceCatalog } from "./catalog"
import { readPublicNonprofitCount } from "./nonprofit-summary"

export async function resourceSummaryGET() {
  try {
    // Reuse the same cached, public-only sources as the resources page.
    const [nonprofits, catalog, organizations] = await Promise.all([
      readPublicNonprofitCount(),
      getFindResourceCatalog(),
      fetchPublicMapOrganizations(),
    ])
    return NextResponse.json(
      { count: nonprofits + catalog.items.length + organizations.length, estimated: true },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Resource count unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
