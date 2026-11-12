import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({ rows: [] as unknown[], readError: null as unknown, profile: {} as Record<string, unknown>,
  actor: "actor", allowed: [] as string[], access: vi.fn(), rpc: vi.fn(), read: vi.fn(), admin: vi.fn(), stream: vi.fn(), beforeStream: () => {},
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: state.admin }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: () => client }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: state.access }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: async () => ({ orgId: "org", role: "owner" }), canEditOrganization: () => true }))
vi.mock("@/lib/modules/notes-index", () => ({ listUserModuleNotesIndex: async () => [] }))
vi.mock("@/lib/organization/private-storage-response", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/organization/private-storage-response")>(), privateStorageResponse: state.stream,
}))
import { isLegacyDocumentPath, projectLegacyDocumentBindings, readableLegacyDocumentBindings } from "@/lib/organization/legacy-document-bindings"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const reference = (kind = "w9") => ({ kind, path: kind.startsWith("policy:") ? `org/policies/${kind.slice(7)}/file.pdf` : `org/${kind}/file.pdf` })
const row = (kind = "w9", n = 1) => ({ id: id(n), org_id: "org", document_kind: kind, storage_path: reference(kind).path, deleted_at: null })
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
  abortSignal: state.read,
}
const client = {
  auth: { getUser: async () => ({ data: { user: { id: state.actor } }, error: null }) },
  from: (table: string) => {
    if (table !== "organizations") throw new Error("Unexpected route table")
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile: state.profile }, error: null }) }) }) }
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  state.rows = [row()]; state.readError = null; state.actor = "actor"; state.allowed = [id(1)]; state.beforeStream = () => {}
  state.profile = { documents: { w9: { name: "Private file.pdf", path: reference().path, updatedAt: "stamp" } } }
  state.read.mockImplementation(async () => ({ data: state.rows, error: state.readError }))
  state.admin.mockReturnValue({ from: () => query, rpc: state.rpc })
  state.access.mockResolvedValue({ supabase: client, orgId: "org", role: "owner" })
  state.rpc.mockImplementation(async (name: string, args: { p_file_ids?: string[]; p_section_ids?: string[] }) => ({ error: null,
    data: name === "filter_document_file_audience" ? (args.p_file_ids ?? []).filter(value => state.allowed.includes(value)) : name === "filter_workspace_ai_sources" ?
      { fileIds: (args.p_file_ids ?? []).filter(value => state.allowed.includes(value)), sectionIds: args.p_section_ids ?? [] } :
      { blockedSectionIds: [], complete: false },
  }))
  state.stream.mockImplementation(async ({ revalidate }: { revalidate: () => Promise<boolean> }) => {
    state.beforeStream()
    return new Response(await revalidate() ? "bytes" : "denied", { status: await revalidate() ? 200 : 404 })
  })
})

describe("canonical legacy file bindings", () => {
  it("requires exact kind/path/org and passes the canonical ID to current audience checks", async () => {
    expect(await readableLegacyDocumentBindings([reference()], "org", "actor")).toEqual(new Map([["w9", { id: id(1), path: reference().path }]]))
    expect(query.eq).toHaveBeenCalledWith("org_id", "org")
    expect(query.in).toHaveBeenCalledWith("document_kind", ["w9"])
    expect(state.rpc).toHaveBeenCalledWith("filter_document_file_audience", { p_file_ids: [id(1)], p_actor_id: "actor" })
  })
  it.each([[], [{ ...row(), deleted_at: "2026-11-01" }], [{ ...row(), storage_path: "org/w9/replacement.pdf" }]].map(rows => ({ rows })))("withholds missing, deleted or replaced bindings", async ({ rows }) => {
    state.rows = rows
    expect((await readableLegacyDocumentBindings([reference()], "org", "actor")).size).toBe(0)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("rechecks revoked access without cached authority", async () => {
    expect((await readableLegacyDocumentBindings([reference()], "org", "actor")).size).toBe(1)
    state.allowed = []
    expect((await readableLegacyDocumentBindings([reference()], "org", "actor")).size).toBe(0)
    expect(state.read).toHaveBeenCalledTimes(2)
  })
  it.each([null, [{ ...row(), org_id: "foreign" }], [{ ...row(), document_kind: "bylaws" }], [{ ...row(), id: "invalid" }], [row(), row()]].map(rows => ({ rows })))("rejects malformed or substituted lookup results", async ({ rows }) => {
    state.rows = rows as unknown[]
    await expect(readableLegacyDocumentBindings([reference()], "org", "actor")).rejects.toThrow("could not be verified")
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("fails the read on transport or audience verification errors", async () => {
    state.readError = { message: "offline" }
    await expect(readableLegacyDocumentBindings([reference()], "org", "actor")).rejects.toThrow()
    state.readError = null; state.rpc.mockResolvedValue({ error: null, data: [id(99)] })
    await expect(readableLegacyDocumentBindings([reference()], "org", "actor")).rejects.toThrow()
  })
  it.each(["foreign/w9/file.pdf", "org/w9/../file.pdf", "org/w9//file.pdf", "org/w9/", "org/w9/a\\b.pdf", "seed/w9.pdf"])("rejects invalid source path %s before lookup", async path => {
    expect(isLegacyDocumentPath(path, "org", "w9")).toBe(false)
    expect((await readableLegacyDocumentBindings([{ kind: "w9", path }], "org", "actor")).size).toBe(0)
    expect(state.read).not.toHaveBeenCalled()
  })
  it("refuses conflicting profile references and cross-organization AI context", async () => {
    await expect(readableLegacyDocumentBindings([reference(), { kind: "w9", path: "org/w9/other.pdf" }], "org", "actor")).rejects.toThrow("ambiguous")
    await expect(readableLegacyDocumentBindings([reference()], "org", "actor", { organizationId: "foreign", canvasId: null })).rejects.toThrow("scope changed")
    expect(state.read).not.toHaveBeenCalled()
  })
  it("intersects legacy files with the AI workspace instead of using personal grants", async () => {
    state.allowed = []
    expect((await readableLegacyDocumentBindings([reference()], "org", "actor", { organizationId: "org", canvasId: id(8) })).size).toBe(0)
    expect(state.rpc).toHaveBeenCalledWith("filter_workspace_ai_sources", { p_org_id: "org", p_actor_id: "actor", p_canvas_id: id(8), p_file_ids: [id(1)], p_section_ids: [] })
  })
  it("bounds lookups and rejects the whole projection if a later batch fails", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(`policy:p${index}`, index + 1))
    const references = rows.map(value => ({ kind: value.document_kind, path: value.storage_path }))
    state.allowed = rows.map(value => value.id)
    state.read.mockImplementation(async () => ({ error: null, data: rows.filter(value => query.in.mock.lastCall?.[1].includes(value.document_kind)) }))
    expect((await readableLegacyDocumentBindings(references, "org", "actor")).size).toBe(101)
    expect(query.in.mock.calls.map(call => call[1].length)).toEqual([100, 1])
    state.read.mockResolvedValueOnce({ error: null, data: rows.slice(0, 100) }).mockResolvedValueOnce({ error: { message: "offline" }, data: null })
    await expect(projectLegacyDocumentBindings({ policies: rows.map(value => ({ id: value.document_kind.slice(7), document: { path: value.storage_path } })) }, "org", "actor")).rejects.toThrow()
  })
  it("removes denied attachment metadata and policy copies without modifying canonical profile", async () => {
    const profile = { name: "Keep organization", documents: { w9: { name: "Hidden file", path: reference().path }, bylaws: { name: "Malformed" } },
      policies: [{ id: "private", title: "Hidden policy", summary: "Hidden summary", document: { path: reference("policy:private").path } }, { id: "shared", title: "Keep policy", document: null }] }
    const before = JSON.stringify(profile)
    state.rows = [row(), row("policy:private", 2)]; state.allowed = []
    const result = await projectLegacyDocumentBindings(profile, "org", "actor")
    expect(result).toEqual({ name: "Keep organization", documents: {}, policies: [{ id: "shared", title: "Keep policy", document: null }] })
    expect(JSON.stringify(profile)).toBe(before)
    state.allowed = [id(1), id(2)]
    expect(JSON.stringify(await projectLegacyDocumentBindings(profile, "org", "actor"))).toContain("Hidden policy")
  })
  it("applies canonical bindings through the common organization profile projection", async () => {
    state.allowed = []
    const { projectReadableDocumentProfile } = await import("@/lib/organization/document-ai-copies")
    expect((await projectReadableDocumentProfile(state.profile, "org", "actor")).profile.documents).toEqual({})
  })
})

describe.each(["core", "policy"] as const)("%s legacy download boundary", kind => {
  const request = (content = false) => new NextRequest(`http://localhost/api/account/${kind === "core" ? "org-documents?kind=w9" : "org-policies/document?id=p1"}&organizationId=org${content ? "&content=1" : ""}`)
  const read = async (content = false) => kind === "core" ? (await import("@/app/api/account/org-documents/route")).GET(request(content)) : (await import("@/app/api/account/org-policies/document/route")).GET(request(content))
  beforeEach(() => {
    if (kind === "policy") {
      state.rows = [row("policy:p1")]
      state.profile = { policies: [{ id: "p1", title: "Private policy", document: { name: "Private.pdf", path: reference("policy:p1").path, updatedAt: "stamp" } }] }
    }
  })
  it("returns only an authenticated app URL after binding admission", async () => {
    const response = await read()
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store")
    expect((await response.json()).url).toContain("content=1")
    expect(state.stream).not.toHaveBeenCalled()
  })
  it("denies parent scope before canonical file lookup", async () => {
    state.access.mockResolvedValue({ error: "Denied" })
    expect((await read()).status).toBe(403); expect(state.read).not.toHaveBeenCalled()
  })
  it("denies missing/revoked bindings without returning names, paths or content", async () => {
    state.allowed = []
    for (const content of [false, true]) {
      const response = await read(content)
      expect(response.status).toBe(404); expect(await response.text()).not.toMatch(/Private|file.pdf|org\//)
    }
    expect(state.stream).not.toHaveBeenCalled()
  })
  it.each(["revoked", "replaced", "recreated", "deleted"])("withholds bytes when the source is %s during download", async change => {
    state.beforeStream = () => {
      if (change === "revoked") state.allowed = []
      else if (change === "deleted") state.rows = []
      else if (change === "recreated") { state.rows = [{ ...(state.rows[0] as object), id: id(2) }]; state.allowed = [id(2)] }
      else state.rows = [{ ...(state.rows[0] as object), storage_path: "replacement" }]
    }
    expect((await read(true)).status).toBe(404)
    expect(state.stream).toHaveBeenCalledTimes(1)
  })
  it("keeps an unchanged authorized source readable", async () => {
    expect((await read(true)).status).toBe(200)
  })
})

describe.each(["policies", "index"] as const)("legacy %s metadata route", route => {
  it("lists current bindings and removes all restricted attachment metadata on reopening", async () => {
    state.profile = { ...state.profile, policies: [{ id: "p1", title: "Secret policy title", summary: "Secret policy summary", document: { name: "Secret.pdf", path: reference("policy:p1").path } }] }
    state.rows = [row(), row("policy:p1", 2)]; state.allowed = [id(1), id(2)]
    const read = async () => route === "policies" ? (await import("@/app/api/account/org-policies/route")).GET(new NextRequest("http://localhost/api/account/org-policies")) :
      (await import("@/app/api/account/workspace-documents-index/route")).GET(new NextRequest("http://localhost/api/account/workspace-documents-index"))
    const admitted = await read()
    expect(admitted.status).toBe(200); expect(admitted.headers.get("cache-control")).toContain("no-store")
    expect(await admitted.text()).toContain("Secret policy title")
    state.allowed = []
    const denied = await read()
    expect(denied.status).toBe(200); expect(await denied.text()).not.toMatch(/Secret|Private|file.pdf/)
    state.readError = { message: "offline" }
    const unavailable = await read()
    expect(unavailable.status).toBe(500); expect(await unavailable.text()).not.toMatch(/Secret|Private|file.pdf/)
  })
})
