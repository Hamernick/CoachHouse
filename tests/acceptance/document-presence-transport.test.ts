import { afterEach, describe, expect, it, vi } from "vitest"
import { workspacePresenceOverHttp } from "@/features/organization-workspace-support/lib/presence-transport"
import { documentFailurePolicy, documentFailureStatus } from "@/features/organization-document-collaboration/lib/editor-state"
import { loggerWarnMock } from "./test-utils"
import { documentTrace, DocumentOperationError } from "@/features/organization-document-collaboration/server/diagnostics"
const input = { organizationId: "org", sessionId: "session", path: "/workspace", position: null, editing: false }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })
describe("presence and persistence failure isolation", () => {
  it("releases a stalled presence request at its deadline and allows another request", async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
    }))
    vi.stubGlobal("fetch", fetcher)
    const pending = workspacePresenceOverHttp(input)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toHaveProperty("error")
    fetcher.mockResolvedValueOnce(Response.json({ participants: [] }))
    await expect(workspacePresenceOverHttp(input)).resolves.toEqual({ participants: [] })
    expect(vi.getTimerCount()).toBe(0)
  })
  it("cancels on scope cleanup without retaining a timeout", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
    })))
    const lifetime = new AbortController()
    const pending = workspacePresenceOverHttp(input, lifetime.signal)
    lifetime.abort()
    await pending
    expect(vi.getTimerCount()).toBe(0)
  })
  it("retries network failures but locks editing on revocation and preserves conflicts", () => {
    expect(documentFailureStatus("denied", false)).toBe("View only")
    expect(documentFailureStatus("denied", true)).toBe("Not saved")
    expect(documentFailureStatus("timeout", false)).toBe("Not connected")
    expect(documentFailurePolicy("timeout")).toMatchObject({ blocked: false, retryable: true })
    expect(documentFailurePolicy("denied")).toMatchObject({ blocked: true, accessDenied: true })
    expect(documentFailurePolicy("external_change")).toMatchObject({ blocked: true, reopenIfClean: true })
    expect(documentFailurePolicy("budget_conflict")).toMatchObject({ blocked: true, reopenIfClean: false })
  })
  it("logs failed stages and committed state without leaking arbitrary provider messages", async () => {
    const warn = loggerWarnMock
    const trace = documentTrace({ organizationId: "org", sectionId: "origin" })
    await trace.measure("commit", async () => true)
    trace.committed()
    const result = trace.failure(new Error("SECRET document text and credentials"))
    expect(result).toMatchObject({ code: "unavailable", retryable: true, requestId: expect.any(String) })
    const log = warn.mock.calls[0][1]
    expect(log).toMatchObject({ stage: "commit", committed: true, requestId: result.requestId })
    expect(JSON.stringify([result, warn.mock.calls])).not.toContain("SECRET")
    expect(trace.failure(new DocumentOperationError("denied", "Read-only"))).toMatchObject({ code: "denied", retryable: false })
  })
})
