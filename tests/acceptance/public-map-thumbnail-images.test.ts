import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { OrganizationDetailBrandKitSection } from "@/components/public/public-map-index/organization-detail-sections"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

const origin = "https://project.supabase.co"
const object = `${origin}/storage/v1/object/public/org-media/atlas/logo.png`
const download = "/api/public/organizations/atlas/brand-kit"

function renderPreview(src: string, mark: string | null = null) {
  const organization = { name: "Atlas", logoUrl: src, brandMarkUrl: mark } as PublicMapOrganization
  const markup = renderToStaticMarkup(React.createElement(OrganizationDetailBrandKitSection, {
    organization,
    brandKitDownloadHref: download,
  }))
  const sources = [...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"))
  return { markup, sources, organization }
}

describe("public brand-kit thumbnail delivery", () => {
  it("bounds both raster previews while preserving original data and download navigation", () => {
    const mark = object.replace("logo.png", "mark.jpeg")
    const { markup, sources, organization } = renderPreview(object, mark)
    expect(sources).toHaveLength(2)
    for (const [index, src] of sources.entries()) {
      const parsed = new URL(src)
      expect(parsed.pathname).toBe(`/storage/v1/render/image/public/org-media/atlas/${index ? "mark.jpeg" : "logo.png"}`)
      expect(Object.fromEntries(parsed.searchParams)).toEqual({ width: "640", height: "128", resize: "contain", quality: "75" })
    }
    expect(organization.logoUrl).toBe(object)
    expect(organization.brandMarkUrl).toBe(mark)
    expect(markup).toContain(`href="${download}"`)
    expect(markup.match(/loading="lazy"/g)).toHaveLength(2)
    expect(markup).toContain('alt="Atlas primary logo"')
    expect(markup).toContain("object-contain")
  })

  it.each([
    "https://example.org/logo.png",
    `${origin}/storage/v1/object/sign/org-media/logo.png?token=fixture`,
    `${origin}/storage/v1/object/public/org-media/logo.svg`,
    `${origin}/storage/v1/object/public/org-media/logo.svg+xml?revision=2`,
    `${origin}/storage/v1/object/public/org-media/logo.svg%2Bxml`,
  ])("preserves an external, signed or vector source: %s", src => {
    expect(renderPreview(src).sources).toEqual([src])
  })

  it("retains a raster revision query while requesting the thumbnail", () => {
    const parsed = new URL(renderPreview(`${object}?revision=2`).sources[0])
    expect(parsed.searchParams.get("revision")).toBe("2")
    expect(parsed.searchParams.get("width")).toBe("640")
  })
})
