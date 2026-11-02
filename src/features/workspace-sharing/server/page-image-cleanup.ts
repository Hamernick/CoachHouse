import "server-only"

import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/** Only unused, expired copies; current reviewed assets and original Documents are
 * excluded. Storage remove is idempotent; failures remain eligible next sweep. */
export async function handlePageImageCleanup(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  const secret = process.env.INTERNAL_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get("authorization")
  const expected = secret ? `Bearer ${secret}` : null
  if (!expected || !supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers })
  try {
    const admin = createSupabaseAdminClient({ requestTimeoutMs: 15_000 })
    const { data, error } = await admin.rpc("workspace_page_image_orphans", {})
    const paths = z.array(z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(webp|txt)$/)).max(100).safeParse(data)
    if (error || !paths.success) throw new Error("Unavailable")
    if (paths.data.length) {
      const removed = await admin.storage.from("workspace-page-assets").remove(paths.data)
      if (removed.error) throw new Error("Unavailable")
    }
    // Grant retirement has its own smaller bound. A nonempty batch requires
    // another pass; only an empty pass reports no candidates at that moment.
    return Response.json({ removed: paths.data.length, morePossible: paths.data.length > 0 }, { headers })
  } catch { return Response.json({ error: "Asset cleanup unavailable" }, { status: 503, headers }) }
}
