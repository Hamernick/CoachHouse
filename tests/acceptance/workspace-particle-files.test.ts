import { particleDrivePreviewUrl } from "@/features/workspace-particles/lib/particle-drive-preview"
import { ParticleDrivePreview } from "@/features/workspace-particles/components/particle-drive-preview"
import { ParticleDocumentCard } from "@/features/workspace-particles/components/particle-document-card"
import * as fileUrlHook from "@/features/workspace-particles/hooks/use-particle-file-url"
import { ParticleDocumentLibrarySource } from "@/features/workspace-particles/components/particle-document-library-source"
import { ParticleLibraryDragContext, type ParticleLibraryDragController } from "@/features/workspace-particles/components/particle-library-drag-context"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ParticleCard } from "@/features/workspace-particles/components/particle-card"
import { reconcileParticleNode } from "@/features/workspace-particles/lib/particle-node-state"
import {
  createFileParticle,
  getParticleDocument,
  particleFileError,
  particleFileFormat,
  uploadParticleFile,
  particleFileEditingSource,
} from "@/features/workspace-particles/lib/particle-file"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import {
  boundedDocumentText,
  documentContentSchema,
  MAX_PREVIEW_CHARACTERS,
} from "@/features/workspace-particles/lib/particle-document-content"
import { duplicateParticle } from "@/features/workspace-particles/lib/particle-card-actions"
import { ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"
import {
  createLibraryDocumentParticle,
  particleDocumentEndpoint,
  particleDocumentOriginal,
  resolveLibraryImageParticle,
} from "@/features/workspace-particles/lib/particle-library-document"
import { documentParticleReference } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-particle-reference"
import { buildLibraryItems } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { buildRoadmapRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"
import { updateRoadmapSection } from "@/lib/roadmap"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const documentFile = {
  kind: "document",
  fileId: ID(52),
  format: "pdf",
  name: "Annual report.pdf",
  size: 1234,
} as const

describe("Particle file contracts", () => {
  it("opens only canonical uploaded Markdown in the complete file window",()=>{
    const particle=createFileParticle(WORKSPACE,"Notes",{...documentFile,format:"md",name:"Notes.md"},{x:10,y:20},ID(99),NOW)
    expect(particleFileEditingSource(particle)).toEqual({provider:"coach_house",organizationId:WORKSPACE,fileId:documentFile.fileId})
    expect(particleFileEditingSource(createFileParticle(WORKSPACE,"PDF",documentFile,{x:10,y:20},ID(99),NOW))).toBeNull()
    expect(particleFileEditingSource(createLibraryDocumentParticle(WORKSPACE,{name:"Drive file",mimeType:"text/markdown",source:{kind:"drive",id:ID(88),webViewLink:"https://drive.google.com/file/d/example/view"}},ID(99),NOW))).toBeNull()
  })
  it.each(["md", "pdf", "docx", "csv", "txt"] as const)(
    "allows moving the %s preview body with native canvas dragging",
    (format) => {
      const particle = createFileParticle(
        WORKSPACE,
        "Report",
        { ...documentFile, format, name: `Report.${format}` },
        { x: 0, y: 0 },
        ID(1),
        NOW
      )
      const data = {
        particle,
        editable: true,
        onOpen: vi.fn(),
        onEdit: vi.fn(),
      }
      const html = renderToStaticMarkup(
        createElement(ParticleCard, { data, controls: false })
      )
      const previewClass = html.match(
        /class="([^"]*particle-file-preview[^"]*)"/
      )?.[1]
      expect(previewClass).toBeDefined()
      expect(previewClass?.split(" ")).not.toContain("nodrag")
      expect(previewClass?.split(" ")).toContain("nowheel")
      expect(
        reconcileParticleNode({
          particle,
          selectedId: null,
          movable: true,
          resizing: false,
          keepPosition: false,
          data,
        }).draggable
      ).toBe(true)
    }
  )
  it("excludes unavailable Drive records from canvas placement", () => {
    for (const status of [
      "trashed",
      "inaccessible",
      "needs_reconnect",
    ] as const) {
      const [item] = buildLibraryItems(
        [],
        [
          {
            id: "drive-file",
            name: "Report",
            mimeType: "application/pdf",
            webViewLink: "https://drive.google.com/file/d/drive-file/view",
            modifiedAt: NOW,
            status,
          },
        ],
        []
      )
      expect(documentParticleReference(item)).toBeNull()
    }
  })
  it("references uploaded library files without copying their storage object", () => {
    const [item] = buildLibraryItems(
      [],
      [],
      [
        {
          id: ID(52),
          name: "Annual report.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          deletedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]
    )
    const reference = documentParticleReference(item)
    if (!reference) throw new Error("Missing library reference")
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      reference,
      ID(1),
      NOW
    )
    expect(particleSchema.safeParse(particle).success).toBe(true)
    expect(getParticleDocument(particle)?.fileId).toBe(ID(52))
    expect(
      getParticleDocument(
        createLibraryDocumentParticle(
          WORKSPACE,
          { ...reference, name: "Report without extension" },
          ID(1),
          NOW
        )
      )?.format
    ).toBe("pdf")
    expect(documentParticleReference({ ...item, deleted: true })).toBeNull()
    expect(JSON.stringify(particle)).not.toContain("storage_path")
  })

  it("keeps linked and generated Core Documents as references, excluding empty slots", () => {
    const { section } = updateRoadmapSection({}, "vision", {
      content: "<p>Our vision</p>",
      status: "in_progress",
    })
    const [item] = buildLibraryItems(buildRoadmapRows([section]), [], [])
    const reference = documentParticleReference(item)
    if (!reference) throw new Error("Missing generated reference")
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      reference,
      ID(1),
      NOW
    )
    expect(particleSchema.safeParse(particle).success).toBe(true)
    expect(getParticleDocument(particle)?.source?.kind).toBe("roadmap")
    expect(JSON.stringify(particle)).not.toContain("Our vision")
    expect(documentParticleReference({ ...item, hasContent: false })).toBeNull()
    const linked = {
      ...item,
      coreDriveSource: {
        provider: "google_drive" as const,
        fileId: "drive-file",
        name: "Vision",
        webViewLink: "https://docs.google.com/document/d/drive-file/edit",
      },
    }
    const driveReference = documentParticleReference(linked)
    if (!driveReference) throw new Error("Missing Drive reference")
    const file = getParticleDocument(
      createLibraryDocumentParticle(WORKSPACE, driveReference, ID(1), NOW)
    )
    expect(file?.format).toBe("link")
    expect(file?.source).toEqual({
      kind: "roadmap_drive", sectionId: section.slug || section.id,
      fileId: "drive-file", webViewLink: linked.coreDriveSource.webViewLink,
    })
    expect(particleSchema.safeParse(
      createLibraryDocumentParticle(WORKSPACE, driveReference, ID(1), NOW)
    ).success).toBe(true)
    expect(file && particleDocumentOriginal(file)).toBe(
      linked.coreDriveSource.webViewLink
    )
    expect(file && particleDocumentEndpoint(WORKSPACE, file)).toBeNull()
  })

  it.each([
    [
      { kind: "upload", documentKind: "bylaws" },
      "/api/account/org-documents",
      "kind=bylaws",
    ],
    [
      { kind: "policy", id: ID(7) },
      "/api/account/org-policies/document",
      `id=${ID(7)}`,
    ],
    [
      { kind: "roadmap", sectionId: "vision" },
      "/api/account/workspace-documents-index/item",
      "id=roadmap%3Avision",
    ],
  ] as const)(
    "scopes %j previews to their persisted organization",
    (source, path, parameter) => {
      const particle = createLibraryDocumentParticle(
        WORKSPACE,
        { name: "Report.pdf", mimeType: "application/pdf", source },
        ID(1),
        NOW
      )
      expect(particleSchema.safeParse(particle).success).toBe(true)
      const file = getParticleDocument(particle)
      if (!file) throw new Error("Missing document")
      expect(particleDocumentEndpoint(WORKSPACE, file)).toBe(
        `${path}?organizationId=${WORKSPACE}&${parameter}`
      )
    }
  )

  it.each([
    "javascript:alert(1)",
    "https://evil.test/doc",
    "https://docs.google.com.evil.test/doc",
    "https://user:secret@docs.google.com/doc",
  ])("rejects unsafe library links: %s", (webViewLink) => {
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      {
        name: "Report",
        mimeType: "application/pdf",
        source: { kind: "drive", id: "drive-file", webViewLink },
      },
      ID(1),
      NOW
    )
    expect(particleSchema.safeParse(particle).success).toBe(false)
  })

  it("rejects ambiguous or missing document sources and preserves legacy file validation", () => {
    const particle = createFileParticle(
      WORKSPACE,
      "Report",
      documentFile,
      { x: 0, y: 0 },
      ID(1),
      NOW
    )
    if (particle.type !== "activity") throw new Error("Invalid fixture")
    const withWidget = (widget: unknown) => ({
      ...particle,
      data: { ...particle.data, widget },
    })
    expect(
      particleSchema.safeParse(
        withWidget({ ...documentFile, source: { kind: "policy", id: ID(7) } })
      ).success
    ).toBe(false)
    expect(
      particleSchema.safeParse(
        withWidget({ ...documentFile, fileId: undefined })
      ).success
    ).toBe(false)
    expect(
      particleSchema.safeParse(withWidget({ ...documentFile, size: undefined }))
        .success
    ).toBe(false)
  })

  it("reuses loaded image dimensions without a network request", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      { name: "Photo.png", mimeType: "image/png", size: 100, fileId: ID(52) },
      ID(1),
      NOW,
      { width: 800, height: 600 }
    )
    expect(particleSchema.safeParse(particle).success).toBe(true)
    expect(await resolveLibraryImageParticle(particle)).toBe(particle)
    expect(fetcher).not.toHaveBeenCalled()
    expect(() =>
      createLibraryDocumentParticle(
        WORKSPACE,
        { name: "Photo.png", mimeType: "image/png", size: 100, fileId: ID(52) },
        ID(1),
        NOW,
        { width: 10000, height: 10000 }
      )
    ).toThrow("40 megapixels")
  })

  it("decodes an unloaded image using its existing authorized file URL, without POST", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ url: "https://example.test/private.png" })
        )
      )
    vi.stubGlobal("fetch", fetcher)
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 800
        naturalHeight = 600
        onload: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
    )
    const particle = createLibraryDocumentParticle(
      WORKSPACE,
      { name: "Photo.png", mimeType: "image/png", size: 100, fileId: ID(52) },
      ID(1),
      NOW
    )
    const resolved = await resolveLibraryImageParticle(particle)
    expect(resolved.id).toBe(particle.id)
    expect(resolved.type === "activity" && resolved.data.widget).toMatchObject({
      kind: "image",
      fileId: ID(52),
      width: 800,
      height: 600,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      `/api/account/organization-document-files?organizationId=${WORKSPACE}&id=${ID(52)}`,
      expect.objectContaining({ cache: "no-store" })
    )
  })

  it.each(["pdf", "md", "docx", "doc", "csv", "txt"])(
    "persists a %s private reference without URLs",
    (format) => {
      const particle = createFileParticle(
        WORKSPACE,
        "Report",
        documentFile,
        { x: 50, y: 100 },
        ID(1),
        NOW
      )
      if (particle.type !== "activity") throw new Error("Wrong fixture")
      expect(
        particleSchema.safeParse({
          ...particle,
          data: { ...particle.data, widget: { ...documentFile, format } },
        }).success
      ).toBe(true)
      expect(
        particleSchema.safeParse({
          ...particle,
          data: {
            ...particle.data,
            widget: { ...documentFile, url: "https://example.com/private" },
          },
        }).success
      ).toBe(false)
      expect(
        getParticleDocument(duplicateParticle(particle, () => ID(2), NOW))
          ?.fileId
      ).toBe(ID(52))
    }
  )
  it("supports extension fallback for browsers with missing MIME types", () => {
    expect(particleFileFormat("README.MARKDOWN")).toBe("md")
    expect(
      particleFileError({ name: "budget.CSV", type: "", size: 25 })
    ).toBeNull()
    expect(
      particleFileError({ name: "script.html", type: "text/html", size: 25 })
    ).toContain("Choose")
    expect(
      particleFileError({ name: "empty.pdf", type: "application/pdf", size: 0 })
    ).toContain("empty")
    expect(
      particleFileError({
        name: "large.pdf",
        type: "application/pdf",
        size: 16 * 1024 * 1024,
      })
    ).toContain("15 MB")
  })
  it("uses the existing authorized organization document upload endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ file: { id: ID(52) } })))
    vi.stubGlobal("fetch", fetcher)
    const result = await uploadParticleFile(
      WORKSPACE,
      new File(["hello"], "Notes.md", { type: "text/markdown" })
    )
    expect(result).toEqual({
      kind: "document",
      fileId: ID(52),
      format: "md",
      name: "Notes.md",
      size: 5,
    })
    expect(fetcher).toHaveBeenCalledWith(
      `/api/account/organization-document-files?organizationId=${WORKSPACE}`,
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    )
  })
  it("preserves access-denial errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Upgrade required" }), {
          status: 403,
        })
      )
    )
    await expect(
      uploadParticleFile(WORKSPACE, new File(["hello"], "Notes.txt"))
    ).rejects.toThrow("Upgrade required")
  })
  it("bounds text while retaining an explicit truncation indicator", () => {
    expect(boundedDocumentText("hello")).toEqual({
      kind: "text",
      text: "hello",
      truncated: false,
    })
    const content = boundedDocumentText("a".repeat(MAX_PREVIEW_CHARACTERS + 1))
    expect(documentContentSchema.safeParse(content).success).toBe(true)
    expect(content.truncated).toBe(true)
  })
})

describe("document worker parsing", () => {
  async function parse(text: string | Uint8Array, format: string) {
    const postMessage = vi.fn()
    const scope: {
      onmessage?: (event: {
        data: { format: string; buffer: ArrayBuffer }
      }) => Promise<void>
      postMessage: typeof postMessage
    } = { postMessage }
    vi.stubGlobal("self", scope)
    vi.resetModules()
    await import("@/features/workspace-particles/lib/particle-document.worker")
    await scope.onmessage?.({
      data: {
        format,
        buffer: (typeof text === "string"
          ? new TextEncoder().encode(text)
          : Uint8Array.from(text)
        ).buffer,
      },
    })
    return postMessage.mock.calls[0]?.[0]
  }
  it("parses quoted commas, newlines and escaped quotes as text, never formulas", async () => {
    const result = await parse(
      'Name,Note\r\n"A, B","Line 1\nLine 2"\r\nC,"A ""quote"""\r\nD,=1+1',
      "csv"
    )
    expect(result.content.rows).toEqual([
      ["Name", "Note"],
      ["A, B", "Line 1\nLine 2"],
      ["C", 'A "quote"'],
      ["D", "=1+1"],
    ])
  })
  it("bounds large CSV tables", async () => {
    const result = await parse(
      Array.from({ length: 1100 }, (_, index) => `row,${index}`).join("\n"),
      "csv"
    )
    expect(result.content.rows).toHaveLength(1000)
    expect(result.content.truncated).toBe(true)
  })
  it("extracts readable content from a valid Word document", async () => {
    const bytes = Uint8Array.from(
      Buffer.from(
        "UEsDBBQAAAAIACyCTV2sbhJangAAANwAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2PsQ7CMBBDf6XKitqrGBhQ24UdGPiBU3JtI5pLlBwF/p4EpA6Mlu1nubu9A6Xq5RZOvZpFwhEg6ZkcpsYH4uyMPjqULOMEAfUdJ4J92x5AexZiqaUw1NBdVorRGqquGOWMjnoFTx8NGK8fLiebTFPV6Vcry73CEBarUaxnWNn8bdZ+HK2mrV9oIXpNKVme3NJsjkPLu4KHoYPvqeEDUEsDBBQAAAAIACyCTV1hey9DiQAAAPIAAAALAAAAX3JlbHMvLnJlbHONzzsOAiEQBuCrEA6ws1pYGKCy2dZ4AQLDIy6PDBj19lJYrMbCcuaffH9GnHHVPZbcQqyNPdKam+Sh93oEaCZg0m0qFfNIXKGk+xjJQ9Xmqj3Cfp4PQFuDK7E12WIlp8XuOLs8K/5jF+eiwVMxt4S5/6j4uhiyJo9d8nshC/a9ngbLQQn4eFG9AFBLAwQUAAAACAAsgk1dug06LHoAAACiAAAAEQAAAHdvcmQvZG9jdW1lbnQueG1sRc4xDsMgDAXQq0Q5QB116IAoS09CgSZIsY2MI5LbN6RDl/dlW1+ybSZy2DCRDjuuVE17jotqMQA1LAl9vXFJdN4+LOj1HGWGxhKLcEi1Zppxhfs0PQB9ptHZZt4cj56lIx11L0bcKOsxxEyUxELfduWyXP6a8P/KfQFQSwECFAMUAAAACAAsgk1drG4SWp4AAADcAAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIACyCTV1hey9DiQAAAPIAAAALAAAAAAAAAAAAAACAAc8AAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIACyCTV26DTosegAAAKIAAAARAAAAAAAAAAAAAACAAYEBAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAwADALkAAAAqAgAAAAA=",
        "base64"
      )
    )
    const result = await parse(bytes, "docx")
    expect(result.content.text.trim()).toBe("Community dinner")
  })
  it("does not treat malformed DOCX as readable content", async () => {
    expect((await parse("not a zip", "docx")).error).toBeTruthy()
  })
  it("rejects binary disguised as text", async () => {
    expect((await parse("some\u0000binary", "txt")).error).toBeTruthy()
  })
})


describe("document placement entry point", () => {
  const document = { name: "Shared report", mimeType: "application/pdf", source: {
    kind: "drive" as const, id: ID(88), webViewLink: "https://drive.google.com/file/d/provider-file-id/view",
  } }
  const controller: ParticleLibraryDragController = {
    workspaceId: WORKSPACE, enabled: true, place: vi.fn(async () => true),
    begin: vi.fn(() => true), move: vi.fn(), drop: vi.fn(), cancel: vi.fn(),
  }
  const render = (value: ParticleLibraryDragController | null, disabled = false) => renderToStaticMarkup(
    createElement(ParticleLibraryDragContext.Provider, { value },
      // eslint-disable-next-line react/no-children-prop -- Required children are part of this component's createElement prop contract.
      createElement(ParticleDocumentLibrarySource, { document, disabled, children: createElement("span", null, document.name) }))
  )
  it("offers an accessible Add control to mouse, touch and keyboard in an editable workspace", () => {
    const html = render(controller)
    expect(html).toContain('aria-label="Add Shared report to canvas"')
    expect(html).toContain('title="Add to canvas"')
    expect(html).not.toContain("sr-only")
    expect(html).toContain("focus-visible:opacity-100")
    expect(html).toContain("group-hover/document-source:opacity-100")
    expect(html).toContain("[@media(hover:none)]:opacity-100")
    expect(html).toContain('data-draggable="true"')
  })
  it("does not expose a dead Add control outside the canvas or without placement permission", () => {
    for (const value of [null, { ...controller, enabled: false }, { ...controller, place: undefined }])
      expect(render(value)).not.toContain('aria-label="Add Shared report to canvas"')
    expect(render(controller, true)).toMatch(/<button[^>]*disabled=""/)
  })
  it("places the canonical attachment ID and opens the existing Google link without copying bytes", () => {
    const [item] = buildLibraryItems([], [{ ...document.source, name: document.name, mimeType: document.mimeType,
      modifiedAt: NOW, status: "available", }], [])
    const reference = documentParticleReference(item)
    if (!reference) throw new Error("Missing Drive attachment")
    const placed = createLibraryDocumentParticle(WORKSPACE, reference, ID(90), NOW)
    expect(particleSchema.safeParse(placed).success).toBe(true)
    const file = getParticleDocument(placed)!
    expect(file.source).toEqual(document.source)
    expect(file.format).toBe("link")
    expect(particleDocumentEndpoint(WORKSPACE, file)).toBeNull()
    expect(particleDocumentOriginal(file)).toBe(document.source.webViewLink)
  })
})


describe("on-demand Google Drive preview", () => {
  const providerId = "google-provider-file-123"
  const original = `https://docs.google.com/document/d/${providerId}/edit`
  function linked(url = original) {
    return createLibraryDocumentParticle(WORKSPACE, {
      name: "Shared vision", mimeType: "application/vnd.google-apps.document",
      source: { kind: "drive", id: ID(88), webViewLink: url },
    }, ID(99), NOW)
  }
  function file(url = original) {
    const value = getParticleDocument(linked(url))
    if (!value) throw new Error("Expected file fixture")
    return value
  }
  it.each(["file", "document", "spreadsheets", "presentation", "drawings"])(
    "uses the Google file identity for %s, not the local attachment UUID", kind => {
      expect(particleDrivePreviewUrl(file(`https://docs.google.com/${kind}/d/${providerId}/edit`)))
        .toBe(`https://drive.google.com/file/d/${providerId}/preview`)
    }
  )
  it("retains resource keys but drops account, auth and arbitrary query parameters", () => {
    expect(particleDrivePreviewUrl(file(`https://drive.google.com/open?id=${providerId}&resourcekey=key_123&authuser=2&access_token=secret#heading`)))
      .toBe(`https://drive.google.com/file/d/${providerId}/preview?resourcekey=key_123`)
  })
  it.each([
    "https://drive.google.com/drive/folders/google-provider-file-123",
    "https://docs.google.com/document/d/e/published-document/pub",
    "https://docs.google.com.evil.test/document/d/google-provider-file-123/edit",
    "https://user:secret@docs.google.com/document/d/google-provider-file-123/edit",
    "https://docs.google.com:444/document/d/google-provider-file-123/edit",
    "http://docs.google.com/document/d/google-provider-file-123/edit",
    "https://drive.google.com/open?id=../secret",
    "javascript:alert(1)",
  ])("leaves unsupported or unsafe links as provider-open only: %s", url => {
    expect(particleDrivePreviewUrl(file(url))).toBeNull()
  })
  it("requires Core Document provider identity to match its saved Google link", () => {
    expect(particleDrivePreviewUrl({ ...file(), source: {
      kind: "roadmap_drive", sectionId: "vision", fileId: providerId, webViewLink: original,
    } })).toBe(`https://drive.google.com/file/d/${providerId}/preview`)
    expect(particleDrivePreviewUrl({ ...file(), source: {
      kind: "roadmap_drive", sectionId: "vision", fileId: "other-provider-file", webViewLink: original,
    } })).toBeNull()
    expect(particleDrivePreviewUrl(documentFile)).toBeNull()
  })
  it("keeps visible canvas cards free of Google frames or file-content requests", () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    vi.spyOn(fileUrlHook, "useParticleFileUrl").mockReturnValue({
      ref: { current: null }, active: true, url: original, text: null, error: null, retry: vi.fn(),
    })
    const html = renderToStaticMarkup(createElement(ParticleDocumentCard, {
      data: { particle: linked(), editable: false, onOpen: vi.fn(), onEdit: vi.fn() }, selected: false, controls: false,
    }))
    expect(html).toContain("Preview file")
    expect(html).toContain("Open original")
    expect(html).not.toContain("<iframe")
    expect(html.match(/Shared vision/g)).toHaveLength(2) // Caption plus its tooltip.
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("labels and isolates the expanded Google frame without an app-side proxy", () => {
    const url = particleDrivePreviewUrl(file())
    if (!url) throw new Error("Expected preview URL")
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const html = renderToStaticMarkup(createElement(ParticleDrivePreview, { url, name: "Shared vision" }))
    expect(html.match(/<iframe/g)).toHaveLength(1)
    expect(html).toContain(`src="${url}"`)
    expect(html).toContain('title="Google Drive preview: Shared vision"')
    expect(html).toContain('referrerPolicy="no-referrer"')
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"')
    expect(html).not.toContain("allow-top-navigation")
    expect(html).toContain("Loading Google Drive preview")
    expect(fetcher).not.toHaveBeenCalled()
  })
})
