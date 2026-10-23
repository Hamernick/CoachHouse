import { beforeEach, describe, expect, it, vi } from "vitest"
import { documentSchema } from "@/features/organization-document-collaboration/lib/schema"
import { EditorState } from "@tiptap/pm/state"
import type { DocumentSession } from "@/features/organization-document-collaboration/types"
const mocks = vi.hoisted(() => ({ context: vi.fn(), path: vi.fn(), tag: vi.fn() }))
vi.mock("@/features/organization-document-collaboration/server/context", () => ({ documentContext: mocks.context }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }))
import { syncOrganizationDocument } from "@/features/organization-document-collaboration/server/actions"

const orgId = "11111111-1111-1111-1111-111111111111"
const sectionId = "mission_vision_values"
const initialDoc = documentSchema.node("doc", null, [documentSchema.node("paragraph", null, documentSchema.text("Hello"))])
const steps = EditorState.create({ doc: initialDoc }).tr.insertText(" world", 6).steps.map(step => step.toJSON())
let session: DocumentSession
let organization: { profile: Record<string, unknown>; updated_at: string; public_slug: string }
let rpc: ReturnType<typeof vi.fn>
function query(table: string) {
  const result = () => ({ data: table === "organizations" ? organization : table === "organization_core_document_sessions" ? session : table === "profiles" ? { full_name: "Verified name" } : [], error: null })
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
    single: vi.fn(async () => result()), maybeSingle: vi.fn(async () => result()), limit: vi.fn(async () => result()),
    upsert: vi.fn(async () => ({ error: null })), delete: vi.fn().mockReturnThis(),
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  }
  return chain
}
const input = () => ({ organizationId: orgId, sectionId, clientId: "actor:tab", generation: "33333333-3333-3333-3333-333333333333", version: 0, steps })
describe("durable collaboration action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    organization = { updated_at: "2026-10-14T00:00:00Z", public_slug: "sample", profile: { name: "Keep me", roadmap: { sections: [{ id: sectionId, content: "<p>Hello</p>", lastUpdated: "2026-10-14T00:00:00Z" }] } } }
    session = { generation: input().generation, version: 0, document: initialDoc.toJSON(), steps: [], section_revision: "2026-10-14T00:00:00Z", section_content: "<p>Hello</p>" }
    rpc = vi.fn(async (_name, args) => {
      session = args.p_state
      if (args.p_profile) organization.profile = args.p_profile
      return { data: true, error: null }
    })
    const admin = { from: (table: string) => query(table), rpc }
    mocks.context.mockResolvedValue({ user: { id: "actor" }, role: "Coach", admin, client: admin })
  })
  it("acknowledges a committed save without waiting on any presence or actor lookup", async () => {
    const from = vi.fn((table: string) => {
      if (!["organizations", "organization_core_document_sessions"].includes(table)) throw new Error("Presence is offline")
      return query(table)
    })
    mocks.context.mockResolvedValue({ user: { id: "actor" }, role: "Coach", admin: { from, rpc }, client: { from } })
    const result = await syncOrganizationDocument(input())
    expect(result).toMatchObject({ session: { version: 1 }, participants: [] })
    expect(rpc).toHaveBeenCalledOnce()
    expect(from.mock.calls.map(([table]) => table)).toEqual(["organizations", "organization_core_document_sessions"])
  })
  it("does not report a failed save when cache revalidation fails after commit", async () => {
    mocks.path.mockImplementationOnce(() => { throw new Error("cache unavailable") })
    expect(await syncOrganizationDocument(input())).toMatchObject({ session: { version: 1 } })
    expect(rpc).toHaveBeenCalledOnce()
  })
  it("returns a retryable safe outcome for database failures", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: { message: "secret provider text", code: "XX000" } })
    const result = await syncOrganizationDocument(input())
    expect(result).toMatchObject({ code: "unavailable", retryable: true, requestId: expect.any(String) })
    expect(JSON.stringify(result)).not.toContain("secret provider text")
    expect(session.version).toBe(0)
  })
  it("returns plain document attributes when opening a new collaboration session", async () => {
    session = { ...session, section_revision: "stale", section_content: "<p>Previous content</p>" }
    const result = await syncOrganizationDocument({ ...input(), generation: undefined, steps: undefined,
      initialDocument: initialDoc.toJSON(), expectedRevision: "2026-10-14T00:00:00Z" })
    expect(result).not.toHaveProperty("error")
    if ("error" in result) throw new Error(result.error)
    expect(Object.getPrototypeOf(result.session?.document.content?.[0].attrs)).toBe(Object.prototype)
    expect(documentSchema.nodeFromJSON(result.session!.document).textContent).toBe("Hello")
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it("retries an unrelated profile race without losing either write", async () => {
    rpc.mockImplementationOnce(async () => {
      organization = { ...organization, updated_at: "2026-10-14T00:00:01Z", profile: { ...organization.profile, name: "Concurrent name" } }
      return { data: false, error: null }
    })
    const result = await syncOrganizationDocument(input())
    expect(result).not.toHaveProperty("error")
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(organization.profile.name).toBe("Concurrent name")
    expect(session.version).toBe(1)
    expect(documentSchema.nodeFromJSON(session.document).textContent).toBe("Hello world")
    expect(mocks.context).toHaveBeenCalledWith(input(), true, expect.any(Object))
  })
  it("acknowledges a duplicate delivery without applying the edit twice", async () => {
    await syncOrganizationDocument(input())
    const second = await syncOrganizationDocument(input())
    expect(second).not.toHaveProperty("error")
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(session.version).toBe(1)
    expect(documentSchema.nodeFromJSON(session.document).textContent).toBe("Hello world")
  })
  it("preserves local work rather than overwriting an external body update", async () => {
    organization.profile = { roadmap: { sections: [{ id: sectionId, content: "External only copy", lastUpdated: "2026-10-14T01:00:00Z" }] } }
    expect(await syncOrganizationDocument(input())).toMatchObject({ code: "external_change" })
    expect(rpc).not.toHaveBeenCalled()
  })
  it("sends no old steps when a viewer has already acknowledged them", async () => {
    await syncOrganizationDocument(input())
    const result = await syncOrganizationDocument({ ...input(), version: 1, steps: undefined })
    expect(result).toMatchObject({ session: { version: 1, steps: [] } })
  })
  it("refuses an expired journal without applying unmergeable edits", async () => {
    session = { ...session, version: 2001, steps: [] }
    expect(await syncOrganizationDocument(input())).toMatchObject({ code: "expired" })
    expect(rpc).not.toHaveBeenCalled()
  })
  it("rejects another user's client identity", async () => {
    expect(await syncOrganizationDocument({ ...input(), clientId: "other:tab" })).toMatchObject({ error: "Invalid editing session." })
    expect(rpc).not.toHaveBeenCalled()
  })
})
