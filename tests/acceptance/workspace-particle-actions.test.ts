import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Json } from "@/lib/supabase"
import type { WorkspaceBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import {
  batch,
  graph,
  ID,
  NOW,
  particle,
  WORKSPACE,
} from "./fixtures/particle-fixtures"
import { buildParticlePreset, DEFAULT_PRESET_FIELDS, PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import type { Particle, ParticleGraph } from "@/features/workspace-particles/types"
import type { ParticleDocumentSource } from "@/features/workspace-particles/lib/particle-library-document"
import { moduleNotesParticle } from "@/features/workspace-particles/lib/particle-notes"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"

import { updateRoadmapSection } from "@/lib/roadmap"
import { documentParticleReference } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-particle-reference"
import { buildLibraryItems } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { buildRoadmapRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  canEdit: vi.fn(),
  persist: vi.fn(),
  admin: vi.fn(),
  revalidate: vi.fn(),
  read: vi.fn(),
  calendarAccess: vi.fn(),
  files: vi.fn(),
  drive: vi.fn(),
  profile: vi.fn(),
  modules: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  in: vi.fn(),
}))
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/workspace-actions-support",
  () => ({ resolveActor: mocks.actor, canEditWorkspaceLayout: mocks.canEdit })
)
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write",
  () => ({ persistWorkspaceBoardState: mocks.persist })
)
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("@/actions/roadmap-calendar-helpers", () => ({ resolveCalendarAccess: mocks.calendarAccess }))
import {
  applyWorkspaceParticleBatchAction,
  loadWorkspaceParticleGraphAction,
} from "@/app/(dashboard)/my-organization/_lib/workspace-particle-actions"

const request = batch(100, [
  { kind: "put_particle", particle: particle(3), expectedRevision: null },
])
beforeEach(() => {
  vi.resetAllMocks()
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mocks.read,
  }
  mocks.from.mockImplementation((table: string) => table === "organization_workspace_boards" ? query : {
    select: vi.fn().mockReturnThis(), eq: mocks.eq.mockReturnThis(),
    is: mocks.is.mockReturnThis(), in: mocks.in.mockReturnThis(),
    maybeSingle: mocks.profile,
    abortSignal: table === "organizations" ? vi.fn().mockReturnThis()
      : table === "modules" ? mocks.modules
      : table === "organization_document_files" ? mocks.files : mocks.drive,
  })
  mocks.actor.mockResolvedValue({
    user: { id: ID(888) },
    activeOrg: { orgId: WORKSPACE, role: "owner" },
    supabase: { from: mocks.from },
  })
  mocks.canEdit.mockResolvedValue(true)
  mocks.calendarAccess.mockResolvedValue({ orgId: WORKSPACE, canManageCalendar: true })
  mocks.admin.mockReturnValue({})
  mocks.read.mockResolvedValue({
    data: { state: { particleGraph: graph() } },
    error: null,
  })
  mocks.persist.mockImplementation(
    async (args: {
      buildState: (stored: WorkspaceBoardState) => WorkspaceBoardState
      updateParticleGraph: (stored: Json) => Json | Promise<Json>
    }) => ({
      ok: true,
      boardState: {
        ...args.buildState(buildDefaultBoardState()),
        particleGraph: await args.updateParticleGraph(graph()),
      },
    })
  )
})

describe("organization-owned person references", () => {
  const person = (ids = [ID(701)]) => particleSchema.parse({
    ...particle(70, "people"), data: { personIds: ids, segment: "" },
  })
  const put = (item: Particle, expectedRevision: number | null = null) => batch(145, [
    { kind: "put_particle", particle: item, expectedRevision },
  ])
  function stored(item: Particle) {
    mocks.persist.mockImplementation(async (args: { updateParticleGraph: (value: Json) => Promise<Json> }) => {
      await args.updateParticleGraph(graph([item]))
      return { ok: true }
    })
  }
  it("resolves person IDs from the active organization profile once per batch", async () => {
    mocks.profile.mockResolvedValue({ data: { profile: { org_people: [{ id: ID(701) }, { id: ID(702) }] } }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put(person([ID(701), ID(702)])))).toMatchObject({ ok: true })
    expect(mocks.eq).toHaveBeenCalledWith("user_id", WORKSPACE)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    expect(mocks.files).not.toHaveBeenCalled()
    expect(mocks.drive).not.toHaveBeenCalled()
  })
  it.each([null, {}, { org_people: [] }, { org_people: [{ id: ID(702) }] }, { org_people: [null, "invalid"] }])(
    "rejects absent, deleted, malformed or other-organization person references (%j)", async profile => {
      mocks.profile.mockResolvedValue({ data: { profile }, error: null })
      expect(await applyWorkspaceParticleBatchAction(put(person()))).toMatchObject({ ok: false, code: "scope" })
      expect(mocks.revalidate).not.toHaveBeenCalled()
    })
  it("does not publish a mutation if the profile lookup fails", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(put(person()))).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("allows geometry, removal and reference subtraction without re-reading unavailable contacts", async () => {
    const before = person([ID(701), ID(702)])
    stored(before)
    for (const after of [
      { ...before, position: { x: 20, y: 80 } },
      { ...before, canvasHidden: true },
      person([ID(701)]),
    ]) expect(await applyWorkspaceParticleBatchAction(put(after, 0))).toMatchObject({ ok: true })
    expect(mocks.profile).not.toHaveBeenCalled()
  })
  it("validates only newly linked IDs, while re-adding revalidates every retained source", async () => {
    stored(person())
    mocks.profile.mockResolvedValue({ data: { profile: { org_people: [{ id: ID(702) }] } }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put(person([ID(701), ID(702)]), 0))).toMatchObject({ ok: true })
    stored({ ...person(), canvasHidden: true })
    expect(await applyWorkspaceParticleBatchAction(put(person(), 0))).toMatchObject({ ok: false, code: "scope" })
  })
})

describe("Core Document Drive placement", () => {
  const driveSource = {
    provider: "google_drive" as const, fileId: "provider-file-id", name: "Vision",
    webViewLink: "https://docs.google.com/document/d/provider-file-id/edit",
  }
  const { nextProfile, section } = updateRoadmapSection({}, "vision", { driveSource })
  function document() {
    const [item] = buildLibraryItems(buildRoadmapRows([section]), [], [])
    const reference = documentParticleReference(item)
    if (!reference) throw new Error("Missing Core Document")
    return createLibraryDocumentParticle(WORKSPACE, reference, ID(80), NOW)
  }
  const put = (value = document(), expectedRevision: number | null = null) =>
    batch(146, [{ kind: "put_particle", particle: value, expectedRevision }])
  it("places the library reference through the organization profile without querying attachments", async () => {
    mocks.profile.mockResolvedValue({ data: { profile: nextProfile }, error: null })
    const result = await applyWorkspaceParticleBatchAction(put())
    expect(result).toMatchObject({ ok: true })
    expect(mocks.eq).toHaveBeenCalledWith("user_id", WORKSPACE)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    expect(mocks.drive).not.toHaveBeenCalled()
    expect(mocks.files).not.toHaveBeenCalled()
  })
  it.each([
    null,
    {},
    updateRoadmapSection(nextProfile, "vision", { driveSource: null }).nextProfile,
    updateRoadmapSection(nextProfile, "vision", { driveSource: { ...driveSource, fileId: "replacement" } }).nextProfile,
    updateRoadmapSection(nextProfile, "vision", { driveSource: { ...driveSource, webViewLink: "https://docs.google.com/document/d/another/edit" } }).nextProfile,
  ])("rejects missing, disconnected or changed Core sources (%#)", async profile => {
    mocks.profile.mockResolvedValue({ data: { profile }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("fails closed when the profile cannot be read", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("moves existing references without lookup, but revalidates when returned to the board", async () => {
    const saved = document()
    function stored(hidden: boolean) {
      mocks.persist.mockImplementation(async (args: { updateParticleGraph: (value: Json) => Promise<Json> }) => {
        await args.updateParticleGraph(graph([{ ...saved, canvasHidden: hidden }]))
        return { ok: true }
      })
    }
    stored(false)
    expect(await applyWorkspaceParticleBatchAction(put({ ...saved, position: { x: 500, y: 200 } }, 0))).toMatchObject({ ok: true })
    expect(mocks.profile).not.toHaveBeenCalled()
    stored(true)
    mocks.profile.mockResolvedValue({ data: { profile: {} }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put(saved, 0))).toMatchObject({ ok: false, code: "scope" })
  })
})

describe("profile and note placement sources", () => {
  function linked(source: ParticleDocumentSource) {
    return createLibraryDocumentParticle(WORKSPACE,
      { name: "Source", mimeType: "text/plain", source }, ID(70), NOW)
  }
  const put = (value: Particle) => batch(140, [{ kind: "put_particle", particle: value, expectedRevision: null }])
  const profile = {
    documents: { verificationLetter: { path: `${WORKSPACE}/verificationLetter/file.pdf` } },
    policies: [{ id: "policy-one", title: "Policy", document: { path: `${WORKSPACE}/policies/policy-one/file.pdf` } }],
    roadmap: { sections: [{ id: "custom-plan", title: "Custom plan", slug: "custom-plan" }] },
  }
  it.each([
    { kind: "upload", documentKind: "verification-letter" },
    { kind: "policy", id: "policy-one" },
    { kind: "roadmap", sectionId: "custom-plan" },
  ] satisfies ParticleDocumentSource[])("checks the existing profile owner for $kind", async source => {
    mocks.profile.mockResolvedValue({ data: { profile }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put(linked(source)))).toMatchObject({ ok: true })
    expect(mocks.eq).toHaveBeenCalledWith("user_id", WORKSPACE)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith("organizations")
  })
  it.each([
    { kind: "upload", documentKind: "unknown" },
    { kind: "policy", id: "other-policy" },
    { kind: "roadmap", sectionId: "other-plan" },
  ] satisfies ParticleDocumentSource[])("rejects missing $kind references", async source => {
    mocks.profile.mockResolvedValue({ data: { profile }, error: null })
    expect(await applyWorkspaceParticleBatchAction(put(linked(source)))).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it.each([`${ID(998)}/verificationLetter/file.pdf`, `${WORKSPACE}/verificationLetter/../secret.pdf`])(
    "rejects cross-org/traversal profile paths", async path => {
      mocks.profile.mockResolvedValue({ data: { profile: { documents: { verificationLetter: { path } } } }, error: null })
      expect(await applyWorkspaceParticleBatchAction(put(linked({ kind: "upload", documentKind: "verification-letter" }))))
        .toMatchObject({ ok: false, code: "scope" })
    })
  it("fails closed when the profile is absent or cannot be read", async () => {
    const input = put(linked({ kind: "policy", id: "policy-one" }))
    mocks.profile.mockResolvedValue({ data: null, error: null })
    expect(await applyWorkspaceParticleBatchAction(input)).toMatchObject({ ok: false, code: "scope" })
    mocks.profile.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(input)).toMatchObject({ ok: false, code: "unavailable" })
  })
  it("checks lesson visibility with actor RLS without reading anyone's note body", async () => {
    const note = moduleNotesParticle({ workspaceId: WORKSPACE, id: ID(71), now: NOW,
      moduleId: ID(72), title: "Lesson notes" })
    mocks.modules.mockResolvedValue({ data: [{ id: ID(72) }], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(note))).toMatchObject({ ok: true })
    expect(mocks.in).toHaveBeenCalledWith("id", [ID(72)])
    expect(mocks.from).toHaveBeenCalledWith("modules")
    expect(mocks.from).not.toHaveBeenCalledWith("module_progress")
    mocks.modules.mockResolvedValue({ data: [], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(note))).toMatchObject({ ok: false, code: "scope" })
    mocks.modules.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(put(note))).toMatchObject({ ok: false, code: "unavailable" })
  })
  it("validates workspace-note aliases against the same graph, never a different board", async () => {
    const base = particle(73)
    if (base.type !== "activity") throw new Error("Wrong fixture")
    const note: Particle = { ...base, data: { ...base.data,
      widget: { kind: "notes", source: { kind: "workspace", content: "Private draft" } } } }
    const alias: Particle = { ...particle(74), type: "activity", data: { ...base.data,
      widget: { kind: "document", format: "md", name: "Note", source: { kind: "workspace_note", id: note.id } } } }
    expect(await applyWorkspaceParticleBatchAction(put(alias))).toMatchObject({ ok: false, code: "scope" })
    expect(await applyWorkspaceParticleBatchAction(batch(141, [
      { kind: "put_particle", particle: note, expectedRevision: null },
      { kind: "put_particle", particle: alias, expectedRevision: null },
    ]))).toMatchObject({ ok: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe("file placement source authorization", () => {
  const fileId = ID(600)
  const file = (id = 50) => createLibraryDocumentParticle(WORKSPACE,
    { fileId, name: "Plan.md", mimeType: "text/markdown", size: 100 }, ID(id), NOW)
  const link = (url = "https://drive.google.com/file/d/example/view") =>
    createLibraryDocumentParticle(WORKSPACE, { name: "Drive plan", mimeType: "text/plain",
      source: { kind: "drive", id: ID(601), webViewLink: url } }, ID(51), NOW)
  function stored(value: ParticleGraph) {
    mocks.persist.mockImplementation(async (args: { updateParticleGraph: (input: Json) => Json | Promise<Json> }) => {
      await args.updateParticleGraph(value)
      return { ok: true }
    })
  }
  const put = (value: Particle = file(), expectedRevision: number | null = null) =>
    batch(130, [{ kind: "put_particle", particle: value, expectedRevision }])

  it("checks new file placements through actor RLS and active organization, without signing/downloading bytes", async () => {
    mocks.files.mockResolvedValue({ data: [{ id: fileId, storage_path: `${WORKSPACE}/library/plan.md` }], error: null })
    expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: true })
    expect(mocks.from).toHaveBeenCalledWith("organization_document_files")
    expect(mocks.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(mocks.is).toHaveBeenCalledWith("document_kind", null)
    expect(mocks.is).toHaveBeenCalledWith("deleted_at", null)
    expect(mocks.in).toHaveBeenCalledWith("id", [fileId])
    expect(mocks.files).toHaveBeenCalledTimes(1)
  })
  it.each([{ data: null }, { data: [] }, { data: [{ id: fileId, storage_path: `${ID(998)}/library/plan.md` }] },
    { data: [{ id: fileId, storage_path: `${WORKSPACE}/library/../secret.md` }] }])(
    "rejects missing, inaccessible or invalid-path sources without revalidation (%j)", async ({ data }) => {
      mocks.files.mockResolvedValue({ data, error: null })
      expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: false, code: "scope" })
      expect(mocks.revalidate).not.toHaveBeenCalled()
    })
  it("distinguishes lookup failure from an inaccessible source", async () => {
    mocks.files.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("deduplicates multiple placements of the same source", async () => {
    mocks.files.mockResolvedValue({ data: [{ id: fileId, storage_path: `${WORKSPACE}/library/plan.md` }], error: null })
    expect(await applyWorkspaceParticleBatchAction(batch(131, [
      { kind: "put_particle", particle: file(50), expectedRevision: null },
      { kind: "put_particle", particle: file(52), expectedRevision: null },
    ]))).toMatchObject({ ok: true })
    expect(mocks.files).toHaveBeenCalledTimes(1)
    expect(mocks.in).toHaveBeenCalledWith("id", [fileId])
  })
  it("replays a confirmed request without rechecking a source that may have disappeared", async () => {
    mocks.files.mockResolvedValue({ data: [{ id: fileId, storage_path: `${WORKSPACE}/library/plan.md` }], error: null })
    const result = await applyWorkspaceParticleBatchAction(put())
    if (!result.ok) throw new Error(result.error)
    stored(result.value.graph)
    mocks.files.mockClear().mockResolvedValue({ data: [], error: null })
    expect(await applyWorkspaceParticleBatchAction(put())).toMatchObject({ ok: true, value: { replayed: true } })
    expect(mocks.files).not.toHaveBeenCalled()
  })
  it("bounds lookup size for a multi-document placement batch", async () => {
    const files = Array.from({ length: 101 }, (_, index) => createLibraryDocumentParticle(WORKSPACE,
      { fileId: ID(2000 + index), name: "Plan.md", mimeType: "text/markdown", size: 100 }, ID(3000 + index), NOW))
    mocks.files.mockResolvedValue({ data: files.map((_, index) => ({
      id: ID(2000 + index), storage_path: `${WORKSPACE}/library/${index}.md`,
    })), error: null })
    expect(await applyWorkspaceParticleBatchAction(batch(133, files.map(value => ({
      kind: "put_particle", particle: value, expectedRevision: null,
    }))))).toMatchObject({ ok: true })
    expect(mocks.files).toHaveBeenCalledTimes(2)
    expect(mocks.in.mock.calls.map(call => call[1].length)).toEqual([100, 1])
  })
  it("checks image sources through the same file boundary", async () => {
    const image = createLibraryDocumentParticle(WORKSPACE,
      { fileId, name: "Photo.png", mimeType: "image/png", size: 100 }, ID(53), NOW,
      { width: 100, height: 100 })
    mocks.files.mockResolvedValue({ data: [], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(image))).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.in).toHaveBeenCalledWith("id", [fileId])
  })
  it("allows moving, resizing, hiding and removing an existing missing file without source lookups", async () => {
    const saved = file()
    stored(graph([saved]))
    expect(await applyWorkspaceParticleBatchAction(put({ ...saved, position: { x: 100, y: 200 },
      size: "medium", canvasHidden: true }, 0))).toMatchObject({ ok: true })
    expect(await applyWorkspaceParticleBatchAction(batch(132, [
      { kind: "remove_particle", id: saved.id, expectedRevision: 0 },
    ]))).toMatchObject({ ok: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("checks re-add and replacement references, including replacements on hidden cards", async () => {
    const saved = { ...file(), canvasHidden: true }
    stored(graph([saved]))
    mocks.files.mockResolvedValue({ data: [], error: null })
    expect(await applyWorkspaceParticleBatchAction(put({ ...saved, canvasHidden: false }, 0)))
      .toMatchObject({ ok: false, code: "scope" })
    const replacement = createLibraryDocumentParticle(WORKSPACE,
      { fileId: ID(602), name: "Other.md", mimeType: "text/markdown", size: 100 }, saved.id, NOW)
    expect(await applyWorkspaceParticleBatchAction(put({ ...replacement, canvasHidden: true }, 0)))
      .toMatchObject({ ok: false, code: "scope" })
    expect(mocks.files).toHaveBeenCalledTimes(2)
  })
  it("accepts only the canonical organization-attached Drive link", async () => {
    const webViewLink = "https://drive.google.com/file/d/example/view"
    mocks.drive.mockResolvedValue({ data: [{ id: ID(601), web_view_link: webViewLink }], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(link()))).toMatchObject({ ok: true })
    expect(mocks.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(mocks.eq).toHaveBeenCalledWith("provider", "google_drive")
    expect(mocks.eq).toHaveBeenCalledWith("status", "available")
    expect(await applyWorkspaceParticleBatchAction(put(link("https://docs.google.com/document/d/other/edit"))))
      .toMatchObject({ ok: false, code: "scope" })
    mocks.drive.mockResolvedValue({ data: [], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(link()))).toMatchObject({ ok: false, code: "scope" })
  })
  it("rechecks edited Drive URLs but avoids lookups for ordinary movement", async () => {
    const saved = link()
    stored(graph([saved]))
    expect(await applyWorkspaceParticleBatchAction(put({ ...saved, position: { x: 50, y: 20 } }, 0)))
      .toMatchObject({ ok: true })
    expect(mocks.drive).not.toHaveBeenCalled()
    mocks.drive.mockResolvedValue({ data: [{ id: ID(601), web_view_link: "https://drive.google.com/file/d/example/view" }], error: null })
    expect(await applyWorkspaceParticleBatchAction(put(link("https://docs.google.com/document/d/forged/edit"), 0)))
      .toMatchObject({ ok: false, code: "scope" })
    mocks.drive.mockResolvedValue({ data: null, error: { message: "offline" } })
    expect(await applyWorkspaceParticleBatchAction(put(link("https://docs.google.com/document/d/forged/edit"), 0)))
      .toMatchObject({ ok: false, code: "unavailable" })
  })
})

describe("authenticated Particle action boundary", () => {
  const event = () => {
    const preset = PARTICLE_PRESETS.find(item => item.id === "event")
    if (!preset) throw new Error("Missing Event preset")
    return buildParticlePreset(preset, { id: ID(30), workspaceId: WORKSPACE, now: NOW,
      title: "Dinner", description: "", fields: { ...DEFAULT_PRESET_FIELDS, when: "2026-10-16T20:00" } })
  }
  it("requires calendar rights before an Event save can commit", async () => {
    const scheduled = batch(110, [{ kind: "put_particle", particle: event(), expectedRevision: null }])
    mocks.calendarAccess.mockResolvedValueOnce({ orgId: WORKSPACE, canManageCalendar: false })
    expect(await applyWorkspaceParticleBatchAction(scheduled)).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.revalidate).not.toHaveBeenCalled()
    expect(await applyWorkspaceParticleBatchAction(scheduled)).toMatchObject({ ok: true })
  })
  it("does not check calendar permissions for unrelated changes, or accept another active calendar scope", async () => {
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({ ok: true })
    expect(mocks.calendarAccess).not.toHaveBeenCalled()
    mocks.calendarAccess.mockResolvedValueOnce({ orgId: ID(9999), canManageCalendar: true })
    expect(await applyWorkspaceParticleBatchAction(batch(111, [{ kind: "put_particle", particle: event(), expectedRevision: null }]))).toMatchObject({ ok: false, code: "scope" })
  })
  it("allows hiding/moving scheduled cards without calendar rights, but denies unscheduling and deletion", async () => {
    const saved = event()
    if (saved.type !== "activity" || saved.data.widget?.kind !== "event") throw new Error("Wrong fixture")
    const stored = graph([saved])
    mocks.persist.mockImplementation(async (args: { updateParticleGraph: (input: Json) => Json | Promise<Json> }) => {
      await args.updateParticleGraph(stored)
      return { ok: true }
    })
    mocks.calendarAccess.mockResolvedValue({ orgId: WORKSPACE, canManageCalendar: false })
    expect(await applyWorkspaceParticleBatchAction(batch(120, [{ kind: "put_particle", expectedRevision: 0,
      particle: { ...saved, canvasHidden: true, position: { x: 500, y: 300 } } }]))).toMatchObject({ ok: true })
    expect(mocks.calendarAccess).not.toHaveBeenCalled()
    expect(await applyWorkspaceParticleBatchAction(batch(121, [{ kind: "remove_particle", id: saved.id, expectedRevision: 0 }]))).toMatchObject({ ok: false, code: "scope" })
    expect(await applyWorkspaceParticleBatchAction(batch(122, [{ kind: "put_particle", expectedRevision: 0,
      particle: { ...saved, data: { ...saved.data, widget: { ...saved.data.widget, startsAt: null } } } }]))).toMatchObject({ ok: false, code: "scope" })
  })
  it("rejects signed-out actors, viewers and other organization IDs before a write", async () => {
    mocks.actor.mockResolvedValueOnce({ error: "You must be signed in." })
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "scope",
    })
    mocks.canEdit.mockResolvedValueOnce(false)
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "scope",
    })
    expect(
      await applyWorkspaceParticleBatchAction({
        ...request,
        workspaceId: ID(777),
      })
    ).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("writes only through the authorized board adapter and revalidates on success", async () => {
    const result = await applyWorkspaceParticleBatchAction(request)
    expect(result).toMatchObject({
      ok: true,
      value: { graph: { revision: 1 }, replayed: false },
    })
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: WORKSPACE, userId: ID(888) })
    )
    expect(mocks.revalidate).toHaveBeenCalledWith("/workspace")
  })
  it("returns invalid-operation and storage errors without claiming a save", async () => {
    expect(
      await applyWorkspaceParticleBatchAction({ ...request, operations: [] })
    ).toMatchObject({ ok: false, code: "invalid" })
    mocks.persist.mockResolvedValueOnce({
      error: "Unable to save workspace layout.",
    })
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "unavailable",
    })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("reads only the active workspace and does not replace an unsupported stored graph", async () => {
    expect(await loadWorkspaceParticleGraphAction()).toMatchObject({
      ok: true,
      value: { workspaceId: WORKSPACE },
    })
    mocks.read.mockResolvedValueOnce({
      data: { state: { particleGraph: { schemaVersion: 99, updatedAt: NOW } } },
      error: null,
    })
    expect(await loadWorkspaceParticleGraphAction()).toMatchObject({
      ok: false,
      code: "unsupported",
    })
    expect(mocks.persist).not.toHaveBeenCalled()
  })
})
