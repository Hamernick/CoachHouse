import { z } from "zod"

export const researchRecoveryCodeSchema = z.enum([
  "verification_unavailable", "sources_changed", "legacy_result", "invalid_result", "scope_mismatch",
  "credits_unavailable", "usage_limit", "capacity_busy", "ai_disabled",
  "invalid_request", "context_too_large", "pricing_changed", "admission_unavailable", "reservation_uncertain", "run_interrupted",
])
export type ResearchRecoveryCode = z.infer<typeof researchRecoveryCodeSchema>

// Fixed, source-free messages. Neither provider prose nor exception text controls recovery.
export const researchRecovery: Record<ResearchRecoveryCode, { message: string; action: "check_status" | "discard" | "edit_request" | "reopen" }> = {
  credits_unavailable: { message: "Not enough available AI credits. Ask the organization owner to review usage, then reopen research.", action: "reopen" },
  usage_limit: { message: "An AI usage limit was reached. Review usage or wait for the limit to reset, then reopen research.", action: "reopen" },
  capacity_busy: { message: "Another AI request is running or recovering. Wait for it to finish, then reopen research.", action: "reopen" },
  ai_disabled: { message: "AI is unavailable for this organization. Ask the organization owner to review access, then reopen research.", action: "reopen" },
  invalid_request: { message: "Research request is invalid or too large. Shorten it and try again.", action: "edit_request" },
  context_too_large: { message: "This plan is too large for one research run. Split it into smaller plans before researching.", action: "reopen" },
  pricing_changed: { message: "Research pricing changed. Close and reopen research to review the current maximum.", action: "reopen" },
  admission_unavailable: { message: "Research could not be started. Close and reopen research to check access and availability.", action: "reopen" },
  reservation_uncertain: { message: "Research reservation could not be confirmed. Check status before starting another run.", action: "check_status" },
  run_interrupted: { message: "Research interrupted. Check status before starting another run.", action: "check_status" },
  verification_unavailable: { message: "Could not verify research sources. Check status to retry.", action: "check_status" },
  sources_changed: { message: "A research source changed or is no longer accessible. Discard this result and research again.", action: "discard" },
  legacy_result: { message: "This saved research predates complete access tracking. Discard this result and research again.", action: "discard" },
  invalid_result: { message: "Saved research could not be validated. Discard this result and research again.", action: "discard" },
  scope_mismatch: { message: "This research belongs to a different workspace or plan. Discard it and reopen research from the current plan.", action: "discard" },
}
