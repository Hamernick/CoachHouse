import { pathToFileURL } from "node:url"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const importer = await import(
  pathToFileURL(join(process.cwd(), "scripts/resource-map/import-records.mjs")).href
)

function staged(id: string, sourceId: string, website = "https://provider.example/sites") {
  return {
    id,
    source_record_id: sourceId,
    promotion_status: "not_promoted",
    review_status: "needs_review",
    extracted_fields: { websiteUrl: website },
  }
}

function cappedDatabase(rows: ReturnType<typeof staged>[], failAfter?: string) {
  const requests: { source: string; cursor: string | null; limit: number }[] = []
  const admin = {
    from(table: string) {
      expect(table).toBe("resource_map_import_records")
      let source = ""
      let cursor: string | null = null
      const query = {
        select() { return query },
        eq(column: string, value: string) {
          expect(column).toBe("source_id")
          source = value
          return query
        },
        order(column: string, options: { ascending: boolean }) {
          expect(column).toBe("id")
          expect(options.ascending).toBe(true)
          return query
        },
        gt(column: string, value: string) {
          expect(column).toBe("id")
          cursor = value
          return query
        },
        async limit(limit: number) {
          requests.push({ source, cursor, limit })
          if (failAfter && cursor && cursor >= failAfter) {
            return { data: null, error: new Error("lookup failed") }
          }
          // The server returns fewer rows than requested, like a PostgREST cap.
          return {
            data: rows.filter((row) => !cursor || row.id > cursor).slice(0, Math.min(limit, 57)),
            error: null,
          }
        },
      }
      return query
    },
  }
  return { admin, requests }
}

describe("resource map staging refresh", () => {
  it("reads beyond a server-capped page and scopes every cursor lookup to the source", async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => staged(String(i).padStart(5, "0"), `source-${i}`))
    const { admin, requests } = cappedDatabase(rows)
    const result = await importer.fetchExistingImportRecords(admin, "selected-source", [], true)
    expect(result).toEqual(rows)
    expect(requests.length).toBeGreaterThan(2)
    expect(requests.every((request) => request.source === "selected-source" && request.limit <= 500)).toBe(true)
    expect(requests.at(-1)?.cursor).toBe(rows.at(-1)?.id)
  })

  it("fails instead of returning partial lookup results after a later page error", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => staged(String(i).padStart(5, "0"), `source-${i}`))
    const { admin } = cappedDatabase(rows, "00056")
    await expect(importer.fetchExistingImportRecords(admin, "selected-source", [], true)).rejects.toThrow("lookup failed")
  })

  it("does not assign two incoming sites to one staged row through a shared URL", () => {
    const existing = [staged("staged-1", "old-site")]
    const payload = [staged("input-a", "site-a"), staged("input-b", "site-b")]
    expect(importer.resolveExistingAssignments(existing, payload, true)).toEqual([null, null])
  })

  it.each([false, true])("reserves exact source matches before URL fallback, reversed=%s", (reverse) => {
    const existing = [staged("staged-1", "site-a")]
    const payload = [staged("input-b", "site-b"), staged("input-a", "site-a")]
    if (reverse) payload.reverse()
    const result = importer.resolveExistingAssignments(existing, payload, true)
    expect(result[payload.findIndex((row) => row.source_record_id === "site-a")]).toEqual({ record: existing[0], reconciled: false })
    expect(result[payload.findIndex((row) => row.source_record_id === "site-b")]).toBeNull()
  })

  it("retains unique URL title reconciliation and rejects ambiguous stored URLs", () => {
    const payload = [staged("input", "new-title")]
    const existing = [staged("staged-1", "old-title")]
    expect(importer.resolveExistingAssignments(existing, payload, true)).toEqual([{ record: existing[0], reconciled: true }])
    expect(importer.resolveExistingAssignments([...existing, staged("staged-2", "other-site")], payload, true)).toEqual([null])
    expect(importer.resolveExistingAssignments(existing, payload, false)).toEqual([null])
  })

  it("rejects duplicate input source IDs before assigning writes", () => {
    const payload = [staged("input-a", "site-a"), staged("input-b", "site-a")]
    expect(() => importer.resolveExistingAssignments([staged("stored", "site-a")], payload, true)).toThrow("duplicate source record IDs")
  })

  it("fails a non-advancing lookup instead of looping or returning partial data", async () => {
    const query = {
      select() { return query },
      eq() { return query },
      order() { return query },
      gt() { return query },
      async limit() { return { data: [staged("same-id", "same-source")], error: null } },
    }
    await expect(importer.fetchExistingImportRecords({ from: () => query }, "selected-source", [], true)).rejects.toThrow("did not advance")
  })
})
