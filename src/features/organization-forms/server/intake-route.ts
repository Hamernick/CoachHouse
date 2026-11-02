import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { formIntakeCommandSchema } from "../lib"
import { FormIntakeError, runFormIntake } from "./intake-service"

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Origin" }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })
async function body(request: Request): Promise<unknown> {
  const limit = 262144
  if (Number(request.headers.get("content-length")) > limit) throw new FormIntakeError(413, "Answers are too large.")
  const reader = request.body?.getReader()
  if (!reader) throw new FormIntakeError(400, "Enter your answers.")
  const chunks: Uint8Array[] = []; let size = 0
  let expired = false
  const timer = setTimeout(() => { expired = true; void reader.cancel() }, 10_000)
  let complete = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) { complete = true; break }
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new FormIntakeError(413, "Answers are too large.") }
      chunks.push(value)
    }
    if (expired) throw new FormIntakeError(408, "Request timed out. Your answers were not submitted.")
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } catch (error) {
    if (error instanceof FormIntakeError) throw error
    throw new FormIntakeError(400, "Invalid form request.")
  } finally { clearTimeout(timer); if (!complete) await reader.cancel().catch(() => {}); reader.releaseLock() }
}

export async function handleFormIntake(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return reply({ error: "Invalid form request.", uncertain: false }, 403)
  let writeStarted = false
  try {
    const parsed = formIntakeCommandSchema.safeParse(await body(request))
    if (!parsed.success) throw new FormIntakeError(400, "Invalid form request.")
    const command = parsed.data
    const anonymous = command.action === "submit" && command.audience === "public"
    if (anonymous && !publicSharingEnabled) throw new FormIntakeError(403, "This form is unavailable.")
    let actorId: string | null = null
    if (!anonymous) {
      const session = await createSupabaseServerClient()
      const { data, error } = await session.auth.getUser()
      if (error || !data.user) throw new FormIntakeError(401, "Sign in to continue.")
      actorId = data.user.id
    }
    writeStarted = (command.action === "save_form_source" || command.action === "accept_viewer" || command.action === "invite_viewer" || command.action === "revoke_viewer" || command.action === "submit" || command.action === "delete_response" || command.action === "correct" || command.action === "recover_form" || command.action === "grant_reviewer" || command.action === "revoke_reviewer")
    return reply({ value: await runFormIntake(actorId, command) })
  } catch (error) {
    if (error instanceof FormIntakeError) return reply({ error: error.message, uncertain: error.uncertain }, error.status)
    // Never log answers, request bodies, database rows or provider error text.
    return reply({ error: writeStarted ? "Unable to confirm. Retry the same request." : "Unable to load responses.", uncertain: writeStarted }, 503)
  }
}
