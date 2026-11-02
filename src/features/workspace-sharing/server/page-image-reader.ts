import "server-only"

import { createHash } from "node:crypto"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { IMAGE_RESPONSE_HEADERS, imageResponse, imageUnavailable } from "./page-image-response"
import { PUBLIC_IMAGE_OUTPUT_LIMIT } from "./page-asset-image"

const requestSchema = z.strictObject({ assetId: z.uuid(), audience: z.enum(["public", "guest", "editor"]) })
const grantSchema = z.strictObject({
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.int().positive().max(PUBLIC_IMAGE_OUTPUT_LIMIT),
})

/** Every direct request rechecks its own grant, then checks again after I/O.
 * No redirect, signed URL, persistent cache, private source read or stale fallback.
 * Already downloaded/in-flight content cannot be recalled after revocation. */
export async function handlePageImage(request: Request, assetId: string) {
  const input = requestSchema.safeParse({ assetId, audience: new URL(request.url).searchParams.get("audience") ?? "public" })
  if (!input.success || (input.data.audience === "public" && !publicSharingEnabled)) return imageUnavailable()
  const { audience, assetId: validatedId } = input.data
  try {
    const session = audience === "public" ? null : await createSupabaseServerClient()
    async function actor() {
      if (!session) return null
      const { data, error } = await session.auth.getUser()
      if (error || !data.user) throw new Error("Unavailable")
      return data.user.id
    }
    const actorId = await actor()
    const admin = createSupabaseAdminClient({ ...(actorId ? { actorId } : {}), requestTimeoutMs: 10_000 })
    async function authorize() {
      const { data, error } = await admin.rpc("read_workspace_page_image", {
        p_asset_id: validatedId, p_audience: audience, p_actor_id: actorId,
      })
      if (error) throw new Error("Unavailable")
      return grantSchema.safeParse(data)
    }
    const grant = await authorize()
    if (!grant.success) return imageUnavailable()
    const { data, error } = await admin.storage.from("workspace-page-assets").download(grant.data.path, undefined, { signal: AbortSignal.timeout(10_000) })
    if (error || !data || data.size !== grant.data.size) return imageUnavailable(503)
    const bytes = Buffer.from(await data.arrayBuffer())
    if (createHash("sha256").update(bytes).digest("hex") !== grant.data.sha256) return imageUnavailable(503)
    if (await actor() !== actorId) return imageUnavailable()
    const current = await authorize()
    if (!current.success || JSON.stringify(current.data) !== JSON.stringify(grant.data)) return imageUnavailable()
    return imageResponse(bytes)
  } catch {
    return new Response(null, { status: 503, headers: IMAGE_RESPONSE_HEADERS })
  }
}
