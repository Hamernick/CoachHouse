import { execFileSync } from "node:child_process"
import { describe, expect, it, vi } from "vitest"
import type { ResolvedMetadata } from "next/dist/lib/metadata/types/metadata-interface"

vi.mock("@/components/dev/react-grab-loader", () => ({ ReactGrabLoader: () => null }))
vi.mock("@/components/providers/app-providers", () => ({ AppProviders: () => null }))
vi.mock("@/components/providers/app-telemetry", () => ({ AppTelemetry: () => null }))
vi.mock("@/lib/locale.server", () => ({ getLocale: async () => "en-US" }))
vi.mock("@/components/public/public-header", () => ({ PublicHeader: () => null }))
vi.mock("@/lib/public-site-origin", () => ({ getPublicSiteOrigin: () => "https://coachhouse.app" }))

import { metadata as defaults } from "@/app/layout"
import { metadata as status } from "@/app/(public)/status/page"
import { buildPublicProfileMetadata } from "@/lib/public-profile-metadata"
import { publicOrganizationShareImageUrl } from "@/lib/public-share-image-url"
import type { PublicProfileView } from "@/features/public-profiles"

const defaultImage = {
  url: "https://coachhouse.app/brand-share.png",
  width: 1200,
  height: 630,
  alt: "Coach House — The platform for nonprofits",
  type: "image/png",
}

function resolvePage(metadata: typeof defaults): ResolvedMetadata {
  // Run Next's server-only resolver in the same React condition as production.
  const resolved = execFileSync(process.execPath, ["--conditions=react-server", "-e", `
    const { readFileSync } = require("node:fs")
    const { accumulateMetadata } = require("next/dist/lib/metadata/resolve-metadata")
    const items = JSON.parse(readFileSync(0, "utf8"))
    accumulateMetadata("/test", items, Promise.resolve("/test"), {
      trailingSlash: false, isStaticMetadataRouteFile: false,
    }).then(metadata => process.stdout.write(JSON.stringify(metadata)))
  `], {
    input: JSON.stringify([
      [defaults, { openGraph: [{ ...defaultImage, url: "/opengraph-image.png?generated" }] }],
      [null, null],
      [metadata, null],
    ]),
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "coach-house-preview.vercel.app",
    },
  })
  return JSON.parse(resolved) as ResolvedMetadata
}

describe("prelaunch social metadata inheritance", () => {
  it("uses the explicit canonical image even on a Vercel preview deployment", async () => {
    const resolved = await resolvePage({ title: "Public page" })
    expect(resolved.openGraph?.images).toEqual([defaultImage])
    expect(resolved.twitter?.images).toEqual([defaultImage])
    expect(JSON.stringify(resolved)).not.toContain("coach-house-preview.vercel.app")
  })

  it("uses the leaf title and description in social previews", async () => {
    const resolved = await resolvePage(status)
    expect(resolved.title?.absolute).toBe("System status · Coach House")
    expect(resolved.description).not.toContain("Bootstrapped")
    expect(resolved.openGraph?.title.absolute).toBe(resolved.title?.absolute)
    expect(resolved.openGraph?.description).toBe(status.description)
    expect(resolved.twitter?.title.absolute).toBe(resolved.title?.absolute)
    expect(resolved.twitter?.description).toBe(status.description)
    expect(resolved.openGraph?.images).toEqual([defaultImage])
    expect(resolved.twitter?.images).toEqual([defaultImage])
  })

  it("preserves profile-specific images, copy, and summary card", async () => {
    const profile = {
      kind: "person",
      handle: "example",
      displayName: "Example Nonprofit",
      description: "A profile-specific mission.",
      avatarUrl: "https://example.org/profile.png",
    } as PublicProfileView
    const resolved = await resolvePage(buildPublicProfileMetadata(profile, profile.handle))
    expect(resolved.openGraph?.title.absolute).toBe(profile.displayName)
    expect(resolved.openGraph?.images).toEqual([
      { url: profile.avatarUrl, alt: "Example Nonprofit profile image" },
    ])
    expect(resolved.twitter).toMatchObject({
      card: "summary",
      description: profile.description,
      images: [{ url: profile.avatarUrl }],
    })
  })
  it.each(["https://example.org/wide-logo.png", null])("frames organization branding consistently, including missing logos", async (avatarUrl) => {
    const profile = { kind: "organization", handle: "example", displayName: "Example Nonprofit", description: "Mission", avatarUrl } as PublicProfileView
    const resolved = resolvePage(buildPublicProfileMetadata(profile, profile.handle))
    const url = expect.stringMatching(/^https:\/\/coachhouse\.app\/example\/share-image\.png\?v=1-[a-z0-9]+$/)
    expect(resolved.openGraph?.images).toEqual([{ url, width: 1200, height: 630, type: "image/png", alt: "Example Nonprofit logo" }])
    expect(resolved.twitter).toMatchObject({ card: "summary_large_image", images: [{ url }] })
    expect(resolved.alternates?.canonical?.url).toBe("https://coachhouse.app/example")
  })

  it.each([null, "https://storage.test/unavailable.png"])("revises fallback artwork after a rename with logo %s", (avatarUrl) => {
    const profile = { kind: "organization", handle: "example", displayName: "First Organization", avatarUrl } as PublicProfileView
    const before = resolvePage(buildPublicProfileMetadata(profile, profile.handle))
    const renamed = { ...profile, displayName: "Renamed Group" }
    const after = resolvePage(buildPublicProfileMetadata(renamed, renamed.handle))
    expect(after.openGraph?.images).not.toEqual(before.openGraph?.images)
    expect(after.twitter?.images).not.toEqual(before.twitter?.images)
    expect(after.openGraph?.images).toEqual(resolvePage(buildPublicProfileMetadata(renamed, renamed.handle)).openGraph?.images)
  })

  it("changes the share image URL when the uploaded logo changes", () => {
    const before = publicOrganizationShareImageUrl("example", "https://storage.test/old.png", "Example Organization")
    const after = publicOrganizationShareImageUrl("example", "https://storage.test/new.png", "Example Organization")
    expect(before).not.toBe(after)
    expect(after).toBe(publicOrganizationShareImageUrl("example", "https://storage.test/new.png", "Example Organization"))
  })

})
