import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { PublicPageSettings } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/public-page-settings"
import { OrgProfileHeader } from "@/components/organization/org-profile-card/header"
import { OrgProfileHeaderVisibility } from "@/components/organization/org-profile-card/header-visibility"
import { IdentitySection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/identity"

describe("organization public page settings", () => {
  it("does not duplicate the header switch or identity URL in map settings", () => {
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

    expect(markup).not.toContain('id="publicSlug"')
    expect(markup).not.toContain('aria-label="Make organization visible on map"')
    expect(markup).not.toContain("Turning this off only hides")
    expect(markup).not.toContain('href="/billing"')
  })

  it("places the compact organization URL between name and tagline with validation", () => {
    const markup = renderToStaticMarkup(React.createElement(IdentitySection, {
      company: { name: "Example", publicSlug: "example", tagline: "Our purpose" },
      errors: { publicSlug: "This URL is taken" },
      onInputChange: vi.fn(), onUpdate: vi.fn(), onDirty: vi.fn(), onAutoSave: vi.fn(),
      slugStatus: null, setSlugStatus: vi.fn(),
    }))
    expect(markup.indexOf('id="name"')).toBeLessThan(markup.indexOf('id="publicSlug"'))
    expect(markup.indexOf('id="publicSlug"')).toBeLessThan(markup.indexOf('id="tagline"'))
    expect(markup.match(/id="publicSlug"/g)).toHaveLength(1)
    expect(markup).toContain("coachhouse.app/")
    expect(markup).toContain("This URL is taken")
    expect(markup).toContain('data-organization-focus-target="public-page"')
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
