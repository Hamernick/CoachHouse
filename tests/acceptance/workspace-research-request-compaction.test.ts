import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ResponseInputItem } from "openai/resources/responses/responses"
import { knowledgeDisclosure } from "@/features/workspace-ai/server/knowledge-evidence"
import { compactResearchToolMessages, researchToolReferenceInstruction } from "@/features/workspace-ai/server/research-tool-message-compaction"
import { researchConfig } from "@/features/workspace-ai/server/research-config"
import { researchProviderRequest, researchRequestFits } from "@/features/workspace-ai/server/research-provider-request"
import { ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

const scope = { organizationId: WORKSPACE, canvasId: null }
const envelope = { version: 1, scope, effect: "internal_read", disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } }
const record = (id = 1, content = "Authorized excerpt. ".repeat(24)) => knowledgeDisclosure({
  id: `document:${ID(id)}`, kind: "document", title: `Source ${id}`, href: "/workspace", revision: "1", content, contentAvailable: true,
}, "search", 480)
type Record = ReturnType<typeof record>
function pair(callId: string, records: Record[], overrides = {}): ResponseInputItem[] {
  return [
    { type: "function_call", call_id: callId, name: "search_workspace", arguments: '{"query":"evidence","kinds":["document"]}' },
    { type: "function_call_output", call_id: callId, output: JSON.stringify({ ...envelope, results: records, unavailableKinds: [], limit: 8, note: "Bounded keyword search", ...overrides }) },
  ]
}
const output = (messages: ResponseInputItem[], index: number) => {
  const item = messages[index]
  if (item.type !== "function_call_output" || typeof item.output !== "string") throw new Error("Expected text tool output")
  return JSON.parse(item.output)
}
beforeEach(() => {
  vi.stubEnv("WORKSPACE_AI_ENABLED", "true")
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture-only")
  vi.stubEnv("WORKSPACE_AI_RATE_CARD", JSON.stringify({ version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, microdollarsPerCredit: 2000 }))
})
afterEach(() => vi.unstubAllEnvs())

describe("lossless bounded research request assembly", () => {
  it("resolves repeated records to earlier full outputs with current evidence and unchanged transcript", () => {
    const first = record(), second = { ...first, evidence: { ...first.evidence, checkedAt: NOW } }
    const messages = [...pair("first", [first]), ...pair("second", [second]), ...pair("third", [second])]
    const before = JSON.stringify(messages), projected = compactResearchToolMessages(messages)
    expect(projected.compacted).toBe(true)
    expect(JSON.stringify(messages)).toBe(before)
    expect(projected.messages[1]).toBe(messages[1])
    for (const index of [3, 5]) {
      const reference = output(projected.messages, index).results[0]
      expect(reference).toEqual({ id: first.id, sameAs: { callId: "first", resultIndex: 0 }, evidence: second.evidence })
      expect({ ...output(projected.messages, 1).results[reference.sameAs.resultIndex], evidence: reference.evidence }).toEqual(second)
    }
    expect(projected.messages.filter(item => item.type === "function_call")).toEqual(messages.filter(item => item.type === "function_call"))
  })

  it.each(["id", "revision", "title", "href", "content", "scope", "coverage"])("preserves unique %s without a duplicate reference", field => {
    const first = record(), second = structuredClone(first)
    if (field === "id") second.id = `document:${ID(2)}`
    if (field === "revision") second.revision = "2"
    if (field === "title") second.title = "Changed title"
    if (field === "href") second.href = "/workspace?source=changed"
    if (field === "content") second.content = second.content.replace("Authorized", "Different!")
    if (field === "scope") second.evidence.scope = "document_body"
    if (field === "coverage") {
      second.content = ""; second.contentAvailable = false; second.status = "metadata_only"; second.recovery = "read_detail"
      second.evidence.coverage = "metadata_only"; second.evidence.characters = 0
    }
    const messages = [...pair("first", [first]), ...pair("second", [second])]
    expect(compactResearchToolMessages(messages)).toEqual({ messages, compacted: false })
  })

  it.each([
    { scope: { ...scope, organizationId: ID(99) } },
    { scope: { ...scope, canvasId: ID(99) } },
    { disclosure: { ...envelope.disclosure, publicDisclosure: true } },
    { unexpected: "not validated" },
  ])("does not merge different or invalid envelopes %j", patch => {
    const item = record(), messages = [...pair("first", [item]), ...pair("second", [item], patch)]
    expect(compactResearchToolMessages(messages).compacted).toBe(false)
  })

  it("keeps query-specific search excerpts and unavailable results intact", () => {
    const shared = record(1), changed = record(2), otherExcerpt = record(2, "Another relevant section. ".repeat(20))
    const messages = [...pair("first", [shared, changed]), ...pair("second", [shared, otherExcerpt], { unavailableKinds: ["document"], note: "Partial search" })]
    const projected = compactResearchToolMessages(messages)
    expect(output(projected.messages, 3)).toMatchObject({ unavailableKinds: ["document"], note: "Partial search" })
    expect(output(projected.messages, 3).results[0]).toHaveProperty("sameAs")
    expect(output(projected.messages, 3).results[1]).toEqual(otherExcerpt)
  })

  it("requires unambiguous prior known calls and validated arguments", () => {
    const item = record()
    for (const messages of [
      [...pair("same", [item]), ...pair("same", [item])],
      [pair("first", [item])[1], ...pair("second", [item])],
      [...pair("first", [item]), pair("second", [item])[1]],
      [pair("first", [item])[0], pair("first", [item])[1], pair("first", [item])[1], ...pair("second", [item])],
    ]) expect(compactResearchToolMessages(messages).compacted).toBe(false)
    for (const patch of [{ name: "forged_tool" }, { arguments: '{"query":"evidence","kinds":["person"]}' }, { arguments: "{" }]) {
      const messages = [...pair("first", [item]), ...pair("second", [item])]
      messages[0] = { ...messages[0], ...patch } as ResponseInputItem
      expect(compactResearchToolMessages(messages).compacted).toBe(false)
    }
  })

  it("does not reference records from the same output", () => {
    const item = record(), messages = pair("first", [item, item])
    expect(compactResearchToolMessages(messages)).toEqual({ messages, compacted: false })
  })

  it("retains current complete read evidence without mixing selected contact fields", () => {
    const first = knowledgeDisclosure({ id: `person:${ID(1)}`, kind: "person", title: "Authorized person", href: "/workspace", revision: "1", content: "Name: Person", contentAvailable: true, contactFields: ["title"] }, "read", 6000)
    const later = { ...first, evidence: { ...first.evidence, checkedAt: NOW, readAt: NOW } }
    const readPair = (callId: string, result: typeof first, personFields = ["title"]): ResponseInputItem[] => [
      { type: "function_call", call_id: callId, name: "read_workspace", arguments: JSON.stringify({ ids: [first.id], personFields }) },
      { type: "function_call_output", call_id: callId, output: JSON.stringify({ ...envelope, results: [result] }) },
    ]
    const messages = [...readPair("first", first), ...readPair("second", later)]
    expect(output(compactResearchToolMessages(messages).messages, 3).results[0]).toEqual({ id: first.id, sameAs: { callId: "first", resultIndex: 0 }, evidence: later.evidence })
    const email = { ...later, contactFields: ["email" as const], evidence: { ...later.evidence, contactFields: ["email" as const] } }
    expect(compactResearchToolMessages([...readPair("first", first), ...readPair("email", email, ["email"])]).compacted).toBe(false)
  })

  it("preserves repair messages and failed reads even when other output compacts", () => {
    const item = record()
    const retained: ResponseInputItem[] = [
      { role: "assistant", content: "Invalid prior draft remains part of the repair transcript." },
      { role: "developer", content: "Repair the output format only." },
      { type: "function_call", call_id: "failed", name: "read_workspace", arguments: JSON.stringify({ ids: [item.id], personFields: null }) },
      { type: "function_call_output", call_id: "failed", output: JSON.stringify({ version: 1, status: "unavailable", recovery: "retry_read", error: "This authorized source or tool could not be verified. Retry the read; do not infer its contents." }) },
    ]
    const messages = [...pair("first", [item]), ...pair("second", [item]), ...retained]
    expect(compactResearchToolMessages(messages).messages.slice(4)).toEqual(retained)
    const config = { ...researchConfig(), maxInputBytes: 1000 }
    const params = researchProviderRequest(config, messages, 2, true)
    expect(params.tools).toEqual([])
    expect(researchRequestFits(params, config.maxInputBytes)).toBe(false)
    expect(params.input).toEqual(expect.arrayContaining(retained))
  })

  it("compacts only overflowing whole requests and preserves provider controls", () => {
    const config = researchConfig(), items = Array.from({ length: 5 }, (_, index) => record(index + 1))
    const messages = [...pair("first", items), ...pair("second", items)]
    const raw = researchProviderRequest({ ...config, maxInputBytes: 1_000_000 }, messages, 2)
    expect(raw.input).toBe(messages)
    const maximum = Buffer.byteLength(JSON.stringify(raw)) - 1
    const compact = researchProviderRequest({ ...config, maxInputBytes: maximum }, messages, 2)
    expect(researchRequestFits(raw, maximum)).toBe(false)
    expect(researchRequestFits(compact, maximum)).toBe(true)
    expect(compact.instructions).toBe(`${raw.instructions}\n${researchToolReferenceInstruction}`)
    expect({ ...compact, input: raw.input, instructions: raw.instructions }).toEqual(raw)
    expect(compact).toMatchObject({ store: false, stream: true, max_output_tokens: 3000, tools: [] })
  })

  it("keeps unique UTF-8 evidence and refuses requests still over budget", () => {
    const config = researchConfig(), first = record(1, "界".repeat(480)), second = record(2, "文".repeat(480))
    const messages = [...pair("first", [first]), ...pair("second", [second])]
    const params = researchProviderRequest({ ...config, maxInputBytes: 1000 }, messages, 2)
    expect(params.input).toBe(messages)
    expect(researchRequestFits(params, 1000)).toBe(false)
    expect(JSON.stringify(params)).toContain(first.content)
    expect(JSON.stringify(params)).toContain(second.content)
  })
})
