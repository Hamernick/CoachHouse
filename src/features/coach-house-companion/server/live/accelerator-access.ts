import type { LiveCompanionContext } from "../../types"
import { CompanionError } from "../errors"

// Local RPC boundary until generated Database types include the unapplied migration.
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }
export async function companionLiveRpc<T>(context: LiveCompanionContext, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (context.supabase as unknown as RpcClient).rpc(name, args)
  if (error) {
    if (error.message?.includes("document_structure")) throw new CompanionError("document_structure", 422, "Open this document in Coach House to update its stored format before using Companion.")
    const codes = ["revision_conflict", "idempotency_conflict", "forbidden", "confirmation_required", "invalid_arguments", "lesson_unavailable"]
    const code = codes.find(value => error.message?.includes(value))
    if (code) throw new CompanionError(code, code.endsWith("conflict") ? 409 : code === "forbidden" ? 403 : 400, code.endsWith("conflict") ? "This work changed. Reload and review before retrying." : code === "forbidden" ? "This account cannot access this organization or Accelerator." : "The request could not be applied. Review the current lesson and required arguments.")
    throw new CompanionError("live_unavailable", 503, "Live Companion data is unavailable. No successful change was confirmed; retry only with the same request ID.")
  }
  return data as T
}
export async function requireLiveActor(context: LiveCompanionContext) {
  const { data, error } = await context.supabase.auth.getUser(context.accessToken)
  if (error || !data.user || data.user.id !== context.userId) throw new CompanionError("unauthorized", 401, "Reconnect Coach House to continue.")
}
export async function requireLiveOrganization(context: LiveCompanionContext, organizationId: string, editOrganization = false) {
  return companionLiveRpc<{ role: string; name: string }>(context, "companion_authorize", { p_org_id: organizationId, p_edit_organization: editOrganization })
}
export function checkLiveRead(error: unknown) {
  if (error) throw new CompanionError("live_unavailable", 503, "Coach House could not load the current record.")
}

export function liveAppUrl(context: LiveCompanionContext, pathname: string) {
  const configured = new URL(context.appOrigin ?? "https://coachhouse.app")
  if (configured.protocol !== "https:" || configured.username || configured.password || configured.pathname !== "/" || configured.search || configured.hash) throw new CompanionError("live_unavailable", 503, "The Coach House application origin is not configured correctly.")
  const target = new URL(pathname, configured.origin)
  if (target.origin !== configured.origin) throw new CompanionError("live_unavailable", 503, "The Coach House destination is unavailable.")
  return target.toString()
}
