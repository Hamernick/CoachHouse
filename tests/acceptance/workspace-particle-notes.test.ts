import { noteEditorHtml, notePreview } from "@/lib/modules/note-content"
import { sanitizeNoteContent } from "@/lib/modules/note-content-server"
import { pageNotes } from "@/features/workspace-particles/lib/note-pagination"
import { loadPersonalNote, writePersonalNote } from "@/features/workspace-particles/server/note-module-actions"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ModuleNotesFields } from "@/features/workspace-particles/components/particle-module-notes-editor"
import { particleWidgetSchema } from "@/features/workspace-particles/lib/particle-widget-schema"
import {
  moduleNotesParticle,
  workspaceNoteDocuments,
  getParticleNotes,
} from "@/features/workspace-particles/lib/particle-notes"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  PARTICLE_PRESETS,
} from "@/features/workspace-particles/lib/particle-presets"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { createParticleHistory } from "@/features/workspace-particles/lib/particle-history"
import { buildLibraryItems } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { documentParticleReference } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-particle-reference"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import { ID, NOW, WORKSPACE, batch, graph, particle } from "./fixtures/particle-fixtures"
import { projectParticlePublicContent, publicParticleContentSchema, canManageParticlePublication } from "@/features/workspace-particles/lib/particle-public-content"
import type { Particle } from "@/features/workspace-particles/types"

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  personalClient: vi.fn(),
  active: vi.fn(),
  access: vi.fn(),
  modules: vi.fn(),
  read: vi.fn(),
  apply: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.personalClient }))
vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: mocks.client,
}))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mocks.active,
}))
vi.mock("@/lib/organization/document-access", () => ({
  resolveOrganizationDocumentAccess: mocks.access,
}))
vi.mock("@/lib/modules/notes-index", () => ({
  listUserModuleNotesIndex: mocks.modules,
}))
vi.mock("@/features/workspace-particles/server/note-documents", () => ({
  readWorkspaceNoteDocuments: mocks.read,
}))
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/workspace-particle-actions",
  () => ({ applyWorkspaceParticleBatchAction: mocks.apply })
)

function note() {
  const preset = PARTICLE_PRESETS.find((item) => item.id === "notes")
  if (!preset) throw new Error("Missing Notes preset")
  return buildParticlePreset(preset, {
    id: ID(1),
    workspaceId: WORKSPACE,
    now: NOW,
    title: "Meeting notes",
    description: "",
    fields: { ...DEFAULT_PRESET_FIELDS, body: "Discuss the venue" },
  })
}

describe("Notes Particle contracts", () => {
  it("keeps personal lesson text out of shared graph records", () => {
    const particle = moduleNotesParticle({
      workspaceId: WORKSPACE,
      id: ID(2),
      now: NOW,
      title: "Lesson notes",
      moduleId: ID(3),
    })
    expect(getParticleNotes(particle)).toEqual({
      kind: "module",
      moduleId: ID(3),
    })
    expect(
      particleWidgetSchema.safeParse({
        kind: "notes",
        source: { kind: "module", moduleId: ID(3), content: "Private text" },
      }).success
    ).toBe(false)
    expect(workspaceNoteDocuments([particle])).toEqual([])
  })
  it("bounds workspace content and retains hidden notes in Documents", () => {
    expect(
      particleWidgetSchema.safeParse({
        kind: "notes",
        source: { kind: "workspace", content: "x".repeat(20_001) },
      }).success
    ).toBe(false)
    const [document] = workspaceNoteDocuments([
      { ...note(), canvasHidden: true },
    ])
    expect(document).toMatchObject({
      title: "Discuss the venue",
      summary: "",
      source: { kind: "workspace_note", id: ID(1) },
    })
    const [item] = buildLibraryItems([], [], [], false, [document])
    expect(documentParticleReference(item)?.source).toEqual(document.source)
    expect(() =>
      createLibraryDocumentParticle(
        WORKSPACE,
        documentParticleReference(item)!,
        ID(4),
        NOW
      )
    ).toThrow("existing Notes Particle")
  })
  it("places personal notes from Documents as references without copying summaries", () => {
    const [item] = buildLibraryItems([], [], [], false, [
      {
        id: "note:module",
        title: "Lesson notes",
        summary: "Private summary",
        updatedAt: NOW,
        source: { kind: "module_note", moduleId: ID(3) },
      },
    ])
    const reference = documentParticleReference(item)
    if (!reference) throw new Error("Missing note reference")
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      reference,
      ID(2),
      NOW
    )
    expect(getParticleNotes(particle)).toEqual({
      kind: "module",
      moduleId: ID(3),
    })
    expect(JSON.stringify(particle)).not.toContain("Private summary")
  })
  it("persists workspace note edits and rejects stale replacement", async () => {
    const original = note()
    if (original.type !== "activity") throw new Error("Wrong note type")
    const changed = {
      ...original,
      data: {
        ...original.data,
        widget: {
          kind: "notes" as const,
          source: { kind: "workspace" as const, content: "Updated text" },
        },
      },
    }
    const operation = batch(10, [
      {
        kind: "put_particle",
        particle: changed,
        expectedRevision: original.revision,
      },
    ])
    const initial = graph([original])
    const history = createParticleHistory(WORKSPACE)
    history.observe(initial)
    const saved = await applyParticleBatch(initial, operation, NOW)
    if (!saved.ok) throw new Error(saved.error)
    expect(getParticleNotes(saved.value.graph.particles[0])).toEqual({
      kind: "workspace",
      content: "Updated text",
      contentEditedAt: NOW,
    })
    const stale = await applyParticleBatch(
      saved.value.graph,
      { ...operation, id: ID(11) },
      NOW
    )
    expect(stale).toMatchObject({ ok: false, code: "conflict" })
    history.committed(operation, saved.value)
    const undo = history.prepare("undo", saved.value.graph, ID(12))
    if (!undo) throw new Error("Missing note undo")
    const reverted = await applyParticleBatch(saved.value.graph, undo, NOW)
    if (!reverted.ok) throw new Error(reverted.error)
    expect(getParticleNotes(reverted.value.graph.particles[0])).toEqual(
      { ...getParticleNotes(original), contentEditedAt: NOW }
    )
    history.committed(undo, reverted.value, "undo")
    const redo = history.prepare("redo", reverted.value.graph, ID(13))
    if (!redo) throw new Error("Missing note redo")
    const replayed = await applyParticleBatch(reverted.value.graph, redo, NOW)
    if (!replayed.ok) throw new Error(replayed.error)
    expect(getParticleNotes(replayed.value.graph.particles[0])).toEqual(
      { ...getParticleNotes(changed), contentEditedAt: NOW }
    )
  })
  it("disables unloaded fields and shows accessible saving feedback without a missing component", () => {
    const props = {
      value: "",
      onChange: vi.fn(),
      onSave: async () => {},
      isSaving: true,
      loaded: false,
      error: null,
      onReload: async () => {},
      dirty: false,
    }
    const markup = renderToStaticMarkup(createElement(ModuleNotesFields, props))
    expect(markup).toContain('role="status"')
    expect(markup).toContain("disabled")
    expect(markup).toContain("lucide-loader-circle")
  })
})

describe("Notes Documents route", () => {
  const session = { auth: { getUser: vi.fn() } }
  beforeEach(() => {
    vi.clearAllMocks()
    session.auth.getUser.mockResolvedValue({
      data: { user: { id: ID(50) } },
      error: null,
    })
    mocks.client.mockReturnValue(session)
    mocks.active.mockResolvedValue({ orgId: WORKSPACE })
    mocks.modules.mockResolvedValue([])
    mocks.read.mockResolvedValue([])
  })
  const request = (query = "") =>
    new NextRequest(`http://localhost/api/account/workspace-notes${query}`)
  it("rejects anonymous reads", async () => {
    session.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const { GET } = await import("@/app/api/account/workspace-notes/route")
    expect((await GET(request())).status).toBe(401)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("loads active-organization notes without requiring an administrator override", async () => {
    const { GET } = await import("@/app/api/account/workspace-notes/route")
    mocks.read.mockResolvedValue(workspaceNoteDocuments([note()]))
    const response = await GET(request(`?organizationId=${WORKSPACE}`))
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(mocks.access).not.toHaveBeenCalled()
    expect(mocks.read).toHaveBeenCalledWith(session, WORKSPACE)
    expect((await response.json()).notes).toHaveLength(1)
  })
  it("checks other organization access and always reads personal notes as the signed-in user", async () => {
    const { GET } = await import("@/app/api/account/workspace-notes/route")
    const scoped = { marker: "scoped" }
    mocks.access.mockResolvedValue({ orgId: ID(60), supabase: scoped })
    const response = await GET(request(`?organizationId=${ID(60)}`))
    expect(response.status).toBe(200)
    expect(mocks.read).toHaveBeenCalledWith(scoped, ID(60))
    expect(mocks.modules).toHaveBeenCalledWith({
      supabase: session,
      userId: ID(50),
      limit: null,
    })
    mocks.access.mockResolvedValue({ error: "Forbidden" })
    mocks.read.mockClear()
    expect((await GET(request(`?organizationId=${ID(60)}`))).status).toBe(403)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("delegates revision-checked edits to the existing authorized graph writer", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    const update = batch(10, [
      { kind: "put_particle", particle: note(), expectedRevision: 0 },
    ])
    mocks.read.mockResolvedValue({ particle: note(), revision: 0 })
    mocks.apply.mockResolvedValue({
      ok: false,
      code: "conflict",
      error: "Changed elsewhere",
    })
    const response = await POST(
      new NextRequest(request().url, {
        method: "POST",
        body: JSON.stringify(update),
      })
    )
    expect(response.status).toBe(409)
    expect(mocks.apply).toHaveBeenCalledWith(update, undefined)
    mocks.apply.mockRejectedValue(new Error("Network failure"))
    expect(
      (
        await POST(
          new NextRequest(request().url, {
            method: "POST",
            body: JSON.stringify(update),
          })
        )
      ).status
    ).toBe(500)
  })
  it("routes an existing named-workspace note to its saved canvas", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    const update = batch(10, [{ kind: "put_particle", particle: note(), expectedRevision: 0 }])
    mocks.read.mockResolvedValue({ particle: note(), revision: 0, workspaceCanvasId: ID(70) })
    mocks.apply.mockResolvedValue({ ok: true, value: {} })
    const response = await POST(new NextRequest(request().url, { method: "POST", body: JSON.stringify(update) }))
    expect(response.status).toBe(200)
    expect(mocks.apply).toHaveBeenCalledWith(update, ID(70))
    expect(mocks.read).toHaveBeenCalledWith(session, WORKSPACE, note().id)
  })
  it("rejects creations and personal note text from the shared graph edit endpoint", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    for (const operation of [
      {
        kind: "put_particle" as const,
        particle: note(),
        expectedRevision: null,
      },
      {
        kind: "put_particle" as const,
        particle: moduleNotesParticle({
          id: ID(2),
          workspaceId: WORKSPACE,
          moduleId: ID(3),
          now: NOW,
          title: "Notes",
        }),
        expectedRevision: 0,
      },
    ]) {
      expect(
        (
          await POST(
            new NextRequest(request().url, {
              method: "POST",
              body: JSON.stringify(batch(11, [operation])),
            })
          )
        ).status
      ).toBe(400)
    }
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})

describe("public Particle review allowlist", () => {
  it.each(["owner", "admin", "staff", "board", "member"] as const)("enforces publication scope for %s", role => {
    const input = { activeOrganization: { orgId: WORKSPACE, role }, organizationId: WORKSPACE, supportAccess: false }
    expect(canManageParticlePublication(input)).toBe(["owner", "admin", "staff"].includes(role))
    expect(canManageParticlePublication({ ...input, organizationId: ID(800) })).toBe(false)
    expect(canManageParticlePublication({ ...input, supportAccess: true })).toBe(false)
    expect(canManageParticlePublication({ ...input, activeOrganization: null })).toBe(false)
  })
  function activity(widget: NonNullable<Extract<Particle, { type: "activity" }>["data"]["widget"]>) {
    const base = particle(901)
    if (base.type !== "activity") throw new Error("Wrong fixture")
    return { ...base, description: "Public summary", data: { ...base.data, widget } }
  }
  it("copies selected workspace note content without board metadata or shared object references", () => {
    const note = activity({ kind: "notes", source: { kind: "workspace", content: "Saved note" } })
    const result = projectParticlePublicContent(note)
    if (!result.ok) throw new Error(result.error)
    expect(result.value).toEqual({ id: note.id, title: note.title, description: "Public summary",
      content: { kind: "notes", markdown: "Saved note" } })
    if (note.data.widget.kind !== "notes" || note.data.widget.source.kind !== "workspace") throw new Error("Wrong fixture")
    note.data.widget.source.content = "Unpublished edit"
    expect(result.value.content).toEqual({ kind: "notes", markdown: "Saved note" })
    expect(Object.keys(result.value).sort()).toEqual(["content", "description", "id", "title"])
  })
  it("excludes personal lesson notes and unresolved document sources", () => {
    expect(projectParticlePublicContent(activity({ kind: "notes", source: { kind: "module", moduleId: ID(902) } })))
      .toMatchObject({ ok: false, code: "unsupported" })
    expect(projectParticlePublicContent(activity({ kind: "document", format: "link", name: "Private Drive file",
      source: { kind: "drive", id: ID(903), webViewLink: "https://drive.google.com/file/d/example/view" } })))
      .toMatchObject({ ok: false, code: "unsupported" })
    expect(projectParticlePublicContent(activity({ kind: "image", fileId: ID(904), width: 100, height: 100, alt: "Private" })))
      .toMatchObject({ ok: false, code: "unsupported" })
  })
  it("excludes event attendees while keeping reviewed time and place", () => {
    const result = projectParticlePublicContent(activity({ kind: "event", startsAt: NOW,
      location: "Community hall", attendees: ["Private attendee"] }))
    expect(result).toMatchObject({ ok: true, value: { content: { kind: "event", startsAt: NOW, location: "Community hall" } } })
    expect(JSON.stringify(result)).not.toContain("Private attendee")
  })
  it("publishes only the activity summary, without internal steps or resource references", () => {
    const value = particle(905)
    if (value.type !== "activity") throw new Error("Wrong fixture")
    value.data.steps = [{ id: ID(906), title: "Private operational detail", status: "backlog", order: 0 }]
    const result = projectParticlePublicContent(value)
    expect(result).toMatchObject({ ok: true, value: { content: { kind: "text" } } })
    expect(JSON.stringify(result)).not.toContain("Private operational detail")
    value.data.source = { kind: "activity", id: ID(907) }
    expect(projectParticlePublicContent(value)).toMatchObject({ ok: false, code: "unsupported" })
  })
  it.each(["people", "finance", "workflow", "decision", "metric", "calendar"] as const)(
    "does not accidentally expose unsupported %s data", type => {
      expect(projectParticlePublicContent(particle(908, type))).toMatchObject({ ok: false, code: "unsupported" })
    })
  it("rejects incomplete forms and snapshots only validated questions", () => {
    expect(projectParticlePublicContent(activity({ kind: "form", definition: { questions: [] } })))
      .toMatchObject({ ok: false, code: "invalid" })
    const value = activity({ kind: "form", definition: { questions: [
      { id: ID(909), type: "text", label: "Name", required: true },
    ] } })
    const result = projectParticlePublicContent(value)
    expect(result).toMatchObject({ ok: true })
    if (value.data.widget.kind !== "form") throw new Error("Wrong fixture")
    value.data.widget.definition.questions[0].label = "Unpublished question edit"
    expect(JSON.stringify(result)).not.toContain("Unpublished question edit")
  })
  it.each(["workspaceId", "position", "source", "responses", "storage_path", "access_token"])(
    "rejects accidental private field %s", field => {
      expect(publicParticleContentSchema.safeParse({ id: ID(910), title: "Preview", content: { kind: "text" }, [field]: "private" }).success).toBe(false)
      expect(publicParticleContentSchema.safeParse({ id: ID(910), title: "Preview", content: { kind: "text", [field]: "private" } }).success).toBe(false)
    })
  it.each(["not a URL", "https://example.com/file", "https://drive.google.com.evil.test/file", "https://user:password@drive.google.com/file", "javascript:alert(1)"])(
    "rejects noncanonical provider links (%s)", href => {
      expect(publicParticleContentSchema.safeParse({ id: ID(911), title: "Drive", content: { kind: "drive_link", href } }).success).toBe(false)
    })
  it("allows canonical Google links without exposing connection or provider credentials", () => {
    expect(publicParticleContentSchema.safeParse({ id: ID(911), title: "Drive",
      content: { kind: "drive_link", href: "https://docs.google.com/document/d/example/edit" } }).success).toBe(true)
  })
})


describe("Notes editor content and paging", () => {
  it("preserves legacy line breaks and literal HTML without executing it", () => {
    expect(noteEditorHtml({ content: "First line\n\n<script>x</script> & details" })).toBe("<p>First line</p><p><br></p><p>&lt;script&gt;x&lt;/script&gt; &amp; details</p>")
    expect(notePreview("First line\nSecond line\nThird line")).toEqual({ title: "First line", summary: "Second line" })
    expect(notePreview("")).toEqual({ title: "New note", summary: "" })
  })
  it("sanitizes rich text and derives trusted plain-text previews", () => {
    const result = sanitizeNoteContent({ content: "forged preview", html: '<h2>Title &amp; plans</h2><p><strong>Second</strong> line</p><script>steal()</script><img src=x onerror=steal()><p><a href="javascript:steal()">Safe text</a></p>' })
    expect(result.content).toBe("Title & plans\nSecond line\nSafe text")
    expect(result.html).not.toMatch(/script|img|onerror|javascript/)
    expect(result.html).toContain("<strong>Second</strong>")
    expect(() => sanitizeNoteContent({ content: "", html: `<p>${"x".repeat(20_001)}</p>` })).toThrow()
  })
  it("pages every matching note in stable edit order, including timestamp ties", () => {
    const notes = Array.from({ length: 125 }, (_, index) => ({ ...workspaceNoteDocuments([note()])[0], id: `note:${String(index).padStart(3, "0")}` }))
    let cursor: string | null = null
    const ids: string[] = []
    do {
      const result = pageNotes(notes, 30, cursor)
      ids.push(...result.notes.map((item) => item.id)); cursor = result.nextCursor
    } while (cursor)
    expect(ids).toHaveLength(125)
    expect(new Set(ids).size).toBe(125)
    expect(() => pageNotes(notes, 30, "bad cursor")).toThrow()
  })
  it("keeps the note edit date stable during moves, then advances it on content edits", async () => {
    const original = note()
    const movedAt = "2026-10-20T10:00:00.000Z"
    const moved = await applyParticleBatch(graph([original]), batch(80, [{ kind: "move_particles", mode: "manual", positions: [{ id: original.id, expectedRevision: original.revision, position: { x: 20, y: 40 } }] }]), movedAt)
    if (!moved.ok) throw new Error(moved.error)
    const item = moved.value.graph.particles[0]
    expect(item.updatedAt).toBe(movedAt)
    expect(workspaceNoteDocuments([item])[0].updatedAt).toBe(NOW)
    if (item.type !== "activity") throw new Error("Wrong type")
    const changedAt = "2026-10-20T11:00:00.000Z"
    const edited = await applyParticleBatch(moved.value.graph, { ...batch(81, [{ kind: "put_particle", expectedRevision: item.revision, particle: { ...item, data: { ...item.data, widget: { kind: "notes", source: { kind: "workspace", content: "Edited", html: "<p>Edited</p>" } } } } }]), baseRevision: moved.value.graph.revision }, changedAt)
    if (!edited.ok) throw new Error(edited.error)
    expect(workspaceNoteDocuments(edited.value.graph.particles)[0].updatedAt).toBe(changedAt)
  })
})

describe("Personal note writes", () => {
  let query: Record<string, ReturnType<typeof vi.fn>>
  const version = "2026-10-20T10:00:00.000Z"
  beforeEach(() => {
    query = Object.fromEntries(["select", "eq", "update", "insert", "maybeSingle", "single"].map((key) => [key, vi.fn()]))
    for (const method of Object.values(query)) method.mockReturnValue(query)
    mocks.personalClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ID(50) } } }) }, from: vi.fn().mockReturnValue(query) })
  })
  it("reads only the signed-in user's personal note", async () => {
    query.maybeSingle.mockResolvedValue({ data: { notes: { content: "Private", editedAt: NOW }, updated_at: version }, error: null })
    expect(await loadPersonalNote(ID(3))).toMatchObject({ body: { content: "Private", updatedAt: NOW }, version })
    expect(query.eq).toHaveBeenCalledWith("user_id", ID(50))
    expect(query.eq).toHaveBeenCalledWith("module_id", ID(3))
  })
  it("rejects stale versions without writing or overwriting a draft", async () => {
    query.maybeSingle.mockResolvedValue({ data: { notes: { content: "Other edit" }, updated_at: version }, error: null })
    expect(await writePersonalNote({ moduleId: ID(3), version: NOW, editId: ID(91), body: { content: "My draft" } })).toMatchObject({ conflict: true })
    expect(query.update).not.toHaveBeenCalled()
  })
  it("resolves a note's lesson link from curriculum metadata even before progress is saved", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { title: "Budget planning", idx: 4, classes: { slug: "financial-foundations" } }, error: null })
    expect(await loadPersonalNote(ID(3))).toMatchObject({
      body: { content: "" },
      lesson: { title: "Budget planning", moduleId: ID(3), href: `/workspace?drawer=accelerator&module=${ID(3)}` },
    })
    expect(query.eq).toHaveBeenCalledWith("id", ID(3))
    expect(query.update).not.toHaveBeenCalled()
  })
  it("keeps the note readable without a broken link when curriculum is unavailable", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { notes: "Private", updated_at: version }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } })
    expect(await loadPersonalNote(ID(3))).toMatchObject({ body: { content: "Private" }, lesson: null })
  })
  it("saves sanitized formatting with a compare-and-set and no progress fields", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { notes: { content: "Old" }, updated_at: version }, error: null })
      .mockResolvedValueOnce({ data: { notes: { content: "New", html: "<p><strong>New</strong></p>", editedAt: version, editId: ID(91) }, updated_at: version }, error: null })
    const result = await writePersonalNote({ moduleId: ID(3), version, editId: ID(91), body: { content: "New", html: "<p><strong>New</strong><script>x()</script></p>" } })
    expect(result).toMatchObject({ body: { content: "New", html: "<p><strong>New</strong></p>" } })
    expect(Object.keys(query.update.mock.calls[0][0])).toEqual(["notes"])
    expect(query.update.mock.calls[0][0].notes.html).not.toContain("script")
    expect(query.eq).toHaveBeenCalledWith("updated_at", version)
  })
  it("clears only notes when deleting, retaining lesson completion and answers", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { notes: { content: "Old" }, updated_at: version }, error: null })
      .mockResolvedValueOnce({ data: { notes: null, updated_at: version }, error: null })
    const result = await writePersonalNote({ moduleId: ID(3), version, editId: ID(92), body: null })
    expect(result).toMatchObject({ body: { content: "" } })
    expect(query.update).toHaveBeenCalledWith({ notes: null })
  })
  it("confirms a lost-response retry without a duplicate write", async () => {
    query.maybeSingle.mockResolvedValue({ data: { notes: { content: "Saved", editId: ID(91) }, updated_at: version }, error: null })
    expect(await writePersonalNote({ moduleId: ID(3), version: NOW, editId: ID(91), body: { content: "Saved" } })).toMatchObject({ body: { content: "Saved" } })
    expect(query.update).not.toHaveBeenCalled()
  })
  it("requires authentication for personal reads and writes", async () => {
    mocks.personalClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    expect(await loadPersonalNote(ID(3))).toHaveProperty("error")
    expect(await writePersonalNote({ moduleId: ID(3), version, editId: ID(91), body: { content: "Text" } })).toHaveProperty("error")
    expect(query.update).not.toHaveBeenCalled()
  })
})

describe("Notes editor API boundaries", () => {
  const session = { auth: { getUser: vi.fn() } }
  beforeEach(() => {
    vi.clearAllMocks()
    session.auth.getUser.mockResolvedValue({ data: { user: { id: ID(50) } }, error: null })
    mocks.client.mockReturnValue(session)
    mocks.active.mockResolvedValue({ orgId: WORKSPACE })
    mocks.modules.mockResolvedValue([])
    mocks.read.mockResolvedValue([])
  })
  it("searches the entire personal note before slicing pages or previews", async () => {
    const { GET } = await import("@/app/api/account/workspace-notes/route")
    mocks.modules.mockResolvedValue([
      { moduleId: ID(3), moduleTitle: "Lesson", content: `Title\nSecond line\n${"x".repeat(600)} needle`, updatedAt: NOW },
      { moduleId: ID(4), moduleTitle: "Other", content: "Unrelated", updatedAt: NOW },
    ])
    const response = await GET(new NextRequest("http://localhost/api/account/workspace-notes?q=needle&limit=30"))
    expect(mocks.read).toHaveBeenCalledWith(session, WORKSPACE, undefined, "needle")
    expect(await response.json()).toMatchObject({ notes: [{ title: "Title", summary: "Second line", source: { moduleId: ID(3) } }], nextCursor: null })
  })
  it("rejects malformed pagination instead of silently skipping notes", async () => {
    const { GET } = await import("@/app/api/account/workspace-notes/route")
    expect((await GET(new NextRequest("http://localhost/api/account/workspace-notes?limit=500"))).status).toBe(400)
    expect((await GET(new NextRequest("http://localhost/api/account/workspace-notes?cursor=broken"))).status).toBe(400)
  })
  it("uses the authorized graph writer and saved canvas for note deletion", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    const original = note()
    const remove = batch(90, [{ kind: "remove_particle", id: original.id, expectedRevision: original.revision }])
    mocks.read.mockResolvedValue({ particle: original, revision: 0, workspaceCanvasId: ID(70) })
    mocks.apply.mockResolvedValue({ ok: false, code: "conflict", error: "Changed elsewhere" })
    expect((await POST(new NextRequest("http://localhost/api/account/workspace-notes", { method: "POST", body: JSON.stringify(remove) }))).status).toBe(409)
    expect(mocks.apply).toHaveBeenCalledWith(remove, ID(70))
  })
  it("cannot use the notes endpoint to delete another particle type", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    const original = particle(1, "objective")
    mocks.read.mockResolvedValue({ particle: original, revision: 0 })
    const remove = batch(90, [{ kind: "remove_particle", id: original.id, expectedRevision: original.revision }])
    expect((await POST(new NextRequest("http://localhost/api/account/workspace-notes", { method: "POST", body: JSON.stringify(remove) }))).status).toBe(404)
    expect(mocks.apply).not.toHaveBeenCalled()
  })
  it("sanitizes workspace markup and checks organization scope before writing", async () => {
    const { POST } = await import("@/app/api/account/workspace-notes/route")
    const original = note()
    if (original.type !== "activity") throw new Error("Wrong type")
    const edited = { ...original, data: { ...original.data, widget: { kind: "notes" as const, source: { kind: "workspace" as const, content: "Forged", html: '<p>Safe<script>x()</script></p>' } } } }
    const update = batch(93, [{ kind: "put_particle", particle: edited, expectedRevision: original.revision }])
    mocks.read.mockResolvedValue({ particle: original, revision: 0 })
    mocks.apply.mockResolvedValue({ ok: false, code: "scope", error: "Read only" })
    expect((await POST(new NextRequest("http://localhost/api/account/workspace-notes", { method: "POST", body: JSON.stringify(update) }))).status).toBe(403)
    expect(mocks.apply.mock.calls[0][0].operations[0].particle.data.widget.source).toEqual({ kind: "workspace", content: "Safe", html: "<p>Safe</p>" })
    mocks.apply.mockClear()
    expect((await POST(new NextRequest("http://localhost/api/account/workspace-notes", { method: "POST", body: JSON.stringify({ ...update, workspaceId: ID(99) }) }))).status).toBe(403)
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})
