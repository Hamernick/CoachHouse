import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
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

// Check every route, not only the public pages sampled by social-preview tests.
describe("page metadata coverage", () => {
  const redirects = new Set([
    "(accelerator)/accelerator/class/[slug]", "(accelerator)/accelerator/roadmap/[slug]", "(accelerator)/accelerator/roadmap",
    "(admin)/admin/platform/user-journeys", "(auth)/tester/login", "(auth)/tester/sign-up",
    "(dashboard)/marketplace", "(dashboard)/my-organization/documents", "(dashboard)/my-organization",
    "(dashboard)/my-organization/roadmap", "(dashboard)/my-tasks", "(dashboard)/organization",
    "(dashboard)/organization/workspace", "(dashboard)/organization/workspace/present", "(dashboard)/roadmap/[slug]",
    "(dashboard)/roadmap", "(dashboard)/strategic-roadmap", "(dashboard)/workspace/present", "(internal)/internal/supabase",
    "(public)/documentation/toolbox/brand-identity", "(public)/find/[slug]", "(public)/find", "(public)/fiscalsponsorship",
    "(public)/home", "(public)/home-canvas", "(public)/legacy-home", "(public)/map", "[org]/program/[programId]",
  ])
  const root = path.resolve("src/app")
  const pages = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === "page.tsx")
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !path.relative(root, file).split(path.sep).some((part) => part.startsWith("@")))

  it.each(pages)("gives %s a title and description or an explicit redirect", (file) => {
    const route = path.relative(root, path.dirname(file))
    const source = readFileSync(file, "utf8")
    if (redirects.has(route)) {
      expect(source).toMatch(/\b(?:redirect|permanentRedirect|notFound)\(/)
      return
    }
    if (source.includes("export async function generateMetadata")) return
    const metadataSources = [source]
    for (let dir = path.dirname(file); dir !== root; dir = path.dirname(dir)) {
      const layout = path.join(dir, "layout.tsx")
      if (existsSync(layout)) metadataSources.push(readFileSync(layout, "utf8"))
    }
    const properties = metadataSources.flatMap((text) => {
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      return ast.statements.flatMap((statement) => ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.flatMap((declaration) =>
          declaration.name.getText(ast) === "metadata" && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)
            ? declaration.initializer.properties.map((property) => property.name?.getText(ast)) : []) : [])
    })
    expect(properties, route).toContain("title")
    expect(properties, route).toContain("description")
  })

  it.each(["", "   "])("uses useful profile copy when the saved description is blank", (description) => {
    const profile = { kind: "person", handle: "example", displayName: "Example", description, headline: "" } as PublicProfileView
    expect(resolvePage(buildPublicProfileMetadata(profile, profile.handle)).description).toBe("View @example on Coach House.")
  })
})


describe("private route indexing", () => {
  it.each([
    "(auth)/layout.tsx", "(dashboard)/layout.tsx", "(admin)/layout.tsx", "(internal)/layout.tsx",
    "(platform-lab)/internal/platform-lab/layout.tsx", "(public)/visual-regression/layout.tsx",
    "auth/confirm/page.tsx", "(public)/pricing/success/page.tsx", "(public)/unsubscribe/page.tsx",
  ])("resolves noindex for %s", (file) => {
    const source = readFileSync(path.join("src/app", file), "utf8")
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const declaration = ast.statements.filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((entry) => entry.name.getText(ast) === "metadata")
    const initializer = declaration?.initializer
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error(`Missing static metadata: ${file}`)
    const robots = initializer.properties.find((property) => property.name?.getText(ast) === "robots")
    if (!robots || !ts.isPropertyAssignment(robots)) throw new Error(`Missing robots policy: ${file}`)
    // The private policy is a literal; resolve it through Next's real metadata API.
    const policy = JSON.parse(robots.initializer.getText(ast).replace(/(index|follow):/g, '"$1":'))
    expect(resolvePage({ robots: policy }).robots?.basic).toBe("noindex, nofollow")
  })
})
