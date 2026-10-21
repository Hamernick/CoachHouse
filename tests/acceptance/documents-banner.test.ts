import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DocumentsBanner } from "@/components/organization/org-profile-card/tabs/documents-tab/components"
import { DocumentsLibraryCard } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-card"
import { buildLibraryItems } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { ParticleLibraryDragContext } from "@/features/workspace-particles/components/particle-library-drag-context"

describe("documents banner", () => {
  it("enables document dragging and keyboard placement only inside an editable workspace", () => {
    const [item] = buildLibraryItems(
      [],
      [],
      [
        {
          id: "00000000-0000-4000-8000-000000000052",
          name: "Report.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          deletedAt: null,
          createdAt: "2026-10-14",
          updatedAt: "2026-10-14",
        },
      ]
    )
    const card = React.createElement(DocumentsLibraryCard, {
      item,
      viewMode: "grid",
      selected: false,
      selecting: false,
      pending: false,
      uploading: false,
      canEdit: true,
      editMode: true,
      onOpen() {},
      onToggle() {},
      pendingUploadedFileIds: [],
      onRestoreUploadedFile: async () => {},
      onTrashUploadedFile: async () => {},
      onPermanentlyDeleteUploadedFile: async () => {},
    })
    const standalone = renderToStaticMarkup(card)
    expect(standalone).not.toContain('aria-label="Add Report.pdf to canvas"')
    for (const enabled of [true, false]) {
      const html = renderToStaticMarkup(
        React.createElement(
          ParticleLibraryDragContext.Provider,
          {
            value: {
              enabled,
              workspaceId: "00000000-0000-4000-8000-000000000999",
              begin: () => true,
              move() {},
              drop() {},
              cancel() {},
              place: async () => true,
            },
          },
          card
        )
      )
      expect(html).toContain(`data-draggable="${enabled}"`)
      expect(html).toContain('data-particle-drag-surface="true"')
      expect(html).toContain('aria-label="Open Report.pdf"')
      expect(html.includes('aria-label="Add Report.pdf to canvas"')).toBe(
        enabled
      )
    }
  })

  it("owns the persistent documents library surface", () => {
    const props: React.ComponentProps<typeof DocumentsBanner> = {
      canEdit: true,
      children: React.createElement(
        "h1",
        { id: "documents-title" },
        "Documents"
      ),
    }
    const markup = renderToStaticMarkup(
      React.createElement(DocumentsBanner, props)
    )

    expect(markup).toContain("Documents")
    expect(markup).toContain("rounded-2xl")
    expect(markup).toContain("max-w-xl")

    expect(markup).not.toContain("Library")
    expect(markup).not.toContain("Start chat")
  })

  it("keeps Notes inside the organization Documents surface", () => {
    const root = process.cwd()
    const pageSource = readFileSync(
      join(
        root,
        "src/app/(dashboard)/organization/documents/organization-documents-page-content.tsx"
      ),
      "utf8"
    )
    const tabSource = readFileSync(
      join(
        root,
        "src/components/organization/org-profile-card/tabs/documents-tab.tsx"
      ),
      "utf8"
    )
    const notesSource = readFileSync(
      join(root, "src/components/organization/documents-notes-right-rail.tsx"),
      "utf8"
    )

    expect(pageSource).toContain("notes={moduleNotes}")
    expect(pageSource).not.toContain("DocumentsNotesRightRail")
    expect(tabSource).toContain("useNoteDocuments(organizationId)")
    expect(tabSource).toContain("notes={noteDocuments.notes}")
    expect(tabSource).not.toContain("<DocumentsNotesPanel")
    expect(notesSource).not.toContain("RightRailSlot")
    expect(notesSource).toContain("rounded-[2rem]")
  })

  it("switches cards into multi-selection mode with batch actions", () => {
    const root = process.cwd()
    const gridSource = readFileSync(
      join(
        root,
        "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-grid.tsx"
      ),
      "utf8"
    )
    const toolbarSource = readFileSync(
      join(
        root,
        "src/components/organization/org-profile-card/tabs/documents-tab/components/documents-selection-toolbar.tsx"
      ),
      "utf8"
    )

    expect(gridSource).toContain("selection.selectedIds.length > 0")
    expect(gridSource).toContain("selection.toggle(item.id)")
    expect(gridSource).toContain("<DocumentsLibraryCard")
    expect(toolbarSource).toContain("Download")
    expect(toolbarSource).toContain("Delete")
    expect(toolbarSource).toContain("{count} selected")
    expect(toolbarSource).toContain('aria-live="polite"')
  })
})
