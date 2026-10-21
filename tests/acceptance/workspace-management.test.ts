import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/supabase"
import { changeWorkspaceCatalog, mergeWorkspaceState, readWorkspaceCatalog, allWorkspaceStates, selectWorkspaceState, summarizeWorkspaces, workspaceCommandSchema } from "@/features/workspace-management"
import { applyWorkspaceTutorialActivationToSeed } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-content-helpers"
import { resolveVisibleWorkspaceCanvasCardIds } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-visible-cards"
import { reduceWorkspaceBoardVisibility } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-visibility-reducer"
import { normalizeWorkspaceBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { persistWorkspaceBoardState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write"
import { buildWorkspaceBoardUiPreferencesStorageKey } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-ui-preferences"
const mocks = vi.hoisted(() => ({ context: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: mocks.context }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { saveWorkspaceCommand } from "@/features/workspace-management/server/actions"
vi.mock("@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas", () => ({ WorkspaceBoardCanvas: () => createElement("div", { "data-live-canvas": "true" }) }))
import { MyOrganizationWorkspaceView } from "@/app/(dashboard)/my-organization/_components/workspace-board/my-organization-workspace-view"
const ORG = "10000000-0000-4000-8000-000000000001"
const A = "10000000-0000-4000-8000-000000000002"
const B = "10000000-0000-4000-8000-000000000003"
const NOW = "2026-10-19T20:00:00.000Z"
const create = (id = A, name = "Planning") => ({ kind: "create" as const, orgId: ORG, id, name })
function database(initial: Json = {}) {
  let state = initial
  let revision = 1
  let conflict: (() => void) | undefined
  const writes: Array<Record<string, unknown>> = []
  const client = { rpc: vi.fn(async () => ({ data: 1, error: null })), from: vi.fn((table: string) => {
    expect(table).toBe("organization_workspace_boards")
    let update: { state: Json } | undefined
    const filters: Record<string, string> = {}
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { filters[key] = value; return query },
      update: (value: { state: Json }) => { update = value; return query },
      maybeSingle: async () => {
        expect(filters.org_id).toBe(ORG)
        if (!update) return { data: { state, updated_at: String(revision) }, error: null }
        if (conflict) { const run = conflict; conflict = undefined; run(); revision++ }
        if (filters.updated_at !== String(revision)) return { data: null, error: null }
        writes.push(filters)
        state = update.state
        revision++
        return { data: { org_id: ORG, updated_at: String(revision) }, error: null }
      },
    }
    return query
  }) }
  return { client: client as unknown as SupabaseClient<Database>, writes, read: () => state, change: (next: Json) => { state = next }, race: (run: () => void) => { conflict = run } }
}
beforeEach(() => vi.clearAllMocks())
describe("named organization workspaces", () => {
  it("creates a separate empty canvas without changing the original graph", () => {
    const root = { particleGraph: { sentinel: "original" }, nodes: [{ id: "original-card" }] }
    const next = changeWorkspaceCatalog(root, create(), NOW)
    expect(selectWorkspaceState(next).particleGraph).toEqual(root.particleGraph)
    expect(selectWorkspaceState(next, A).particleGraph).toBeUndefined()
    expect(summarizeWorkspaces(next)).toEqual([{ id: null, name: "Main workspace" }, { id: A, name: "Planning" }])
    const board = normalizeWorkspaceBoardState(selectWorkspaceState(next, A))
    expect(board.workspaceCanvasId).toBe(A)
    expect(board.visibility?.allCardsHiddenExplicitly).toBe(true)
    expect(board.nodes.every((node) => board.hiddenCardIds.includes(node.id))).toBe(true)
    const hydrated = reduceWorkspaceBoardVisibility(board, { type: "hydrate_legacy_visibility" })
    expect(hydrated.nodes.every((node) => hydrated.hiddenCardIds.includes(node.id))).toBe(true)
    expect(resolveVisibleWorkspaceCanvasCardIds(hydrated.hiddenCardIds)).toEqual([])
    const rendered = applyWorkspaceTutorialActivationToSeed({ boardState: hydrated }, {
      initialOnboardingRequired: false, workspaceOnboardingActive: false,
      workspaceTutorialRequested: false, workspaceOnboardingCompletedAt: NOW,
    })
    expect(resolveVisibleWorkspaceCanvasCardIds(rendered.boardState.hiddenCardIds)).toEqual([])
  })
  it("replays creation and rejects changed retries, invalid names and injected state", () => {
    const stored = changeWorkspaceCatalog({}, create(), NOW)
    expect(changeWorkspaceCatalog(stored, create(), NOW)).toEqual(stored)
    expect(() => changeWorkspaceCatalog(stored, create(A, "Changed"), NOW)).toThrow(/already created/)
    for (const command of [{ ...create(), name: "  " }, { ...create(), name: "x".repeat(81) }, { ...create(), state: {} }, { ...create(), id: "bad" }])
      expect(workspaceCommandSchema.safeParse(command).success).toBe(false)
    expect(workspaceCommandSchema.parse({ ...create(), name: "  Planning  " })).toMatchObject({ name: "Planning" })
  })
  it("protects sibling canvases and the catalog from ordinary board writes", () => {
    let stored = changeWorkspaceCatalog({ particleGraph: { main: true } }, create(), NOW)
    stored = changeWorkspaceCatalog(stored, create(B, "Events"), NOW)
    const next = mergeWorkspaceState(stored, { particleGraph: { a: true }, workspaceCatalog: "malicious" }, A)
    expect(selectWorkspaceState(next).particleGraph).toEqual({ main: true })
    expect(selectWorkspaceState(next, B)).toEqual(selectWorkspaceState(stored, B))
    expect(selectWorkspaceState(next, A).particleGraph).toEqual({ a: true })
    const mainSave = mergeWorkspaceState(next, { particleGraph: { updated: true }, workspaceCatalog: {} })
    expect(readWorkspaceCatalog(mainSave)).toEqual(readWorkspaceCatalog(next))
    expect(() => selectWorkspaceState({}, A)).toThrow(/not found/)
    expect(() => selectWorkspaceState({}, "")).toThrow()
    expect(() => readWorkspaceCatalog({ workspaceCatalog: { version: 2 } })).toThrow(/No changes/)
  })
  it("renames without changing data and detects another user's rename", () => {
    const stored = changeWorkspaceCatalog({}, create(), NOW)
    const command = { kind: "rename" as const, orgId: ORG, id: A, name: "Strategy", previousName: "Planning" }
    const next = changeWorkspaceCatalog(stored, command, NOW)
    expect(selectWorkspaceState(next, A)).toEqual(selectWorkspaceState(stored, A))
    expect(summarizeWorkspaces(next)[1].name).toBe("Strategy")
    expect(changeWorkspaceCatalog(next, command, NOW)).toEqual(next)
    expect(() => changeWorkspaceCatalog(next, { ...command, name: "Another" }, NOW)).toThrow(/someone else/)
  })
  it("deletes only the selected canvas, rejects stale names and makes retries safe", () => {
    let stored = changeWorkspaceCatalog({ particleGraph: { main: true } }, create(), NOW)
    stored = changeWorkspaceCatalog(stored, create(B, "Other"), NOW)
    const command = { kind: "delete" as const, orgId: ORG, id: A, previousName: "Planning" }
    expect(() => changeWorkspaceCatalog(stored, { ...command, previousName: "Old name" }, NOW)).toThrow(/changed/)
    const next = changeWorkspaceCatalog(stored, command, NOW)
    expect(summarizeWorkspaces(next).map((item) => item.name)).toEqual(["Main workspace", "Other"])
    expect(selectWorkspaceState(next).particleGraph).toEqual({ main: true })
    expect(selectWorkspaceState(next, B)).toEqual(selectWorkspaceState(stored, B))
    expect(() => selectWorkspaceState(next, A)).toThrow(/not found/)
    expect(() => mergeWorkspaceState(next, { restored: true }, A)).toThrow(/not found/)
    expect(changeWorkspaceCatalog(next, command, NOW)).toEqual(next)
    expect(workspaceCommandSchema.safeParse({ ...command, id: null }).success).toBe(true)
  })
  it("keeps viewport preferences separate while preserving the existing default key", () => {
    const scope = { orgId: ORG, viewerId: B }
    expect(buildWorkspaceBoardUiPreferencesStorageKey(scope)).not.toBe(buildWorkspaceBoardUiPreferencesStorageKey({ ...scope, workspaceCanvasId: A }))
  })
  it("retries a named board write against fresh sibling changes", async () => {
    let root = changeWorkspaceCatalog({ particleGraph: { main: true } }, create(), NOW)
    const db = database(root)
    db.race(() => { root = changeWorkspaceCatalog(db.read(), create(B, "Concurrent"), NOW); db.change(root) })
    const result = await persistWorkspaceBoardState({ orgId: ORG, workspaceCanvasId: A, userId: B, supabase: db.client,
      buildState: (stored) => ({ ...normalizeWorkspaceBoardState(stored), preset: "calendar-focused" }),
      updateParticleGraph: () => ({ saved: "A" }),
    })
    expect(result).toHaveProperty("ok", true)
    expect(selectWorkspaceState(db.read()).particleGraph).toEqual({ main: true })
    expect(selectWorkspaceState(db.read(), A).particleGraph).toEqual({ saved: "A" })
    expect(summarizeWorkspaces(db.read())).toHaveLength(3)
    expect(db.writes).toHaveLength(1)
  })
  it.each([null, { role: "member", isAdmin: false }, { role: "staff", isAdmin: false, orgId: B }])("rejects unauthorized or changed organization before writing: %s", async (actor) => {
    const db = database()
    mocks.context.mockResolvedValue(actor && { supabase: db.client, activeOrg: { orgId: actor.orgId ?? ORG, role: actor.role }, profileAudience: { isAdmin: actor.isAdmin }, user: { id: B } })
    expect(await saveWorkspaceCommand(create())).toHaveProperty("error")
    expect(db.client.from).not.toHaveBeenCalled()
  })
  it("blocks creation until the database calendar guard supports named canvases", async () => {
    const db = database()
    vi.mocked(db.client.rpc).mockResolvedValue({ success: true, data: 0, error: null, count: null, status: 200, statusText: "OK" })
    mocks.context.mockResolvedValue({ supabase: db.client, activeOrg: { orgId: ORG, role: "staff" }, profileAudience: { isAdmin: false }, user: { id: B } })
    expect(await saveWorkspaceCommand(create())).toHaveProperty("error")
    expect(db.client.from).not.toHaveBeenCalled()
  })
  it("creates and renames through authenticated, organization-scoped CAS writes", async () => {
    const db = database({ particleGraph: { main: true } })
    mocks.context.mockResolvedValue({ supabase: db.client, activeOrg: { orgId: ORG, role: "staff" }, profileAudience: { isAdmin: false }, user: { id: B } })
    db.race(() => db.change(changeWorkspaceCatalog(db.read(), create(B, "Other"), NOW)))
    expect(await saveWorkspaceCommand(create())).toHaveProperty("ok", true)
    expect(await saveWorkspaceCommand({ kind: "rename", orgId: ORG, id: A, name: "Renamed", previousName: "Planning" })).toHaveProperty("ok", true)
    expect(summarizeWorkspaces(db.read()).map((item) => item.name)).toEqual(["Main workspace", "Other", "Renamed"])
    expect(selectWorkspaceState(db.read()).particleGraph).toEqual({ main: true })
    expect(await saveWorkspaceCommand({ kind: "delete", orgId: ORG, id: A, previousName: "Renamed" })).toHaveProperty("ok", true)
    expect(summarizeWorkspaces(db.read()).map((item) => item.name)).toEqual(["Main workspace", "Other"])
  })
})


describe("starting workspace lifecycle", () => {
  const removeRoot = { kind: "delete" as const, orgId: ORG, id: null, previousName: "Build" }
  it("starts with four ordered presets and persists them on first save", () => {
    const initial = summarizeWorkspaces(undefined)
    expect(initial.map(({ name }) => name)).toEqual(["Build", "Board", "Communications", "Finance"])
    expect(summarizeWorkspaces(undefined)).toEqual(initial)
    const saved = mergeWorkspaceState(undefined, { nodes: [{ id: "onboarding" }] })
    expect(summarizeWorkspaces(JSON.parse(JSON.stringify(saved)))).toEqual(initial)
    for (const { id } of initial.slice(1)) {
      const board = normalizeWorkspaceBoardState(selectWorkspaceState(saved, id))
      expect(board.visibility?.allCardsHiddenExplicitly).toBe(true)
      expect(resolveVisibleWorkspaceCanvasCardIds(board.hiddenCardIds)).toEqual([])
    }
  })
  it("persists all four starters when a preset is the first canvas edited", async () => {
    const boardId = summarizeWorkspaces(undefined)[1].id!
    let inserted: { org_id: string; state: Json; updated_by: string | null } | undefined
    const client = { from: vi.fn(() => {
      const query = {
        select: () => query,
        eq: () => query,
        insert: (value: NonNullable<typeof inserted>) => { inserted = value; return query },
        maybeSingle: async () => ({ data: inserted ? { updated_at: NOW } : null, error: null }),
      }
      return query
    }) } as unknown as SupabaseClient<Database>
    const result = await persistWorkspaceBoardState({ orgId: ORG, workspaceCanvasId: boardId, userId: B, supabase: client,
      buildState: (stored) => normalizeWorkspaceBoardState(stored),
      updateParticleGraph: () => ({ sentinel: "First preset edit" }),
    })
    expect(result).toHaveProperty("ok", true)
    expect(inserted).toMatchObject({ org_id: ORG, updated_by: B })
    expect(summarizeWorkspaces(inserted?.state).map(({ name }) => name)).toEqual(["Build", "Board", "Communications", "Finance"])
    expect(selectWorkspaceState(inserted?.state, boardId).particleGraph).toEqual({ sentinel: "First preset edit" })
  })
  it("preserves existing legacy, Build-only, and customized catalogs without adding presets", () => {
    for (const stored of [{}, { nodes: [{ id: "legacy" }] }, { workspaceCatalog: { version: 1, defaultName: "Build", entries: [] } }]) {
      const before = summarizeWorkspaces(stored)
      expect(before).toHaveLength(1)
      expect(summarizeWorkspaces(mergeWorkspaceState(stored, { nodes: [] }))).toEqual(before)
    }
    const custom = changeWorkspaceCatalog({ nodes: [{ id: "existing" }] }, create(A, "Custom"), NOW)
    expect(summarizeWorkspaces(mergeWorkspaceState(custom, { nodes: [] }))).toEqual(summarizeWorkspaces(custom))
  })
  it("allows first-save edits in a preset without losing its siblings or recreating deleted presets", () => {
    const boardId = summarizeWorkspaces(undefined)[1].id!
    let saved = mergeWorkspaceState(undefined, { particleGraph: { sentinel: "Board content" } }, boardId)
    expect(selectWorkspaceState(saved, boardId).particleGraph).toEqual({ sentinel: "Board content" })
    expect(summarizeWorkspaces(saved)).toHaveLength(4)
    for (const { id, name } of summarizeWorkspaces(saved)) {
      saved = changeWorkspaceCatalog(saved, { kind: "delete", orgId: ORG, id, previousName: name }, NOW)
    }
    expect(summarizeWorkspaces(JSON.parse(JSON.stringify(saved)))).toEqual([])
    expect(summarizeWorkspaces(changeWorkspaceCatalog(saved, create(A, "Fresh"), NOW))).toEqual([{ id: A, name: "Fresh" }])
  })
  it("persists an empty catalog without restoring Build or its cards", () => {
    const root = mergeWorkspaceState({}, { particleGraph: { private: "deleted" } })
    expect(() => changeWorkspaceCatalog(root, { ...removeRoot, previousName: "Outdated" }, NOW)).toThrow(/changed/)
    const empty = changeWorkspaceCatalog(root, removeRoot, NOW)
    expect(summarizeWorkspaces(JSON.parse(JSON.stringify(empty)))).toEqual([])
    expect(allWorkspaceStates(empty)).toEqual([])
    expect(JSON.stringify(empty)).not.toContain("private")
    expect(() => selectWorkspaceState(empty)).toThrow(/not found/)
    expect(() => mergeWorkspaceState(empty, { particleGraph: { restored: true } })).toThrow(/not found/)
    expect(changeWorkspaceCatalog(empty, removeRoot, NOW)).toEqual(empty)
    expect(() => changeWorkspaceCatalog(empty, { kind: "rename", orgId: ORG, id: null, name: "Revive", previousName: "Build" }, NOW)).toThrow(/not found/)
    const next = changeWorkspaceCatalog(empty, create(A, "Fresh"), NOW)
    expect(summarizeWorkspaces(next)).toEqual([{ id: A, name: "Fresh" }])
    expect(selectWorkspaceState(next, A).particleGraph).toBeUndefined()
  })
  it("deletes the original independently and keeps sibling content", () => {
    let root = changeWorkspaceCatalog({}, create(), NOW)
    root = mergeWorkspaceState(root, { particleGraph: { sibling: true } }, A)
    const next = changeWorkspaceCatalog(root, removeRoot, NOW)
    expect(summarizeWorkspaces(next)).toEqual([{ id: A, name: "Planning" }])
    expect(selectWorkspaceState(next, A).particleGraph).toEqual({ sibling: true })
  })
  it("requires the durable database guard before deleting the starting workspace", async () => {
    const db = database(mergeWorkspaceState({}, {}))
    mocks.context.mockResolvedValue({ supabase: db.client, activeOrg: { orgId: ORG, role: "owner" }, profileAudience: { isAdmin: false }, user: { id: B } })
    expect(await saveWorkspaceCommand(removeRoot)).toHaveProperty("error")
    expect(db.client.from).not.toHaveBeenCalled()
    vi.mocked(db.client.rpc).mockResolvedValue({ success: true, data: 2, error: null, count: null, status: 200, statusText: "OK" })
    expect(await saveWorkspaceCommand(removeRoot)).toMatchObject({ ok: true, workspaces: [], id: null })
    expect(await saveWorkspaceCommand(create())).toMatchObject({ ok: true, workspaces: [{ id: A, name: "Planning" }] })
  })
  it("rejects a default-canvas save racing with deletion", async () => {
    const db = database(mergeWorkspaceState({}, {}))
    db.race(() => db.change(changeWorkspaceCatalog(db.read(), removeRoot, NOW)))
    const result = await persistWorkspaceBoardState({ orgId: ORG, userId: B, supabase: db.client,
      buildState: (stored) => normalizeWorkspaceBoardState(stored),
      updateParticleGraph: () => ({ restored: true }),
    })
    expect(result).not.toHaveProperty("ok", true)
    expect(summarizeWorkspaces(db.read())).toEqual([])
    expect(db.writes).toHaveLength(0)
  })
})

it("does not mount an editable canvas when the last workspace is deleted", () => {
  type ViewProps = ComponentProps<typeof MyOrganizationWorkspaceView>
  const props = {
    seed: { orgId: ORG, boardState: normalizeWorkspaceBoardState({}), workspaceCatalog: [], canEdit: true },
    organizationEditorData: {}, financeInput: {}, onInitialOnboardingSubmit: async () => {},
  } as unknown as ViewProps
  const empty = renderToStaticMarkup(createElement(MyOrganizationWorkspaceView, props))
  expect(empty).toContain('aria-label="Empty workspace area"')
  expect(empty).not.toContain('data-live-canvas')
  const started = renderToStaticMarkup(createElement(MyOrganizationWorkspaceView, {
    ...props, seed: { ...props.seed, workspaceCatalog: [{ id: null, name: "Build" }] },
  }))
  expect(started).toContain('data-live-canvas="true"')
})
