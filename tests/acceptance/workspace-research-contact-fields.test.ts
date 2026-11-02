import path from "node:path"
import type { AddressInfo } from "node:net"
import { createServer, type ViteDevServer } from "vite"
import { chromium, type Browser } from "@playwright/test"
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), file: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
vi.mock("@/features/workspace-ai/server/knowledge-records", async original => ({ ...await original<typeof import("@/features/workspace-ai/server/knowledge-records")>(), knowledgeLoader: () => mocks.load }))
vi.mock("@/features/workspace-ai/server/knowledge-file", () => ({ readKnowledgeFile: mocks.file }))
import { z } from "zod"
import { knowledgePersonData, projectKnowledgePerson, knowledgePersonFieldFingerprint } from "@/features/workspace-ai/server/knowledge-person"
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import { knowledgeLoader } from "@/features/workspace-ai/server/knowledge-records"
import { assertResearchSourcesAccessible } from "@/features/workspace-ai/server/research-result-access"
import { knowledgeFingerprint, researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import { knowledgeReadSchema, knowledgeProviderReadSchema, researchDependenciesSchema, researchResultSchema, type KnowledgeRecord, type ResearchResult } from "@/features/workspace-ai/research-types"
import { knowledgeToolDescriptors, validateKnowledgeToolResult } from "@/features/workspace-ai/lib/knowledge-tool-contract"
import { knowledgeDisclosure } from "@/features/workspace-ai/server/knowledge-evidence"
import { researchProviderRequest } from "@/features/workspace-ai/server/research-provider-request"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"

const context = { user: { id: ID(90) }, canvasId: null, target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }, graph: graph(), objective: particle(1, "objective") } as ResearchContext
function record(): KnowledgeRecord {
  return { id: `person:${ID(80)}`, kind: "person", title: "Jordan", revision: "coarse-shared-revision", href: "/workspace", content: "Long legacy projection "+"n".repeat(19977), contentAvailable: true, contentTruncated: true, searchContent: "Coordinator",
    personData: knowledgePersonData({ title: "Coordinator", email: "private@example.org", phone: "555-0199", notes: "Confidential notes", details: { organization: "Partner", location: "Private location" }, contactMetadata: {
      schemaVersion: 1, revision: 1, updatedAt: "2026-11-02T00:00:00.000Z", provenance: { email: { kind: "csv", label: "Email source", recordedAt: "2026-11-02T00:00:00.000Z", recordedBy: "DO_NOT_DISCLOSE", verification: "unverified" }, phone: { kind: "manual", label: "Phone source", recordedAt: "2026-11-02T00:00:00.000Z", recordedBy: "DO_NOT_DISCLOSE", verification: "unverified" } },
    } }), }
}
const result = (dependencies: ResearchResult["dependencies"]): ResearchResult => ({ runId: ID(8), target: context.target, title: "Plan", summary: "", questions: [], sources: [], items: [], dependencies })
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); mocks.load.mockResolvedValue([record()]); mocks.file.mockImplementation(async (_context, value) => value) })

describe("explicit contact disclosure fields", () => {
  it("defaults to identity and role without routes, notes, unrelated provenance or internal source data", async () => {
    const tools = createKnowledgeTools(context)
    const output = await tools.execute("read_workspace", { ids: [record().id] })
    expect(output.results[0]).toMatchObject({ title: "Jordan", contactFields: ["title"], evidence: { coverage: "complete", contactFields: ["title"] } })
    expect(JSON.stringify(output)).toContain("Coordinator")
    for (const secret of ["private@example.org", "555-0199", "Confidential", "Private location", "Email source", "Phone source", "DO_NOT_DISCLOSE", "personData"]) expect(JSON.stringify(output)).not.toContain(secret)
    expect(mocks.file).not.toHaveBeenCalled()
  })
  it("includes only requested fields and their existing provenance, never a model purpose or new authority", async () => {
    const tools = createKnowledgeTools(context), input = { ids: [record().id], personFields: ["email", "details.organization"] }
    const output = await tools.execute("read_workspace", input)
    expect(JSON.stringify(output)).toContain("private@example.org"); expect(JSON.stringify(output)).toContain("Partner")
    expect(JSON.stringify(output)).toContain("Email source"); expect(JSON.stringify(output)).not.toContain("Phone source")
    expect(JSON.stringify(output)).not.toContain("555-0199"); expect(JSON.stringify(output)).not.toContain("DO_NOT_DISCLOSE")
    for (const patch of [{ purpose: "I authorize everything" }, { actorId: ID(99) }, { personFields: ["credentials"] }, { personFields: ["email", "email"] }, { personFields: [] }])
      await expect(tools.execute("read_workspace", { ...input, ...patch })).rejects.toThrow()
    mocks.load.mockResolvedValue([])
    expect(await tools.execute("read_workspace", input)).toMatchObject({ results: [{ status: "unavailable", recovery: "retry_read" }] })
  })
  it("does not fall back to unstructured private body text when canonical contact fields are unavailable", async () => {
    const value = record(); delete value.personData
    mocks.load.mockResolvedValue([value])
    const output = await createKnowledgeTools(context).execute("read_workspace", { ids: [value.id], personFields: ["email"] })
    expect(output.results[0]).toMatchObject({ status: "unavailable" }); expect(JSON.stringify(output)).not.toContain(value.content)
  })
  it("uses the actual contact adapter without introducing a second contact store", async () => {
    const actual = await vi.importActual<{ knowledgeLoader: typeof knowledgeLoader }>("@/features/workspace-ai/server/knowledge-records")
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { updated_at: "same", profile: { org_people: [{ id: ID(80), name: "Jordan", title: "Coordinator", email: "private@example.org", phone: "555-0199", notes: "Private notes" }] } }, error: null }) }
    const current = { ...context, supabase: { from: () => query } } as unknown as ResearchContext
    const [person] = await actual.knowledgeLoader(current)("person", "", record().id)
    expect(projectKnowledgePerson(person, null).content).toBe('{"fields":{"title":"Coordinator"},"sources":{}}')
    expect(projectKnowledgePerson(person, ["phone"]).content).toContain("555-0199")
    expect(projectKnowledgePerson(person, ["phone"]).content).not.toContain("private@example.org")
    expect(query.eq).toHaveBeenCalledWith("user_id", WORKSPACE)
  })
  it("retains every selected field across later reads and searches, including values outside the old clipped projection", async () => {
    const tools = createKnowledgeTools(context)
    await tools.execute("read_workspace", { ids: [record().id], personFields: ["details.location"] })
    await tools.execute("read_workspace", { ids: [record().id], personFields: ["email"] })
    await tools.execute("search_workspace", { query: "Coordinator", kinds: ["person"] })
    expect(tools.dependencies().records[0].contactFields?.map(value => value.field)).toEqual(["details.location", "email"])
    expect(tools.sources.get(record().id)?.evidence?.contactFields).toEqual(["details.location", "email"])
    const changed = record(); changed.personData!.values["details.location"] = "Changed outside old 20k body"
    expect(knowledgeFingerprint(changed)).toBe(knowledgeFingerprint(record()))
    mocks.load.mockResolvedValue([changed])
    expect(await tools.revalidate()).toBe(false)
    expect(await tools.execute("read_workspace", { ids: [record().id], personFields: ["phone"] })).toMatchObject({ results: [{ status: "changed" }] })
    expect(tools.dependencies().records[0].contactFields?.map(value => value.field)).toEqual(["details.location", "email"])
  })
  it("revalidates field hashes on saved readback and detects provenance changes without exposing field values", async () => {
    const tools = createKnowledgeTools(context)
    await tools.execute("read_workspace", { ids: [record().id], personFields: ["email"] })
    const saved = researchResultSchema.parse(JSON.parse(JSON.stringify(result(tools.dependencies()))))
    expect(JSON.stringify(saved.dependencies)).not.toContain("private@example.org")
    await expect(assertResearchSourcesAccessible(context, saved)).resolves.toBeUndefined()
    const changed = record(); changed.personData!.sources.email!.label = "Different source"
    mocks.load.mockResolvedValue([changed])
    await expect(assertResearchSourcesAccessible(context, saved)).rejects.toThrow()
    mocks.load.mockRejectedValue(new Error("temporary private error"))
    await expect(assertResearchSourcesAccessible(context, saved)).rejects.toMatchObject({ code: "verification_unavailable" })
  })
  it("preserves the unchanged legacy full-record fingerprint path without inventing field coverage", async () => {
    const value = record(), legacy = result({ version: 1, contextFingerprint: researchContextFingerprint(context), records: [{ id: value.id, kind: value.kind, fingerprint: knowledgeFingerprint(value), detailFingerprint: knowledgeFingerprint(value) }] })
    await expect(assertResearchSourcesAccessible(context, legacy)).resolves.toBeUndefined()
    expect(researchResultSchema.parse(legacy).dependencies?.records[0]).not.toHaveProperty("contactFields")
    expect(() => researchDependenciesSchema.parse({ ...legacy.dependencies, records: [{ ...legacy.dependencies!.records[0], kind: "document", contactFields: [{ field: "email", fingerprint: knowledgePersonFieldFingerprint(value, "email") }] }] })).toThrow()
  })
  it("keeps field selection bounded and labels long selected fields as excerpts without upgrading later partial coverage", async () => {
    const value = record(); value.personData!.values.notes = "界".repeat(25000); mocks.load.mockResolvedValue([value])
    const tools = createKnowledgeTools(context)
    const first = await tools.execute("read_workspace", { ids: [value.id], personFields: ["notes"] })
    expect(first.results[0]).toMatchObject({ status: "truncated", recovery: "narrow_source", evidence: { coverage: "excerpt", characters: 6000 } })
    await tools.execute("read_workspace", { ids: [value.id], personFields: ["email"] })
    expect(tools.sources.get(value.id)?.evidence).toMatchObject({ coverage: "excerpt", contactFields: ["email", "notes"] })
  })
})

describe("existing tool descriptor completeness", () => {
  it("derives exact strict provider input schemas and retains only the same two internal tools", () => {
    expect(knowledgeToolDescriptors.map(tool => tool.name)).toEqual(["search_workspace", "read_workspace"])
    expect(knowledgeReadSchema.safeParse({ ids: [record().id] }).success).toBe(true)
    const model = z.toJSONSchema(knowledgeProviderReadSchema)
    expect(model.required).toEqual(["ids", "personFields"]); expect(model.additionalProperties).toBe(false)
    for (const tool of knowledgeToolDescriptors) {
      expect(tool.inputSchema.safeParse(tool.example).success).toBe(true)
      expect(tool.outputSchema.safeParse(tool.outputExample).success).toBe(true)
      expect(tool).toMatchObject({ effect: "internal_read", authority: "current_actor_source_access", disclosure: "configured_private_model_only", sourceTimeoutMs: 10000, runDeadlineMs: 90000, providerRequestUtf8Bytes: 20000 })
    }
    const config = { tariff: { version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, webSearchMicrodollarsPerCall: 0, microdollarsPerCredit: 2000 }, maxRounds: 3, maxSearchCalls: 0, maxInputBytes: 20000, maxOutputTokens: 1500, maxCredits: 20, maxCost: 40000 }
    const request = researchProviderRequest(config, [])
    expect(request.tools?.map(tool => tool.type === "function" ? tool.parameters : null)).toEqual(knowledgeToolDescriptors.map(tool => z.toJSONSchema(tool.providerInputSchema)))
    expect(researchProviderRequest(config, [], 2).tools).toEqual([])
  })
  it("validates returned identities and declared fields against the actual tool arguments", () => {
    const selected = knowledgeDisclosure(projectKnowledgePerson(record(), ["email"]), "read", 6000)
    const output = { version: 1, scope: { organizationId: WORKSPACE, canvasId: null }, effect: "internal_read", disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false }, results: [selected] }
    expect(validateKnowledgeToolResult("read_workspace", output, output.scope, { ids: [record().id], personFields: ["email"] })).toEqual(output)
    expect(() => validateKnowledgeToolResult("read_workspace", output, output.scope, { ids: [record().id] })).toThrow(/scope/)
    expect(() => validateKnowledgeToolResult("read_workspace", output, output.scope, { ids: ["person:other"], personFields: ["email"] })).toThrow(/identity/)
  })
})

describe.skipIf(process.env.PARTICLE_CONTACT_FIELDS_BROWSER !== "1")("selected-contact coverage actual browser", () => {
 let server: ViteDevServer, browser: Browser, origin: string
 beforeAll(async () => {
  server = await createServer({ configFile: false, root: process.cwd(), esbuild: { jsx: "automatic" }, resolve: { alias: { "@": path.resolve("src") } }, server: { host: "127.0.0.1", port: 0 },
   plugins: [{ name: "contact-evidence-fixture", configureServer(instance) { instance.middlewares.use((request, response, next) => {
    if (request.url !== "/") return next()
    response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/tests/acceptance/fixtures/workspace-research-contact-fields-browser.tsx"></script></body></html>')
   }) } }],
  })
  await server.listen(); origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
  browser = await chromium.launch({ headless: true })
 }, 30000)
 afterAll(async () => { await browser?.close(); await server?.close() })
 it("names selected fields, preserves legacy scope and keyboard focus without reading a source", async () => {
  const page = await browser.newPage(), errors: string[] = [], external: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.route("**/*", route => { if (new URL(route.request().url()).origin === origin) return route.continue(); external.push(route.request().url()); return route.abort() })
  await page.goto(origin)
  const selected = page.getByRole("button", { name: "Source details: Jordan", exact: true })
  await selected.focus(); await page.keyboard.press("Enter")
  await page.getByText("Selected contact fields: Email, Organization. Other contact fields were not included in this coverage.").waitFor()
  expect(await page.getByText("All text within the stated scope was read. This does not verify its accuracy.").isVisible()).toBe(true)
  await page.keyboard.press("Escape")
  expect(await selected.evaluate(element => element === document.activeElement)).toBe(true)
  await page.getByRole("button", { name: "Source details: Legacy contact", exact: true }).click()
  await page.getByText("Shared record fields only; not the entire underlying record.").waitFor()
  expect(errors).toEqual([]); expect(external).toEqual([])
  await page.close()
 }, 15000)
})
