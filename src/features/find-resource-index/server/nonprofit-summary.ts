import "server-only"
import { unstable_cache } from "next/cache"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Fixed public projection only: excludes suppressed records and EINs owned by
// platform/curated listings. No user predicates, private rows, or exact scan.
export const readPublicNonprofitCount = unstable_cache(
  async () => {
    const { count, error } = await createSupabaseAdminClient()
      .from("nonprofit_directory_public" as never)
      .select("ein", { count: "planned", head: true })
      .abortSignal(AbortSignal.timeout(3000))
    if (error || count === null || !Number.isSafeInteger(count) || count < 0)
      throw new Error("Count unavailable")
    return count
  },
  ["public-nonprofit-directory-count-v1"],
  { revalidate: 300 }
)

export async function nonprofitSummaryGET() {
  try {
    return NextResponse.json(
      { count: await readPublicNonprofitCount(), estimated: true },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: "Directory count unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
