import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DocumentPersistenceStatus } from "@/features/organization-document-collaboration/lib/editor-state"

const mocks = vi.hoisted(() => ({
  status: "Saved" as DocumentPersistenceStatus,
  ready: true,
  presenceUnavailable: false,
  error: null as string | null,
  sync: vi.fn(),
  historyToolbar: false,
}))

vi.mock("@/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller", () => ({
  useOrganizationDocumentCollaborationController: () => ({
    ...mocks,
    loaded: { section: { content: "<p>Existing user answer</p>" } },
    recovery: null, accessDenied: false, blocked: false, savedSection: null,
    dirty: { current: false }, editorRef: { current: null }, budgetRows: [],
  }),
}))
vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({ toolbarTrailingActions, value, readOnly }: {
    toolbarTrailingActions?: ReactNode; value: string; readOnly?: boolean
  }) => createElement("section", { "data-editor": true },
    !readOnly ? createElement("div", { role: "toolbar" }, toolbarTrailingActions) : null,
    createElement("article", { dangerouslySetInnerHTML: { __html: value } })),
}))
vi.mock("@/components/roadmap/roadmap-budget-table-editor", () => ({
  RoadmapBudgetTableEditor: () => createElement("div", { "data-budget": true }),
}))
vi.mock("@/features/organization-document-collaboration/components/document-version-history", () => ({
  DocumentVersionHistory: ({ toolbar }: { toolbar?: boolean }) => { mocks.historyToolbar = Boolean(toolbar); return null },
}))
vi.mock("@/lib/organization/org-media", () => ({ uploadOrgMedia: vi.fn() }))

import { OrganizationDocumentCollaborationPanel } from "@/features/organization-document-collaboration/components/organization-document-collaboration-panel"
import { resolveRoadmapSections } from "@/lib/roadmap"

const section = resolveRoadmapSections({}).find(item => item.id === "vision")!
function render(overrides: Partial<Parameters<typeof OrganizationDocumentCollaborationPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(OrganizationDocumentCollaborationPanel, {
    section, userId: "user-a", organizationId: "org-a",
    editorProps: {
      toolbarPortalId: "roadmap-toolbar",
      toolbarTrailingActions: createElement("button", null, "Legacy saved indicator"),
    },
    ...overrides,
  }))
}

describe("collaborative document save status placement", () => {
  beforeEach(() => {
    mocks.status = "Saved"
    mocks.ready = true
    mocks.presenceUnavailable = false
    mocks.error = null
    mocks.sync.mockClear()
  })

  it.each<DocumentPersistenceStatus>(["Saved", "Saving…", "Not saved", "Offline · edits retained", "Waiting for image upload…"])("shows one authoritative %s status in the roadmap toolbar without an extra row", status => {
    mocks.status = status
    const markup = render()
    expect(markup.match(/role="status"/g)).toHaveLength(1)
    expect(markup.slice(0, markup.indexOf("<section"))).not.toContain('role="status"')
    expect(markup).toContain(`<span>${status}</span>`)
    expect(markup).not.toContain("Legacy saved indicator")
    expect(markup).toContain('<article><p>Existing user answer</p></article>')
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.historyToolbar).toBe(true)
  })

  it("keeps the live-cursor availability notice with the toolbar status", () => {
    mocks.presenceUnavailable = true
    const markup = render()
    expect(markup).toContain("Live cursors unavailable")
    expect(markup).toContain('aria-live="polite"')
    expect(markup.slice(0, markup.indexOf("<section"))).not.toContain('role="status"')
  })

  it.each([
    { canEdit: false },
    { hideTextEditor: true, section: { ...section, id: "budget" } },
    { editorProps: undefined },
  ])("preserves the standalone status when the editor toolbar is unavailable: %j", overrides => {
    const markup = render(overrides)
    expect(markup.slice(0, markup.indexOf("<section"))).toContain('role="status"')
    if (overrides.canEdit === false) expect(markup).toContain("View only")
    if (overrides.hideTextEditor) expect(markup).toContain('data-budget="true"')
    expect(mocks.historyToolbar).toBe(false)
  })

  it("does not label an available unsaved recovery draft as Saved", () => {
    const markup = render({ initialDraft: { content: "<p>Unacknowledged replacement</p>" } })
    expect(markup).toContain("Unsaved draft available")
    expect(markup).not.toContain("<span>Saved</span>")
    expect(markup).not.toContain("Legacy saved indicator")
    expect(markup).toContain("Restore earlier draft")
  })

  it("keeps connection status and actionable failures visible before the toolbar is available", () => {
    mocks.ready = false
    mocks.status = "Not connected"
    mocks.error = "Connection lost. Your changes remain on this device."
    const markup = render()
    expect(markup.slice(0, markup.indexOf("<section"))).toContain("Not connected")
    expect(markup).toContain('role="alert"')
    expect(markup).toContain(mocks.error)
    expect(markup).toContain("Try connecting again")
  })
})
