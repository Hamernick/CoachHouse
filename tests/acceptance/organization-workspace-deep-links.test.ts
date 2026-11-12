import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  addActiveOrganizationResults,
  attachOrganizationImages,
} from "@/app/api/search/_lib/query-sources/organization"
import type { SearchResult } from "@/lib/search/types"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("organization workspace deep links", () => {
  it("uses the canonical workspace editor in active organization entry points", () => {
    const sources = [
      "src/lib/accelerator/readiness-checklist.ts",
      "src/components/accelerator/accelerator-org-snapshot-strip.tsx",
      "src/components/organization/program-builder-dashboard-card.tsx",
      "src/app/api/search/_lib/query-sources/organization.ts",
      "src/app/api/search/_lib/query-sources/fallback.ts",
    ].map(readSource)

    for (const source of sources) {
      expect(source).toContain("getWorkspaceEditorPath")
      expect(source).not.toContain("/organization?view=editor")
      expect(source).not.toContain("/organization?tab=programs")
    }
  })

  it("keys active-organization image enrichment to identity, not a legacy URL", () => {
    const source = readSource(
      "src/app/api/search/_lib/query-sources/organization.ts"
    )

    expect(source).toContain("result.id === `org:${orgId}`")
    expect(source).not.toContain('result.href === "/organization"')
  })

  it("returns canonical organization and program destinations from search", async () => {
    const results: SearchResult[] = []
    const programQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: [
          {
            id: "program/one",
            title: "Coach program",
            subtitle: null,
            status_label: null,
          },
        ],
      }),
    }
    const organizationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          profile: {
            name: "Coach House",
            tagline: "Practical support",
          },
        },
      }),
    }
    const supabase = {
      from: vi.fn((table: string) =>
        table === "programs" ? programQuery : organizationQuery
      ),
    }

    await addActiveOrganizationResults({
      supabase: supabase as never,
      orgId: "org-1",
      actorId: "reader-1",
      tokens: ["coach"],
      pushResult: (result) => results.push(result),
    })

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "program:program/one",
          href: "/workspace?view=editor&tab=programs&programId=program%2Fone",
        }),
        expect.objectContaining({
          id: "org:org-1",
          href: "/workspace?view=editor&tab=company",
        }),
      ])
    )
  })

  it("keeps self-logo enrichment after canonical routing", async () => {
    const organizationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { profile: { logoUrl: "https://example.com/logo.svg" } },
      }),
    }
    const supabase = {
      from: vi.fn(() => organizationQuery),
    }

    const results = await attachOrganizationImages({
      supabase: supabase as never,
      orgId: "org-1",
      results: [
        {
          id: "org:org-1",
          label: "Coach House",
          href: "/workspace?view=editor&tab=company",
          group: "My organization",
        },
      ],
    })

    expect(results[0]?.image).toBe("https://example.com/logo.svg")
  })
})

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: async () => ({ data: { blockedSectionIds: [], complete: false }, error: null }) }) }))
