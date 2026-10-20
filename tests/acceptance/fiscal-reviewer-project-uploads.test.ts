import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ admin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/features/member-workspace", () => ({
  sanitizeProjectAssetFilename: (name: string) => name,
  buildProjectAssetOpenPath: ({ assetId }: { assetId: string }) => `/asset/${assetId}`,
}))
import { getProjectAssetUploadId } from "@/lib/workspace/project-asset-upload-id"
import { projectAssetReadClient, uploadFiscalReviewerAssets } from "@/app/api/account/project-assets/fiscal-upload"

const actorId = "10000000-0000-4000-8000-000000000001"
const projectId = "20000000-0000-4000-8000-000000000001"
const orgId = "30000000-0000-4000-8000-000000000001"
const uploadId = "40000000-0000-4000-8000-000000000001"
const assets = new Map<string, Record<string, unknown>>()
let registrationMode = "success"
let scope: boolean | null = true
const upload = vi.fn()
const remove = vi.fn()
const from = vi.fn()
const rpc = vi.fn()
const client = { from, rpc, storage: { from: () => ({ upload, remove }) } }
function input() {
  return { actorId, projectId, uploadId, files: [new File(["%PDF-test"], "budget.pdf", { type: "application/pdf" })], title: "Budget", description: "Budget support", link: "" }
}
beforeEach(() => {
  vi.clearAllMocks()
  assets.clear()
  scope = true
  registrationMode = "success"
  mocks.admin.mockReturnValue(client)
  upload.mockResolvedValue({ error: null })
  remove.mockResolvedValue({ error: null })
  from.mockImplementation((table) => {
    const filters = new Map<string, string>()
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key, value) => { filters.set(key, value); return query }),
      maybeSingle: vi.fn(async () => ({ data: table === "organization_projects" ? { id: projectId, org_id: orgId } : assets.get(filters.get("id") ?? "") ?? null, error: null })),
    }
    return query
  })
  rpc.mockImplementation(async (name, args) => {
    if (name === "fiscal_guest_project_reviewer_access") return { data: scope, error: null }
    if (registrationMode === "revoked") return { data: { ok: false, code: "forbidden" }, error: null }
    assets.set(args.p_asset_id, { id: args.p_asset_id, org_id: orgId, project_id: projectId, created_by: actorId, name: args.p_title, description: args.p_description, mime: args.p_mime, size_bytes: args.p_size_bytes, storage_path: args.p_storage_path, asset_type: "pdf", external_url: null })
    if (registrationMode === "committed-timeout") return { data: null, error: { message: "timeout" } }
    return { data: { ok: true, created: true }, error: null }
  })
})

describe("fiscal reviewer project uploads", () => {
  it("reuses the client idempotency key when a lost-response upload is retried", () => {
    const selection = input()
    const first = getProjectAssetUploadId(selection)
    expect(getProjectAssetUploadId({ ...selection, files: [...selection.files] })).toBe(first)
    expect(getProjectAssetUploadId({ ...selection, title: "Changed" })).not.toBe(first)
    expect(getProjectAssetUploadId(input())).not.toBe(first)
  })

  it("stores a reviewer file under the server-owned project without creating an applicant account", async () => {
    const result = await uploadFiscalReviewerAssets(input())
    expect(result.status).toBe(200)
    const body = await result.json()
    expect(body.assets).toHaveLength(1)
    expect(rpc).toHaveBeenCalledWith("register_fiscal_guest_project_asset", expect.objectContaining({ p_actor_id: actorId, p_project_id: projectId, p_size_bytes: 9 }))
    expect(upload.mock.calls[0][0]).toMatch(new RegExp(`^${orgId}/${projectId}/fiscal-uploads/${actorId}/`))
    expect(from.mock.calls.every(([table]) => ["organization_projects", "organization_project_assets"].includes(table))).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })
  it("returns the existing asset for replay of the same upload request", async () => {
    const first = await (await uploadFiscalReviewerAssets(input())).json()
    const second = await (await uploadFiscalReviewerAssets(input())).json()
    expect(second).toEqual(first)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls.filter(([name]) => name === "register_fiscal_guest_project_asset")).toHaveLength(1)
  })
  it("rejects request reuse with changed contents without overwriting stored evidence", async () => {
    await uploadFiscalReviewerAssets(input())
    const result = await uploadFiscalReviewerAssets({ ...input(), files: [new File(["different"], "budget.pdf", { type: "application/pdf" })] })
    expect(result.status).toBe(400)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })
  it.each([false, null])("denies revoked reviewers and ordinary projects before storage (%s)", async (value) => {
    scope = value
    expect((await uploadFiscalReviewerAssets(input())).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })
  it("removes the unregistered object if reviewer access is revoked before registration", async () => {
    registrationMode = "revoked"
    expect((await uploadFiscalReviewerAssets(input())).status).toBe(400)
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
    expect(assets.size).toBe(0)
  })
  it("never removes a committed file after an ambiguous transaction response", async () => {
    registrationMode = "committed-timeout"
    expect((await uploadFiscalReviewerAssets(input())).status).toBe(400)
    expect(assets.size).toBe(1)
    expect(remove).not.toHaveBeenCalled()
    registrationMode = "success"
    expect((await uploadFiscalReviewerAssets(input())).status).toBe(200)
    expect(upload).toHaveBeenCalledTimes(1)
  })
  it("uses a privileged read client only after exact session reviewer authorization", async () => {
    const session = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) }
    expect(await projectAssetReadClient(session as never, actorId, projectId)).toBe(session)
    expect(mocks.admin).not.toHaveBeenCalled()
    session.rpc.mockResolvedValue({ data: true, error: null })
    expect(await projectAssetReadClient(session as never, actorId, projectId)).toBe(client)
    expect(session.rpc).toHaveBeenLastCalledWith("fiscal_guest_project_reviewer_access", { p_project_id: projectId, p_user_id: actorId })
  })
})
