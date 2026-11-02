import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getParticleCapabilityCatalog, createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { getParticleNotes } from "@/features/workspace-particles/lib/particle-notes"
import { writeNote } from "@/features/workspace-particles/lib/note-editor-client"
import { ResearchPresentation, ResearchPlanPresentation, IncomingResearchPresentation } from "@/features/workspace-ai/components/research-presentation"
import { projectResearchPresentation, projectIncomingResearchPresentation, validateResearchPresentation } from "@/features/workspace-ai/lib/research-presentation"
import { createResearchItemParser, researchItemPreviewSchema } from "@/features/workspace-ai/lib/research-item-preview"
import { createResearchDraft, applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE, NOW, graph, particle } from "./fixtures/particle-fixtures"

const result = (): ResearchResult => ({
  runId: ID(8), target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 },
  title: "Community event", summary: "Prepare invitations", questions: [], sources: [], decisions: [], removeReferences: [],
  items: [{ key: "invite", title: "Invitation draft", kind: "note", description: "Hello neighbors,\nJoin our community event.", referenceId: null, evidenceIds: [], dependsOn: [] }],
})
afterEach(() => vi.unstubAllGlobals())

describe("bounded working-output presentation", () => {
  it("renders the actual note text through the pinned renderer without source effects", () => {
    const value = result(), before = structuredClone(value), fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const markup = renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: value }))
    expect(markup).toContain('aria-label="Proposed plan items"')
    expect(markup).toContain("Invitation draft")
    expect(markup).toContain("Hello neighbors,\nJoin our community event.")
    expect(markup).not.toMatch(/<button|<input|<form|onClick|href=/)
    expect(fetch).not.toHaveBeenCalled()
    expect(value).toEqual(before)
  })
  it("escapes markup and treats path-looking strings as text, never bindings", () => {
    const value = result()
    value.items[0].description = '<script>alert(1)</script> $state:/credentials'
    const markup = renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: value }))
    expect(markup).toContain("&lt;script&gt;")
    expect(markup).not.toContain("<script>")
    expect(markup).toContain("$state:/credentials")
  })
  it.each(["state", "on", "watch", "visible", "repeat", "slots", "unknown", "binding", "wrong_type", "cycle", "orphan", "duplicate", "oversized", "version"])("rejects %s without pruning or a partial successful render", attack => {
    const value = projectResearchPresentation(result())
    const spec = value.spec as unknown as { root: string; elements: Record<string, Record<string, unknown>>; state?: unknown }
    const row = spec.elements.item_invite
    if (attack === "state") spec.state = { credentials: "secret" }
    if (["on", "watch", "visible", "repeat", "slots"].includes(attack)) row[attack] = { path: "/other-org" }
    if (attack === "unknown") row.type = "PublishButton"
    if (attack === "binding") (row.props as Record<string, unknown>).content = { $bindState: "/other-org" }
    if (attack === "wrong_type") (row.props as Record<string, unknown>).title = 42
    if (attack === "cycle") row.children = ["plan"]
    if (attack === "orphan") spec.elements.item_orphan = structuredClone(row)
    if (attack === "duplicate") spec.elements.plan.children = ["item_invite", "item_invite"]
    if (attack === "oversized") (row.props as Record<string, unknown>).content = "x".repeat(96001)
    if (attack === "version") Object.assign(value, { capabilityVersion: 2 })
    expect(() => validateResearchPresentation(value)).toThrow()
    const markup = renderToStaticMarkup(createElement(ResearchPresentation, { value }))
    expect(markup).toContain('role="alert"')
    expect(markup).not.toContain("Invitation draft")
  })
  it("revalidates old previews against the current manual registry", () => {
    const old = projectResearchPresentation(result()), catalog = getParticleCapabilityCatalog()
    expect(() => validateResearchPresentation(old, { ...catalog, entries: catalog.entries.filter(entry => entry.id !== "workspace_note") })).toThrow(/unavailable/)
    expect(() => validateResearchPresentation(old, { ...catalog, entries: catalog.entries.filter(entry => entry.id !== "plan") })).toThrow(/unavailable/)
  })
  it("uses a minimal display snapshot and retains reference, branch and dependency meaning", () => {
    const value = result()
    value.items.push({ key: "choose", title: "Choose date", kind: "decision", description: "Confirm together", referenceId: null, evidenceIds: [], dependsOn: ["invite"] },
      { key: "existing", title: "Model title", kind: "reference", description: "Do not expose reference description", referenceId: `particle:${ID(5)}`, evidenceIds: [], dependsOn: [] })
    value.decisions = [{ itemKey: "choose", outcomes: [{ key: "yes", label: "Confirmed", next: ["existing"] }, { key: "no", label: "Reschedule", next: [] }] }]
    const plan = { title: "Current plan", members: [{ id: ID(5), title: "Canonical title" }] }
    const projected = projectResearchPresentation(value, plan), text = JSON.stringify(projected)
    expect(text).not.toContain(ID(5)); expect(text).not.toContain(WORKSPACE); expect(text).not.toContain(value.runId)
    const markup = renderToStaticMarkup(createElement(ResearchPresentation, { value: projected }))
    expect(markup).toContain("Canonical title"); expect(markup).toContain("Existing")
    expect(markup).toContain("After: Invitation draft"); expect(markup).toContain("Confirmed")
    expect(markup).not.toContain("Do not expose")
  })
  it("rejects invalid domain topology before rendering even if the render grammar is valid", () => {
    const value = result()
    value.items[0].dependsOn = ["invite"]
    expect(() => projectResearchPresentation(value)).toThrow()
    expect(renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: value }))).toContain('role="alert"')
  })
  it.each([1, 3, 37])("projects only completed streamed units across %i-character fragments", width => {
    const original = result(), parser = createResearchItemParser(), serialized = JSON.stringify(original), items = []
    for (let offset = 0; offset < serialized.length; offset += width) {
      const parsed = parser(serialized.slice(offset, offset + width))
      expect(parsed.invalid).toBe(false)
      items.push(...parsed.items.map(item => researchItemPreviewSchema.parse({ key: item.key, title: item.title, kind: item.kind, description: item.description })))
      expect(projectIncomingResearchPresentation(items).spec.elements.plan).toMatchObject({ children: items.map(item => `item_${item.key}`) })
    }
    const markup = renderToStaticMarkup(createElement(IncomingResearchPresentation, { items }))
    expect(markup).toContain("Hello neighbors")
    expect(markup).not.toContain("After:")
  })
  it("does not repair truncated or malformed units into an artifact", () => {
    const parser = createResearchItemParser()
    const parsed = parser('{"items":[{"key":"invite","kind":"note","description":"unfinished')
    expect(parsed.items).toEqual([])
    const value = projectIncomingResearchPresentation([])
    expect(value.spec.elements.plan).toMatchObject({ children: [] })
    expect(() => projectIncomingResearchPresentation([{ ...result().items[0], unknown: "publish" }] as never)).toThrow()
  })
  it("saves the edited preview as the same note content as the manual canonical writer and does not repeat research effects", async () => {
    const original = result(), draft = createResearchDraft(original)
    draft.items[0].description = "Hello neighbors,\nMeet us at the library on Friday."
    const edited = applyResearchDraft(original, draft), before = graph([particle(1, "objective")])
    expect(renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: edited }))).toContain("library on Friday")
    let sequence = 100
    const applied = await applyParticleBatch(before, { id: ID(90), workspaceId: WORKSPACE, baseRevision: 0,
      operations: researchPlanOperations(before, edited, ID(91), NOW, () => ID(sequence++)), requireExactRevision: true }, NOW)
    if (!applied.ok) throw new Error(applied.error)
    const aiNote = applied.value.graph.particles.find(item => item.id !== ID(1))!
    expect(getParticleNotes(aiNote)).toMatchObject({ kind: "workspace", content: draft.items[0].description })
    expect(researchPlanOperations(applied.value.graph, edited, ID(91), NOW, () => ID(sequence++))).toEqual([])
    const manual = createParticle("activity", { id: ID(20), workspaceId: WORKSPACE, now: NOW, title: edited.items[0].title })
    if (manual.type !== "activity") throw new Error("Wrong fixture")
    manual.data.widget = { kind: "notes", source: { kind: "workspace", content: "" } }
    const manualGraph = graph([manual])
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const saved = await applyParticleBatch(manualGraph, JSON.parse(init.body as string), NOW)
      if (!saved.ok) throw new Error(saved.error)
      return new Response(JSON.stringify(saved), { status: 200 })
    })
    vi.stubGlobal("fetch", fetch)
    const saved = await writeNote({ id: `workspace-note:${manual.id}`, title: manual.title, summary: "", updatedAt: NOW,
      source: { kind: "workspace_note", id: manual.id } },
    { body: { content: "" }, updatedAt: NOW, version: null, particle: manual, revision: 0 }, { content: draft.items[0].description }, ID(92))
    expect(saved?.body.content).toBe(getParticleNotes(aiNote)?.kind === "workspace" ? draft.items[0].description : null)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(original.items[0].description).not.toBe(draft.items[0].description)
  })
})
