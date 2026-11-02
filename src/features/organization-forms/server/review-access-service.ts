import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formReviewAccessSchema, formSourceAccessSchema, formRecoveryReceiptSchema } from "../lib"
import type { FormIntakeCommand } from "../lib"
import { FormIntakeError } from "./intake-error"

export async function runFormReviewAccess(actorId: string | null, command: Extract<FormIntakeCommand, { action: "source_access" | "review_access" | "grant_reviewer" | "revoke_reviewer" }>) {
  if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
  const write = command.action === "grant_reviewer" || command.action === "revoke_reviewer"
  const { data, error } = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10_000 })
    .rpc("organization_form_review_access", { p_actor_id: actorId, p_command: command })
  if (error) {
    if (error.code === "42501") throw new FormIntakeError(403, "You do not have access to this form action.")
    if (error.code === "40001" || error.code === "23505") throw new FormIntakeError(409, "Response access changed. Reload before trying again.")
    if (error.code === "22023") throw new FormIntakeError(400, "Enter the verified email of the organization owner or an existing editor.")
    if (error.code === "54000") throw new FormIntakeError(400, "This form supports up to 50 reviewers.")
    throw new FormIntakeError(503, write ? "Unable to confirm. Retry the same request." : "Unable to load response access.", write)
  }
  return command.action === "source_access" ? formSourceAccessSchema.parse(data) : write ? formRecoveryReceiptSchema.parse(data) : formReviewAccessSchema.parse(data)
}
