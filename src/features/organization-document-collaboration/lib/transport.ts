import type { DocumentSyncInput, DocumentSyncResult } from "../types"

// Live document traffic must not wait behind Next's navigation/server-action queue.
export async function syncDocumentOverHttp(input: DocumentSyncInput, signal?: AbortSignal): Promise<DocumentSyncResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener("abort", abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch("/api/account/document-collaboration", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-coach-house-organization-id": input.organizationId },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error("Document request failed")
    return await response.json() as DocumentSyncResult
  } catch {
    return { code: controller.signal.aborted ? "timeout" : "unavailable", retryable: true, error: controller.signal.aborted
      ? "Connecting took too long. Try connecting again. Your edits are retained."
      : "Unable to reach the live document. Try connecting again. Your edits are retained." }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", abort)
  }
}

export async function documentPresenceOverHttp(input: DocumentSyncInput, signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(5000)
  try {
    const response = await fetch("/api/account/document-presence", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "x-coach-house-organization-id": input.organizationId },
      body: JSON.stringify(input), signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    })
    if (!response.ok) throw new Error("Presence unavailable")
    return await response.json() as { participants: import("../types").DocumentParticipant[] } | { error: string }
  } catch { return { error: "Live presence is temporarily unavailable." } }
}
