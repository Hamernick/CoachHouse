import { randomUUID } from "node:crypto"
import { logger } from "@/lib/logger"
import type { DocumentScope, DocumentErrorCode } from "../types"

export class DocumentOperationError extends Error {
  constructor(public readonly code: DocumentErrorCode, message: string, public readonly providerCode?: string) { super(message) }
}

/** Never include document bodies, arbitrary provider messages, cookies or tokens. */
export function documentTrace(scope: DocumentScope, operation = "sync") {
  const requestId = randomUUID()
  const started = performance.now()
  const organizationId = /^[a-zA-Z0-9_-]{1,160}$/.test(scope.organizationId) ? scope.organizationId : "invalid"
  const sectionId = /^[a-zA-Z0-9_-]{1,160}$/.test(scope.sectionId) ? scope.sectionId : "invalid"
  let stage = "validate"
  let committed = false
  const timings: Record<string, number> = {}
  return {
    requestId,
    committed() { committed = true },
    async measure<T>(name: string, work: () => PromiseLike<T>): Promise<T> {
      stage = name
      const start = performance.now()
      try { return await work() } finally { timings[name] = Math.round(performance.now() - start) }
    },
    failure(error: unknown) {
      const code = error instanceof DocumentOperationError ? error.code : "unavailable"
      const rawCode = error instanceof DocumentOperationError ? error.providerCode
        : error && typeof error === "object" && "code" in error ? error.code : undefined
      const providerCode = typeof rawCode === "string" && /^[A-Z0-9_]{1,16}$/.test(rawCode) ? rawCode : undefined
      if (operation !== "presence" || Math.random() < 0.1) logger.warn("document_operation_failed", { requestId, operation, stage, committed,
        organizationId, sectionId, code, providerCode,
        durationMs: Math.round(performance.now() - started), timings })
      return { error: error instanceof DocumentOperationError ? error.message : "Unable to sync this document. Keep your editor open and try again.",
        code, retryable: code === "unavailable" || code === "timeout", requestId }
    },
    success() {
      if (process.env.LOG_SERVER_TIMINGS === "1") logger.info("document_operation", {
        requestId, operation, committed, organizationId,
        sectionId, durationMs: Math.round(performance.now() - started), timings,
      })
    },
  }
}
