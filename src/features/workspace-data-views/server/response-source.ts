import "server-only"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import { runFormIntake, FormIntakeError } from "@/features/organization-forms/server"
import type { DataViewCommand, DataViewResult } from "../lib/schema"

/** The native owner alone validates answers and performs correction CAS/replays. */
export async function runResponseDataView(actorId: string, command: DataViewCommand): Promise<DataViewResult | null> {
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10_000 })
  const rpc = admin.rpc.bind(admin) as unknown as (name: "workspace_response_view_command", args: { p_actor_id: string; p_command: Json }) => PromiseLike<PostgrestSingleResponse<Json>>
  const { data, error } = await rpc("workspace_response_view_command", { p_actor_id: actorId, p_command: command as Json })
  if (error) return { ok: false, code: error.code === "42501" ? "denied" : ["40001", "23505", "55P03"].includes(error.code) ? "conflict" : error.code === "22023" ? "invalid" : "unavailable", error: error.code === "42501" ? "Response access is unavailable. Workspace ownership does not grant response access." : ["40001", "23505", "55P03"].includes(error.code) ? "This response view changed. Review the latest values before retrying." : "Unable to confirm this response-view request. Retry the same request." }
  if (data === null) return null
  if (command.action !== "edit_response_cell") return { ok: true, data }
  const resolved = data as { versionId?: string }
  if (!resolved.versionId) return { ok: false, code: "unavailable", error: "Unable to confirm the response source." }
  try {
    const result = await runFormIntake(actorId, { action: "correct", versionId: resolved.versionId, id: command.rowId,
      operationId: command.requestId, expectedRevision: command.revision, questionId: command.questionId, value: command.value })
    return { ok: true, data: result }
  } catch (failure) {
    if (failure instanceof FormIntakeError) return { ok: false, code: failure.status === 403 || failure.status === 401 ? "denied" : failure.status === 409 ? "conflict" : failure.status === 400 ? "invalid" : "unavailable", error: failure.message }
    return { ok: false, code: "unavailable", error: "Unable to confirm this correction. Retry the same request." }
  }
}
