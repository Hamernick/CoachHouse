import { describe, expect, it } from "vitest"
import { LEGACY_INVENTORY_DOMAINS, reconcileLegacyDocumentInventory, type LegacyInventorySnapshot } from "@/lib/organization/legacy-document-inventory"

const snapshot = (): LegacyInventorySnapshot => ({
  organizationId: "org", complete: true, domains: LEGACY_INVENTORY_DOMAINS,
  objects: [{ bucket: "org-documents", path: "org/w9/old.pdf", sizeBytes: 17 }], references: [],
})

describe("read-only legacy Storage reconciliation", () => {
  it("never turns an unreferenced object into deletion authority", () => {
    const input = snapshot()
    const before = structuredClone(input)
    const result = reconcileLegacyDocumentInventory(input)
    expect(result.deletionAuthorized).toBe(false)
    expect(result.objects[0].disposition).toBe("unresolved")
    expect(input).toEqual(before)
    expect(reconcileLegacyDocumentInventory(input)).toEqual(result)
  })
  it.each(LEGACY_INVENTORY_DOMAINS)("preserves exact %s references", domain => {
    const input = snapshot()
    input.references.push({ domain, organizationId: "org", path: "org/w9/old.pdf", sizeBytes: 17 })
    expect(reconcileLegacyDocumentInventory(input).objects[0].disposition).toBe("referenced")
  })
  it("holds every object when pagination or a reference domain is incomplete", () => {
    for (const input of [{ ...snapshot(), complete: false }, { ...snapshot(), domains: [] }]) {
      const result = reconcileLegacyDocumentInventory(input)
      expect(result.complete).toBe(false)
      expect(result.objects[0].reasons).toContain("incomplete-snapshot")
    }
  })
  it.each([
    ["foreign-bucket", { bucket: "other" }], ["foreign-path", { path: "other/w9/old.pdf" }],
    ["malformed-path", { path: "org/../old.pdf" }], ["malformed-path", { path: "org//old.pdf" }],
    ["unknown-object-size", { sizeBytes: null }], ["unknown-object-size", { sizeBytes: -1 }],
    ["unknown-object-size", { sizeBytes: Number.MAX_SAFE_INTEGER + 1 }],
  ])("holds %s instead of normalizing ownership", (reason, overrides) => {
    const input = snapshot()
    Object.assign(input.objects[0], overrides)
    expect(reconcileLegacyDocumentInventory(input).objects[0].reasons).toContain(reason)
  })
  it("holds duplicate rows and contradictory or foreign references", () => {
    const input = snapshot()
    input.objects.push({ ...input.objects[0] })
    input.references.push({ domain: "canonical", organizationId: "other", path: "org/w9/old.pdf", sizeBytes: 18 })
    expect(reconcileLegacyDocumentInventory(input).objects[0].reasons).toEqual([
      "duplicate-object", "foreign-reference", "size-mismatch",
    ])
  })
  it("holds recreated objects behind terminal receipts and reports missing live references", () => {
    const input = snapshot()
    input.references.push(
      { domain: "cleanup", organizationId: "org", path: "org/w9/old.pdf", terminal: true },
      { domain: "version", organizationId: "org", path: "org/library/missing.md" },
      { domain: "stage", organizationId: "org", path: "org/w9/gone.pdf", terminal: true },
      { domain: "stage", organizationId: "org", path: "org/w9/not-uploaded.pdf", requiresObject: false },
      { domain: "cleanup", organizationId: "org", path: "org/w9/awaiting-finish.pdf", requiresObject: false },
    )
    const result = reconcileLegacyDocumentInventory(input)
    expect(result.objects[0].reasons).toContain("terminal-receipt-with-object")
    expect(result.missingReferences).toEqual([input.references[1]])
  })
})
