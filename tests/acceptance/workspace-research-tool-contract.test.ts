import { describe, expect, it } from "vitest"
import { knowledgeDisclosure } from "@/features/workspace-ai/server/knowledge-evidence"
import { knowledgeReadFailure, KnowledgeChangedError } from "@/features/workspace-ai/server/knowledge-failure"
import { knowledgeDisclosedRecordSchema, validateKnowledgeToolResult } from "@/features/workspace-ai/lib/knowledge-tool-contract"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"
const scope = { organizationId: WORKSPACE, canvasId: null }
const envelope = { version: 1, scope, effect: "internal_read", disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } }
const record = (content = "Private approved excerpt"): KnowledgeRecord => ({ id: `document:${ID(1)}`, kind: "document", title: "Evidence", href: "/workspace", revision: "1", content, contentAvailable: true })
const read = () => ({ ...envelope, results: [knowledgeDisclosure(record(), "read", 6000)] })
const search = () => ({ ...envelope, results: [knowledgeDisclosure(record(), "search", 480)], unavailableKinds: [], limit: 8, note: "Bounded keyword search" })

describe("deterministic knowledge tool output boundary", () => {
  it("binds internal/private disclosure and exact scope without asserting processing approval", () => {
    const value = read()
    expect(validateKnowledgeToolResult("read_workspace", value, scope)).toEqual(value)
    expect(() => validateKnowledgeToolResult("read_workspace", read(), { ...scope, organizationId: ID(99) })).toThrow(/scope/)
    expect(() => validateKnowledgeToolResult("read_workspace", read(), { ...scope, canvasId: ID(99) })).toThrow(/scope/)
    expect(() => validateKnowledgeToolResult("external_search", search(), scope)).toThrow(/not available/)
  })
  it.each([
    { effect: "canonical_write" }, { disclosure: { ...envelope.disclosure, publicDisclosure: true } },
    { disclosure: { ...envelope.disclosure, destination: "public_search" } }, { credentials: "secret" }, { version: 2 },
  ])("rejects forged disclosure or envelope fields %j", patch => {
    expect(() => validateKnowledgeToolResult("read_workspace", { ...read(), ...patch }, scope)).toThrow()
  })
  it.each([
    { href: "https://storage.example/private?token=secret" }, { href: "//outside.example" }, { kind: "person" }, { storage_path: "private/path" },
    { status: "available", contentAvailable: false }, { status: "available", recovery: "restart_research" },
    { evidence: { ...read().results[0].evidence, characters: 0 } }, { title: "x".repeat(241) }, { revision: "x".repeat(2001) },
  ])("rejects unsafe or contradictory source output %j", patch => {
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [{ ...read().results[0], ...patch }] }, scope)).toThrow()
  })
  it("enforces the unchanged four-reference/6000 UTF-16 limit independently of UTF-8 bytes and token estimates", () => {
    const text = "界".repeat(6000), bounded = knowledgeDisclosure(record(text), "read", 6000)
    expect(bounded.evidence.characters).toBe(6000)
    expect(Buffer.byteLength(bounded.content)).toBe(18000)
    expect(validateKnowledgeToolResult("read_workspace", { ...envelope, results: [bounded] }, scope)).toHaveProperty("results")
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [bounded, ...read().results] }, scope)).toThrow(/budget/)
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: Array(5).fill(read().results[0]) }, scope)).toThrow()
    const emoji = knowledgeDisclosure(record("😀".repeat(4000)), "read", 6000)
    expect(emoji.evidence.characters).toBe(6000); expect(emoji.content.length).toBe(6000)
  })
  it("keeps search at eight matches, 480 characters each and six unavailable kinds", () => {
    expect(validateKnowledgeToolResult("search_workspace", search(), scope)).toHaveProperty("limit", 8)
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), results: Array(9).fill(search().results[0]) }, scope)).toThrow()
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), results: [knowledgeDisclosure(record("x".repeat(481)), "search", 481)] }, scope)).toThrow()
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), unavailableKinds: Array(7).fill("person") }, scope)).toThrow()
  })
  it.each([
    ["unsupported_format", "choose_source"], ["exhausted_budget", "narrow_source"], ["empty", "choose_source"], ["unavailable", "retry_read"],
  ] as const)("reports verified %s extraction separately from complete body evidence", (availability, recovery) => {
    const disclosed = knowledgeDisclosure({ ...record(), contentAvailable: false, availability }, "read", 6000)
    expect(disclosed).toMatchObject({ status: availability, recovery, contentAvailable: false, evidence: { coverage: "unavailable", characters: 0 } })
    expect(knowledgeDisclosedRecordSchema.parse(disclosed)).toEqual(disclosed)
  })
  it("never upgrades unknown, denied or transient errors into confirmed revocation or change", () => {
    const outputs = [new Error("permission denied private details"), new Error("not found private id"), new Error("timeout"), null]
      .map(error => knowledgeReadFailure("person:requested", error))
    expect(outputs.every(value => JSON.stringify(value) === JSON.stringify(outputs[0]))).toBe(true)
    expect(outputs[0]).toMatchObject({ status: "unavailable", recovery: "retry_read" })
    expect(JSON.stringify(outputs)).not.toContain("private")
    expect(knowledgeReadFailure("person:requested", new KnowledgeChangedError())).toMatchObject({ status: "changed", recovery: "restart_research" })
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [{ ...outputs[0], error: "secret database text" }] }, scope)).toThrow()
  })
})
