/** Read-only reconciliation. No classification authorizes deletion or changes quota. */
export const LEGACY_INVENTORY_DOMAINS = [
  "canonical", "profile", "version", "source", "stage", "cleanup",
] as const
type Domain = typeof LEGACY_INVENTORY_DOMAINS[number]
export type LegacyInventoryObject = { bucket: string; path: string; sizeBytes: number | null }
export type LegacyInventoryReference = {
  domain: Domain; organizationId: string; path: string; sizeBytes?: number | null
  terminal?: boolean; requiresObject?: boolean
}
export type LegacyInventorySnapshot = {
  organizationId: string
  /** True only for one consistent, untruncated snapshot including every domain. */
  complete: boolean
  domains: readonly Domain[]
  objects: LegacyInventoryObject[]
  references: LegacyInventoryReference[]
}

const normalizedPath = (path: string) => Boolean(path) && !/[\\\u0000-\u001f]/.test(path) &&
  path.split("/").every(part => part !== "" && part !== "." && part !== "..")
const validBytes = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0

export function reconcileLegacyDocumentInventory(snapshot: LegacyInventorySnapshot) {
  const complete = snapshot.complete && LEGACY_INVENTORY_DOMAINS.every(domain => snapshot.domains.includes(domain))
  const counts = new Map<string, number>()
  for (const object of snapshot.objects) {
    const key = JSON.stringify([object.bucket, object.path])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const references = new Map<string, LegacyInventoryReference[]>()
  for (const reference of snapshot.references) {
    const existing = references.get(reference.path) ?? []
    existing.push(reference)
    references.set(reference.path, existing)
  }
  const objects = snapshot.objects.map(object => {
    const matches = references.get(object.path) ?? []
    const reasons: string[] = []
    if (!complete) reasons.push("incomplete-snapshot")
    if (object.bucket !== "org-documents") reasons.push("foreign-bucket")
    if (!normalizedPath(object.path)) reasons.push("malformed-path")
    if (!object.path.startsWith(`${snapshot.organizationId}/`)) reasons.push("foreign-path")
    if ((counts.get(JSON.stringify([object.bucket, object.path])) ?? 0) !== 1) reasons.push("duplicate-object")
    if (!validBytes(object.sizeBytes)) reasons.push("unknown-object-size")
    if (matches.some(reference => reference.organizationId !== snapshot.organizationId)) reasons.push("foreign-reference")
    if (matches.some(reference => reference.sizeBytes !== undefined &&
      (!validBytes(reference.sizeBytes) || reference.sizeBytes !== object.sizeBytes))) reasons.push("size-mismatch")
    if (matches.some(reference => reference.terminal && (reference.domain === "stage" || reference.domain === "cleanup")))
      reasons.push("terminal-receipt-with-object")
    const disposition = reasons.length ? "held" : matches.length ? "referenced" : "unresolved"
    return { ...object, disposition, reasons, domains: [...new Set(matches.map(reference => reference.domain))].sort() }
  })
  const present = new Set(snapshot.objects.filter(object => object.bucket === "org-documents").map(object => object.path))
  const missingReferences = snapshot.references.filter(reference => reference.organizationId === snapshot.organizationId &&
    !reference.terminal && reference.requiresObject !== false && !present.has(reference.path))
  return {
    complete,
    deletionAuthorized: false as const,
    objects,
    missingReferences,
    counts: {
      total: objects.length,
      referenced: objects.filter(object => object.disposition === "referenced").length,
      unresolved: objects.filter(object => object.disposition === "unresolved").length,
      held: objects.filter(object => object.disposition === "held").length,
      missingReferences: missingReferences.length,
    },
  }
}
