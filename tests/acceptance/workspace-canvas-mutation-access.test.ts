import { expect, it, vi } from "vitest"
import type { Database, Json } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceCanvasAccess, WORKSPACE_CANVAS_ACCESS_ERROR } from "@/lib/organization/workspace-canvas-access"
import { persistWorkspaceBoardState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { changeWorkspaceCatalog, mergeWorkspaceState, readWorkspaceCatalog, selectWorkspaceState, summarizeWorkspaces } from "@/features/workspace-management"
const ORG = "10000000-0000-4000-8000-000000000001", ACTOR = "10000000-0000-4000-8000-000000000002", CANVAS = "10000000-0000-4000-8000-000000000003"
const NOW = "2026-11-07T00:00:00Z"
const hidden = { workspaceCatalog: { version: 1, defaultName: "Workspace", defaultDeleted: true, entries: [] } }

it.each([null, [], {}, true, { state: null }, { state: [] }, hidden, { state: hidden }, { state: { workspaceCatalog: { version: 9 } } }])("fails closed on missing, hidden or malformed canvas responses: %j", async data => {
  const rpc = vi.fn(async () => ({ data, error: null }))
  await expect(assertWorkspaceCanvasAccess({ supabase: { rpc } as unknown as SupabaseClient<Database>, orgId: ORG, userId: ACTOR })).rejects.toThrow(WORKSPACE_CANVAS_ACCESS_ERROR)
  expect(rpc).toHaveBeenCalledExactlyOnceWith("read_workspace_canvas_projection", { p_org_id: ORG, p_actor_id: ACTOR })
})
it("rejects error-bearing data and transport failures without exposing provider details", async () => {
  for (const rpc of [vi.fn(async () => ({ data: { state: {} }, error: { message: "private detail" } })), vi.fn(async () => { throw new Error("private detail") })]) {
    await expect(assertWorkspaceCanvasAccess({ supabase: { rpc } as unknown as SupabaseClient<Database>, orgId: ORG, userId: ACTOR })).rejects.toThrow(WORKSPACE_CANVAS_ACCESS_ERROR)
  }
})
it("allows existing starter selection only when the initial board is genuinely absent", async () => {
  const supabase = { rpc: vi.fn(async () => ({ data: null, error: null })) } as unknown as SupabaseClient<Database>
  for (const workspaceCanvasId of [undefined, summarizeWorkspaces(undefined)[1].id!])
    await expect(assertWorkspaceCanvasAccess({ supabase, orgId: ORG, userId: ACTOR, workspaceCanvasId, allowAbsent: true })).resolves.toBeUndefined()
  await expect(assertWorkspaceCanvasAccess({ supabase, orgId: ORG, userId: ACTOR, workspaceCanvasId: CANVAS, allowAbsent: true })).rejects.toThrow(WORKSPACE_CANVAS_ACCESS_ERROR)
})

it.each([undefined, CANVAS])("withholds layout-only responses after revocation on canvas %s, preserving the committed save", async workspaceCanvasId => {
  let stored: Json = changeWorkspaceCatalog(buildDefaultBoardState(), { kind: "create", orgId: ORG, id: CANVAS, name: "Private finance" }, NOW)
  let committed = false
  const rpc = vi.fn(async (name: string, args: { p_state?: Json }) => {
    if (name === "read_workspace_canvas_projection") return { data: { state: committed ? hidden : stored }, error: null }
    expect(name).toBe("commit_workspace_board")
    stored = args.p_state!; committed = true
    return { data: true, error: null }
  })
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { state: stored, updated_at: NOW }, error: null }) }
  const result = await persistWorkspaceBoardState({ supabase: { rpc, from: () => query } as unknown as SupabaseClient<Database>, orgId: ORG, userId: ACTOR, workspaceCanvasId,
    buildState: persisted => ({ ...persisted!, preset: "calendar-focused" }),
  })
  expect(result).toHaveProperty("error")
  expect(result).not.toHaveProperty("boardState")
  expect(committed).toBe(true)
  expect(selectWorkspaceState(stored, workspaceCanvasId).preset).toBe("calendar-focused")
})
it("preserves a hidden sibling in canonical storage without disclosing its identity or body", async () => {
  let stored = mergeWorkspaceState(changeWorkspaceCatalog(buildDefaultBoardState(), { kind: "create", orgId: ORG, id: CANVAS, name: "Private finance" }, NOW), { privateBody: "Secret" }, CANVAS)
  const originalSibling = selectWorkspaceState(stored, CANVAS)
  const rpc = vi.fn(async (name: string, args: { p_state?: Json }) => {
    if (name === "read_workspace_canvas_projection") return { data: { state: { ...selectWorkspaceState(stored), workspaceCatalog: { ...readWorkspaceCatalog(stored), entries: [] } } }, error: null }
    stored = args.p_state!
    return { data: true, error: null }
  })
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { state: stored, updated_at: NOW }, error: null }) }
  const result = await persistWorkspaceBoardState({ supabase: { rpc, from: () => query } as unknown as SupabaseClient<Database>, orgId: ORG, userId: ACTOR,
    buildState: persisted => ({ ...persisted!, preset: "calendar-focused" }),
  })
  expect(result).toMatchObject({ ok: true, boardState: { preset: "calendar-focused" } })
  expect(selectWorkspaceState(stored, CANVAS)).toEqual(originalSibling)
  expect(JSON.stringify(result)).not.toMatch(/Private finance|Secret|10000000-0000-4000-8000-000000000003/)
})
