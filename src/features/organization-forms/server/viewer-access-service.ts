import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formViewerAcceptanceSchema, formViewerListSchema, formViewerOfferSchema, formViewerReceiptSchema } from "../lib/form-viewer-access"
import type { FormViewerCommand } from "../lib/form-viewer-access"
import { FormIntakeError } from "./intake-error"
export async function runFormViewerAccess(actorId: string | null, command: FormViewerCommand) {
  if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
  const write = ["accept_viewer", "invite_viewer", "revoke_viewer"].includes(command.action)
  const { data, error } = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10_000 })
    .rpc("organization_form_viewer_access", { p_actor_id: actorId, p_command: command })
  if (error) {
    if (error.code === "42501") throw new FormIntakeError(403, "This invitation is unavailable for this account.")
    if (error.code === "40001" || error.code === "23505") throw new FormIntakeError(409, "Access changed. Reload before trying again.")
    if (error.code === "22023") throw new FormIntakeError(400, "Check the email and response permission.")
    if (error.code === "54000") throw new FormIntakeError(400, "This form supports up to 50 invited collaborators.")
    throw new FormIntakeError(503, write ? "Unable to confirm. Retry the same request." : "Unable to load invitations.", write)
  }
  if (command.action === "viewer_invitations") return formViewerListSchema.parse(data)
  if (command.action === "viewer_offer") return formViewerOfferSchema.parse(data)
  if (command.action === "accept_viewer") return formViewerAcceptanceSchema.parse(data)
  return formViewerReceiptSchema.parse(data)
}
