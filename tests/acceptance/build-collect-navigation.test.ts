import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BUILD_NAVIGATION_ITEMS,
  COLLECT_NAVIGATION_ITEMS,
} from "@/features/build-collect-navigation"

const ROOT = process.cwd()

function readSource(path: string) {
  return readFileSync(join(ROOT, path), "utf8")
}

describe("build-collect-navigation feature contract", () => {
  it("keeps Collect at the canonical map route and exposes real builder destinations", () => {
    expect(COLLECT_NAVIGATION_ITEMS[0]?.href).toBe("/resources")
    expect(BUILD_NAVIGATION_ITEMS.map((item) => item.href)).toEqual([
      "/build#workspace",
      "/build#accelerator",
      "/build#documentation",
      "/build#pricing",
    ])
  })

  it("uses an accessible shadcn navigation menu and a working map search form", () => {
    const source = readSource(
      "src/features/build-collect-navigation/components/build-collect-public-header.tsx"
    )

    expect(source).toContain("<NavigationMenu")
    expect(source).toContain("<NavigationMenuTrigger")
    expect(source).toContain('<form action={FIND_PATH} method="get"')
    expect(source).toContain('name="q"')
    expect(source).toContain(
      '{ href: "/sign-up?intent=build", label: "Sign up" }'
    )
    expect(source).toContain("<BuildCollectNavigation activeArea={activeArea} />")
    expect(source).toContain("<NavigationCards items={BUILD_NAVIGATION_ITEMS} onNavigate=")
  })

  it("keeps the build route composition-only and delegates its UI to the feature", () => {
    const route = readSource("src/app/(public)/build/page.tsx")

    expect(route).toContain(
      'import { BuildPublicLanding } from "@/features/build-collect-navigation"'
    )
    expect(route).toContain("return <BuildPublicLanding />")
    expect(route).not.toContain("<main")
  })

  it("places the shared public header in the Find shell", () => {
    const shell = readSource(
      "src/components/public/home-canvas-preview-shell.tsx"
    )

    expect(shell).toContain("BuildCollectPublicHeader")
    expect(shell).toContain(
      'activeArea={activeSection === "find" ? "collect" : "build"}'
    )
  })
})

// Homepage collection recovery contains public identifiers only, never auth credentials.
describe("homepage resource collection recovery", () => {
  it("preserves the requested item and query through the confirmation return", async () => {
    const { homeCollectionReturnHref, parsePendingHomeCollection } = await import("@/features/build-collect-navigation/lib/home-resource-preview")
    const pending = { id: "nonprofit:123456789", kind: "resource" as const, query: "Food & housing", createdAt: Date.now() }
    const href = new URL(homeCollectionReturnHref(pending, pending.query), "https://coachhouse.app")
    expect(href.pathname).toBe("/")
    expect(href.hash).toBe("#home-resource-preview")
    expect(href.searchParams.get("homeSearch")).toBe(pending.query)
    expect(parsePendingHomeCollection(href.searchParams.get("homeCollect"))).toEqual(pending)
  })

  it("rejects malformed, expired, future and oversized pending actions", async () => {
    const { parsePendingHomeCollection, HOME_COLLECTION_TTL } = await import("@/features/build-collect-navigation/lib/home-resource-preview")
    const now = Date.now()
    const valid = { id: "nonprofit:123456789", kind: "resource", query: "", createdAt: now }
    for (const value of [null, "invalid", { ...valid, kind: "admin" }, { ...valid, id: "../private" }, { ...valid, query: "x".repeat(161) }, { ...valid, createdAt: now + 1 }, { ...valid, createdAt: now - HOME_COLLECTION_TTL - 1 }]) {
      expect(parsePendingHomeCollection(JSON.stringify(value), now)).toBeNull()
    }
  })

  it("retries saves idempotently and never silently evicts an existing collection", async () => {
    const { collectionIdsAfterChange } = await import("@/features/build-collect-navigation/lib/home-resource-preview")
    expect(collectionIdsAfterChange(["a", "b"], "a", true)).toEqual(["a", "b"])
    expect(collectionIdsAfterChange(["a", "b"], "a", false)).toEqual(["b"])
    expect(collectionIdsAfterChange(["a"], "b", true)).toEqual(["b", "a"])
    expect(() => collectionIdsAfterChange(Array.from({ length: 120 }, (_, i) => String(i)), "new", true)).toThrow("full")
  })
})

describe("homepage organization check badge", () => {
  it("keeps subscription lookups behind the server-only homepage entry", () => {
    expect(readSource("src/features/build-collect-navigation/client.ts")).not.toContain("PublicHomeLanding }")
    expect(readSource("src/app/(public)/page.tsx")).toContain('from "@/features/build-collect-navigation"')
    expect(readSource("src/components/public/home-canvas-preview-shell.tsx")).toContain('from "@/features/build-collect-navigation/client"')
    expect(readSource("src/features/build-collect-navigation/server/home-organization-badges.ts")).toContain('import "server-only"')
  })

  it("requires approved formation and all three nonempty narratives", async () => {
    const { hasCompleteNonprofitBadgeProfile } = await import("@/features/build-collect-navigation/lib/home-organization-badge")
    const profile = { vision: "<p>Our future</p>", mission: "Our purpose", values: "Our values", formationStatus: "approved" }
    expect(hasCompleteNonprofitBadgeProfile(profile)).toBe(true)
    for (const field of ["vision", "mission", "values"]) {
      for (const blank of [null, "", "  ", "<p><br></p>", "<p>&nbsp;</p>", "\u200B"]) {
        expect(hasCompleteNonprofitBadgeProfile({ ...profile, [field]: blank })).toBe(false)
      }
    }
    for (const formationStatus of [null, "pre_501c3", "in_progress"]) {
      expect(hasCompleteNonprofitBadgeProfile({ ...profile, formationStatus })).toBe(false)
    }
  })

  it("excludes trials, delinquent, free, expired, test and stub subscriptions", async () => {
    const { hasActivePaidBadgeSubscription } = await import("@/features/build-collect-navigation/lib/home-organization-badge")
    const now = Date.parse("2026-10-09T12:00:00Z")
    const subscription = { status: "active", metadata: { plan_tier: "organization", stripe_mode: "live" }, stripe_subscription_id: "sub_real", current_period_end: "2026-11-09T12:00:00Z" }
    expect(hasActivePaidBadgeSubscription(subscription, now)).toBe(true)
    for (const status of ["trialing", "past_due", "incomplete", "unpaid", "canceled", null]) {
      expect(hasActivePaidBadgeSubscription({ ...subscription, status }, now)).toBe(false)
    }
    for (const metadata of [null, { planName: "Free", stripe_mode: "live" }, { plan_tier: "organization", stripe_mode: "test" }, { plan_tier: "organization" }]) {
      expect(hasActivePaidBadgeSubscription({ ...subscription, metadata }, now)).toBe(false)
    }
    expect(hasActivePaidBadgeSubscription({ ...subscription, stripe_subscription_id: "stub_paid" }, now)).toBe(false)
    expect(hasActivePaidBadgeSubscription({ ...subscription, current_period_end: null }, now)).toBe(false)
    expect(hasActivePaidBadgeSubscription({ ...subscription, current_period_end: "2026-10-09T12:00:00Z" }, now)).toBe(false)
  })
})
