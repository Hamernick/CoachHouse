import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formSourceDirectorySchema, formSourceEntrySchema, formSourceReceiptSchema, formSourceSchema } from "../lib/form-source"
import type { FormSourceCommand } from "../lib/form-source"
import { FormIntakeError } from "./intake-error"
export async function runFormSource(actorId: string | null, command: FormSourceCommand) {
  if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
  const write = command.action === "save_form_source"
  const { data, error } = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10_000 })
    .rpc("organization_form_source_command", { p_actor_id: actorId, p_command: command })
  if (error) {
    if (error.code === "42501") throw new FormIntakeError(403, "Form editing is unavailable. Your draft is preserved.")
    if (error.code === "40001" || error.code === "23505") throw new FormIntakeError(409, "This form changed. Review the saved form before saving.")
    if (error.code === "22023") throw new FormIntakeError(400, "Check this form and try again.")
    throw new FormIntakeError(503, write ? "Unable to confirm. Retry the same request." : "Unable to load the saved form.", write)
  }
  if (command.action === "form_source_entry") return formSourceEntrySchema.parse(data)
  if (command.action === "form_source_directory") return formSourceDirectorySchema.parse(data)
  return write ? formSourceReceiptSchema.parse(data) : formSourceSchema.parse(data)
}
