import { describe, expect, it } from "vitest"

import {
  MAX_BYTES,
  MAX_UPLOAD_MB,
} from "@/components/organization/org-profile-card/tabs/documents-tab/constants"
import { validatePdf } from "@/components/organization/org-profile-card/tabs/documents-tab/helpers"
import { validateOrganizationDocument } from "@/lib/organization/document-storage"
import {
  buildLibraryItems,
  isEmptyDocumentSlot,
} from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import {
  buildRoadmapRows,
  buildUploadRows,
} from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"

describe("organization document upload limit", () => {
  it("accepts supported image and PDF slot uploads while rejecting empty, active, and oversized files", () => {
    for (const type of [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ]) {
      expect(validateOrganizationDocument({ type, size: MAX_BYTES })).toBeNull()
    }
    for (const type of [
      "image/svg+xml",
      "text/html",
      "application/javascript",
      "",
    ]) {
      expect(validateOrganizationDocument({ type, size: 100 })).not.toBeNull()
    }
    expect(
      validateOrganizationDocument({ type: "image/png", size: 0 })
    ).toContain("empty")
    expect(
      validateOrganizationDocument({
        type: "application/pdf",
        size: MAX_BYTES + 1,
      })
    ).toContain("15 MB")
  })

  it("keeps empty slots undated and routes each populated slot to its own preview", () => {
    const rows = buildUploadRows({
      bylaws: {
        name: "bylaws.png",
        path: "org/bylaws/image.png",
        mime: "image/png",
        updatedAt: "2026-09-08T12:00:00Z",
      },
      w9: { name: "missing.pdf", path: "", updatedAt: "2026-09-08T12:00:00Z" },
    })
    const items = buildLibraryItems(rows, [], [], true)
    const bylaws = items.find((item) => item.id === "upload:bylaws")!
    const empty = items.find((item) => item.id === "upload:w9")!
    expect(bylaws.fileType).toBe("image")
    expect(bylaws.previewPath).toBe("/api/account/org-documents?kind=bylaws")
    expect(bylaws.updatedAt).toBe("2026-09-08T12:00:00Z")
    expect(empty.updatedAt).toBeNull()
    expect(empty.previewPath).toBeUndefined()
  })

  it("routes attached Drive files through the private thumbnail proxy", () => {
    const documentId = "11111111-1111-4111-8111-111111111111"
    const [item] = buildLibraryItems(
      [],
      [
        {
          id: documentId,
          name: "Board strategy",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/selected-file/edit",
          modifiedAt: "2026-09-17T12:00:00Z",
          status: "available",
        },
      ],
      []
    )

    expect(item.previewPath).toBe(
      `/api/integrations/google-drive/documents/${documentId}/preview`
    )
    expect(item.previewVersion).toBe("2026-09-17T12:00:00Z")
  })

  it("attaches core files only to their own slot, with no duplicate card, and releases trashed attachments", () => {
    const rows = buildRoadmapRows(
      ["budget", "board_strategy"].map((id) => ({
        id,
        title: id,
        subtitle: "",
        slug: id,
        status: "not_started",
        lastUpdated: null,
        isPublic: false,
      }))
    )
    const file = {
      id: "attachment",
      coreSectionId: "budget",
      name: "plan.png",
      mimeType: "image/png",
      sizeBytes: 100,
      createdAt: "2026-09-08T12:00:00Z",
      updatedAt: "2026-09-08T12:00:00Z",
      deletedAt: null,
    }
    const items = buildLibraryItems(rows, [], [file], true)
    expect(items).toHaveLength(2)
    const budget = items.find((item) => item.id === "roadmap:budget")!
    expect(budget.uploadedFile).toEqual(file)
    expect(budget.fileType).toBe("image")
    expect(budget.previewPath).toBe(
      "/api/account/organization-document-files?id=attachment"
    )
    expect(budget.href).toBe("/roadmap/budget")
    expect(isEmptyDocumentSlot(budget)).toBe(false)
    expect(
      isEmptyDocumentSlot(
        items.find((item) => item.id === "roadmap:board_strategy")!
      )
    ).toBe(true)
    const trashed = buildLibraryItems(
      rows,
      [],
      [{ ...file, deletedAt: file.updatedAt }],
      true
    )
    expect(
      trashed.find((item) => item.id === "uploaded:attachment")?.deleted
    ).toBe(true)
    expect(
      isEmptyDocumentSlot(trashed.find((item) => item.id === "roadmap:budget")!)
    ).toBe(true)
    const versions = buildLibraryItems(
      rows,
      [],
      [file, { ...file, id: "older" }],
      true
    )
    expect(versions.find((item) => item.id === "uploaded:older")).toBeDefined()
  })

  it("allows PDF uploads up to the existing 15 MB bucket limit", () => {
    expect(MAX_UPLOAD_MB).toBe(15)
    expect(MAX_BYTES).toBe(15 * 1024 * 1024)

    const file = new File(["x"], "verification.pdf", {
      type: "application/pdf",
    })
    Object.defineProperty(file, "size", {
      value: MAX_BYTES,
    })

    expect(validatePdf(file)).toBeNull()
  })

  it("returns the current 15 MB limit in validation errors", () => {
    const file = new File(["x"], "verification.pdf", {
      type: "application/pdf",
    })
    Object.defineProperty(file, "size", {
      value: MAX_BYTES + 1,
    })

    expect(validatePdf(file)).toBe("PDF must be 15 MB or less.")
  })
})
