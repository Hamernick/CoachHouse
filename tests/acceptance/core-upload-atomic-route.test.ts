import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const org = "00000000-0000-4000-8000-000000000001"
const state = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>, file: null as Record<string, unknown> | null,
  admin: vi.fn(), cleanupRemove: vi.fn(),
  pending: [] as Array<{ path: string; fileId: string; kind: string }>, stored: new Set<string>(), rpc: vi.fn(),
  stages: new Map<string, { kind: string; state: string }>(),
  mutation: vi.fn(), upload: vi.fn(), remove: vi.fn(), notify: vi.fn(), from: vi.fn(), storageAccess: vi.fn(), cleanupError: null as { message: string } | null, afterCommit: () => {},
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: state.admin }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: () => client }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: async () => ({ supabase: client, orgId: org, role: "owner" }) }))
vi.mock("@/lib/organization/active-org", () => ({ canEditOrganization: (role: string) => role === "owner", resolveActiveOrganization: async () => ({ orgId: org, role: "owner" }) }))
vi.mock("@/lib/organization/document-storage-access", () => ({ requireOrganizationDocumentStorage: state.storageAccess }))
vi.mock("@/lib/organization/profile-mutation", () => ({ mutateOrganizationProfile: state.mutation }))
vi.mock("@/lib/notifications", () => ({ createNotification: state.notify }))

const client = {
  auth: { getUser: async () => ({ data: { user: { id: org } }, error: null }) },
  storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
  from: state.from,
}
type Mutation = { mutate: (profile: Record<string, unknown>) => { changed?: boolean; error?: string; status?: number; nextProfile?: Record<string, unknown>; value?: unknown } }
const previous = `${org}/w9/previous.pdf`
beforeEach(() => {
  vi.clearAllMocks()
  state.profile = { unrelated: "preserved", documents: { w9: { path: previous, name: "Previous", size: 3, mime: "application/pdf" } } }
  state.admin.mockReturnValue({ rpc: state.rpc, storage: { from: () => ({ remove: state.cleanupRemove, upload: state.upload }) } })
  state.cleanupRemove.mockImplementation((paths: string[]) => state.remove(paths))
  state.pending = []; state.stored = new Set([previous]); state.stages = new Map()
  state.cleanupError = null
  state.file = { id: "00000000-0000-4000-8000-000000000011", org_id: org, document_kind: "w9", storage_path: previous, size_bytes: 3, deleted_at: null }; state.afterCommit = () => {}
  state.storageAccess.mockResolvedValue({ hasStorageAccess: true }); state.upload.mockImplementation(async (path: string) => { state.stored.add(path); return { error: null } })
  state.remove.mockImplementation(async (paths: string[]) => { paths.forEach(path => state.stored.delete(path)); return { error: null } }); state.notify.mockResolvedValue({})
  state.mutation.mockImplementation(async ({ mutate }: Mutation) => {
    const result = mutate(state.profile)
    if (result.error) return { error: result.error, status: result.status }
    if (result.nextProfile && result.changed !== false) {
      state.profile = result.nextProfile
      if (state.file) {
        const kind = String(state.file.document_kind)
        const current = kind.startsWith("policy:")
          ? (state.profile.policies as Array<{ id: string; document?: unknown }>)?.find(p => `policy:${p.id}` === kind)?.document
          : (state.profile.documents as Record<string, unknown>)?.[kind]
        const document = current as { path: string; size: number } | undefined
        if (((!document && !state.file.deleted_at) || (document && document.path !== state.file.storage_path)) && !state.pending.some(item => item.path === state.file?.storage_path))
          state.pending.push({ path: String(state.file.storage_path), fileId: String(state.file.id), kind })
        if (!document) state.file.deleted_at = "2026-11-11T00:00:00Z"
        else {
          Object.assign(state.file, { storage_path: document.path, size_bytes: document.size, deleted_at: null })
          const stage = state.stages.get(document.path)
          if (stage) stage.state = "committed"
        }
      }
    }
    state.afterCommit()
    return { ok: true, value: result.value }
  })
  state.from.mockImplementation(() => { throw Error("Unexpected direct table mutation") })
  state.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
    if (name === "reserve_legacy_document_upload") {
      state.stages.set(args.p_path, { kind: args.p_kind, state: "staged" })
      return { error: null, data: { path: args.p_path, state: "staged" } }
    }
    if (name === "abandon_legacy_document_upload") {
      const stage = state.stages.get(args.p_path)
      if (!stage) return { error: { message: "Missing" }, data: null }
      if (stage.state === "staged") stage.state = "abandoned"
      return { error: null, data: stage.state }
    }
    if (name === "reserve_legacy_document_stage_cleanup") return { error: null, data: [...state.stages].filter(([path, stage]) =>
      stage.state === "abandoned" && (!args.p_path || path === args.p_path)).map(([path, stage]) => ({ path, kind: stage.kind })) }
    if (name === "finish_legacy_document_stage_cleanup") {
      if (state.cleanupError || state.stored.has(args.p_path)) return { data: false, error: state.cleanupError }
      state.stages.get(args.p_path)!.state = "cleaned"
      return { data: true, error: null }
    }
    if (name === "reserve_legacy_document_cleanup") return { error: null, data: state.pending.filter(item =>
      !args.p_kind || item.path.startsWith(args.p_kind.startsWith("policy:") ? `${org}/policies/${args.p_kind.slice(7)}/` : `${org}/${args.p_kind}/`)) }
    if (name !== "finish_legacy_document_cleanup") throw Error("Unexpected cleanup RPC")
    if (state.cleanupError || state.stored.has(args.p_path)) return { data: false, error: state.cleanupError }
    state.pending = state.pending.filter(item => item.path !== args.p_path)
    if (state.file?.storage_path === args.p_path && state.file.deleted_at) state.file.size_bytes = 0
    return { data: true, error: null }
  })
})
const request = (method: string, body?: BodyInit) => new NextRequest(`http://localhost/api/account/org-documents?kind=w9&organizationId=${org}`, { method, body })
const upload = async () => {
  const form = new FormData(); form.set("file", new File(["PDF"], "w9.pdf", { type: "application/pdf" }))
  return (await import("@/app/api/account/org-documents/route")).POST(request("POST", form))
}

describe("atomic core upload route", () => {
  it("commits through the profile owner and cleans the previous path only after success", async () => {
    const response = await upload()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    expect(state.upload.mock.calls[0][0]).toMatch(new RegExp(`^${org}/w9/[a-f0-9-]{36}-w9.pdf$`))
    expect(state.profile.unrelated).toBe("preserved")
    expect(state.from).not.toHaveBeenCalled()
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([previous])
    expect(state.mutation.mock.invocationCallOrder[0]).toBeLessThan(state.remove.mock.invocationCallOrder[0])
    expect(state.notify).toHaveBeenCalledTimes(1)
    expect(state.admin).toHaveBeenCalledWith({ actorId: org, requestTimeoutMs: 10000 })
    expect(state.cleanupRemove).toHaveBeenCalledExactlyOnceWith([previous])
  })
  it("allocates independent Storage paths for simultaneous same-name uploads", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1)
    try {
      await Promise.all([upload(), upload()])
      expect(new Set(state.upload.mock.calls.map(call => call[0])).size).toBe(2)
    } finally { clock.mockRestore() }
  })
  it.each([
    { error: "Organization document storage quota exceeded.", status: 500, expected: 413 },
    { error: "Organization data changed", status: 409, expected: 409 },
  ])("cleans only its staged upload when profile commit fails: $expected", async failure => {
    const profile = JSON.stringify(state.profile), file = JSON.stringify(state.file)
    state.mutation.mockResolvedValue(failure)
    const response = await upload()
    expect(response.status).toBe(failure.expected)
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([state.upload.mock.calls[0][0]])
    expect(state.from).not.toHaveBeenCalled(); expect(state.notify).not.toHaveBeenCalled()
    expect(state.cleanupRemove).toHaveBeenCalledExactlyOnceWith([state.upload.mock.calls[0][0]])
    expect(JSON.stringify(state.profile)).toBe(profile); expect(JSON.stringify(state.file)).toBe(file)
  })
  it("does not begin a profile save after Storage refuses the upload", async () => {
    state.upload.mockResolvedValue({ error: { message: "Upload failed" } })
    expect((await upload()).status).toBe(500)
    expect(state.mutation).not.toHaveBeenCalled()
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([state.upload.mock.calls[0][0]])
  })
  it("reserves durable capacity before bytes and preserves it when rollback cleanup fails", async () => {
    state.mutation.mockResolvedValue({ error: "Organization data changed", status: 409 })
    state.remove.mockResolvedValue({ error: { message: "Storage unavailable" } })
    expect((await upload()).status).toBe(409)
    const path = state.upload.mock.calls[0][0]
    expect(state.stages.get(path)?.state).toBe("abandoned")
    expect(state.stored.has(path)).toBe(true)
    const reservation = state.rpc.mock.calls.findIndex(call => call[0] === "reserve_legacy_document_upload")
    expect(state.rpc.mock.invocationCallOrder[reservation]).toBeLessThan(state.upload.mock.invocationCallOrder[0])
    state.remove.mockImplementation(async (paths: string[]) => { paths.forEach(path => state.stored.delete(path)); return { error: null } })
    const { PATCH } = await import("@/app/api/account/org-documents/route")
    await PATCH(request("PATCH", JSON.stringify({ name: "Retry" })))
    expect(state.stages.get(path)?.state).toBe("cleaned")
    expect(state.stored.has(path)).toBe(false)
  })
  it("recovers an upload whose response throws after storing bytes", async () => {
    state.upload.mockImplementation(async (path: string) => { state.stored.add(path); throw Error("Lost upload reply") })
    expect((await upload()).status).toBe(500)
    const path = state.upload.mock.calls[0][0]
    expect(state.stages.get(path)?.state).toBe("cleaned")
    expect(state.stored.has(path)).toBe(false)
    expect(state.mutation).not.toHaveBeenCalled()
  })
  it("does not delete a committed upload after the profile response is lost", async () => {
    state.afterCommit = () => { throw Error("Lost commit reply") }
    expect((await upload()).status).toBe(500)
    const path = state.upload.mock.calls[0][0]
    expect(state.stages.get(path)?.state).toBe("committed")
    expect(state.stored.has(path)).toBe(true)
    expect(state.remove).not.toHaveBeenCalled()
    expect(state.file?.storage_path).toBe(path)
  })
  it("cleans its stage when the policy disappears after reservation", async () => {
    state.profile.policies = [{ id: "missing", title: "Concurrent policy" }]
    state.upload.mockImplementation(async (path: string) => { state.stored.add(path); state.profile.policies = []; return { error: null } })
    const form = new FormData(); form.set("file", new File(["PDF"], "policy.pdf", { type: "application/pdf" }))
    const { POST } = await import("@/app/api/account/org-policies/document/route")
    expect((await POST(new NextRequest("http://localhost/api/account/org-policies/document?id=missing", { method: "POST", body: form }))).status).toBe(404)
    const path = state.upload.mock.calls[0][0]
    expect(state.stages.get(path)?.state).toBe("cleaned")
    expect(state.stored.has(previous)).toBe(true)
    expect(state.stored.has(path)).toBe(false)
  })
  it("retains the existing native storage entitlement boundary", async () => {
    state.storageAccess.mockResolvedValue({ error: "Upgrade required" })
    expect((await upload()).status).toBe(403)
    expect(state.upload).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled()
  })
  it("renames only through the profile transaction", async () => {
    const { PATCH } = await import("@/app/api/account/org-documents/route")
    expect((await PATCH(request("PATCH", JSON.stringify({ name: "Renamed" })))).status).toBe(200)
    expect(state.profile.documents).toMatchObject({ w9: { name: "Renamed", path: previous } })
    expect(state.from).not.toHaveBeenCalled()
  })
  it("old deletion cleanup cannot erase a concurrent replacement's tracked row", async () => {
    const replacement = `${org}/w9/replacement.pdf`
    state.afterCommit = () => {
      state.file = { org_id: org, document_kind: "w9", storage_path: replacement }
      state.profile = { documents: { w9: { path: replacement, name: "Concurrent replacement" } } }
    }
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([previous])
    expect(state.file?.storage_path).toBe(replacement)
    expect(state.profile.documents).toMatchObject({ w9: { path: replacement } })
  })
  it("releases bytes after deletion while retaining canonical identity", async () => {
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.file).toMatchObject({ id: "00000000-0000-4000-8000-000000000011", size_bytes: 0, storage_path: previous })
    expect(state.file?.deleted_at).toBeTruthy()
  })
  it("retains quota when Storage deletion fails", async () => {
    state.remove.mockResolvedValue({ error: { message: "Storage unavailable" } })
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.file).toMatchObject({ id: "00000000-0000-4000-8000-000000000011", size_bytes: 3 })
    expect(state.from).not.toHaveBeenCalled()
  })
  it("retains quota when the database rejects cleanup accounting", async () => {
    state.cleanupError = { message: "Object still present" }
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.file).toMatchObject({ id: "00000000-0000-4000-8000-000000000011", size_bytes: 3 })
  })
  it("an already-empty slot does not remove an unrelated retained tracking row", async () => {
    state.profile = { documents: {} }
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.from).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled()
    expect(state.file?.storage_path).toBe(previous)
  })
  it("retries failed deletion after its profile slot disappears", async () => {
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    state.remove.mockResolvedValueOnce({ error: { message: "Storage unavailable" } })
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.pending).toHaveLength(1)
    expect(state.file?.size_bytes).toBe(3)
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.pending).toEqual([])
    expect(state.file).toMatchObject({ size_bytes: 0, id: "00000000-0000-4000-8000-000000000011" })
  })
  it("retries failed replacement accounting without touching the current upload", async () => {
    state.cleanupError = { message: "Database unavailable" }
    expect((await upload()).status).toBe(200)
    const current = state.file?.storage_path
    expect(state.pending).toHaveLength(1)
    state.cleanupError = null
    const { PATCH } = await import("@/app/api/account/org-documents/route")
    expect((await PATCH(request("PATCH", JSON.stringify({ name: "Retry" })))).status).toBe(200)
    expect(state.pending).toEqual([])
    expect(state.file?.storage_path).toBe(current)
    expect(state.remove.mock.calls.every(([paths]) => !paths.includes(current))).toBe(true)
  })
  it("a later write retries a removed policy's durable queue", async () => {
    const path = `${org}/policies/deleted-policy/old.pdf`
    state.pending = [{ path, fileId: "00000000-0000-4000-8000-000000000012", kind: "policy:deleted-policy" }]
    const { PATCH } = await import("@/app/api/account/org-documents/route")
    expect((await PATCH(request("PATCH", JSON.stringify({ name: "Renamed" })))).status).toBe(200)
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([path])
    expect(state.pending).toEqual([])
  })
  it("does not retry the same failed path twice in one request", async () => {
    state.pending = [{ path: previous, fileId: "00000000-0000-4000-8000-000000000011", kind: "w9" }]
    state.profile = { documents: {} }; state.file!.deleted_at = "2026-11-11T00:00:00Z"
    state.remove.mockResolvedValue({ error: { message: "Storage unavailable" } })
    const { DELETE } = await import("@/app/api/account/org-documents/route")
    expect((await DELETE(request("DELETE"))).status).toBe(200)
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([previous])
    expect(state.pending).toHaveLength(1)
  })
  it.each(["denied", "foreign", "duplicate", "malformed", "throw"])("fails closed for %s cleanup receipts", async mode => {
    const receipt = { path: previous, fileId: "00000000-0000-4000-8000-000000000011", kind: "w9" }
    state.rpc.mockImplementation(async (name: string) => {
      if (name === "reserve_legacy_document_stage_cleanup") return { error: null, data: [] }
      if (mode === "throw") throw Error("Transport unavailable")
      return mode === "denied" ? { error: { message: "Forbidden" }, data: null }
        : { error: null, data: mode === "foreign" ? [{ ...receipt, path: `another-org/w9/file.pdf` }]
          : mode === "duplicate" ? [receipt, receipt] : [{ ...receipt, fileId: "invalid" }] }
    })
    const { PATCH } = await import("@/app/api/account/org-documents/route")
    expect((await PATCH(request("PATCH", JSON.stringify({ name: "Renamed" })))).status).toBe(200)
    expect(state.remove).not.toHaveBeenCalled()
  })

  it.each(["attachment", "policy"] as const)("retains identity after deleting a %s", async kind => {
    const policyPath = `${org}/policies/retention-policy/document.pdf`
    state.profile.policies = [{ id: "retention-policy", title: "Retention", document: { path: policyPath, name: "Policy", size: 3, mime: "application/pdf" } }]
    state.file = { id: "00000000-0000-4000-8000-000000000012", org_id: org, document_kind: "policy:retention-policy", storage_path: policyPath, size_bytes: 3, deleted_at: null }
    const route = kind === "attachment" ? await import("@/app/api/account/org-policies/document/route") : await import("@/app/api/account/org-policies/route")
    const response = await route.DELETE(new NextRequest("http://localhost/api/account/org-policies?id=retention-policy", { method: "DELETE" }))
    expect(response.status).toBe(200)
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([policyPath])
    expect(state.file).toMatchObject({ id: "00000000-0000-4000-8000-000000000012", size_bytes: 0 })
    expect(state.file?.deleted_at).toBeTruthy()
    expect(state.profile.unrelated).toBe("preserved")
  })

})

describe("legacy mutation response privacy", () => {
  const policy = { id: "retention-policy", title: "Private title", summary: "Private summary", document: { path: `${org}/policies/retention-policy/secret.pdf`, name: "Secret.pdf", size: 3, mime: "application/pdf" } }
  it.each([
    ["core", "POST"], ["core", "PATCH"], ["core", "DELETE"],
    ["policy", "POST"], ["policy", "PATCH"], ["policy", "DELETE"],
    ["attachment", "POST"], ["attachment", "DELETE"],
  ] as const)("%s %s acknowledges the write without source metadata or sibling records", async (kind, method) => {
    state.profile.policies = [policy, { ...policy, id: "another-policy", title: "Another private policy" }]
    if (kind !== "core") state.file = { id: "00000000-0000-4000-8000-000000000012", org_id: org, document_kind: `policy:${policy.id}`, storage_path: policy.document.path, size_bytes: 3, deleted_at: null }
    const route = kind === "core" ? await import("@/app/api/account/org-documents/route")
      : kind === "policy" ? await import("@/app/api/account/org-policies/route")
      : await import("@/app/api/account/org-policies/document/route")
    const form = new FormData(); form.set("file", new File(["PDF"], "Private.pdf", { type: "application/pdf" }))
    const body = method === "DELETE" ? undefined : kind !== "policy" && method === "POST" ? form : JSON.stringify({ id: policy.id, title: "Saved title", name: "Saved filename" })
    // A completed write grants no continued read authority. Even if the source
    // disappears before delivery, its old snapshot must never escape the route.
    state.afterCommit = () => { state.profile = {} }
    const handler = route[method as keyof typeof route] as (request: NextRequest) => Promise<Response>
    const response = await handler(new NextRequest(`http://localhost/api/account/test?kind=w9&id=${policy.id}`, { method, body }))
    expect(response.status).toBe(200)
    const result = await response.json()
    if (kind === "policy" && method !== "DELETE") {
      expect(result).toEqual({ ok: true, policyId: expect.any(String) })
      if (method === "PATCH") expect(result.policyId).toBe(policy.id)
    } else expect(result).toEqual({ ok: true })
    expect(response.headers.get("cache-control")).toContain("private, no-store")
    expect(response.headers.get("cdn-cache-control")).toBe("no-store")
    expect(state.mutation).toHaveBeenCalledOnce()
  })

  it("the client accepts acknowledgments without rebuilding document metadata", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, policyId: "new-policy" }) })
    vi.stubGlobal("fetch", fetch)
    try {
      const api = await import("@/components/organization/org-profile-card/tabs/documents-tab/api")
      const file = new File(["PDF"], "Private.pdf", { type: "application/pdf" })
      expect(await api.uploadOrgDocument("w9", file)).toBeUndefined()
      expect(await api.savePolicy({ title: "New policy", summary: "", status: "not_started", categories: [], programId: null, personIds: [] })).toBe("new-policy")
      expect(await api.uploadPolicyDocument("new-policy", file)).toBeUndefined()
      expect(await api.removePolicyDocument("new-policy")).toBeUndefined()
      expect(fetch).toHaveBeenCalledTimes(4)
    } finally { vi.unstubAllGlobals() }
  })
})
