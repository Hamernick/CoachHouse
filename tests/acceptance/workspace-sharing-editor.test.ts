import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePageEditor } from "@/features/workspace-sharing/hooks/use-page-editor"
import { SharePageEditor } from "@/features/workspace-sharing/components/workspace-share-panel"
import { pageChoice, type PageEditorData } from "@/features/workspace-sharing/lib/page-editor"
import { movePageMember } from "@/features/workspace-sharing/lib/page-membership"
import { useParticleSelection } from "@/features/workspace-particles/hooks/use-particle-selection"
import { graph, particle, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
import type { WorkspacePage } from "@/features/workspace-sharing/types"

const mocks = vi.hoisted(() => ({ review: vi.fn(), commit: vi.fn(), load: vi.fn(), updates: [] as unknown[], toast: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/actions", () => ({ reviewWorkspacePageAction: mocks.review, commitWorkspacePageAction: mocks.commit, loadWorkspacePageEditorAction: mocks.load }))
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toast } }))
// Reuse the existing real-dispatcher SSR observation pattern from optimistic
// placement tests; exercise async refs without a new browser test framework.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>()
  return { ...actual, useState(initial?: unknown) {
    const [value, set] = actual.useState(initial)
    return [value, (next: unknown) => { mocks.updates.push(next); set(next) }]
  } }
})
const draft = { title: "Community table", description: "Join us", particleIds: [ID(1)] }
const snapshot = { version: 1 as const, brand: { name: "Community table", organizationSlug: "community-table" },
  title: draft.title, description: draft.description, items: [{ id: ID(1), title: "Welcome", content: { kind: "text" as const } }] }
const page = (visibility: "private" | "public" = "private"): WorkspacePage => ({
  id: ID(10), orgId: WORKSPACE, linkId: ID(10), revision: 1, draft,
  visibility, publishedSnapshot: visibility === "public" ? snapshot : null,
  publishedAt: visibility === "public" ? NOW : null, createdAt: NOW, updatedAt: NOW,
})
const data = (): PageEditorData => ({ workspaceId: WORKSPACE, publishingEnabled: true, suggestedPageId: ID(10),
  page: null, pages: [], initialParticleIds: [ID(1)], choices: [pageChoice(particle(1, "objective")), pageChoice(particle(2))] })
function harness(input = data()) {
  let result: ReturnType<typeof usePageEditor> | undefined
  const dirty = vi.fn()
  function Harness() { result = usePageEditor({ data: input, particleId: ID(1), onDirtyChange: dirty }); return null }
  renderToStaticMarkup(createElement(Harness))
  if (!result) throw new Error("Missing editor")
  return { editor: result, dirty }
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.updates.length = 0
  mocks.review.mockResolvedValue({ ok: true, value: { page: null, snapshot, reviewToken: "a".repeat(64) } })
  mocks.commit.mockResolvedValue({ ok: true, value: { page: page(), replayed: false } })
})
afterEach(() => vi.unstubAllGlobals())

describe("Share editor confirmed-state and retry behavior", () => {
  it("starts a new page with the selected cards in order", () => {
    const input = data(); input.initialParticleIds = [ID(2), ID(1)]
    const { editor } = harness(input)
    expect(editor.state.draft.particleIds).toEqual([ID(2), ID(1)])
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it("reorders locally without accepting dropped, duplicated or injected IDs", () => {
    const input = data(); input.initialParticleIds = [ID(1), ID(2)]
    const { editor } = harness(input)
    editor.reorder([ID(2), ID(1)])
    expect(mocks.updates.at(-1)).toMatchObject({ draft: { particleIds: [ID(2), ID(1)] } })
    const count = mocks.updates.length
    editor.reorder([ID(2)]); editor.reorder([ID(2), ID(2)]); editor.reorder([ID(2), ID(99)])
    expect(mocks.updates).toHaveLength(count)
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it("keeps typing and membership changes local until an explicit action", () => {
    const { editor } = harness()
    editor.update({ ...draft, title: "Private edits" })
    editor.toggle(ID(2))
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.updates.at(-1)).toMatchObject({ draft: { title: "Private edits", particleIds: [ID(1), ID(2)] } })
  })
  it("reviews then publishes exactly the reviewed saved content", async () => {
    const { editor } = harness()
    editor.update(draft)
    await editor.review()
    expect(mocks.commit).not.toHaveBeenCalled()
    await editor.write("publish")
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ intent: "publish", pageId: ID(10), expectedRevision: 0,
      draft, reviewToken: "a".repeat(64) }))
  })
  it("invalidates a preview when any local content or order changes", async () => {
    const { editor } = harness()
    await editor.review()
    editor.toggle(ID(2))
    await editor.write("publish")
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(mocks.updates.at(-1)).toMatchObject({ preview: null })
  })
  it("retains and retries the exact request after an ambiguous save", async () => {
    const { editor } = harness()
    mocks.commit.mockRejectedValueOnce(new Error("Response interrupted"))
    await editor.write("save_draft")
    const first = mocks.commit.mock.calls[0][0]
    expect(mocks.updates.at(-1)).toMatchObject({ uncertain: true, page: null })
    editor.update({ ...draft, title: "Must not replace unconfirmed input" })
    await editor.write("save_draft")
    expect(mocks.commit).toHaveBeenCalledOnce()
    await editor.retry()
    expect(mocks.commit.mock.calls[1][0]).toEqual(first)
    expect(mocks.updates.at(-1)).toMatchObject({ uncertain: false, page: { revision: 1 }, notice: "Draft saved." })
  })
  it("keeps the confirmed publication on a definite conflict and permits fresh review", async () => {
    const input = data(); input.page = page("public")
    const { editor } = harness(input)
    editor.update({ ...draft, title: "Unpublished" })
    mocks.commit.mockResolvedValue({ ok: false, code: "conflict", error: "Page changed", uncertain: false })
    await editor.write("save_draft")
    expect(mocks.updates.at(-1)).toMatchObject({ page: { visibility: "public", publishedSnapshot: snapshot }, draft: { title: "Unpublished" }, uncertain: false })
    await editor.review()
    expect(mocks.review).toHaveBeenCalledOnce()
  })
  it("makes Private without discarding unsaved page edits", async () => {
    const input = data(); input.page = page("public")
    const { editor } = harness(input)
    editor.update({ ...draft, description: "Unpublished introduction" })
    const saved = { ...page("public"), visibility: "private", revision: 2 }
    mocks.commit.mockResolvedValue({ ok: true, value: { page: saved, replayed: false } })
    await editor.write("make_private")
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ intent: "make_private", expectedRevision: 1 }))
    expect(mocks.updates.at(-1)).toMatchObject({ page: { visibility: "private" }, draft: { description: "Unpublished introduction" }, baseline: draft })
  })
  it("does not send a second command while the first is pending", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.commit.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { editor } = harness()
    const saving = editor.write("save_draft")
    await editor.write("save_draft")
    expect(mocks.commit).toHaveBeenCalledOnce()
    finish({ ok: true, value: { page: page(), replayed: false } }); await saving
  })
  it("never publishes when the server-reported feature gate is off", async () => {
    const input = data(); input.publishingEnabled = false
    const { editor } = harness(input)
    await editor.review(); await editor.write("publish")
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it("surfaces an empty selection without saving", async () => {
    const { editor } = harness()
    editor.toggle(ID(1)); await editor.review()
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.updates.at(-1)).toMatchObject({ field: "particleIds", preview: null })
  })
  it("keeps order deterministic and ignores unsupported/duplicate additions", () => {
    expect(movePageMember([ID(1), ID(2)], ID(2), -1)).toEqual([ID(2), ID(1)])
    expect(movePageMember([ID(1), ID(2)], ID(1), -1)).toEqual([ID(1), ID(2)])
    const input = data(); input.choices.push(pageChoice(particle(3, "people")))
    const { editor } = harness(input)
    editor.toggle(ID(3)); expect(mocks.updates).toHaveLength(0)
  })
})

describe("Share controls use the existing compact window", () => {
  it("renders one header, a larger description field and no generic status selector", () => {
    const html = renderToStaticMarkup(createElement(SharePageEditor, { data: data(), particleId: ID(1), onDirtyChange: vi.fn(), onBack: vi.fn(), onChoose: vi.fn() }))
    expect(html.match(/>Share page<\/h2>/g)).toHaveLength(1)
    expect(html).toContain("Name this page")
    expect(html).toContain("min-h-28")
    expect(html).toContain('aria-label="Page actions"')
    expect(html).not.toContain("Backlog")
    expect(html).not.toContain("Node details")
    expect(html).not.toContain("Next steps")
  })
  it("blocks dirty details-to-share and share-to-details navigation without native confirms", () => {
    const dirty = { current: true }, selectParticle = vi.fn(), setNodes = vi.fn()
    const native = vi.fn()
    vi.stubGlobal("window", { confirm: native, requestAnimationFrame: vi.fn() })
    let result: ReturnType<typeof useParticleSelection> | undefined
    function Harness() { result = useParticleSelection({ graph: graph(), selectedId: ID(1), dirty, selectParticle, setNodes }); return null }
    renderToStaticMarkup(createElement(Harness))
    if (!result) throw new Error("Missing selection")
    expect(result.select(ID(1), { view: "share" })).toBe(false)
    dirty.current = false; expect(result.select(ID(1), { view: "share" })).toBe(true)
    dirty.current = true; expect(result.select(ID(1), { view: "details" })).toBe(false)
    expect(native).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it("captures current multiselection when Share opens and preserves selected canvas nodes", () => {
    const dirty = { current: false }, setNodes = vi.fn()
    let result: ReturnType<typeof useParticleSelection> | undefined
    function Harness() { result = useParticleSelection({ graph: graph(), selectedId: ID(1), dirty,
      selectParticle: vi.fn(), setNodes, getSelectedIds: () => [ID(2), ID(1), ID(99)] }); return null }
    renderToStaticMarkup(createElement(Harness))
    if (!result) throw new Error("Missing selection")
    expect(result.select(ID(1), { view: "share" })).toBe(true)
    expect(mocks.updates).toContainEqual([ID(2), ID(1)])
    const updateNodes = setNodes.mock.calls[0][0]
    expect(updateNodes([{ id: ID(1), selected: true }, { id: ID(2), selected: true }])).toEqual([
      { id: ID(1), selected: true }, { id: ID(2), selected: true },
    ])
  })
})
