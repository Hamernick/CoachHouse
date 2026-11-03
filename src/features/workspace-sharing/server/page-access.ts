import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { pageAccessCommandSchema, pageAccessDataSchema } from "../lib/page-access"
import { canonicalDrivePublicLink } from "../lib/drive-public-link"
import { publicationHash, WorkspaceSharingError } from "./page-projection"

/** Deliberately does not resolve an active organization or grant membership. */
export async function executePageAccess(input: unknown) {
  const parsed = pageAccessCommandSchema.safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Review these page details.")
  const session = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await session.auth.getUser()
  if (authError || !user) return { signInRequired: true as const }
  const { pageId, ...command } = parsed.data
  const admin = createSupabaseAdminClient({ actorId: user.id, requestTimeoutMs: 15_000 })
  const { data, error } = await admin.rpc("workspace_page_guest_command", {
    p_actor_id: user.id, p_page_id: pageId, p_command: command, p_hash: publicationHash(command),
  })
  if (error) {
    if (error.code === "42501") throw new WorkspaceSharingError("scope", "This page or invitation is unavailable for this account.")
    if (error.code === "PT409" || error.code === "40001") throw new WorkspaceSharingError("conflict", "This page changed. Reload before saving.")
    if (error.code === "22023" || error.code === "23505") throw new WorkspaceSharingError("invalid", "This request cannot be applied. Reload the page.")
    throw new WorkspaceSharingError("unavailable", "Unable to confirm. Retry the same request.", true)
  }
  const value = pageAccessDataSchema.parse(data)
  if (value.pageId !== pageId || value.snapshot.items.some(({ content }) =>
    (content.kind === "drive_link" && canonicalDrivePublicLink(content.href) !== content.href)))
    throw new WorkspaceSharingError("scope", "This page is unavailable.")
  return { signInRequired: false as const, value }
}
