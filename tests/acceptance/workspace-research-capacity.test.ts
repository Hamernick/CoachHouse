import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getParticleCapabilities, researchPlanOperations } from "@/features/workspace-particles"
import { generatedResearchSchema, researchResultSchema } from "@/features/workspace-ai/research-types"
import { applyResearchDraft, createResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { researchConfig } from "@/features/workspace-ai/server/research-config"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { assertInitialResearchRequestFits, researchProviderRequest, researchRequestFits } from "@/features/workspace-ai/server/research-provider-request"
import { capacityBranchDraft, capacityContext, capacityDraft, capacityRequest } from "./fixtures/research-capacity-fixtures"
import { ID, NOW } from "./fixtures/particle-fixtures"

beforeEach(() => {
  vi.stubEnv("WORKSPACE_AI_ENABLED", "true")
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture-only")
  vi.stubEnv("WORKSPACE_AI_RATE_CARD", JSON.stringify({ version: "capacity-fixture", model: "fixture",
    inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, microdollarsPerCredit: 2000 }))
})
afterEach(() => vi.unstubAllEnvs())
const report = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`)
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8")

describe("offline generation capacity qualification", () => {
  it.each([
    { name: "sparse objective", members: 0, dense: false, multilingual: false, admitted: true },
    { name: "selected twelve members", members: 12, dense: false, multilingual: false, admitted: true },
    { name: "selected forty dense members", members: 40, dense: true, multilingual: false, admitted: false },
    { name: "twelve dense members and multilingual prompt", members: 12, dense: true, multilingual: true, admitted: false },
  ])("measures complete request admission: $name", specimen => {
    const context = capacityContext(specimen.members, specimen.dense), config = researchConfig()
    const request = capacityRequest(context, specimen.multilingual ? "計画".repeat(1000) : undefined)
    const input = [{ role: "user" as const, content: researchPrompt(context, request) }]
    const params = researchProviderRequest(config, input)
    const fits = bytes(params) <= config.maxInputBytes
    report({ specimen: specimen.name, requestBytes: bytes(params), inputBytes: bytes(input),
      envelopeBytes: bytes(params) - bytes(input), remainingBytes: config.maxInputBytes - bytes(params), admitted: fits })
    expect(config.maxInputBytes).toBe(20000); expect(config.maxOutputTokens).toBe(1500)
    expect(fits).toBe(specimen.admitted)
    expect(researchRequestFits(params, config.maxInputBytes)).toBe(fits)
    if (fits) expect(() => assertInitialResearchRequestFits(context, request, config)).not.toThrow()
    else expect(() => assertInitialResearchRequestFits(context, request, config)).toThrow(/too large/)
    if (specimen.members) {
      const selected = JSON.parse(input[0].content).objective.selectedPlan
      expect(selected.members).toHaveLength(specimen.members)
      expect(selected.links).toHaveLength(specimen.members - 1)
    }
  })

  it("distinguishes initial admission from room for a tool continuation", () => {
    const context = capacityContext(12, true), config = researchConfig()
    // Find a near-budget prompt for the current versioned schema/instructions.
    let repeats = 1000
    while (repeats > 0 && !researchRequestFits(researchProviderRequest(config, [{ role: "user", content: researchPrompt(context, capacityRequest(context, "計画".repeat(repeats))) }]), config.maxInputBytes)) repeats--
    expect(repeats).toBeGreaterThan(0)
    const request = capacityRequest(context, "計画".repeat(repeats))
    const input = [{ role: "user" as const, content: researchPrompt(context, request) }]
    expect(() => assertInitialResearchRequestFits(context, request, config)).not.toThrow()
    const next = researchProviderRequest(config, [...input,
      { type: "function_call", call_id: "search_1", name: "search_workspace", arguments: '{"query":"program","kinds":["document"]}' },
      { type: "function_call_output", call_id: "search_1", output: '{"results":[]}' },
    ], 1)
    expect(researchRequestFits(next, config.maxInputBytes)).toBe(false)
    report({ specimen: "admitted multilingual request with empty tool result", requestBytes: bytes(next), admitted: false })
  })

  it.each(["a", "界"])("measures a 6000-character tool return without assuming characters are bytes: %s", character => {
    const context = capacityContext(), config = researchConfig(), request = capacityRequest(context)
    const initial = [{ role: "user" as const, content: researchPrompt(context, request) }]
    const params = researchProviderRequest(config, [...initial,
      { type: "function_call", call_id: "read_1", name: "read_workspace", arguments: '{"ids":["document:fixture"]}' },
      { type: "function_call_output", call_id: "read_1", output: JSON.stringify({ content: character.repeat(6000), contentTruncated: true }) },
    ], 1)
    report({ specimen: `tool-${character === "a" ? "ascii" : "utf8"}`, requestBytes: bytes(params), admitted: researchRequestFits(params, config.maxInputBytes) })
    expect(researchRequestFits(params, config.maxInputBytes)).toBe(character === "a")
    expect(JSON.stringify(params)).toContain(character.repeat(6000))
  })

  it.each([
    { name: "compact four-item plan", draft: capacityDraft(4) },
    { name: "compact twelve-item plan", draft: capacityDraft(12) },
    { name: "maximum-description twelve-item plan", draft: capacityDraft(12, true) },
    { name: "two-route decision", draft: capacityBranchDraft() },
  ])("validates full output and merged graph without treating bytes as tokens: $name", ({ name, draft }) => {
    const context = capacityContext(), before = JSON.stringify(context.graph)
    const result = bindResearch(JSON.stringify(draft), [], context.target, ID(900))
    let nextId = 1000
    const operations = researchPlanOperations(context.graph, result, ID(90), NOW, () => ID(nextId++))
    expect(operations.length).toBeGreaterThan(0)
    expect(result.items).toHaveLength(draft.items.length)
    expect(JSON.stringify(context.graph)).toBe(before)
    report({ specimen: name, outputBytes: bytes(draft), items: draft.items.length, outputTokens: null, modelQuality: "unmeasured" })
  })

  it("preserves selected work in a focused sourced revision", () => {
    const context = capacityContext(12), draft = capacityDraft(2)
    const member = context.graph.particles[1], referenceId = `particle:${member.id}`
    draft.items[0] = { ...draft.items[0], kind: "reference", title: member.title, referenceId, evidenceIds: [referenceId], dependsOn: [] }
    const result = bindResearch(JSON.stringify(draft), [{ id: referenceId, title: member.title, href: "/workspace", revision: "0", checkedAt: NOW, kind: "workspace" }], context.target, ID(900))
    const before = JSON.stringify(context.graph)
    let nextId = 1000
    expect(researchPlanOperations(context.graph, result, ID(90), NOW, () => ID(nextId++)).length).toBeGreaterThan(0)
    expect(JSON.stringify(context.graph)).toBe(before)
    expect(result.removeReferences).toEqual([])
    expect(result.items[0].referenceId).toBe(referenceId)
  })

  it("does not silently accept a thirteenth item or truncate it to fit", () => {
    const draft = capacityDraft(13)
    expect(generatedResearchSchema.safeParse(draft).success).toBe(false)
    expect(draft.items).toHaveLength(13)
  })

  it.each(["form", "draft"])("does not advertise an unsupported %s output as qualified", kind => {
    const draft = capacityDraft(1)
    expect(generatedResearchSchema.safeParse({ ...draft, items: [{ ...draft.items[0], kind }] }).success).toBe(false)
    expect(generatedResearchSchema.safeParse({ ...draft, [kind]: { title: "Requested output" } }).success).toBe(false)
  })
})


it("keeps omissions across saved-result parsing, private edits and real note materialization", () => {
  const context = capacityContext(), unfulfilled = ["Working form", "Response table"]
  const result = bindResearch(JSON.stringify({ ...capacityDraft(1), unfulfilled }), [], context.target, ID(900))
  const restored = researchResultSchema.parse(JSON.parse(JSON.stringify(result)))
  const edited = applyResearchDraft(restored, { ...createResearchDraft(restored), title: "My revised plan" })
  expect(edited.unfulfilled).toEqual(unfulfilled)
  let nextId = 1000
  const operations = researchPlanOperations(context.graph, edited, ID(90), NOW, () => ID(nextId++))
  const notes = operations.flatMap(operation => operation.kind === "put_particle" && operation.particle.type === "activity" ? [operation.particle] : [])
  expect(notes).toHaveLength(1)
  expect(getParticleCapabilities(notes[0]).map(capability => capability.id)).toEqual(["workspace_note"])
  expect(notes[0].data.widget).toMatchObject({ kind: "notes", source: { kind: "workspace", content: result.items[0].description } })
  // Earlier saved results remain readable, without inventing a coverage declaration.
  const legacy = { ...restored }; delete legacy.unfulfilled
  expect(researchResultSchema.parse(legacy)).not.toHaveProperty("unfulfilled")
})
