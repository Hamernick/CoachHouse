import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PublicWorkspacePage, PublicWorkspacePageLoading } from "@/features/workspace-sharing/components/public-workspace-page"
import { workspacePageMetadata } from "@/features/workspace-sharing/server/public-page-metadata"
import type { WorkspacePageSnapshot } from "@/features/workspace-sharing/types"
import { ID } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/public-page", () => ({ loadPublicWorkspacePage: mocks.read }))
const snapshot = (): WorkspacePageSnapshot => ({
  version: 1, brand: { name: "Southside Community Table", organizationSlug: "southside-community-table" },
  title: "Join the table", description: "Neighbors building together.",
  items: [
    { id: ID(1), title: "Welcome", content: { kind: "notes", markdown: "## Join us\n\nShared **notes**.\n\n<script>alert('private')</script>\n\n![Image](https://private.example/image.png)\n\n[Unsafe](javascript:alert(1))\n\n| Day | Place |\n| --- | --- |\n| Friday | Library |" } },
    { id: ID(2), title: "Read our plan", content: { kind: "drive_link", href: "https://docs.google.com/document/d/canonicalFile01/edit" } },
  ],
})
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ snapshot: snapshot(), publishedAt: "2026-10-16T18:30:00Z", revision: 2 }) })

describe("branded public page", () => {
  it("reuses the public renderer inside Share without a nested main or full-page minimum height", () => {
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: snapshot(), embedded: true }))
    expect(html).not.toContain("<main")
    expect(html).not.toContain("min-h-svh")
    expect(html).toContain('aria-label="Shared Particles"')
    expect(html).toContain("Southside Community Table")
  })
  it("puts the brand first and preserves published membership order in one column", () => {
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: snapshot() }))
    expect(html.indexOf("Southside Community Table")).toBeLessThan(html.indexOf("Join the table"))
    expect(html.indexOf('id="particle-' + ID(1))).toBeLessThan(html.indexOf('id="particle-' + ID(2)))
    expect(html).toContain('aria-label="Shared Particles"')
    expect(html).not.toContain("react-flow")
    expect(html).not.toContain("contenteditable")
    expect(html).not.toContain("iframe")
  })
  it("renders readable notes/tables without active HTML, unsafe links or private image fetches", () => {
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: snapshot() }))
    expect(html).toContain("<strong>notes</strong>")
    expect(html).toContain("<table>")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("https://private.example")
  })
  it("uses an accessible external Drive link with no provider embed", () => {
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: snapshot() }))
    expect(html).toContain('href="https://docs.google.com/document/d/canonicalFile01/edit"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('referrerPolicy="no-referrer"')
    expect(html).toContain("Open in Google Drive")
  })
  it("renders long titles and body content without canvas dimensions or truncation", () => {
    const page = snapshot()
    page.brand.name = "Long organization name ".repeat(10)
    page.items[0].title = "Long note title ".repeat(10)
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: page }))
    expect(html).toContain("break-words")
    expect(html).not.toContain("truncate")
    expect(html).not.toContain("position:absolute")
    expect(html).not.toContain("scale(")
  })
  it("labels UTC event times and omits empty location/date fields", () => {
    const page = snapshot()
    page.items = [{ id: ID(3), title: "Dinner", content: { kind: "event", startsAt: "2026-10-20T20:00:00Z", location: "Library" } }]
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: page }))
    expect(html).toContain('dateTime="2026-10-20T20:00:00Z"')
    expect(html).toContain("UTC")
    expect(html).toContain("Library")
  })
  it("shows accessible loading skeletons with reduced-motion support", () => {
    const html = renderToStaticMarkup(createElement(PublicWorkspacePageLoading))
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("motion-reduce:animate-none")
    expect(html).toContain("Loading shared page")
  })
  it("builds share metadata exclusively from the committed projection", async () => {
    const metadata = await workspacePageMetadata("southside-community-table", ID(10))
    expect(metadata.title).toEqual({ absolute: "Join the table · Southside Community Table" })
    expect(metadata.description).toBe("Neighbors building together.")
    expect(metadata.openGraph).toMatchObject({ type: "website", title: "Join the table · Southside Community Table" })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(JSON.stringify(metadata)).not.toContain("private.example")
  })
  it("gives missing/private/revoked pages the same non-indexable metadata", async () => {
    mocks.read.mockResolvedValue(null)
    expect(await workspacePageMetadata("southside-community-table", ID(10))).toMatchObject({ title: "Page not found", description: null,
      robots: { index: false, follow: false }, openGraph: null, twitter: null })
  })
})
