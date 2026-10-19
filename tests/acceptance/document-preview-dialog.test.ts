import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { LibraryItem } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"

const preview = vi.hoisted(() => ({ resolve: vi.fn() }))
vi.mock("@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-document-preview-url", () => ({
  useDocumentPreviewUrl: preview.resolve,
}))
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => createElement("div", null, children)
  return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map((name) => [name, Container]))
})
vi.mock("@/components/organization/org-profile-card/tabs/documents-tab/components/document-pdf-viewer", () => ({
  DocumentPdfViewer: ({ url }: { url: string }) => createElement("div", { "data-pdf-url": url }),
}))
import { DocumentPreviewDialog } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-preview-dialog"

function renderPreview(item: LibraryItem) {
  return renderToStaticMarkup(createElement(DocumentPreviewDialog, {
    item, onClose: () => {}, returnFocusRef: { current: null },
  }))
}
const base: LibraryItem = {
  id: "document", name: "Plan", description: "", source: "uploaded",
  fileType: "pdf", updatedAt: null, deleted: false,
  previewPath: "/api/preview", previewVersion: "v1",
}

describe("document preview modal contracts", () => {
  beforeEach(() => {
    preview.resolve.mockReset()
    preview.resolve.mockImplementation((_path, _version, enabled) => ({
      url: enabled ? "https://storage.example.test/signed-file" : null,
      error: null, retry: vi.fn(),
    }))
  })

  it.each(["image", "pdf"] as const)("renders a Drive %s thumbnail without JSON resolution or PDF decoding", (fileType) => {
    const href = "https://drive.google.com/file/d/provider-file/view"
    const html = renderPreview({
      ...base, fileType, href,
      previewPath: "/api/integrations/google-drive/documents/document/preview",
      driveDocument: { id: "document", name: "Plan", mimeType: fileType === "pdf" ? "application/pdf" : "image/png", modifiedAt: null, status: "available", webViewLink: href },
    })
    expect(preview.resolve).toHaveBeenCalledWith(
      "/api/integrations/google-drive/documents/document/preview", "v1", false
    )
    expect(html).toContain('<img src="/api/integrations/google-drive/documents/document/preview"')
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain("Google Drive thumbnail preview")
    expect(html).not.toContain("data-pdf-url")
    expect(html).not.toContain("storage.example.test")
  })

  it("keeps signed uploaded PDFs in the full PDF viewer", () => {
    const html = renderPreview(base)
    expect(preview.resolve).toHaveBeenCalledWith("/api/preview", "v1", true)
    expect(html).toContain('data-pdf-url="https://storage.example.test/signed-file"')
    expect(html).toContain('href="https://storage.example.test/signed-file"')
    expect(html).not.toContain("<img")
  })

  it("keeps signed uploaded images in the image viewer", () => {
    const html = renderPreview({ ...base, fileType: "image" })
    expect(preview.resolve).toHaveBeenCalledWith("/api/preview", "v1", true)
    expect(html).toContain('<img src="https://storage.example.test/signed-file"')
    expect(html).not.toContain("data-pdf-url")
  })
})
