import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { validateLiveAnswers } from "@/features/coach-house-companion/server/live/accelerator-answers"
import { executeLiveCompanionTool } from "@/features/coach-house-companion/server/live/accelerator"
import { liveAppUrl } from "@/features/coach-house-companion/server/live/accelerator-access"
import { readLiveDocument, saveLiveDocument } from "@/features/coach-house-companion/server/live/documents"
import { createLiveCompanionMcp } from "@/features/coach-house-companion/server/live/mcp"
import type { LiveCompanionContext } from "@/features/coach-house-companion/types"
import type { ModuleAssignmentField } from "@/lib/modules/types"

vi.mock("@/features/coach-house-companion/server/widget", () => ({ getCompanionWidgetHtml: vi.fn(async () => "<html>Connected</html>") }))
const owner = "11111111-1111-4111-8111-111111111111", lesson = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
type CatalogLesson = { id: string; idx: number; title: string; classes: { slug: string; title: string; is_published: boolean; position: number | null } }
function fixture(options: { catalog?: CatalogLesson[]; completed?: string[] } = {}) {
  const profile: Record<string, unknown> = { name: "Organization", roadmap: { sections: [{ id: "mission_vision_values", content: "<p>Public mission</p>", status: "complete", isPublic: true, publicProfileStatusControlled: true }] } }
  const updatedAt = "2026-10-26T00:00:00.000Z"
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
    if (name === "companion_authorize") return { data: { role: "owner", name: "Organization" }, error: null }
    if (name === "companion_document_retry") return { data: null, error: null }
    if (name === "companion_read_draft") return { data: { revision: 0, answers: {}, updated_at: null }, error: null }
    if (name === "companion_save_document") return { data: { applied: true }, error: null }
    return { data: null, error: null }
  })
  const from = vi.fn((table: string) => {
    let selectedId: string | undefined
    const chain = { select: vi.fn(() => chain), order: vi.fn(() => chain), eq: vi.fn((column: string, value: string) => { if (column === "id" || column === "module_id") selectedId = value; return chain }), limit: vi.fn(() => chain),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve({ data: table === "modules" ? options.catalog ?? [] : table === "module_progress" ? (options.completed ?? []).map(module_id => ({ module_id, status: "completed" })) : [], error: null }),
      maybeSingle: vi.fn(async () => {
      const data = table === "organizations" ? { profile, updated_at: updatedAt }
        : table === "modules" ? options.catalog?.find(row => row.id === selectedId) ?? { id: lesson, idx: 1, title: "Mission", content_md: "Published body", video_url: "https://example.com/lesson", classes: { slug: "core", title: "Core", is_published: true } }
        : table === "module_assignments" ? { schema: { fields: [{ name: "mission", label: "Mission", type: "long_text", required: true }], completion_mode: "all_answered" }, complete_on_submit: true, updated_at: "2026-10-26T00:00:00.000Z" }
        : table === "module_content" ? { video_url: null, resources: [{ label: "Guide", url: "https://example.com/guide" }], homework: [] } : null
      return { data, error: null }
    }) }
    return chain
  })
  const context = { userId: owner, clientId: "test-client", accessToken: "private-token", scopes: ["accelerator:read", "accelerator:write"], appOrigin: "https://staging.coachhouse.example", supabase: { rpc, from, auth: { getUser: vi.fn(async () => ({ data: { user: { id: owner } }, error: null })) } } } as unknown as LiveCompanionContext
  return { context, rpc, from, getProfile: () => profile }
}
const fields: ModuleAssignmentField[] = [
  { name: "text", label: "Text", type: "long_text", required: true },
  { name: "one", label: "One", type: "select", options: ["A", "B"], required: false },
  { name: "many", label: "Many", type: "multi_select", options: ["A", "B"], required: false },
  { name: "number", label: "Number", type: "slider", min: 1, max: 5, step: 2, required: false },
  { name: "budget", label: "Budget", type: "budget_table", required: false },
  { name: "program", label: "Program", type: "custom_program", required: false },
  { name: "subtitle", label: "Section", type: "subtitle", required: false },
]
describe("live Companion typed assignment validation", () => {
  it("preserves all supported answer types and normalizes text", () => {
    expect(validateLiveAnswers(fields, { text: "<p>Parents &amp; children</p>", one: "A", many: ["A", "B", "A"], number: 3, budget: [{ category: "Staff", units: "2" }], program: "A program" }, true)).toMatchObject({ text: "Parents & children", one: "A", many: ["A", "B"], number: 3, budget: [{ category: "Staff", units: "2" }], program: "A program" })
  })
  it.each([{ unknown: "x" }, { subtitle: "x" }, { one: "C" }, { many: ["C"] }, { number: 2 }, { number: Infinity }, { budget: [{ script: "x" }] }])("rejects malformed typed answers without silently coercing them", answers => expect(() => validateLiveAnswers(fields, answers)).toThrow())
  it("allows incomplete drafts but requires required answers on submit", () => { expect(validateLiveAnswers(fields, {})).toEqual({}); expect(() => validateLiveAnswers(fields, {}, true)).toThrow() })
})
describe("live Companion authority and contracts", () => {
  it("checks scopes before any user lookup or data reads", async () => {
    const { context, rpc, from } = fixture(); context.scopes = ["accelerator:read"]
    await expect(executeLiveCompanionTool(context, "companion_save_draft", { organizationId: owner, lessonId: lesson, requestId: "request-1", expectedRevision: 0, answers: {} })).rejects.toMatchObject({ code: "insufficient_scope" })
    expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled(); expect(context.supabase.auth.getUser).not.toHaveBeenCalled()
  })
  it("rejects actor/token mismatch before organization lookup", async () => {
    const { context, rpc } = fixture(); context.userId = "other-user"
    await expect(executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner, lessonId: lesson })).rejects.toMatchObject({ code: "unauthorized" }); expect(rpc).not.toHaveBeenCalled()
  })
  it("rechecks revoked membership for each call", async () => {
    const { context, rpc, from } = fixture(); rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } } as never)
    await expect(executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner, lessonId: lesson })).rejects.toMatchObject({ code: "forbidden" }); expect(from).not.toHaveBeenCalled()
  })
  it("rejects a member-organization submission before reading or writing its lesson", async () => {
    const { context, rpc, from } = fixture()
    await expect(executeLiveCompanionTool(context, "companion_submit_assignment", {
      organizationId: "22222222-2222-4222-8222-222222222222", lessonId: lesson,
      requestId: "member-submit", expectedRevision: 0, expectedSubmissionRevision: null, confirmed: true,
    })).rejects.toMatchObject({ code: "forbidden", message: expect.stringContaining("only to your own organization") })
    expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled()
  })
  it("submits an owner's reviewed draft and discloses the native organization-profile merge", async () => {
    const { context, rpc } = fixture()
    rpc.mockImplementation(async (name: string) => {
      if (name === "companion_authorize") return { data: { role: "owner", name: "Organization" }, error: null }
      if (name === "companion_read_draft") return { data: { revision: 1, answers: { mission: "Reviewed mission" }, updated_at: null }, error: null }
      return { data: { applied: true }, error: null }
    })
    const result = await executeLiveCompanionTool(context, "companion_submit_assignment", {
      organizationId: owner, lessonId: lesson, requestId: "owner-submit", expectedRevision: 1, expectedSubmissionRevision: null, confirmed: true,
    })
    expect(rpc.mock.calls.find(([name]) => name === "companion_write_assignment")?.[1]).toMatchObject({ p_org_id: owner, p_answers: { mission: "Reviewed mission" }, p_submit: true, p_confirmed: true })
    expect(result.message).toContain("merged the reviewed answers into your own organization profile")
    expect(result.message).toContain("may change public profile content")
  })
  it("continues the unfinished earlier class before a later class's first lesson", async () => {
    const first = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", later = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    const earlyClass = { slug: "early-core", title: "Z Early class", is_published: true, position: 10 }
    const laterClass = { slug: "later-core", title: "A Later class", is_published: true, position: 20 }
    const { context } = fixture({ completed: [first], catalog: [
      { id: later, idx: 1, title: "A Later first", classes: laterClass },
      { id: first, idx: 1, title: "Z Earlier first", classes: earlyClass },
      { id: second, idx: 2, title: "Z Earlier second", classes: earlyClass },
    ] })
    const list = await executeLiveCompanionTool(context, "companion_list_lessons", { organizationId: owner })
    expect(list.lessons?.map(row => row.id)).toEqual([first, second, later])
    const continued = await executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner })
    expect(continued.snapshot?.lesson.id).toBe(second)
    expect(continued.snapshot?.lesson.href).toContain("/class/early-core/module/2")
  })

  it("loads actual lesson body, resources, typed questions and current data", async () => {
    const { context } = fixture(); const result = await executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner, lessonId: lesson })
    expect(result.snapshot).toMatchObject({ mode: "connected", lesson: { body: "Published body", videoUrl: "https://example.com/lesson", resources: [{ label: "Guide", url: "https://example.com/guide" }], fields: [{ type: "long_text" }] }, draft: { visibility: "personal" }, document: { visibility: "organization" } })
  })
  it("uses the broker-configured staging origin for every native destination", async () => {
    const { context } = fixture()
    const result = await executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner, lessonId: lesson })
    expect(result.snapshot?.lesson.href).toBe("https://staging.coachhouse.example/class/core/module/1")
    expect(result.snapshot?.document.href).toBe("https://staging.coachhouse.example/workspace/roadmap/mission-vision-values")
    expect(result.snapshot?.coachingHref).toBe("https://staging.coachhouse.example/coaching")
    expect(() => liveAppUrl({ ...context, appOrigin: "http://insecure.example" }, "/coaching")).toThrow()
    expect(() => liveAppUrl(context, "https://unrelated.example")).toThrow()
  })
  it("returns an exact review without any mutation RPC", async () => {
    const { context, rpc } = fixture(); const result = await executeLiveCompanionTool(context, "companion_review_document", { organizationId: owner, lessonId: lesson, content: "Parents &amp; children" })
    expect(result.proposal).toMatchObject({ organizationId: owner, lessonId: lesson, documentId: "mission", content: "Parents & children", visibility: "organization" })
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("companion_save_document")
  })
  it("rejects unconfirmed saves and extra server-owned fields", async () => {
    const { context, rpc } = fixture()
    await expect(executeLiveCompanionTool(context, "companion_save_document", { organizationId: owner, lessonId: lesson, requestId: "request-1", expectedRevision: "a".repeat(64), content: "Change", confirmed: false })).rejects.toMatchObject({ code: "invalid_arguments" })
    await expect(executeLiveCompanionTool(context, "companion_get_session", { organizationId: owner, lessonId: lesson, completed: true })).rejects.toMatchObject({ code: "invalid_arguments" }); expect(rpc).not.toHaveBeenCalled()
  })
  it("sends only exact approved content and CAS evidence, never a caller-controlled profile", async () => {
    const { context, rpc } = fixture(); const before = await readLiveDocument(context, owner, "mission")
    await saveLiveDocument(context, { organizationId: owner, documentId: "mission", requestId: "request-1", expectedRevision: before.document.revision, content: "Reviewed change", confirmed: true })
    expect(rpc.mock.calls.find(([name]) => name === "companion_save_document")?.[1]).toMatchObject({ p_expected_profile: before.profile, p_content: "Reviewed change", p_confirmed: true })
    expect(rpc.mock.calls.find(([name]) => name === "companion_save_document")?.[1]).not.toHaveProperty("p_next_profile")
  })
  it("stale document revision never reaches the write RPC", async () => {
    const { context, rpc } = fixture()
    await expect(saveLiveDocument(context, { organizationId: owner, requestId: "request-1", expectedRevision: "a".repeat(64), content: "Change", confirmed: true })).rejects.toMatchObject({ code: "revision_conflict" })
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("companion_save_document")
  })
  it("keeps draft/save/submit headless and read/review/calendar as compact cards", async () => {
    const { context } = fixture(); const server = await createLiveCompanionMcp(context); const client = new Client({ name: "live-test", version: "1" }); const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(a), client.connect(b)])
    try {
      const { tools } = await client.listTools(); expect(tools).toHaveLength(8)
      const submissionTool = tools.find(tool => tool.name === "companion_submit_assignment")
      expect(submissionTool?.description).toContain("may change public profile content")
      expect(submissionTool?.description).toContain("explicit approval of both submission and this profile change")
      for (const tool of tools) {
        const ui = tool._meta?.ui as { resourceUri?: string }
        expect(Boolean(ui.resourceUri)).toBe(["companion_get_session", "companion_review_document", "companion_schedule_block"].includes(tool.name))
      }
      const result = await client.callTool({ name: "companion_review_document", arguments: { organizationId: owner, lessonId: lesson, content: "Reviewed" } })
      expect(result.isError).not.toBe(true); expect(result.structuredContent).toMatchObject({ proposal: { content: "Reviewed" } })
    } finally { await client.close(); await server.close() }
  })
  it("migration confines tables and retains caller-bound, atomic canonical writes", () => {
    const migration = readFileSync("supabase/migrations/20261026160000_companion_live_work.sql", "utf8")
    expect(migration).toContain("force row level security")
    expect(migration).toContain("where public.assignment_submissions.updated_at is not distinct from p_expected_submission_at")
    expect(migration).toContain("org.profile is distinct from p_expected_profile")
    expect(migration).not.toContain("service_role")
  })
})
