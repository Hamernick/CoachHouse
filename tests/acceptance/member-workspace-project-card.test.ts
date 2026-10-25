import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { resolveOrganizationCardImage } from "@/features/member-workspace/lib/organization-card-image"
import { MemberWorkspaceProjectCard } from "@/features/member-workspace/components/projects/member-workspace-project-card"

const projectCardSource =
  "src/features/member-workspace/components/projects/member-workspace-project-card.tsx"

vi.mock("next/navigation", () => ({
  usePathname: () => "/organizations",
  useRouter: () => ({
    push: () => undefined,
  }),
}))

const organizationProject: PlatformAdminDashboardLabProject = {
  id: "project-1",
  organizationId: "org-1",
  projectKind: "organization_admin",
  name: "Community Builders",
  description: "Support the org through accelerator setup.",
  taskCount: 10,
  progress: 62,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2026-04-30T12:00:00.000Z"),
  status: "active",
  fiscalSponsorshipStatus: "eligible",
  priority: "medium",
  tags: ["organization", "onboarding"],
  members: ["Paula Founder", "Chris Ops"],
  primaryPersonName: "Paula Founder",
  primaryPersonAvatarUrl: null,
  client: "Private",
  typeLabel: "Approved nonprofit",
  durationLabel: "3 members",
  taskSummaryLabel: "Setup items",
  tasks: [
    {
      id: "task-1",
      name: "Add organization name",
      type: "task",
      assignee: "Paula Founder",
      status: "done",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
    },
    {
      id: "task-2",
      name: "Add tagline",
      type: "task",
      assignee: "Paula Founder",
      status: "done",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
    },
    {
      id: "task-3",
      name: "Complete roadmap: Program",
      type: "task",
      assignee: "Paula Founder",
      status: "todo",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
    },
  ],
}

describe("MemberWorkspaceProjectCard", () => {
  it("preserves stored due dates across timezones", () => {
    const previous = process.env.TZ
    try {
      for (const zone of ["America/New_York", "Pacific/Honolulu", "Asia/Tokyo"]) {
        process.env.TZ = zone
        const markup = renderToStaticMarkup(React.createElement(MemberWorkspaceProjectCard, {
          project: { ...organizationProject, endDate: new Date("2026-04-30T00:00:00.000Z") },
          variant: "board",
        }))
        expect(markup).toContain("Apr 30")
        expect(markup).not.toContain("Apr 29")
      }
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })
  it("renders organization-aware metadata for platform admin cards", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectCard, {
        project: organizationProject,
      })
    )

    expect(markup).toContain("Community Builders")
    expect(markup).not.toContain("Created by")
    expect(markup).toContain("Approved nonprofit")
    expect(markup).toContain("Fiscal sponsorship")
    expect(markup).toContain("Eligible")
    expect(markup).toContain("Private")
    expect(markup).toContain("bg-destructive")
    expect(markup).toContain("62%")
    expect(markup).toContain("2 / 3 Setup items")
    expect(markup).toContain(">PF<")
  })

  it("uses the three-stage organization lifecycle", () => {
    const onboardingMarkup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectCard, {
        project: { ...organizationProject, status: "planned" },
      })
    )
    const archivedMarkup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectCard, {
        project: { ...organizationProject, status: "cancelled" },
      })
    )

    expect(onboardingMarkup).toContain("Onboarding")
    expect(onboardingMarkup).not.toContain(">Planned<")
    expect(archivedMarkup).toContain("Archived")
    expect(archivedMarkup).not.toContain(">Cancelled<")
  })

  it("keeps the progress summary and separator in the card footer", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectCard, {
        project: organizationProject,
      })
    )
    const footerIndex = markup.indexOf('class="mt-auto pt-4"')
    const dueDateIndex = markup.indexOf("Apr 30, 2026")
    const separatorIndex = markup.indexOf('class="border-border/60 border-t"')

    expect(markup).toContain("flex h-full cursor-pointer flex-col")
    expect(markup).toContain("flex flex-1 flex-col p-4")
    expect(markup).toContain('class="mt-auto pt-4"')
    expect(markup).toContain(
      'class="text-muted-foreground mb-4 flex items-center justify-between text-sm"'
    )
    expect(markup).toContain('class="border-border/60 border-t"')
    expect(dueDateIndex).toBeGreaterThan(footerIndex)
    expect(dueDateIndex).toBeLessThan(separatorIndex)
  })

})

describe("organization card image identity", () => {
  const personalPhoto = "https://example.com/person.jpg"
  const organizationLogo = "https://example.com/organization.png"
  it("does not turn an owner photo into a logo when the organization has none", () => {
    expect(resolveOrganizationCardImage({ profile: {}, ownerAvatarUrl: personalPhoto, members: [] })).toBeNull()
  })
  it("rejects a legacy logo copied from the owner or an organization person", () => {
    expect(resolveOrganizationCardImage({ profile: { logoUrl: personalPhoto }, ownerAvatarUrl: personalPhoto, members: [] })).toBeNull()
    expect(resolveOrganizationCardImage({ profile: { logoUrl: personalPhoto, org_people: [{ image: personalPhoto }] }, ownerAvatarUrl: "https://example.com/new-photo.jpg", members: [] })).toBeNull()
  })
  it("keeps a distinct organization image", () => {
    expect(resolveOrganizationCardImage({ profile: { logoUrl: organizationLogo }, ownerAvatarUrl: personalPhoto, members: [] })).toBe(organizationLogo)
  })
})
