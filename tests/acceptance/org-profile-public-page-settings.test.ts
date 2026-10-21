import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { PublicPageSettings } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/public-page-settings"
import { OrgProfileHeader } from "@/components/organization/org-profile-card/header"
import { OrgProfileHeaderVisibility } from "@/components/organization/org-profile-card/header-visibility"

describe("organization public page settings", () => {
  it("retains public URL settings without duplicating the header switch", () => {
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

    expect(markup).toContain('id="publicSlug"')
    expect(markup).not.toContain('aria-label="Make organization visible on map"')
    expect(markup).not.toContain("Turning this off only hides")
    expect(markup).not.toContain('href="/billing"')
  })

  it("places the labeled public switch above the logo with initially hidden help", () => {
    const markup = renderToStaticMarkup(React.createElement(OrgProfileHeader, {
      name: "Example", tagline: "", logoUrl: "/logo.png", editMode: true,
      isSaving: false, canEdit: true, onLogoChange: vi.fn(),
      visibilityControl: React.createElement(OrgProfileHeaderVisibility, {
        isPublic: true, onCheckedChange: vi.fn(),
      }),
    }))
    expect(markup).toContain('aria-label="About public visibility"')
    expect(markup).toContain('aria-checked="true"')
    expect(markup.indexOf('aria-label="Make organization visible on map"')).toBeLessThan(markup.indexOf('alt="Logo"'))
    expect(markup).not.toContain("When enabled, your organization is discoverable")
  })
})
