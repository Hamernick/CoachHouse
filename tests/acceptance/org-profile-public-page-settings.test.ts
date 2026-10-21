import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { PublicPageSettings } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/public-page-settings"

describe("organization public page settings", () => {
  it("renders public map controls without the removed billing notice", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicPageSettings, {
        company: {
          name: "Hadiya's Promise",
          isPublic: true,
          publicSlug: "hadiyas-promise",
          locationType: "in_person",
        },
        errors: {},
        onInputChange: vi.fn(),
        onUpdate: vi.fn(),
        onDirty: vi.fn(),
        onAutoSave: vi.fn(),
        slugStatus: null,
        setSlugStatus: vi.fn(),
      }),
    )

    expect(markup).toContain('aria-label="Make organization visible on map"')
    expect(markup).toContain("our map")
    expect(markup).not.toContain("Turning this off only hides")
    expect(markup).not.toContain('href="/billing"')
  })
})
