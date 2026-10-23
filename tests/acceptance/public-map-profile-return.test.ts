import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

import { usePublicMapNavigation } from "@/components/public/public-map-index/use-public-map-profile-navigation"

function mountNavigation(embedded: boolean) {
  const setSidebarMode = vi.fn()
  const options: Parameters<typeof usePublicMapNavigation>[0] = {
    embedded,
    beforeProfileNavigation: vi.fn(),
    organizationById: new Map(),
    handleSelectOrganization: vi.fn(),
    mapRef: { current: null },
    selectableMapItemById: new Map(),
    setSameLocationSelection: vi.fn(),
    onSameLocationSelectionChange: vi.fn(),
    setSelectedListItemId: vi.fn(),
    setSelectedOrgId: vi.fn(),
    setSidebarMode,
  }
  let navigation!: ReturnType<typeof usePublicMapNavigation>
  function Harness() {
    navigation = usePublicMapNavigation(options)
    return null
  }
  renderToStaticMarkup(React.createElement(Harness))
  return { navigation, setSidebarMode }
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe("returning from a public profile", () => {
  it("loads the resources route for a direct profile entry and retains search filters", () => {
    const back = vi.fn()
    vi.stubGlobal("window", { history: { state: null, back }, location: { pathname: "/find/resources/010044660", search: "?q=food&group=food" } })
    const { navigation, setSidebarMode } = mountNavigation(true)
    navigation.handleBackToSearch()
    expect(replace).toHaveBeenCalledWith("/resources?q=food&group=food")
    expect(back).not.toHaveBeenCalled()
    // Avoid flashing the search list inside the old profile shell while routing.
    expect(setSidebarMode).not.toHaveBeenCalled()
  })

  it("preserves the existing history entry for profiles opened from the resource list", () => {
    const back = vi.fn()
    vi.stubGlobal("window", { history: { state: { homeProfileNavigation: true }, back }, location: { pathname: "/find/resources/010044660" } })
    const { navigation, setSidebarMode } = mountNavigation(true)
    navigation.handleBackToSearch()
    expect(back).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
    expect(setSidebarMode).toHaveBeenCalledWith("search")
  })

  it.each([null, { homeProfileNavigation: false }])("dismisses local directory details without navigating: %j", (state) => {
    const back = vi.fn()
    vi.stubGlobal("window", {
      history: { state, back },
      location: { pathname: "/resources", search: "?q=housing" },
    })
    const { navigation, setSidebarMode } = mountNavigation(true)
    navigation.handleBackToSearch()
    expect(setSidebarMode).toHaveBeenCalledWith("search")
    expect(replace).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
  })

  it("keeps administrative map detail dismissal local without browser navigation", () => {
    const { navigation, setSidebarMode } = mountNavigation(false)
    navigation.handleBackToSearch()
    expect(replace).not.toHaveBeenCalled()
    expect(setSidebarMode).toHaveBeenCalledWith("search")
  })
})
