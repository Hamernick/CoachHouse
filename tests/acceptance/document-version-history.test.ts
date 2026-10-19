import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ portal: vi.fn(), versions: vi.fn() }))
vi.mock("react-dom", async importActual => ({
  ...await importActual<typeof import("react-dom")>(),
  createPortal: (children: ReactNode, container: Element) => { mocks.portal(children, container); return children },
}))
vi.mock("@/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller", () => ({
  defaultDocumentTransport: { versions: mocks.versions },
}))
vi.mock("@/components/rich-text-editor", () => ({ RichTextEditor: () => null }))
vi.mock("@/components/roadmap/roadmap-budget-table-editor", () => ({ RoadmapBudgetTableEditor: () => null }))

import { DocumentVersionHistory } from "@/features/organization-document-collaboration/components/document-version-history"

const props = { scope: { organizationId: "org-a", sectionId: "vision" }, disabled: false, restore: vi.fn() }

describe("version history toolbar trigger", () => {
  beforeEach(() => vi.clearAllMocks())

  it("portals an accessible ghost icon button into the supplied toolbar slot", () => {
    const container = {} as HTMLElement
    const markup = renderToStaticMarkup(createElement(DocumentVersionHistory, { ...props, toolbar: true, triggerContainer: container }))
    expect(mocks.portal).toHaveBeenCalledExactlyOnceWith(expect.anything(), container)
    expect(markup).toContain('aria-label="Version history"')
    expect(markup).toContain('title="Version history"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain("lucide-history")
    expect(markup).toContain("hover:bg-accent")
    expect(markup).toContain("h-7 w-7 p-0")
    expect(markup).not.toContain(">Version history<")
    expect(mocks.versions).not.toHaveBeenCalled()
  })

  it("does not leave a footer button or empty wrapper while the toolbar slot mounts", () => {
    expect(renderToStaticMarkup(createElement(DocumentVersionHistory, { ...props, toolbar: true, triggerContainer: null }))).toBe("")
    expect(mocks.portal).not.toHaveBeenCalled()
  })

  it("preserves the default text trigger outside toolbar editors", () => {
    const markup = renderToStaticMarkup(createElement(DocumentVersionHistory, props))
    expect(markup).toContain(">Version history</button>")
    expect(markup).not.toContain("lucide-history")
    expect(mocks.portal).not.toHaveBeenCalled()
  })

  it("still allows viewing history while restoring is disabled", () => {
    const markup = renderToStaticMarkup(createElement(DocumentVersionHistory, { ...props, disabled: true, toolbar: true, triggerContainer: {} as HTMLElement }))
    expect(markup).toContain('aria-label="Version history"')
    expect(markup).not.toContain("disabled=")
  })
})
