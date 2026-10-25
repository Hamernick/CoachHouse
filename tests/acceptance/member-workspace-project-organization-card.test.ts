import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  partitionMemberWorkspaceOrganizationSetupItems,
  resolveMemberWorkspaceOrganizationHref,
} from "@/features/member-workspace/components/projects/member-workspace-project-organization-card"
import type { MemberWorkspaceAdminOrganizationSummary } from "@/features/member-workspace/types"

function buildOrganizationSummary(
  overrides: Partial<MemberWorkspaceAdminOrganizationSummary> = {}
): MemberWorkspaceAdminOrganizationSummary {
  return {
    orgId: "org-1",
    canonicalProjectId: null,
    name: "Community Builders",
    ownerName: "Paula Founder",
    ownerAvatarUrl: null,
    publicSlug: "community-builders",
    organizationStatus: "approved",
    isPublic: true,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    acceleratorProgress: 62,
    setupProgress: 75,
    setupCompletedCount: 3,
    setupTotalCount: 4,
    missingSetupCount: 1,
    memberCount: 1,
    tags: ["organization"],
    members: [],
    setupItems: [],
    profile: {},
    ...overrides,
  }
}

describe("member workspace organization card", () => {
  it("falls back to the public Find profile when no external site is configured", () => {
    expect(
      resolveMemberWorkspaceOrganizationHref(buildOrganizationSummary())
    ).toBe("/community-builders")
  })

  it("normalizes bare external website domains before opening them", () => {
    expect(
      resolveMemberWorkspaceOrganizationHref(
        buildOrganizationSummary({
          profile: {
            website: "communitybuilders.org",
          },
        })
      )
    ).toBe("https://communitybuilders.org")
  })

  it("separates incomplete setup items from completed setup items", () => {
    const result = partitionMemberWorkspaceOrganizationSetupItems([
      { id: "mission", label: "Add mission statement", complete: false },
      { id: "name", label: "Add organization name", complete: true },
      { id: "website", label: "Add website", complete: false },
    ])

    expect(result.incompleteItems.map((item) => item.id)).toEqual([
      "mission",
      "website",
    ])
    expect(result.completedItems.map((item) => item.id)).toEqual(["name"])
  })

  it("shows the setup checklist in a bounded linked hover card", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-organization-card.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("HoverCardTrigger asChild")
    expect(source).toContain("HoverCardContent")
    expect(source).toContain('title="Needs attention"')
    expect(source).toContain('title="Complete"')
    expect(source).toContain("max-h-72")
    expect(source).toContain("overscroll-contain")

  })

  it("shows hover previews on individual users while retaining inline disclosure", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-organization-card.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("<HoverCardTrigger asChild>")
    expect(source).toContain("<CollapsibleTrigger asChild>")
    expect(source).toContain("<UserCompletenessMemberRows")
    expect(source).toContain("Preview completeness for ${member.name}")
    expect(source).toContain("Needs attention")
    expect(source).toContain("Profile complete")

  })
})
