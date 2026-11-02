import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFormVersion } from "@/features/organization-forms"
import { exportFormResponsePage, FormResponseExportSizeError } from "@/features/organization-forms/lib/form-response-export"
import { handleFormResponseExport } from "@/features/organization-forms/server/response-export-route"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }))
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const now = "2026-11-01T12:00:00Z"
const version = createFormVersion({ id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [
  { id: id(90), type: "text", label: "Name", required: true },
  { id: id(91), type: "number", label: "Amount", required: false },
  { id: id(92), type: "multiple_choice", label: "Choice", required: false, options: ["Oui", "Non"], allowOther: true },
  { id: id(93), type: "checkbox_grid", label: "Grid", required: false, rows: [{ id: id(100), label: "Day" }], columns: [{ id: id(101), label: "AM" }, { id: id(102), label: "PM" }] },
  { id: id(94), type: "paragraph", label: '=HYPERLINK("bad")', required: false },
] } })
const response = { id: id(70), versionId: version.id, revision: 2, submittedAt: now, updatedAt: now, answers: [
  { questionId: id(90), value: 'Joan, "J"\n你好' }, { questionId: id(91), value: -25 },
  { questionId: id(92), value: { optionIds: ["option-1", "other"], otherText: "Maybe" } },
  { questionId: id(93), value: { [id(100)]: [id(101), id(102)] } },
] }
const page = { version, responses: [response], permissions: { canCorrect: false, canManageAccess: false }, next: id(70) }
const request = (query = `versionId=${version.id}`, headers: HeadersInit = { "sec-fetch-site": "same-origin" }) => new Request(`https://example.org/api/forms/responses/export?${query}`, { headers })
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: id(1) } }, error: null }); mocks.rpc.mockResolvedValue({ data: page }) })
describe("response page export", () => {
  it("quotes Unicode/multiline answers, labels choices/grids, preserves numbers and neutralizes headers", () => {
    const csv = exportFormResponsePage(page, version.id)
    expect(csv.startsWith("\ufeff")).toBe(true)
    expect(csv).toContain('"Joan, ""J""\n你好"')
    expect(csv).toContain('"-25"')
    expect(csv).toContain('"Oui, Other: Maybe"')
    expect(csv).toContain('"Day: AM, PM"')
    expect(csv).toContain('"\'=HYPERLINK(""bad"")')
    expect(csv).toContain(`Name [${id(90)}]`)
    expect(csv).toContain("2026-11-01T12:00:00.000Z")
    expect(csv).not.toContain("[object Object]")
  })
  it.each(["=SUM(1,2)", "+cmd", "-cmd", "@SUM(A1)", " \t\r=1", "\u0000=1"])("neutralizes untrusted formula text %j", value => {
    const input = { ...page, responses: [{ ...response, answers: [{ questionId: id(90), value }] }] }
    expect(exportFormResponsePage(input, version.id)).toContain(`"'${value}"`)
  })
  it("preserves zero and leaves missing optional cells empty", () => {
    const input = { ...page, responses: [{ ...response, answers: [{ questionId: id(90), value: "Joan" }, { questionId: id(91), value: 0 }] }] }
    expect(exportFormResponsePage(input, version.id)).toContain('"Joan","0","","",""\r\n')
  })
  it.each([
    { ...page, version: { ...version, id: id(81) } },
    { ...page, responses: [{ ...response, versionId: id(81) }] },
    { ...page, responses: [response, response] },
    { ...page, responses: [{ ...response, answers: [{ questionId: id(99), value: "private" }] }] },
    { ...page, responses: Array.from({ length: 51 }, (_, i) => ({ ...response, id: id(300 + i) })) },
  ])("rejects malformed identities, answers and oversized pages", input => {
    expect(() => exportFormResponsePage(input, version.id)).toThrow()
  })
  it("rejects excessive label expansion without returning a truncated CSV", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: id(500 + i), label: `Row ${i}` }))
    const columns = Array.from({ length: 10 }, (_, i) => ({ id: id(600 + i), label: `${i}${"界".repeat(239)}` }))
    const questions = Array.from({ length: 5 }, (_, i) => ({ id: id(700 + i), type: "checkbox_grid" as const, label: `Grid ${i}`, required: false, rows, columns }))
    const largeVersion = createFormVersion({ ...version, definition: { questions } })
    const answers = questions.map(question => ({ questionId: question.id, value: Object.fromEntries(rows.map(row => [row.id, columns.map(column => column.id)])) }))
    const input = { ...page, version: largeVersion, responses: Array.from({ length: 50 }, (_, i) => ({ ...response, id: id(800 + i), answers })) }
    expect(() => exportFormResponsePage(input, version.id)).toThrow(FormResponseExportSizeError)
  })
  it("downloads a freshly authorized canonical page without accepting caller identity or stored browser answers", async () => {
    const result = await handleFormResponseExport(request(`versionId=${version.id}&before=${id(71)}`))
    expect(result.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_intake", { p_actor_id: id(1), p_command: { action: "responses", versionId: version.id, before: id(71) } })
    expect(result.headers.get("cache-control")).toBe("private, no-store")
    expect(result.headers.get("content-disposition")).toContain(`responses-${version.id}-${id(71)}.csv`)
    expect(result.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(await result.text()).toContain("Joan")
  })
  it.each([`versionId=${id(80)}&actorId=${id(2)}`, `versionId=${id(80)}&versionId=${id(81)}`, `versionId=${id(80)}&before=bad`, "versionId=bad"])("rejects invalid export input %s", async query => {
    expect((await handleFormResponseExport(request(query))).status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each<HeadersInit>([{}, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-origin", origin: "https://attacker.example" }])("rejects cross-site and unsolicited navigation", async headers => {
    expect((await handleFormResponseExport(request(undefined, headers))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it("requires verified authentication", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: id(1) } }, error: { message: "invalid session" } })
    expect((await handleFormResponseExport(request())).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501", 403], ["22023", 400], ["network", 503]])("denies failed authority/cursor/storage without leaking data (%s)", async (code, status) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private answers" } })
    const result = await handleFormResponseExport(request())
    expect(result.status).toBe(status)
    expect(result.headers.get("cache-control")).toContain("no-store")
    expect(result.headers.get("content-disposition")).toBeNull()
    expect(await result.text()).not.toMatch(/Joan|private answers/)
  })
  it("fails closed if the canonical read returns a different version", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...page, version: { ...version, id: id(81) } } })
    expect((await handleFormResponseExport(request())).status).toBe(503)
  })
})
