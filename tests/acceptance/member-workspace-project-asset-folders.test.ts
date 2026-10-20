import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyFolderMutation, readProjectAssetFolders, organizationFolderFiles, getFolderDropFile } from "@/features/member-workspace/lib/project-asset-folders"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { ProjectAssetFolderGrid } from "@/features/member-workspace/components/projects/project-asset-folder-grid"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), documents: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/features/member-workspace/server/organization-documents", () => ({ loadOrganizationDocuments: mocks.documents }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { loadProjectAssetFolders, mutateProjectAssetFolder } from "@/features/member-workspace/server/project-asset-folder-actions"

const projectId = "00000000-0000-4000-8000-000000000001"
const folderId = "00000000-0000-4000-8000-000000000002"
const fileId = "00000000-0000-4000-8000-000000000003"
const fileKey = `project:${fileId}`
const folders = { folders: [{ id: folderId, name: "Board documents" }], placements: [] }
const project = { id: projectId, org_id: "org-a", project_kind: "organization_admin", updated_at: "2026-10-03T12:00:00Z", option_settings: { tags: [], sprintTypes: [], fiscalSponsorshipEnabled: true, untouched: "keep", assetFolders: folders } }
function query(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then(resolve: (result: { data: unknown; error: null }) => unknown) { return Promise.resolve(resolve({ data, error: null })) },
  }
}
let read: ReturnType<typeof query>
let write: ReturnType<typeof query>
let assets: ReturnType<typeof query>
let documents: ReturnType<typeof query>
beforeEach(() => {
  vi.clearAllMocks()
  read = query(project)
  write = query({ id: projectId })
  assets = query([{ id: fileId, name: "Budget.pdf" }])
  documents = query([{ id: fileId, name: "Policy attachment.pdf" }])
  mocks.actor.mockResolvedValue({ userId: "editor", activeOrg: { orgId: "org-a" }, isAdmin: false, canEdit: true, hasMemberWorkspaceAccess: true, supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: (table: string) => table === "organization_projects" ? read : table === "organization_project_assets" ? assets : documents } })
  mocks.admin.mockReturnValue({ from: () => write })
  mocks.documents.mockResolvedValue({
    sections: resolveRoadmapSections({}),
    policies: [{ id: "policy-1", title: "Safeguarding", summary: "", status: "complete", categories: [], programId: null, personIds: [], document: null, updatedAt: null }],
    uploads: [{ kind: "bylaws", title: "Bylaws", document: null }],
    drive: [{ id: "drive-1", name: "Board agenda", web_view_link: "https://drive.google.com/file/agenda" }],
    files: [], userId: "editor",
  })
})

describe("project file folders", () => {
  it("rejects untrusted action scope values before resolving an actor", async () => {
    expect(await loadProjectAssetFolders(projectId, "invalid" as never)).toEqual({ error: "Choose a valid project view." })
    expect(mocks.actor).not.toHaveBeenCalled()
  })

  it("uses verified platform scope for a directory file library while support workspace stays restricted", async () => {
    const actor = await mocks.actor()
    mocks.actor.mockImplementation(async (scope) => scope === "platform"
      ? { ...actor, canAccessOrganizations: true, organizationCoachScope: { mode: "assigned", organizationIds: new Set(["org-a"]), canAccessUnassigned: false } }
      : { ...actor, activeOrg: { orgId: "support-org" } })
    expect(await loadProjectAssetFolders(projectId)).toEqual({ error: "Unable to access that project." })
    expect(await loadProjectAssetFolders(projectId, "platform")).toHaveProperty("canEdit", true)
    expect(mocks.actor).toHaveBeenLastCalledWith("platform")
  })

  it("allows a fiscal reviewer to read only project files without host documents or writes", async () => {
    const actor = await mocks.actor()
    actor.supabase.rpc.mockResolvedValue({ data: true, error: null })
    mocks.actor.mockResolvedValue({ ...actor, activeOrg: { orgId: "another-org" }, isAdmin: true })
    const result = await loadProjectAssetFolders(projectId)
    expect(result).toHaveProperty("canEdit", false)
    expect(result).toHaveProperty("canUpload", true)
    expect(result).toHaveProperty("organizationDocuments", null)
    expect(result).toHaveProperty("files", [expect.objectContaining({ key: fileKey, source: "project" })])
    expect(assets.eq).toHaveBeenCalledWith("project_id", projectId)
    expect(mocks.documents).not.toHaveBeenCalled()
    expect(documents.select).not.toHaveBeenCalled()
    expect(await mutateProjectAssetFolder(projectId, { type: "create", name: "Host folder" })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each([{ data: false, error: null }, { data: null, error: { code: "unavailable" } }, { data: undefined, error: null }])("denies fiscal file reads on failed or revoked authorization", async (scope) => {
    const actor = await mocks.actor()
    actor.supabase.rpc.mockResolvedValue(scope)
    expect(await loadProjectAssetFolders(projectId)).toHaveProperty("error")
    expect(read.select).not.toHaveBeenCalled()
    expect(assets.select).not.toHaveBeenCalled()
  })
  it.each([true, false])("loads only project-owned files for standard projects (existing assets: %s)", async (hasFiles) => {
    read.maybeSingle.mockResolvedValue({ data: { ...project, project_kind: "standard" }, error: null })
    mocks.actor.mockResolvedValue({ ...await mocks.actor(), isAdmin: true })
    if (!hasFiles) assets = query([])
    const result = await loadProjectAssetFolders(projectId)
    expect(result).toHaveProperty("files", hasFiles ? [expect.objectContaining({ key: fileKey, source: "project" })] : [])
    expect(result).toHaveProperty("state", folders)
    expect(result).toHaveProperty("organizationDocuments", null)
    expect(mocks.documents).not.toHaveBeenCalled()
    expect(documents.select).not.toHaveBeenCalled()
  })
  it("rejects organization-document placement in standard projects without modifying saved data", async () => {
    read.maybeSingle.mockResolvedValue({ data: { ...project, project_kind: "standard" }, error: null })
    for (const key of [`organization:${fileId}`, "core:mission_vision_values", "policy:policy-1", "upload:bylaws", "drive:drive-1"]) {
      expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: key, folderId })).toHaveProperty("error", expect.stringContaining("Organization documents"))
    }
    expect(mocks.documents).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("creates persisted folders while preserving unrelated project settings", async () => {
    const result = await mutateProjectAssetFolder(projectId, { type: "create", name: "  Finance  " })
    expect(result).toHaveProperty("state.folders", [folders.folders[0], { id: expect.any(String), name: "Finance" }])
    expect(write.update).toHaveBeenCalledWith({ updated_by: "editor", option_settings: { ...project.option_settings, assetFolders: expect.objectContaining({ folders: expect.arrayContaining([{ id: expect.any(String), name: "Finance" }]) }) } })
    expect(write.eq).toHaveBeenCalledWith("id", projectId)
    expect(write.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(write.eq).toHaveBeenCalledWith("updated_at", project.updated_at)
  })
  it("loads saved folders and only this project's and organization's files", async () => {
    const result = await loadProjectAssetFolders(projectId)
    expect(result).toHaveProperty("state", folders)
    expect(result).toHaveProperty("canEdit", true)
    expect(assets.eq).toHaveBeenCalledWith("project_id", projectId)
    expect(assets.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(documents.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(documents.is).toHaveBeenCalledWith("deleted_at", null)
    expect(documents.is).toHaveBeenCalledWith("document_kind", null)
    expect(result).toHaveProperty("files", expect.arrayContaining([expect.objectContaining({ key: fileKey }), expect.objectContaining({ key: `organization:${fileId}` })]))
  })
  it("rejects viewers, unpaid members and foreign-organization editors before writes", async () => {
    const actor = await mocks.actor()
    for (const change of [{ canEdit: false }, { hasMemberWorkspaceAccess: false }, { activeOrg: { orgId: "org-b" } }]) {
      mocks.actor.mockResolvedValue({ ...actor, ...change })
      expect(await mutateProjectAssetFolder(projectId, { type: "create", name: "Folder" })).toHaveProperty("error")
    }
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects coaches outside their assigned organization scope", async () => {
    mocks.actor.mockResolvedValue({ ...await mocks.actor(), canAccessOrganizations: true, organizationCoachScope: { mode: "assigned", organizationIds: new Set(), canAccessUnassigned: false } })
    expect(await loadProjectAssetFolders(projectId)).toHaveProperty("error")
    expect(await mutateProjectAssetFolder(projectId, { type: "create", name: "Folder" })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("allows viewers to read folders without edit controls", async () => {
    mocks.actor.mockResolvedValue({ ...await mocks.actor(), canEdit: false })
    expect(await loadProjectAssetFolders(projectId)).toHaveProperty("canEdit", false)
  })
  it("validates destination and file ownership before moving", async () => {
    assets.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey, folderId })).toHaveProperty("error")
    expect(assets.eq).toHaveBeenCalledWith("project_id", projectId)
    expect(assets.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("scopes uploaded organization file moves and excludes core/deleted files", async () => {
    documents.maybeSingle.mockResolvedValue({ data: { id: fileId }, error: null })
    expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: `organization:${fileId}`, folderId })).toHaveProperty("state.placements", [{ fileKey: `organization:${fileId}`, folderId }])
    expect(documents.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(documents.is).toHaveBeenCalledWith("document_kind", null)
    expect(documents.is).toHaveBeenCalledWith("deleted_at", null)
  })
  it("rejects stale saves and write failures", async () => {
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "failed" } })
    expect(await mutateProjectAssetFolder(projectId, { type: "rename", folderId, name: "Updated" })).toHaveProperty("error", expect.stringContaining("changed"))
    expect(await mutateProjectAssetFolder(projectId, { type: "rename", folderId, name: "Updated" })).toHaveProperty("error", expect.stringContaining("Unable"))
  })
  it("rejects duplicate names, blank names and invalid IDs without writing", async () => {
    for (const name of ["board documents", "  "]) expect(await mutateProjectAssetFolder(projectId, { type: "create", name })).toHaveProperty("error")
    expect(await mutateProjectAssetFolder("invalid", { type: "create", name: "Valid" })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("does not overwrite unreadable folder metadata", async () => {
    read.maybeSingle.mockResolvedValue({ data: { ...project, option_settings: { assetFolders: "invalid" } }, error: null })
    expect(await mutateProjectAssetFolder(projectId, { type: "create", name: "Folder" })).toHaveProperty("error", expect.stringContaining("could not be read"))
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("moves files, renames folders and returns files to root on folder removal", () => {
    const moved = applyFolderMutation(folders, { type: "move", fileKey, folderId }, "unused")
    expect(moved.placements).toEqual([{ fileKey, folderId }])
    const renamed = applyFolderMutation(moved, { type: "rename", folderId, name: "Reports" }, "unused")
    expect(renamed.folders[0].name).toBe("Reports")
    expect(renamed.placements).toEqual(moved.placements)
    expect(applyFolderMutation(renamed, { type: "move", fileKey, folderId: null }, "unused").placements).toEqual([])
    expect(applyFolderMutation(renamed, { type: "remove", folderId }, "unused")).toEqual({ folders: [], placements: [] })
    expect(readProjectAssetFolders(undefined)).toEqual({ folders: [], placements: [] })
  })
  it("renders matching folder cards, counts, navigation and read-only restrictions", () => {
    const file = { key: fileKey, name: "Budget.pdf", url: "/asset", source: "project" as const }
    const props = { state: { ...folders, placements: [{ fileKey, folderId }] }, files: [file], query: "", busy: false, onOpenFolder: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onOpenFile: vi.fn() }
    const root = renderToStaticMarkup(React.createElement(ProjectAssetFolderGrid, { ...props, folderId: null, canEdit: true }))
    expect(root).toContain('aria-label="Open folder Board documents"')
    expect(root).toContain('aria-label="Actions for Board documents"')
    expect(root).toContain("1 item")
    expect(root).not.toContain("Budget.pdf")
    const inside = renderToStaticMarkup(React.createElement(ProjectAssetFolderGrid, { ...props, folderId, canEdit: false }))
    expect(inside).toContain('aria-label="Open file Budget.pdf"')
    expect(inside).not.toContain("Actions for")
    expect(inside).toContain("Open folder")
    expect(inside).toContain('data-file-row="project:')
    expect(inside).toContain('draggable="false"')
    expect(inside.indexOf('aria-label="Folders"')).toBeLessThan(inside.indexOf('aria-label="Files"'))
  })
  it("includes core documents, policies, document uploads and Drive links for authorized staff", async () => {
    mocks.actor.mockResolvedValue({ ...await mocks.actor(), isAdmin: true })
    const result = await loadProjectAssetFolders(projectId)
    expect(result).toHaveProperty("organizationDocuments")
    expect(result).toHaveProperty("files", expect.arrayContaining([
      expect.objectContaining({ source: "core" }),
      expect.objectContaining({ key: "policy:policy-1" }),
      expect.objectContaining({ key: "upload:bylaws" }),
      expect.objectContaining({ key: "drive:drive-1" }),
    ]))
  })
  it("moves every document category without modifying document content", async () => {
    mocks.actor.mockResolvedValue({ ...await mocks.actor(), isAdmin: true })
    const items = organizationFolderFiles(await mocks.documents())
    for (const source of ["core", "policy", "upload", "drive"]) {
      const document = items.find((item) => item.source === source)!
      expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: document.key, folderId })).toHaveProperty("state.placements", [{ fileKey: document.key, folderId }])
    }
    for (const [payload] of write.update.mock.calls) {
      expect(Object.keys(payload).sort()).toEqual(["option_settings", "updated_by"])
    }
  })
  it("rejects unavailable or out-of-scope core documents", async () => {
    expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: "core:foreign-section", folderId })).toHaveProperty("error")
    mocks.documents.mockResolvedValue({ error: "Forbidden" })
    expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: "policy:policy-1", folderId })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("keeps signed-document content read-only while allowing folder placement", async () => {
    documents.maybeSingle.mockResolvedValue({ data: { id: fileId }, error: null })
    expect(await mutateProjectAssetFolder(projectId, { type: "move", fileKey: `fiscal:${fileId}`, folderId })).toHaveProperty("state.placements", [{ fileKey: `fiscal:${fileId}`, folderId }])
    expect(documents.eq).toHaveBeenCalledWith("project_id", projectId)
    expect(documents.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(documents.eq).toHaveBeenCalledWith("status", "executed")
    const markup = renderToStaticMarkup(React.createElement(ProjectAssetFolderGrid, {
      state: folders, files: [{ key: `fiscal:${fileId}`, name: "Signed agreement", source: "fiscal", url: "/signed", downloadUrl: "/download" }],
      folderId: null, query: "", canEdit: true, busy: false, onOpenFolder: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onOpenFile: vi.fn(),
    }))
    expect(markup).toContain("Signed document · Read-only")
    expect(markup).toContain('href="/download"')
    expect(markup).not.toContain(">Edit<")
  })
})


describe("folder drag and drop", () => {
  const file = { key: fileKey, name: "Budget.pdf", url: "/asset", source: "project" as const }
  const props = { state: folders, files: [file], key: fileKey, folderId, canEdit: true, busy: false }
  it("moves a listed file into a folder or back to the root", () => {
    expect(getFolderDropFile(props)).toEqual(file)
    const moved = applyFolderMutation(folders, { type: "move", fileKey, folderId }, "")
    expect(getFolderDropFile({ ...props, state: moved, folderId: null })).toEqual(file)
  })
  it("rejects unknown files, missing destinations, viewers and pending saves", () => {
    for (const change of [{ key: "project:foreign-file" }, { folderId: "missing" }, { canEdit: false }, { busy: true }]) {
      expect(getFolderDropFile({ ...props, ...change })).toBeNull()
    }
  })
  it("ignores drops back into the current location", () => {
    expect(getFolderDropFile({ ...props, folderId: null })).toBeNull()
    const moved = applyFolderMutation(folders, { type: "move", fileKey, folderId }, "")
    expect(getFolderDropFile({ ...props, state: moved })).toBeNull()
  })
  it("renders draggable rows below folder cards and disables dragging while saving", () => {
    const render = (busy: boolean) => renderToStaticMarkup(React.createElement(ProjectAssetFolderGrid, {
      state: folders, files: [file], folderId: null, query: "", canEdit: true, busy,
      onOpenFolder: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onOpenFile: vi.fn(),
    }))
    const markup = render(false)
    expect(markup).toContain('draggable="true"')
    expect(markup).toContain(`data-drop-folder="${folderId}"`)
    expect(markup).toContain(`data-file-row="${fileKey}"`)
    expect(markup.indexOf('aria-label="Folders"')).toBeLessThan(markup.indexOf('aria-label="Files"'))
    expect(render(true)).not.toContain('draggable="true"')
  })
})
