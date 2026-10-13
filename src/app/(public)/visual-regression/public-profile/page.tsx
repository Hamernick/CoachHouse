import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { PublicProfilePage } from "@/features/public-profiles"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"

const DAY_IN_MS = 86_400_000

function fixtureHeatmap() {
  const end = Date.UTC(2026, 7, 31)
  const activity = new Map([
    ["2026-05-08", 1],
    ["2026-06-21", 1],
    ["2026-08-18", 1],
  ])
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(end - (364 - index) * DAY_IN_MS)
      .toISOString()
      .slice(0, 10)
    return { date, value: activity.get(date) ?? 0 }
  })
}

export default async function PublicProfileVisualRegressionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()
  const { kind } = await searchParams

  if (kind === "person") {
    return (
      <PublicProfilePage
        profile={{
          kind: "person",
          handle: "caleb",
          displayName: "Caleb Hamernick",
          headline:
            "Designer and developer building practical tools for mission-led teams.",
          description:
            "I work across product, engineering, and community infrastructure to help organizations turn good ideas into durable programs.",
          avatarUrl: null,
          locationLabel: "New York, New York",
          websiteUrl: "https://example.org",
          showOrganizations: true,
          showProgramActivity: true,
          showSavedLocations: true,
          resourcesShared: 1,
          resourceOpens: 12,
          savedItems: 2,
          savedCollections: [
            {
              id: "neighborhood-essentials",
              name: "Neighborhood essentials",
              isPublic: true,
              items: [
                {
                  kind: "resource",
                  id: "food-guide",
                  title: "Harlem Community Food Guide",
                  subtitle: "Free groceries and meal support",
                  locationLabel: "Harlem, New York",
                  href: "/map?q=Harlem%20Community%20Food%20Guide",
                },
                {
                  kind: "organization",
                  id: "open-house",
                  title: "Open House Collective",
                  subtitle: "Community programs and shared space",
                  locationLabel: "New York, New York",
                  href: "/map?organization=open-house",
                },
              ],
            },
          ],
          affiliations: [
            {
              organizationId: "open-house",
              name: "Open House Collective",
              handle: "open-house",
              role: "owner",
              avatarUrl: null,
              href: "/open-house",
            },
            {
              organizationId: "harlem-code-house",
              name: "Harlem Code House",
              handle: "harlem-code-house",
              role: "board",
              avatarUrl: null,
              href: "/harlem-code-house",
            },
          ],
          activity: [
            {
              id: "activity-3",
              kind: "affiliation_published",
              title: "Added Harlem Code House as a public affiliation",
              summary:
                "Published a verified Coach House organization membership.",
              occurredAt: "2026-08-18T14:00:00.000Z",
              relatedLabel: "Harlem Code House",
              relatedHref: "/harlem-code-house",
            },
            {
              id: "activity-resource",
              kind: "resource_shared",
              title: "Shared Harlem Community Food Guide",
              summary: "Created a tracked public resource link.",
              occurredAt: "2026-06-21T14:00:00.000Z",
              relatedLabel: "Harlem Community Food Guide",
              relatedHref: "/go/visual123",
            },
            {
              id: "activity-2",
              kind: "affiliation_published",
              title: "Added Open House Collective as a public affiliation",
              summary:
                "Published a verified Coach House organization membership.",
              occurredAt: "2026-05-08T14:00:00.000Z",
              relatedLabel: "Open House Collective",
              relatedHref: "/open-house",
            },
          ],
          heatmap: fixtureHeatmap(),
        }}
      />
    )
  }

  return (
    <PublicProfilePage
      profile={{
        kind: "organization",
        handle: "harlem-code-house",
        organizationId: "visual-fixture",
        displayName: "Harlem Code House",
        headline:
          "Free, neighborhood-led technology programs for young people.",
        description:
          "We connect students with practical skills, trusted mentors, and welcoming spaces to build what comes next.",
        avatarUrl: null,
        locationLabel: "Harlem, New York",
        websiteUrl: "https://example.org",
        donateUrl: "https://example.org/donate",
        findUrl: "/map?organization=harlem-code-house",
        people: [
          {
            id: "maya-thompson",
            name: "Maya Thompson",
            title: "Executive Director",
            roleLabel: "Staff",
            avatarUrl: null,
          },
          {
            id: "jordan-lee",
            name: "Jordan Lee",
            title: "Board Chair",
            roleLabel: "Governing Board",
            avatarUrl: null,
          },
        ],
        programs: [
          {
            id: "summer-studio",
            title: "Summer Code Studio",
            summary:
              "A project-based summer program where middle school students design and ship their first web experience.",
            statusLabel: "Applications open",
            startDate: "2026-07-06",
            locationLabel: "In person",
            ctaLabel: "Apply",
            ctaUrl: "https://example.org/apply",
          },
          {
            id: "mentor-hours",
            title: "Community Mentor Hours",
            summary:
              "Weekly online office hours connecting emerging builders with working designers and engineers.",
            statusLabel: "Ongoing",
            startDate: null,
            locationLabel: "Online",
            ctaLabel: "Join a session",
            ctaUrl: "https://example.org/mentors",
          },
        ],
      }}
    />
  )
}
