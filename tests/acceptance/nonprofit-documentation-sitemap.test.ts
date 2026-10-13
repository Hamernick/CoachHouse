import { describe, expect, it } from "vitest"

import { documentationSitemapEntries } from "@/features/nonprofit-documentation/lib/sitemap"
import { MARKETPLACE_RESOURCES } from "@/features/nonprofit-documentation/lib/marketplace-directory"
import { listLiveDocumentationItems } from "@/features/nonprofit-documentation/lib/navigation"

describe("public Documentation sitemap", () => {
  it("lists live guide and resource routes without search or visual fixtures", () => {
    const urls = documentationSitemapEntries("https://coachhouse.app").map(
      ({ url }) => url
    )

    for (const item of listLiveDocumentationItems()) {
      if (item.href?.startsWith("/documentation/")) {
        expect(urls).toContain(`https://coachhouse.app${item.href}`)
      }
    }
    for (const resource of MARKETPLACE_RESOURCES) {
      expect(urls).toContain(
        `https://coachhouse.app/documentation/marketplace/${resource.id}`
      )
    }

    expect(urls).not.toContain("https://coachhouse.app/documentation/search")
    expect(urls.some((url) => url.includes("visual-regression"))).toBe(false)
    expect(urls.some((url) => url.includes("/people/"))).toBe(false)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
