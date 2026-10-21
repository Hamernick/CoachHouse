import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { SocialSection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/social"
import { PresenceSection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/presence"
import { AddressSection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/address"

const handlers = {
  errors: {}, onInputChange: vi.fn(), onUpdate: vi.fn(), onDirty: vi.fn(),
  onAutoSave: vi.fn(), slugStatus: null, setSlugStatus: vi.fn(),
}

describe("grouped organization edit fields", () => {
  it("preserves social field identities, URLs and associated labels", () => {
    const names = ["twitter", "facebook", "linkedin", "instagram", "youtube", "tiktok", "github"]
    const company = Object.fromEntries(names.map(name => [name, `https://example.org/${name}`]))
    const html = renderToStaticMarkup(createElement(SocialSection, { ...handlers, company }))
    for (const name of names) {
      expect(html).toContain(`for="${name}"`)
      expect(html).toContain(`id="${name}"`)
      expect(html).toContain(`name="${name}"`)
      expect(html).toContain(`value="https://example.org/${name}"`)
    }
  })

  it("preserves website fields and associates their validation messages", () => {
    const company = { publicUrl: "https://example.org", newsletter: "https://example.org/news", donateUrl: "https://example.org/give" }
    const html = renderToStaticMarkup(createElement(PresenceSection, {
      ...handlers, company, errors: { publicUrl: "Enter a valid URL" },
    }))
    for (const [name, value] of Object.entries(company)) {
      expect(html).toContain(`for="${name}"`)
      expect(html).toContain(`name="${name}"`)
      expect(html).toContain(`value="${value}"`)
    }
    expect(html).toContain('aria-describedby="publicUrl-error"')
    expect(html).toContain('id="publicUrl-error"')
  })

  it("retains international address entry and all saved address values", () => {
    const company = { addressStreet: "1 Main St", addressCity: "Toronto", addressState: "Ontario", addressPostal: "M5V 2T6", addressCountry: "Canada" }
    const html = renderToStaticMarkup(createElement(AddressSection, { ...handlers, company }))
    for (const [name, value] of Object.entries(company)) {
      expect(html).toContain(`for="${name}"`)
      expect(html).toContain(`name="${name}"`)
      expect(html).toContain(`value="${value}"`)
    }
  })
})
