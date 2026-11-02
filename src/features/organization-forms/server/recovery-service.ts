import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formRecoveryListSchema, formRecoveryReceiptSchema } from "../lib"
import type { FormIntakeCommand } from "../lib"
import { FormIntakeError } from "./intake-error"

export async function runFormRecovery(actorId: string | null, command: Extract<FormIntakeCommand, { action: "recoverable_forms" | "recover_form" }>) {
  if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
  const write = command.action === "recover_form"
  const { data, error } = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10_000 })
    .rpc("organization_form_recovery", { p_actor_id: actorId, p_command: command })
  if (error) {
    if (error.code === "42501") throw new FormIntakeError(403, "Recovery is unavailable. Only the organization owner can recover a form whose manager lost editing access.")
    if (error.code === "40001") throw new FormIntakeError(409, "Form access changed. Reload before trying again.")
    if (error.code === "23505") throw new FormIntakeError(409, "This recovery request was already used. Reload to check access.")
    if (error.code === "22023") throw new FormIntakeError(400, "Invalid recovery request.")
    throw new FormIntakeError(503, write ? "Unable to confirm. Retry the same request." : "Unable to check form recovery.", write)
  }
  return write ? formRecoveryReceiptSchema.parse(data) : formRecoveryListSchema.parse(data)
}
