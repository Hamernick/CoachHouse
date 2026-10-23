import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultDocumentTransport } from "@/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller"
import { documentSchema } from "@/features/organization-document-collaboration/lib/schema"
import { handleDocumentCollaborationPost } from "@/features/organization-document-collaboration/server/route"
import { syncOrganizationDocument } from "@/features/organization-document-collaboration/server/sync-document"
vi.mock("@/features/organization-document-collaboration/server/sync-document", () => ({ syncOrganizationDocument: vi.fn() }))

vi.mock("@/features/organization-document-collaboration/server/actions", () => ({
  syncOrganizationDocument: vi.fn(), leaveOrganizationDocument: vi.fn(), loadOrganizationDocumentVersions: vi.fn(),
}))
const input = { organizationId: "11111111-1111-1111-1111-111111111111", sectionId: "need", clientId: "actor:tab", version: 0 }
const url = "https://coachhouse.app/api/account/document-collaboration"
const request = (body: unknown = input, origin = "https://coachhouse.app") => new Request(url, {
  method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks() })

describe("live document HTTP transport", () => {
  it("opens independently of a stalled server action and serializes real ProseMirror attrs", async () => {
    vi.mocked(syncOrganizationDocument).mockImplementation(() => new Promise(() => {}))
    const doc = documentSchema.node("doc", null, [documentSchema.node("paragraph", { textAlign: "center" })]).toJSON()
    const fetchMock = vi.fn(async () => Response.json({ section: { content: "" }, session: null, participants: [], userId: "actor" }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(defaultDocumentTransport.sync({ ...input, initialDocument: doc })).resolves.toHaveProperty("userId", "actor")
    expect(syncOrganizationDocument).not.toHaveBeenCalled()
    const [endpoint, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe("/api/account/document-collaboration")
    expect(options).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store" })
    expect(new Headers(options.headers).get("x-coach-house-organization-id")).toBe(input.organizationId)
    expect(JSON.parse(String(options.body)).initialDocument.content[0].attrs.textAlign).toBe("center")
  })
  it("aborts a stalled request and permits a fresh retry", async () => {
    vi.useFakeTimers()
    let aborted = false
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")) })
    }))
    vi.stubGlobal("fetch", fetchMock)
    const pending = defaultDocumentTransport.sync(input)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await pending).toMatchObject({ error: expect.stringContaining("took too long") })
    expect(aborted).toBe(true)
    fetchMock.mockResolvedValueOnce(Response.json({ userId: "actor" }))
    await expect(defaultDocumentTransport.sync(input)).resolves.toEqual({ userId: "actor" })
    expect(vi.getTimerCount()).toBe(0)
  })
  it("turns failed or non-JSON responses into a retryable error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>"))
    vi.stubGlobal("fetch", fetchMock)
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(defaultDocumentTransport.sync(input)).resolves.toMatchObject({ error: expect.stringContaining("Try connecting again") })
    }
  })
})

describe("document sync route", () => {
  it("preserves the existing action authorization result and does not cache it", async () => {
    vi.mocked(syncOrganizationDocument).mockResolvedValue({ error: "Document access denied." })
    const response = await handleDocumentCollaborationPost(request())
    expect(await response.json()).toEqual({ error: "Document access denied." })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(syncOrganizationDocument).toHaveBeenCalledWith(input)
  })
  it("rejects cross-origin, missing-origin, malformed and oversized requests before document access", async () => {
    expect((await handleDocumentCollaborationPost(request(input, "https://other.example"))).status).toBe(403)
    expect((await handleDocumentCollaborationPost(request(input, ""))).status).toBe(403)
    expect((await handleDocumentCollaborationPost(request(null))).status).toBe(400)
    expect((await handleDocumentCollaborationPost(request({ ...input, clientId: null }))).status).toBe(400)
    expect((await handleDocumentCollaborationPost(request({ ...input, extra: "x".repeat(1_000_000) }))).status).toBe(413)
    expect(syncOrganizationDocument).not.toHaveBeenCalled()
  })
})
