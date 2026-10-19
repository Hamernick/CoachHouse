import { describe, expect, it } from "vitest"
import { buildDocumentsTabDocuments } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import { buildUploadRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"
import { buildLibraryItems, isEmptyDocumentSlot } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { DOCUMENTS } from "@/components/organization/org-profile-card/tabs/documents-tab/constants"

describe("document preview availability", () => {
  it("keeps all seeded document slots missing without creating preview requests", () => {
    const profile = {
      documents: Object.fromEntries(DOCUMENTS.map(({ key, kind }) => [key, {
        name: `${kind}.pdf`, path: `seed/${kind}.pdf`, mime: "application/pdf",
      }])),
    }
    const snapshot = JSON.stringify(profile)
    const documents = buildDocumentsTabDocuments(profile)
    const rows = buildUploadRows(documents)
    expect(rows).toHaveLength(14)
    expect(rows.every((row) => row.status === "missing" && row.document === null)).toBe(true)
    expect(buildLibraryItems(rows, [], [])).toEqual([])
    const slots = buildLibraryItems(rows, [], [], true)
    expect(slots).toHaveLength(14)
    expect(slots.every((item) => !item.previewPath && isEmptyDocumentSlot(item))).toBe(true)
    expect(JSON.stringify(profile)).toBe(snapshot)
  })

  it("preserves a real uploaded document and its preview", () => {
    const document = {
      name: "W9.pdf", path: "org-id/w9/123-W9.pdf", mime: "application/pdf",
      size: 100, updatedAt: "2026-10-19T15:00:00Z",
    }
    const documents = buildDocumentsTabDocuments({ documents: { w9: document } })
    expect(documents.w9).toEqual(document)
    const [item] = buildLibraryItems(buildUploadRows(documents), [], [])
    expect(item.previewPath).toBe("/api/account/org-documents?kind=w9")
    expect(isEmptyDocumentSlot(item)).toBe(false)
  })

  it.each([null, {}, { path: "" }, { path: "  " }, { path: 123 }])(
    "does not turn malformed metadata into a preview: %j", (w9) => {
      expect(buildDocumentsTabDocuments({ documents: { w9 } }).w9).toBeNull()
    }
  )

  it.each(["available", "trashed", "inaccessible", "needs_reconnect"] as const)(
    "requests Drive thumbnails only for available files: %s", (status) => {
      const [item] = buildLibraryItems([], [{
        id: "drive-doc", name: "Plan", mimeType: "application/pdf",
        webViewLink: "https://drive.google.com/file/d/file-id/view", modifiedAt: null, status,
      }], [])
      expect(item.previewPath).toBe(status === "available"
        ? "/api/integrations/google-drive/documents/drive-doc/preview" : undefined)
      expect(item.href).toBe("https://drive.google.com/file/d/file-id/view")
    }
  )
})
