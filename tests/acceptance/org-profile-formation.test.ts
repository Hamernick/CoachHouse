import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { IdentitySection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/identity"
import { IdentityPreview } from "@/components/organization/org-profile-card/tabs/company-tab/display-sections"
import { organizationProfileSchema } from "@/components/organization/org-profile-card/validation"
import type { FormationStatus } from "@/components/organization/org-profile-card/types"

const handlers = {
  errors: {}, onInputChange: vi.fn(), onUpdate: vi.fn(), onDirty: vi.fn(),
  onAutoSave: vi.fn(), slugStatus: null, setSlugStatus: vi.fn(),
}

describe("organization formation and EIN", () => {
  it.each([undefined, "", "   ", "123"])("requires a valid EIN for approval: %s", (ein) => {
    const result = organizationProfileSchema.safeParse({ name: "Example", formationStatus: "approved", ein })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors.ein).toBeDefined()
  })

  it.each(["12-3456789", "123456789", " 12-3456789 "])("accepts a valid approved EIN: %s", (ein) => {
    expect(organizationProfileSchema.safeParse({ name: "Example", formationStatus: "approved", ein }).success).toBe(true)
  })

  it.each(["in_progress", "pre_501c3"] as FormationStatus[])("hides EIN and does not require it for %s", (formationStatus) => {
    expect(organizationProfileSchema.safeParse({ name: "Example", formationStatus }).success).toBe(true)
    const html = renderToStaticMarkup(createElement(IdentitySection, {
      ...handlers, company: { formationStatus, ein: "12-3456789" },
    }))
    expect(html).not.toContain('id="ein"')
    const preview = renderToStaticMarkup(createElement(IdentityPreview, {
      company: { formationStatus, ein: "12-3456789" }, addressLines: [],
    }))
    expect(preview).not.toContain("12-3456789")
  })

  it("places the required EIN input after formation status with its inline error", () => {
    const html = renderToStaticMarkup(createElement(IdentitySection, {
      ...handlers, company: { formationStatus: "approved" }, errors: { ein: "Enter an EIN" },
    }))
    expect(html.indexOf('id="formationStatus"')).toBeLessThan(html.indexOf('id="ein"'))
    expect(html).toMatch(/id="ein"[^>]*required=""/)
    expect(html).toContain('id="ein-error"')
    expect(html).toContain("Enter an EIN")
  })

  it("shows EIN inside the approved summary below its title", () => {
    const html = renderToStaticMarkup(createElement(IdentityPreview, {
      company: { formationStatus: "approved", ein: "12-3456789" }, addressLines: [],
    }))
    expect(html).toContain("border-primary/60 bg-primary/5")
    expect(html.indexOf("Approved")).toBeLessThan(html.indexOf("EIN: 12-3456789"))
    expect(html.indexOf("EIN: 12-3456789")).toBeLessThan(html.indexOf("We have a determination letter."))
    expect(html.match(/12-3456789/g)).toHaveLength(1)
  })
})
