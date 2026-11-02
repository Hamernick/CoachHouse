import "server-only"
import { researchRecovery, type ResearchRecoveryCode } from "../lib/research-recovery"

export class ResearchRecoveryError extends Error {
  constructor(readonly code: ResearchRecoveryCode) {
    super(researchRecovery[code].message)
    this.name = "ResearchRecoveryError"
  }
}

export function researchRecoveryResponse(error: unknown, fallback: ResearchRecoveryCode = "verification_unavailable") {
  const code = error instanceof ResearchRecoveryError ? error.code : fallback
  return { error: researchRecovery[code].message, failure: { code } }
}
