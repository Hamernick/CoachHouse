import "server-only"

export type AiAdmissionDenial = "credits_unavailable" | "usage_limit" | "capacity_busy" | "ai_disabled"

// These exact P0001 exceptions occur only after the existing-run check under
// the admission lock. The RPC transaction rolls back any partial allocation.
// Access, identity, revision, unknown SQL and transport errors are NOT proof
// that an earlier attempt did not commit; they must retain recovery identity.
const denials: Readonly<Record<string, AiAdmissionDenial>> = {
  "Not enough AI credits": "credits_unavailable",
  "AI daily service limit reached": "usage_limit",
  "Organization daily AI service limit reached": "usage_limit",
  "AI provider safety limits are not configured": "ai_disabled",
  "AI daily member limit reached": "usage_limit",
  "AI hourly request limit reached": "usage_limit",
  "Organization monthly AI credit limit reached": "usage_limit",
  "Your monthly AI credit limit reached": "usage_limit",
  "An AI request is already running": "capacity_busy",
  "AI is not enabled for this organization": "ai_disabled",
}

export class AiAdmissionDenied extends Error {
  constructor(readonly reason: AiAdmissionDenial, message: string) {
    super(message)
    this.name = "AiAdmissionDenied"
  }
}

export function reservationError(error: { code?: string; message: string }): Error {
  const reason = error.code === "P0001" && Object.hasOwn(denials, error.message) ? denials[error.message] : undefined
  return reason ? new AiAdmissionDenied(reason, error.message) : new Error(error.message)
}
