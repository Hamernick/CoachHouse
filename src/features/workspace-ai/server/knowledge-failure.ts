import "server-only"
/** This code is used only after the same actor can still read the record and a
 * previously observed projection differs. Missing/revoked records stay opaque. */
export class KnowledgeChangedError extends Error {
  constructor() { super("Research context changed. Restart research for current evidence."); this.name = "KnowledgeChangedError" }
}
export function knowledgeReadFailure(id: string, error: unknown) {
  return error instanceof KnowledgeChangedError
    ? { id, status: "changed" as const, recovery: "restart_research" as const, error: "Source changed. Restart research for current evidence." }
    : { id, status: "unavailable" as const, recovery: "retry_read" as const, error: "Contents could not be verified. Retry the read; do not infer their contents." }
}
