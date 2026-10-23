import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { usePublicMapListItemSelection } from "@/components/public/public-map-index/public-map-index-selection"
import type { PublicMapItem } from "@/lib/public-map/resource-map-items"

function setup() {
  const callbacks = { handleSelectOrganization: vi.fn(), navigateToProfile: vi.fn(() => true), setSameLocationSelection: vi.fn(), setSelectedListItemId: vi.fn(), setSelectedOrgId: vi.fn(), setSidebarMode: vi.fn() }
  let handlers!: ReturnType<typeof usePublicMapListItemSelection>
  function Probe() {
    handlers = usePublicMapListItemSelection({ ...callbacks, mapRef: { current: null }, selectableMapItemById: new Map(["a", "b"].map(id => [id, { id, itemType: "external_resource" } as PublicMapItem])) })
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return { callbacks, handlers }
}

describe("shared-location marker selection", () => {
  it("shows both choices and clears previous details without navigating or fetching the first profile", () => {
    const {callbacks,handlers} = setup()
    const group = { key: "shared", organizationIds: ["a", "b"], locationLabel: "123 Main Street" }
    handlers.handleOpenSameLocationGroup(group)
    expect(callbacks.setSameLocationSelection).toHaveBeenCalledWith(group)
    expect(callbacks.setSelectedOrgId).toHaveBeenCalledWith(null)
    expect(callbacks.setSelectedListItemId).toHaveBeenCalledWith(null)
    expect(callbacks.setSidebarMode).toHaveBeenCalledWith("search")
    expect(callbacks.navigateToProfile).not.toHaveBeenCalled()
    expect(callbacks.handleSelectOrganization).not.toHaveBeenCalled()
    handlers.handleSelectListItem("b")
    expect(callbacks.navigateToProfile).toHaveBeenCalledExactlyOnceWith("b")
  })
  it("ignores stale groups with no available choices", () => {
    const {callbacks,handlers} = setup()
    handlers.handleOpenSameLocationGroup({key:"gone",organizationIds:["missing"],locationLabel:null})
    expect(callbacks.setSidebarMode).not.toHaveBeenCalled()
    expect(callbacks.navigateToProfile).not.toHaveBeenCalled()
  })
})
