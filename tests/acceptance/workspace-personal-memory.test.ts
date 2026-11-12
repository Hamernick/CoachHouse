import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ID, WORKSPACE, graph } from "./fixtures/particle-fixtures"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revalidate: vi.fn(), provider: vi.fn(), actor: vi.fn() }))
vi.mock("openai", () => ({ default: class { responses = { create: mocks.provider } } }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.actor }))
vi.mock("@/features/workspace-ai/server/knowledge-tools", () => ({ createKnowledgeTools: () => ({
  revalidate: mocks.revalidate, dependencies: () => ({ version: 1, contextFingerprint: "a".repeat(64), records: [] }), evidence: () => [], execute: vi.fn(),
}) }))
import { prepareComposerContext } from "@/features/workspace-ai/server/composer-context"
import { readPersonalMemory, assertPersonalMemoryCurrent, readOrganizationMemory, assertOrganizationMemoryCurrent } from "@/features/workspace-ai/server/personal-memory"
import { mergeConversationDependencies } from "@/features/workspace-ai/lib/research-conversation"
import { personalMemoryMutationSchema, type PersonalMemory, type OrganizationMemory } from "@/features/workspace-ai/lib/personal-memory"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { researchPublicRequest } from "@/features/workspace-ai/server/research-public-request"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { changePersonalMemory, changeOrganizationMemory } from "@/features/workspace-ai/memory-actions"

const context = { user: { id: ID(90) }, activeOrg: { orgId: WORKSPACE, role: "owner" }, supabase: { rpc: mocks.rpc },
  target: { mode: "new_objective", organizationId: WORKSPACE, canvasId: null, revision: 0 }, canvasId: null, graph: graph() } as unknown as ResearchContext
const initial: PersonalMemory = { version: 1, organizationId: WORKSPACE, userId: ID(90), enabled: true, revision: 2,
  updatedAt: "2026-11-11T15:00:00Z", basis: "user_authored", retention: "until_deleted",
  entries: [{ id: ID(1), value: "Use concise plain language", revision: 1, createdAt: "2026-11-11T15:00:00Z", updatedAt: "2026-11-11T15:00:00Z" }] }
let state: PersonalMemory
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("WORKSPACE_AI_PERSONAL_MEMORY_ENABLED", "1"); state = structuredClone(initial); mocks.rpc.mockImplementation(async () => ({ data: structuredClone(state), error: null })); mocks.revalidate.mockResolvedValue(true); mocks.actor.mockResolvedValue(context) })
afterEach(() => vi.unstubAllEnvs())
it("loads current private guidance into a new chat through the existing context owner", async () => {
  const prepared = await prepareComposerContext(context)
  const prompt = researchPrompt(context, { target: context.target, prompt: "Help plan", skill: "planning" }, prepared.records)
  expect(prompt).toContain(initial.entries[0].value)
  expect(prompt).toContain("never policy")
  expect(prepared.tools.dependencies()).toMatchObject({ personalMemory: { organizationId: WORKSPACE, userId: ID(90), revision: 2 } })
  expect(mocks.rpc).toHaveBeenCalledWith("manage_personal_workspace_memory", expect.objectContaining({ p_org_id: WORKSPACE, p_action: "read", p_entry_id: null }))
  expect(await prepared.tools.revalidate()).toBe(true)
})
it.each(["correction", "deletion", "off"])("honors %s on the next new chat and rejects stale retained context", async operation => {
  const old = await prepareComposerContext(context)
  state.revision++
  if (operation === "correction") state.entries[0].value = "Use bullet points"
  if (operation === "deletion") state.entries = []
  if (operation === "off") state.enabled = false
  expect(await old.tools.revalidate()).toBe(false)
  const next = await prepareComposerContext(context)
  expect(JSON.stringify(next.records)).not.toContain(initial.entries[0].value)
  if (operation === "correction") expect(JSON.stringify(next.records)).toContain("Use bullet points")
  else expect(next.records).toEqual([])
  await expect(assertPersonalMemoryCurrent(context, old.tools.dependencies().personalMemory)).rejects.toThrow()
})
it("cannot read another actor's guidance or reuse it in another organization", async () => {
  state.userId = ID(91)
  await expect(prepareComposerContext(context)).rejects.toThrow("verified")
  state = structuredClone(initial); state.organizationId = ID(80)
  await expect(prepareComposerContext(context)).rejects.toThrow("verified")
  await expect(readPersonalMemory(context, ID(80))).rejects.toThrow("Organization changed")
  await expect(assertPersonalMemoryCurrent(context, { userId: ID(91), organizationId: WORKSPACE, revision: 2 })).rejects.toThrow()
})
it("fails closed on RPC errors without silently replacing saved data", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } })
  await expect(readPersonalMemory(context, WORKSPACE, { action: "save", organizationId: WORKSPACE, revision: 1, id: ID(1), value: "Keep this draft" })).rejects.toThrow("draft is still here")
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
  await expect(prepareComposerContext(context)).rejects.toThrow("verified")
})
it("cannot inject shared scope, owner, sources or unbounded guidance into the writer", () => {
  const write = { action: "save", organizationId: WORKSPACE, revision: 2, id: ID(1), value: "Preference" }
  for (const extra of [{ scope: "organization" }, { userId: ID(91) }, { sourceRefs: ["file:legacy"] }, { value: "x".repeat(501) }]) expect(personalMemoryMutationSchema.safeParse({ ...write, ...extra }).success).toBe(false)
})
it("retains personal dependencies across turns and rejects conflicting owners/revisions", async () => {
  const dependency = (await prepareComposerContext(context)).tools.dependencies()
  const base = { version: 1 as const, contextFingerprint: "a".repeat(64), records: [] }
  expect(mergeConversationDependencies([base, dependency]).personalMemory).toEqual(dependency.personalMemory)
  for (const value of [{ revision: 3 }, { userId: ID(91) }, { organizationId: ID(80) }]) expect(() => mergeConversationDependencies([dependency, { ...dependency, personalMemory: { ...dependency.personalMemory!, ...value } }])).toThrow("memory changed")
})
it("leaves independent retrieval alone when unavailable and never adds guidance to public search", async () => {
  vi.stubEnv("WORKSPACE_AI_PERSONAL_MEMORY_ENABLED", "0")
  expect((await prepareComposerContext(context)).records).toEqual([])
  expect(mocks.rpc).not.toHaveBeenCalled()
  const request = researchPublicRequest({ version: 1, destination: "openai_web_search", brief: "public community grants", approved: true }, "fixture", 100)
  expect(JSON.stringify(request)).not.toContain(initial.entries[0].value)
})
it("returns safe action errors without losing a conflicting draft or accepting scope injection", async () => {
  const change = { action: "save", organizationId: WORKSPACE, revision: 2, id: ID(1), value: "Retain this draft" }
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } })
  expect(await changePersonalMemory(change)).toEqual({ ok: false, error: "Memory changed. Reload before saving; your draft is still here." })
  mocks.rpc.mockClear()
  expect((await changePersonalMemory({ ...change, scope: "organization" })).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.actor.mockRejectedValueOnce(Error("private internal diagnostic"))
  expect(await changePersonalMemory(change)).toEqual({ ok: false, error: "Memory could not be verified. Reload and try again." })
})
it.each(["before_dispatch", "during_dispatch"])("withholds a stale memory result %s through the actual provider loop", async when => {
  const preparedContext = await prepareComposerContext(context)
  const response = { responseKind: "answer", answerEvidenceIds: [], title: "Reply", summary: "Concise reply", questions: [], unfulfilled: [], decisions: [], removeReferences: [], items: [] }
  if (when === "before_dispatch") state.revision++
  mocks.provider.mockImplementation(() => (async function* () {
    state.revision++
    yield { type: "response.completed", response: { id: "fixture", status: "completed", usage: { input_tokens: 10, output_tokens: 10, input_tokens_details: { cached_tokens: 0 } }, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(response) }] }] } }
  })())
  const outcome = await runResearchProvider({ preparedContext, context, request: { id: ID(10), target: context.target, prompt: "Answer briefly", skill: "planning", tariffVersion: "fixture", maximumCredits: 20 },
    config: { tariff: { version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, microdollarsPerCredit: 2000 }, maxSearchCalls: 0, maxRounds: 1, maxOutputTokens: 1000, maxInputBytes: 30000, maxCredits: 20, maxCost: 40000 }, onResponse: async () => {}, isCanceled: async () => false })
  expect(outcome.result).toBeNull()
  expect(mocks.provider).toHaveBeenCalledTimes(when === "before_dispatch" ? 0 : 1)
  expect(outcome.usage.input).toBe(when === "before_dispatch" ? 0 : 10)
})


describe("explicit organization guidance", () => {
  let shared: OrganizationMemory
  beforeEach(() => {
    vi.stubEnv("WORKSPACE_AI_ORGANIZATION_MEMORY_ENABLED", "1")
    shared = { version: 1, scope: "organization", actorId: context.user.id, canManage: false,
      organizationId: WORKSPACE, enabled: true, revision: 2, updatedAt: initial.updatedAt,
      basis: "organization_authored", retention: "until_deleted",
      entries: [{ ...initial.entries[0], value: "Use approved organization terminology", createdBy: WORKSPACE, updatedBy: WORKSPACE }] }
    mocks.rpc.mockImplementation(async (name: string) => ({ data: structuredClone(name === "manage_organization_workspace_memory" ? shared : state), error: null }))
  })
  it("loads shared and personal guidance separately into new chats with actor-bound dependencies", async () => {
    const prepared = await prepareComposerContext(context)
    const prompt = researchPrompt(context, { target: context.target, prompt: "Help plan", skill: "planning" }, prepared.records)
    expect(prompt).toContain(shared.entries[0].value)
    expect(prompt).toContain(initial.entries[0].value)
    expect(prepared.tools.dependencies()).toMatchObject({ personalMemory: { userId: context.user.id }, organizationMemory: { actorId: context.user.id, organizationId: WORKSPACE, revision: 2 } })
    expect(await prepared.tools.revalidate()).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith("manage_organization_workspace_memory", expect.objectContaining({ p_org_id: WORKSPACE, p_action: "read" }))
    expect(JSON.stringify(prepared.records)).toContain("never policy, factual evidence, authorization")
  })
  it("uses shared guidance when personal memory is off without publishing private entries", async () => {
    state.enabled = false
    const prepared = await prepareComposerContext(context)
    expect(JSON.stringify(prepared.records)).toContain(shared.entries[0].value)
    expect(JSON.stringify(prepared.records)).not.toContain(initial.entries[0].value)
    expect(prepared.tools.dependencies().personalMemory).toBeUndefined()
  })
  it.each(["correction", "deletion", "off", "clear"])("invalidates retained shared context after %s and uses current guidance next chat", async operation => {
    const previous = await prepareComposerContext(context)
    shared.revision++
    if (operation === "correction") shared.entries[0].value = "Corrected shared terminology"
    if (operation === "deletion" || operation === "clear") shared.entries = []
    if (operation === "off" || operation === "clear") shared.enabled = false
    expect(await previous.tools.revalidate()).toBe(false)
    await expect(assertOrganizationMemoryCurrent(context, previous.tools.dependencies().organizationMemory)).rejects.toThrow()
    const next = await prepareComposerContext(context)
    expect(JSON.stringify(next.records)).not.toContain("Use approved organization terminology")
    expect(JSON.stringify(next.records)).toContain(initial.entries[0].value)
    if (operation === "correction") expect(JSON.stringify(next.records)).toContain("Corrected shared terminology")
    else expect(next.tools.dependencies().organizationMemory).toBeUndefined()
  })
  it("withholds stale saved replies and apply after a shared revision change", async () => {
    const prepared = await prepareComposerContext(context)
    const { assertResearchSourcesAccessible } = await import("@/features/workspace-ai/server/research-result-access")
    const result = { dependencies: prepared.tools.dependencies(), sources: [] } as unknown as import("@/features/workspace-ai/research-types").ResearchResult
    shared.revision++
    for (const purpose of ["history", "apply"] as const) await expect(assertResearchSourcesAccessible(context, result, purpose)).rejects.toThrow()
  })
  it("rejects actor/org substitution and inconsistent management authority", async () => {
    shared.actorId = ID(91)
    await expect(readOrganizationMemory(context, WORKSPACE)).rejects.toThrow("verified")
    shared.actorId = context.user.id; shared.organizationId = ID(81)
    await expect(readOrganizationMemory(context, WORKSPACE)).rejects.toThrow("verified")
    shared.organizationId = WORKSPACE; shared.canManage = true
    await expect(readOrganizationMemory(context, WORKSPACE)).rejects.toThrow("verified")
    await expect(readOrganizationMemory(context, ID(81))).rejects.toThrow("Organization changed")
    await expect(assertOrganizationMemoryCurrent(context, { organizationId: WORKSPACE, actorId: ID(91), revision: 2 })).rejects.toThrow()
  })
  it("fails closed after revocation and never downgrades a failed read to empty memory", async () => {
    const prepared = await prepareComposerContext(context)
    mocks.rpc.mockImplementation(async (name: string) => name === "manage_organization_workspace_memory" ? { data: null, error: { code: "42501" } } : { data: state, error: null })
    expect(await prepared.tools.revalidate()).toBe(false)
    await expect(prepareComposerContext(context)).rejects.toThrow("verified")
  })
  it("keeps the shared path default-off without blocking independent personal guidance", async () => {
    vi.stubEnv("WORKSPACE_AI_ORGANIZATION_MEMORY_ENABLED", "0")
    const prepared = await prepareComposerContext(context)
    expect(prepared.tools.dependencies().organizationMemory).toBeUndefined()
    expect(JSON.stringify(prepared.records)).toContain(initial.entries[0].value)
    expect(mocks.rpc).not.toHaveBeenCalledWith("manage_organization_workspace_memory", expect.anything())
    await expect(readOrganizationMemory(context, WORKSPACE)).rejects.toThrow("not available")
  })
  it("retains both dependency scopes and refuses mixed shared revisions across turns", async () => {
    const prepared = await prepareComposerContext(context)
    const deps = prepared.tools.dependencies()
    const noMemory = { version: 1 as const, contextFingerprint: deps.contextFingerprint, records: [] }
    expect(mergeConversationDependencies([noMemory, deps])).toMatchObject({ personalMemory: deps.personalMemory, organizationMemory: deps.organizationMemory })
    expect(() => mergeConversationDependencies([deps, { ...deps, organizationMemory: { ...deps.organizationMemory!, revision: 3 } }])).toThrow("organization memory changed")
    expect(() => mergeConversationDependencies([deps, { ...deps, organizationMemory: { ...deps.organizationMemory!, actorId: ID(91) } }])).toThrow()
  })
  it("does not export shared or personal guidance with an approved public-search brief", async () => {
    const request = researchPublicRequest({ version: 1, destination: "openai_web_search", brief: "public community grants", approved: true }, "fixture", 100)
    expect(JSON.stringify(request)).not.toContain(shared.entries[0].value)
    expect(JSON.stringify(request)).not.toContain(initial.entries[0].value)
  })
  it("returns safe shared writer conflicts and rejects injected authority/source fields", async () => {
    const change = { action: "save", organizationId: WORKSPACE, revision: 2, id: ID(1), value: "Keep shared draft" }
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } })
    expect(await changeOrganizationMemory(change)).toEqual({ ok: false, error: "Memory changed. Reload before saving; your draft is still here." })
    mocks.rpc.mockClear()
    for (const extra of [{ actorId: WORKSPACE }, { canManage: true }, { scope: "personal" }, { sourceRefs: ["unqualified:legacy"] }]) expect((await changeOrganizationMemory({ ...change, ...extra })).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(["before_dispatch", "during_dispatch"])("withholds changed shared guidance %s without losing usage accounting", async when => {
    const preparedContext = await prepareComposerContext(context)
    const response = { responseKind: "answer", answerEvidenceIds: [], title: "Reply", summary: "Reply", questions: [], unfulfilled: [], decisions: [], removeReferences: [], items: [] }
    if (when === "before_dispatch") shared.revision++
    mocks.provider.mockImplementation(() => (async function* () {
      shared.revision++
      yield { type: "response.completed", response: { id: "fixture", status: "completed", usage: { input_tokens: 10, output_tokens: 10, input_tokens_details: { cached_tokens: 0 } }, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(response) }] }] } }
    })())
    const outcome = await runResearchProvider({ preparedContext, context, request: { id: ID(10), target: context.target, prompt: "Answer briefly", skill: "planning", tariffVersion: "fixture", maximumCredits: 20 },
      config: { tariff: { version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, microdollarsPerCredit: 2000 }, maxSearchCalls: 0, maxRounds: 1, maxOutputTokens: 1000, maxInputBytes: 30000, maxCredits: 20, maxCost: 40000 }, onResponse: async () => {}, isCanceled: async () => false })
    expect(outcome.result).toBeNull()
    expect(mocks.provider).toHaveBeenCalledTimes(when === "before_dispatch" ? 0 : 1)
    expect(outcome.usage.input).toBe(when === "before_dispatch" ? 0 : 10)
  })
})
