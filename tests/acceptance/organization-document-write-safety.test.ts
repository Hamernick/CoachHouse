import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readRoute(path: string) {
  return readFileSync(join(ROOT, path), "utf8")
}

function handler(source: string, method: "POST" | "DELETE") {
  const start = source.indexOf(`export async function ${method}`)
  const nextExport = source.indexOf("\nexport async function ", start + 1)
  return source.slice(start, nextExport === -1 ? undefined : nextExport)
}

describe("organization document write safety", () => {
  const documentRoute = readRoute("src/app/api/account/org-documents/route.ts")
  const policyRoute = readRoute("src/app/api/account/org-policies/route.ts")
  const policyDocumentRoute = readRoute(
    "src/app/api/account/org-policies/document/route.ts"
  )
  const publicDocumentRoute = readRoute(
    "src/app/api/account/org-public-documents/route.ts"
  )

  it("uses conflict-safe profile mutations instead of whole-profile upserts", () => {
    for (const source of [
      documentRoute,
      policyRoute,
      policyDocumentRoute,
      publicDocumentRoute,
    ]) {
      expect(source).toContain("mutateOrganizationProfile")
      expect(source).not.toContain(".upsert(")
    }
  })

  it("commits replacement metadata before removing a prior storage object", () => {
    for (const source of [
      documentRoute,
      policyDocumentRoute,
      publicDocumentRoute,
    ]) {
      const post = handler(source, "POST")
      const upload = post.indexOf(source === publicDocumentRoute ? ".upload(" : "uploadLegacyDocumentStage(")
      const mutation = post.indexOf("mutateOrganizationProfile")
      const beforeMutation = post.slice(upload, mutation)
      const priorObjectRemovals = ["existingPath", "previousPath"]
        .map((name) => post.indexOf(`.remove([${name}])`))
        .filter((index) => index !== -1)

      expect(upload).toBeGreaterThan(-1)
      expect(mutation).toBeGreaterThan(upload)
      expect(beforeMutation).not.toMatch(
        /\.remove\(\[(?:existingPath|previousPath)\]\)/
      )
      for (const removal of priorObjectRemovals) {
        expect(removal).toBeGreaterThan(mutation)
      }
    }
  })

  it("durably reconciles private stages on every exit without direct ambiguous deletion", () => {
    for (const source of [documentRoute, policyDocumentRoute]) {
      expect(handler(source, "POST")).toContain("finally {")
      expect(handler(source, "POST")).toContain("reconcileLegacyDocumentUploadStages({ ...stage, attemptedPaths })")
      expect(handler(source, "POST")).not.toContain(".remove([objectName])")
    }
    expect(handler(publicDocumentRoute, "POST")).toContain(
      ".remove([objectName])"
    )
  })

  it("commits delete metadata before storage cleanup", () => {
    for (const source of [
      documentRoute,
      policyRoute,
      policyDocumentRoute,
      publicDocumentRoute,
    ]) {
      const remove = handler(source, "DELETE")
      const cleanup = source === publicDocumentRoute ? remove.indexOf(".remove(") : remove.lastIndexOf("reconcileLegacyDocumentCleanup(")
      expect(remove.indexOf("mutateOrganizationProfile")).toBeLessThan(cleanup)
    }
  })
})
