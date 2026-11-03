import "server-only"

import { createHash } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import { formDeletionReceiptSchema, formResponseDirectorySchema, formVersionListSchema, formVersionSchema, formResponseSchema, formResponsePageSchema, formReceiptSchema,
  validateFormSubmission, validateFormAnswers, normalizeFormAnswerInputs } from "../lib"
import type { FormIntakeCommand } from "../lib"

import { runFormSource } from "./source-service"
import { runFormReviewAccess } from "./review-access-service"
import { runFormViewerAccess } from "./viewer-access-service"
import { runFormRecovery } from "./recovery-service"
import { FormIntakeError } from "./intake-error"
export { FormIntakeError } from "./intake-error"
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")

export async function runFormIntake(actorId: string | null, command: FormIntakeCommand) {
  if (command.action === "read_form_source" || command.action === "save_form_source" || command.action === "form_source_entry" || command.action === "form_source_directory") return runFormSource(actorId, command)
  if (command.action === "viewer_invitations" || command.action === "viewer_offer" || command.action === "accept_viewer" || command.action === "invite_viewer" || command.action === "revoke_viewer") return runFormViewerAccess(actorId, command)
  if (command.action === "recoverable_forms" || command.action === "recover_form") return runFormRecovery(actorId, command)
  if (command.action === "source_access" || command.action === "review_access" || command.action === "grant_reviewer" || command.action === "revoke_reviewer") return runFormReviewAccess(actorId, command)
  const admin = createSupabaseAdminClient({ ...(actorId ? { actorId } : {}), requestTimeoutMs: 10_000 })
  if (command.action === "response_forms") {
    if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
    const { data, error } = await admin.rpc("list_accessible_organization_forms", {
      p_actor_id: actorId, p_version_id: command.versionId, p_after: command.after ?? null,
    })
    if (error) throw new FormIntakeError(error.code === "42501" ? 403 : 503, "Unable to load accessible forms.")
    return formResponseDirectorySchema.parse(data)
  }
  if (command.action === "response_versions") {
    if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
    const { data, error } = await admin.rpc("list_organization_form_response_versions", {
      p_actor_id: actorId, p_version_id: command.versionId, p_before: command.before ?? null,
    })
    if (error) throw new FormIntakeError(error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503, "Unable to load form versions.")
    return formVersionListSchema.parse(data)
  }
  if (command.action === "versions") {
    if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
    const { data, error } = await admin.rpc("list_organization_form_versions", {
      p_actor_id: actorId, p_page_id: command.pageId, p_before: command.before ?? null,
    })
    if (error) throw new FormIntakeError(error.code === "42501" ? 403 : 503, "Unable to load form versions.")
    return formVersionListSchema.parse(data)
  }
  async function rpc(input: Json, write = false) {
    const { data, error } = await admin.rpc("organization_form_intake", { p_actor_id: actorId, p_command: input })
    if (error) {
      if (error.code === "P0002") throw new FormIntakeError(410, "This submission was deleted. It cannot be submitted again.")
      if (error.code === "42501") throw new FormIntakeError(403, "This form is no longer available to you.")
      if (error.code === "PT409" || error.code === "40001") throw new FormIntakeError(409, "This response changed. Your edit is still here. Reload before saving again.")
      if (error.code === "23505") throw new FormIntakeError(409, "This request was already used with different answers.")
      if (error.code === "22023") throw new FormIntakeError(400, "Check the form and try again.")
      if (error.code === "54000") throw new FormIntakeError(429, "This form is busy. Wait a minute and retry.")
      throw new FormIntakeError(503, write ? "Unable to confirm. Retry the same request." : "Unable to load this form. Try again.", write)
    }
    return data
  }
  if (command.action === "delete_response") {
    if (!actorId) throw new FormIntakeError(401, "Sign in to continue.")
    const receipt = formDeletionReceiptSchema.parse(await rpc(command, true))
    if (receipt.id !== command.id || receipt.versionId !== command.versionId || receipt.operationId !== command.operationId)
      throw new FormIntakeError(503, "Unable to confirm. Retry the same request.", true)
    return receipt
  }
  if (command.action === "responses")
    return formResponsePageSchema.parse(await rpc(command))
  const versionId = command.action === "submit" ? command.submission.versionId : command.versionId
  const version = formVersionSchema.parse(await rpc({ action: command.action === "submit" ? "version" : "editor_version",
    versionId, ...(command.action === "submit" ? { audience: command.audience } : {}) }))
  if (command.action === "submit") {
    const result = validateFormSubmission(version, command.submission)
    if (!result.ok) throw new FormIntakeError(400, result.issues[0]?.message ?? "Check your answers.")
    // Hash normalized, version-bound answers; corrected canonical values are never
    // used to decide whether the original submission is an exact retry.
    return formReceiptSchema.parse(await rpc({ action: "submit", audience: command.audience,
      versionId, id: result.submission.id, version: JSON.parse(JSON.stringify(version)),
      answers: result.submission.answers, hash: hash(result.submission) }, true))
  }
  const response = formResponseSchema.parse(await rpc({ action: "response", versionId, id: command.id }))
  if (command.action === "response") return response
  const answers = normalizeFormAnswerInputs(version.definition, [
    ...response.answers.filter((answer) => answer.questionId !== command.questionId),
    { questionId: command.questionId, value: command.value },
  ])
  const result = validateFormAnswers(version.definition, answers)
  if (!result.ok) throw new FormIntakeError(400, result.issues[0]?.message ?? "Check this answer.")
  return formResponseSchema.parse(await rpc({ ...command, answers: result.answers,
    version: JSON.parse(JSON.stringify(version)), hash: hash(command) }, true))
}
