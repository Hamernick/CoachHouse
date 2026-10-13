import { describe, expect, it } from "vitest"

import { FEATURE_GROUPS, PLATFORM_TIERS } from "@/components/public/pricing-surface-data"

describe("public pricing surface data", () => {
  it("routes each tier signup CTA with its selected builder plan", () => {
    expect(
      PLATFORM_TIERS.map((tier) => [tier.id, tier.ctaLabel, tier.ctaHref])
    ).toEqual([
      [
        "formation",
        "Create free profile",
        "/sign-up?intent=build&plan=free",
      ],
      [
        "organization",
        "Choose Organization",
        "/sign-up?intent=build&plan=organization",
      ],
      [
        "operations",
        "Choose Operations Support",
        "/sign-up?intent=build&plan=operations_support",
      ],
    ])
  })
})


it("includes personal workspace tools and Drive while reserving paid organization capabilities", () => {
  expect(PLATFORM_TIERS[0].features).toEqual([
    "1 Admin Seat (founder only)", "Organization Profile", "Connect your tools",
    "Link files from your Google Drive", "Discord + WhatsApp Community access",
  ])
  const rows = FEATURE_GROUPS.flatMap(group => group.rows)
  for (const label of ["Strategic roadmap", "Secure & centralized document storage", "Shared Workspace for staff and board", "Accelerator access"]) {
    expect(rows.find(row => row.label === label)?.tier1).toBe("not-included")
  }
  expect(rows.find(row => row.label === "Fiscal sponsorship applications")?.tier1).toBe("included")
})
