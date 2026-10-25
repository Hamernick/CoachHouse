import "server-only"

import { cache } from "react"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { canonicalDrivePublicLink, workspacePageSnapshotSchema } from "../lib"

const address = z.strictObject({
  organizationSlug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  linkId: z.uuid(),
})
const published = z.strictObject({
  snapshot: workspacePageSnapshotSchema,
  publishedAt: z.iso.datetime({ offset: true }),
})

/** Request-local deduplication only. Never persistently cache visibility or
 * render a cached snapshot before checking current publication state. One
 * indexed DB lookup, no user session, source lookups, Google calls or bytes. */
export const loadPublicWorkspacePage = cache(async (organizationSlug: string, linkId: string) => {
  if (!publicSharingEnabled) return null
  const input = address.safeParse({ organizationSlug, linkId })
  if (!input.success) return null
  const supabase = createSupabaseAdminClient({ requestTimeoutMs: 10_000 })
  const { data, error } = await supabase.rpc("read_workspace_page_public", {
    p_organization_slug: input.data.organizationSlug, p_link_id: input.data.linkId,
  })
  if (error) throw new Error("This shared page is temporarily unavailable.")
  if (data === null) return null
  const result = published.safeParse(data)
  if (!result.success || result.data.snapshot.brand.organizationSlug !== organizationSlug) return null
  // DTO asset shapes are reserved for future explicit public grants. No upload
  // bytes or guessed storage paths can be exposed by a malformed stored row.
  if (result.data.snapshot.items.some(({ content }) =>
    content.kind === "image" || content.kind === "document"
    || (content.kind === "drive_link" && canonicalDrivePublicLink(content.href) !== content.href))) return null
  return result.data
})
