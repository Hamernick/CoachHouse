import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createSupabaseServerClientServerMock } from "./test-utils"

const { resolveOrg, routeClient, notesIndex } = vi.hoisted(() => ({ resolveOrg: vi.fn(), routeClient: vi.fn(), notesIndex: vi.fn() }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: routeClient }))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: resolveOrg,
  canEditOrganization: (role: string) => ["owner", "admin", "staff"].includes(role),
}))
vi.mock("@/lib/modules/notes-index", () => ({ listUserModuleNotesIndex: notesIndex }))
vi.mock("@/lib/user-journey", () => ({ trackUserJourneyMilestone: vi.fn() }))
vi.mock("@/app/(admin)/admin/classes/actions", () => ({ revalidateClassViews: vi.fn() }))

import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { getModuleNotesAction, saveModuleNotesAction } from "@/app/actions/module-notes"
import { markModuleCompleteAction } from "@/app/actions/module-progress"
import { GET, POST } from "@/app/api/modules/[id]/assignment-submission/route"
import { GET as documentItem } from "@/app/api/account/workspace-documents-index/item/route"
import { GET as documentIndex } from "@/app/api/account/workspace-documents-index/route"
import { POST as saveNotes } from "@/app/api/modules/[id]/notes/route"
import { getAssignmentDraftStorageKey } from "@/components/training/module-detail/assignment-form/assignment-draft"
import { hydrateWorkspaceSeedAcceleratorState } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-content-helpers"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"

describe("selected organization learning records", () => {
  const records = new Map<string, Record<string, unknown>>()
  let writes: Array<{ table: string; userId: string }> = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "staff" } }, error: null }) },
    from(table: string) {
      let id = ""
      let result: Record<string, unknown> | null = null
      const query = {
        select: () => query,
        eq: (column: string, value: string) => { if (column === "user_id") id = value; return query },
        upsert: (payload: Record<string, unknown>) => {
          id = String(payload.user_id)
          result = { ...records.get(`${table}:${id}`), ...payload }
          records.set(`${table}:${id}`, result)
          writes.push({ table, userId: id })
          return query
        },
        maybeSingle: async () => ({ data: table === "modules"
          ? { id: "lesson", idx: 1, class_id: "class", classes: { slug: "class" } }
          : table === "module_assignments"
            ? { schema: { fields: [{ name: "answer", type: "long_text", label: "Answer" }] }, complete_on_submit: false }
            : result ?? records.get(`${table}:${id}`) ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }
      return query
    },
  }
  const params = { params: Promise.resolve({ id: "lesson" }) }
  beforeEach(() => {
    records.clear(); writes = []; vi.clearAllMocks()
    records.set("module_progress:staff", { notes: { content: "Completed note: Vision", format: "markdown" }, status: "completed" })
    records.set("module_progress:alpha", { notes: { content: "Alpha notes", format: "markdown" } })
    records.set("assignment_submissions:staff", { answers: { summary: "Demo" }, status: "accepted" })
    records.set("assignment_submissions:alpha", { answers: { answer: "Alpha answer" }, status: "submitted" })
    resolveOrg.mockResolvedValue({ orgId: "alpha", role: "admin", supportAccess: true })
    createSupabaseServerClientServerMock.mockResolvedValue(client)
    routeClient.mockReturnValue(client)
  })

  it("switches notes and answers A to B to A without using the staff seed", async () => {
    expect(await getModuleNotesAction("lesson")).toMatchObject({ notes: { content: "Alpha notes" } })
    expect(await (await GET(new Request("https://example.test"), params)).json()).toMatchObject({ answers: { answer: "Alpha answer" }, status: "submitted" })
    resolveOrg.mockResolvedValue({ orgId: "beta", role: "admin", supportAccess: true })
    expect(await getModuleNotesAction("lesson")).toEqual({ ok: true, notes: null })
    expect(await (await GET(new Request("https://example.test"), params)).json()).toMatchObject({ answers: null, status: null })
    resolveOrg.mockResolvedValue({ orgId: "alpha", role: "admin", supportAccess: true })
    expect(await getModuleNotesAction("lesson")).toMatchObject({ notes: { content: "Alpha notes" } })
    expect(writes).toEqual([])
  })

  it("persists notes, answers and completion to the selected owner and preserves staff data", async () => {
    const staffBefore = structuredClone([...records.entries()].filter(([key]) => key.endsWith(":staff")))
    expect(await saveModuleNotesAction("lesson", "Edited Alpha", "alpha")).toHaveProperty("ok", true)
    expect(await markModuleCompleteAction("lesson")).toEqual({ ok: true })
    const response = await POST(new Request("https://example.test", { method: "POST", body: JSON.stringify({ answers: { answer: "New Alpha" } }) }), params)
    expect(response.status).toBe(200)
    expect(await (await GET(new Request("https://example.test"), params)).json()).toMatchObject({ answers: { answer: "New Alpha" } })
    expect(writes).toEqual([
      { table: "module_progress", userId: "alpha" },
      { table: "module_progress", userId: "alpha" },
      { table: "assignment_submissions", userId: "alpha" },
    ])
    expect([...records.entries()].filter(([key]) => key.endsWith(":staff"))).toEqual(staffBefore)
  })

  it("rejects stale notes cleanup after switching, including keepalive", async () => {
    resolveOrg.mockResolvedValue({ orgId: "beta", role: "admin", supportAccess: true })
    expect(await saveModuleNotesAction("lesson", "Old Alpha", "alpha")).toHaveProperty("error")
    const response = await saveNotes(new NextRequest("https://example.test", { method: "POST", body: JSON.stringify({ content: "Old Alpha", organizationId: "alpha" }) }), params)
    expect(response.status).toBe(403)
    expect(writes).toEqual([])
  })

  it("fails closed on revoked support instead of writing personal records", async () => {
    resolveOrg.mockRejectedValue(new Error("revoked"))
    expect(await markModuleCompleteAction("lesson")).toHaveProperty("error")
    expect(await saveModuleNotesAction("lesson", "text")).toHaveProperty("error")
    expect((await POST(new Request("https://example.test", { method: "POST", body: "{}" }), params)).status).toBe(403)
    expect(writes).toEqual([])
  })

  it("uses selected learner notes in Documents search and preview", async () => {
    notesIndex.mockImplementation(async ({ userId }: { userId: string }) => [{ moduleId: "lesson", moduleTitle: "Vision", classTitle: "Planning", content: `${userId} notes`, updatedAt: null, href: "/lesson" }])
    const index = await documentIndex(new NextRequest("https://example.test/api/account/workspace-documents-index"))
    expect(index.status).toBe(200)
    expect((await index.json()).items).toContainEqual(expect.objectContaining({ id: "note:lesson", summary: "alpha notes" }))
    resolveOrg.mockResolvedValue({ orgId: "beta", role: "admin", supportAccess: true })
    const item = await documentItem(new NextRequest("https://example.test/api/account/workspace-documents-index/item?id=note:lesson"))
    expect(item.status).toBe(200)
    expect((await item.json()).detail.contentMarkdown).toBe("beta notes")
    expect(notesIndex).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "beta" }))
  })

  it("does not load note previews after support is revoked", async () => {
    resolveOrg.mockRejectedValue(new Error("revoked"))
    const item = await documentItem(new NextRequest("https://example.test/api/account/workspace-documents-index/item?id=note:lesson"))
    expect(item.status).toBe(500)
    expect(notesIndex).not.toHaveBeenCalled()
  })

  it("does not grant ordinary members access to the owner's private learning", () => {
    expect(organizationLearningUserId("member", { orgId: "alpha", role: "member" })).toBe("member")
    expect(organizationLearningUserId("owner", { orgId: "owner", role: "owner" })).toBe("owner")
  })

  it("separates drafts across organizations, accounts and legacy unscoped drafts", () => {
    const keys = [getAssignmentDraftStorageKey("lesson", "alpha:staff"), getAssignmentDraftStorageKey("lesson", "beta:staff"), getAssignmentDraftStorageKey("lesson", "alpha:owner"), "assignment-autosave-lesson"]
    expect(new Set(keys).size).toBe(4)
  })

  it("does not restore seeded completion from an old shared board snapshot", () => {
    const boardState = buildDefaultBoardState()
    boardState.accelerator.completedStepIds = ["lesson:video", "other:video"]
    const next = hydrateWorkspaceSeedAcceleratorState({ boardState }, [
      { id: "lesson:video", moduleId: "lesson", status: "not_started" },
      { id: "other:video", moduleId: "other", status: "completed" },
    ] as never)
    expect(next.boardState.accelerator.completedStepIds).toEqual(["other:video"])
  })
})
