import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveRoadmapSections } from "@/lib/roadmap"

const mocks = vi.hoisted(() => ({ capabilities: vi.fn() }))
vi.mock("@/features/organization-document-collaboration/client", () => ({ useDocumentCapabilities: mocks.capabilities }))
vi.mock("@/components/paywall/feature-upgrade-notice", () => ({
  FeatureUpgradeNotice: () => React.createElement("aside", { "data-upgrade": true }),
}))
vi.mock("@/components/roadmap/roadmap-editor", () => ({
  RoadmapEditor: (props: { canEdit: boolean; initialSectionId: string; sourceScope: { organizationId: string } }) => React.createElement("div", {
    "data-editable": String(props.canEdit), "data-section": props.initialSectionId, "data-org": props.sourceScope.organizationId,
  }),
}))
import { WorkspaceCanvasOverlayRoadmapPanel } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-roadmap-panel"

const sections = resolveRoadmapSections({})
const origin = sections.find(section => section.slug === "origin-story")!
function render(canEdit = true) {
  return renderToStaticMarkup(React.createElement(WorkspaceCanvasOverlayRoadmapPanel, {
    sourceScope: { userId: "coach", organizationId: "supported-org" },
    sections, publicSlug: null, canEdit,
    request: { id: 1, tab: "roadmap", roadmapSectionSlug: "origin-story" },
  }))
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.capabilities.mockReturnValue({ capabilities: { canView: true, canEdit: false, reason: "upgrade" }, loading: false })
})
describe("Origin document in the accelerator roadmap drawer", () => {
  it("uses verified document access for supported free organizations", () => {
    mocks.capabilities.mockReturnValue({ capabilities: { canEdit: true, reason: "editable" } })
    const html = render()
    expect(html).toContain('data-editable="true"')
    expect(html).toContain(`data-section="${origin.id}"`)
    expect(mocks.capabilities).toHaveBeenCalledWith("supported-org")
    expect(html).not.toContain("data-upgrade")
  })
  it("retains ordinary free-plan restrictions", () => {
    expect(render()).toContain('data-editable="false"')
    expect(render()).toContain("data-upgrade")
  })
  it("does not display an upgrade while checking permissions", () => {
    mocks.capabilities.mockReturnValue({ loading: true })
    expect(render()).toContain('data-editable="false"')
    expect(render()).not.toContain("data-upgrade")
  })
  it("respects explicit read-only access even with document entitlement", () => {
    mocks.capabilities.mockReturnValue({ capabilities: { canEdit: true, reason: "editable" } })
    expect(render(false)).toContain('data-editable="false"')
  })
  it("provides retry at the document when permission lookup fails", () => {
    mocks.capabilities.mockReturnValue({ error: "Access unavailable", retry: vi.fn() })
    expect(render()).toContain("Retry access check")
    expect(render()).not.toContain("data-upgrade")
  })
})
