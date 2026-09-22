import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  sanitizeDocumentationQuery,
  searchDocumentation,
} from "@/features/nonprofit-documentation/lib/documentation-search"
import { DOCUMENTATION_SEARCH_DOCUMENTS } from "@/features/nonprofit-documentation/lib/search-documents"
import { DOCUMENTATION_NAVIGATION } from "@/features/nonprofit-documentation/lib/navigation"
import { MARKETPLACE_RESOURCES } from "@/features/nonprofit-documentation/lib/marketplace-resources"
import type { DocumentationSearchDocument } from "@/features/nonprofit-documentation/search-types"

const search = (query: unknown) =>
  searchDocumentation(DOCUMENTATION_SEARCH_DOCUMENTS, query)

describe("nonprofit documentation search", () => {
  it("covers every published library page once, with real routes and section content", () => {
    const expected = [
      "/documentation",
      ...MARKETPLACE_RESOURCES.map(
        (resource) => `/documentation/marketplace/${resource.id}`
      ),
      ...DOCUMENTATION_NAVIGATION.flatMap((group) => group.items)
        .filter(
          (item) =>
            item.status === "live" && item.href?.startsWith("/documentation/")
        )
        .map((item) => item.href),
    ].sort()
    expect(
      DOCUMENTATION_SEARCH_DOCUMENTS.map((item) => item.href).sort()
    ).toEqual(expected)
    expect(new Set(expected).size).toBe(54)
    for (const document of DOCUMENTATION_SEARCH_DOCUMENTS) {
      expect(
        existsSync(
          resolve(
            `src/app/(public)${document.href.startsWith("/documentation/marketplace/") ? "/documentation/marketplace/[slug]" : document.href}/page.tsx`
          )
        )
      ).toBe(true)
      expect(document.sections.length).toBeGreaterThan(0)
      for (const section of document.sections)
        expect(section.text.trim().length).toBeGreaterThan(0)
    }
  })

  it("ranks exact titles first and keeps short acronyms distinct from substrings", () => {
    expect(search("CRM")[0].href).toBe("/documentation/tools/crm")
    expect(search("mission")[0].href).toBe(
      "/documentation/best-practices/mission"
    )
    expect(search("HR")[0].href).toBe("/documentation/tools/hr")
    const unrelated: DocumentationSearchDocument = {
      href: "/documentation/example",
      title: "Through your mission",
      category: "Library",
      description: "Three thoughtful steps",
      sections: [],
    }
    expect(searchDocumentation([unrelated], "HR")).toEqual([])
  })

  it("finds body content, returns section anchors, and covers tool export concepts", () => {
    expect(
      search("conflict of interest").some((item) => item.href.includes("#"))
    ).toBe(true)
    expect(
      search("color proportions").find(
        (item) => item.title === "Brand identity"
      )?.href
    ).toBe("/documentation/tools/brand-identity#color-palette")
    expect(
      search("ZIP").some(
        (item) => item.href === "/documentation/tools/brand-identity#exports"
      )
    ).toBe(true)
    expect(
      search("TechSoup").some((item) =>
        item.href.startsWith("/documentation/marketplace/techsoup")
      )
    ).toBe(true)
  })

  it("requires all query terms and gives honest empty results", () => {
    expect(search("fundraising qzxnotaword")).toEqual([])
    expect(search(" ")).toEqual([])
    expect(search("---!!!")).toEqual([])
    expect(search(null)).toEqual([])
  })

  it("normalizes punctuation, accents, case, repeated terms, and word prefixes", () => {
    expect(search("  Bránd IDENTITY ")).toEqual(search("brand identity"))
    expect(search("CRM CRM")).toEqual(search("crm"))
    expect(search("fundrais")[0].title).toBe("Fundraising")
    expect(search("990-N").length).toBeGreaterThan(0)
  })

  it("bounds hostile input and produces deterministic, bounded plain-text excerpts", () => {
    expect(sanitizeDocumentationQuery("a".repeat(1000))).toHaveLength(160)
    expect(sanitizeDocumentationQuery(["mission", "crm"])).toBe("")
    expect(sanitizeDocumentationQuery("  board\u0000\n  oversight  ")).toBe(
      "board oversight"
    )
    expect(search("<script>alert('qzxnotaword')</script>")).toEqual([])
    const first = search("governance")
    expect(first).toEqual(search("governance"))
    expect(first.every((item) => item.excerpt.length <= 192)).toBe(true)
    expect(new Set(first.map((item) => item.href.split("#")[0])).size).toBe(
      first.length
    )
  })

  it("keeps the corpus out of the search form and gives search URLs a noindex policy", () => {
    const form = readFileSync(
      resolve(
        "src/features/nonprofit-documentation/components/documentation-search-form.tsx"
      ),
      "utf8"
    )
    const route = readFileSync(
      resolve("src/app/(public)/documentation/search/page.tsx"),
      "utf8"
    )
    const corpus = readFileSync(
      resolve("src/features/nonprofit-documentation/lib/search-documents.ts"),
      "utf8"
    )
    expect(form).not.toMatch(/search-documents|localStorage|supabase|fetch\(/)
    expect(corpus).not.toMatch(
      /from .*hooks\/|from .*server\/|localStorage|supabase/
    )
    expect(route).toContain("index: false")
    expect(form).toContain('from "next/form"')
  })
})
