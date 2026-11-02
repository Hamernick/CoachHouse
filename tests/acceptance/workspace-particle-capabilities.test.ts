import { afterEach, describe, expect, it, vi } from "vitest"
import { bindParticleSource, getParticleCapabilities, getParticleCapabilityCatalog, particleRegistry } from "@/features/workspace-particles/lib/particle-registry"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { workspaceNoteDocuments } from "@/features/workspace-particles/lib/particle-notes"
import { readNote, writeNote } from "@/features/workspace-particles/lib/note-editor-client"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { ID, NOW, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"

vi.mock("@/features/workspace-particles/note-actions", () => ({ loadPersonalNote: vi.fn(), writePersonalNote: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())
function note() {
  return particleSchema.parse({ ...particle(2), data: { template: "task", steps: [],
    widget: { kind: "notes", source: { kind: "workspace", content: "Private meeting details" } } } })
}

describe("registered manual Particle capabilities", () => {
  it("derives a serializable catalog without record contents or server handlers", () => {
    const catalog = getParticleCapabilityCatalog({ includeSchemas: true })
    expect(catalog.entries.map(item => item.id)).toEqual(["plan", "workspace_note", "workspace_form", "project_data_view", "existing_data_view"])
    expect(catalog.entries.every(item => item.availability === "manual")).toBe(true)
    expect(catalog.schemas?.["plan.input"]).toHaveProperty("properties.change")
    expect(catalog.schemas?.particle_commit).toHaveProperty("properties.graph")
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog)
    const compact = getParticleCapabilityCatalog()
    expect(compact.schemas).toBeUndefined()
    expect(JSON.stringify(compact).length).toBeLessThan(2000)
    expect(JSON.stringify(catalog)).not.toContain("Private meeting details")
    expect(JSON.stringify(catalog)).not.toContain("matches")
  })

  it("binds the original source identity and keeps unregistered or personal sources unavailable", () => {
    expect(bindParticleSource(note())).toEqual({ kind: "workspace_note", organizationId: WORKSPACE, id: ID(2), revision: 0 })
    expect(bindParticleSource(particle(1, "objective"))).toMatchObject({ kind: "objective", id: ID(1) })
    const personal = particleSchema.parse({ ...note(), data: { template: "task", steps: [], widget: { kind: "notes", source: { kind: "module", moduleId: "lesson" } } } })
    expect(bindParticleSource(personal)).toBeNull()
    expect(getParticleCapabilities(personal)).toEqual([])
    for (const type of ["calendar", "people", "decision", "metric", "workflow", "finance"] as const) {
      expect(getParticleCapabilities(particle(3, type))).toEqual([])
      expect(particleRegistry[type].schema.safeParse(particleRegistry[type].defaults()).success).toBe(true)
    }
    expect(particleRegistry.activity.capabilities.workspace_note.inputSchema.safeParse({ source: { kind: "module_note", id: "lesson" }, body: { content: "Copy me" } }).success).toBe(false)
  })

  it("uses the registered note input and canonical writer receipt when saving and reopening", async () => {
    const original = note(), document = workspaceNoteDocuments([original])[0]
    let saved = graph([particle(1, "objective"), original])
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method !== "POST") return Response.json({ particle: saved.particles.find(item => item.id === original.id), revision: saved.revision })
      const input = JSON.parse(init.body as string)
      expect(input.operations).toHaveLength(1)
      expect(input.operations[0]).toMatchObject({ kind: "put_particle", expectedRevision: original.revision, particle: { id: original.id, workspaceId: WORKSPACE } })
      const prepared = await prepareAuthorizedParticleMutation({ input, workspaceId: WORKSPACE, canEdit: true, now: NOW })
      if (!prepared.ok) throw new Error(prepared.error)
      const commit = prepared.value(saved)
      saved = commit.graph
      return Response.json({ ok: true, value: commit })
    })
    vi.stubGlobal("fetch", fetchMock)
    const detail = await readNote(document, WORKSPACE)
    const edited = await writeNote(document, detail, { content: "Confirmed next steps" }, ID(100))
    expect(edited?.body.content).toBe("Confirmed next steps")
    const reloaded = await readNote(document, WORKSPACE)
    expect(reloaded.body).toEqual(edited?.body)
    expect(reloaded.particle?.id).toBe(original.id)
    expect(saved.particles).toHaveLength(2)
  })

  it("rejects mismatched sources and malformed confirmation instead of claiming a save", async () => {
    const original = note(), document = workspaceNoteDocuments([original])[0]
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ particle: { ...original, workspaceId: ID(998) }, revision: 0 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(readNote(document, WORKSPACE)).rejects.toThrow(/another source/)
    const detail = { body: { content: "Draft" }, updatedAt: null, version: null, particle: original, revision: 0 }
    fetchMock.mockResolvedValue(Response.json({ ok: true, value: { graph: graph([original]) } }))
    await expect(writeNote(document, detail, detail.body, ID(101))).rejects.toThrow(/confirm/)
    fetchMock.mockResolvedValue(Response.json({ ok: true, value: { graph: { ...graph([original]), workspaceId: ID(998) }, inverse: [], replayed: false } }))
    await expect(writeNote(document, detail, detail.body, ID(103))).rejects.toThrow(/Organization changed/)
    const calls = fetchMock.mock.calls.length
    await expect(writeNote(document, { ...detail, particle: { ...original, id: ID(99) } }, detail.body, ID(102))).rejects.toThrow(/Reload/)
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })
})
