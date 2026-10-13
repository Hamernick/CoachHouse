import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("fiscal sponsorship entrypoints", () => {
  it("houses public intake in Documentation and preserves the old URL", () => {
    const route = readSource("src/app/(public)/documentation/fiscal-sponsorship/page.tsx")
    expect(route).toContain('canonical: "/documentation/fiscal-sponsorship"')
    expect(route).toContain("<FiscalSponsorshipPublicPage />")
    expect(readSource("src/app/(public)/fiscalsponsorship/page.tsx")).toContain('permanentRedirect("/documentation/fiscal-sponsorship")')
    expect(readSource("src/features/fiscal-sponsorship/components/fiscal-sponsorship-public-page.tsx")).toContain("Sponsorship does not guarantee funding.")
    expect(readSource("src/features/nonprofit-documentation/lib/search-documents.ts")).toContain('href: "/documentation/fiscal-sponsorship"')
    expect(readSource("src/lib/organization/reserved-public-slugs.ts")).toContain('"fiscalsponsorship"')
  })

  it("is available from the prototype lab as the default centered canvas entry", () => {
    const entries = readSource("src/features/prototype-lab/lib/index.ts")
    const sidebarTree = readSource(
      "src/lib/prototype-lab-sidebar-tree.ts"
    )
    const panel = readSource(
      "src/features/prototype-lab/components/prototype-lab-panel.tsx"
    )
    const route = readSource(
      "src/app/(admin)/admin/platform/prototypes/page.tsx"
    )

    expect(entries).toContain(
      'const DEFAULT_ENTRY_ID = "fiscal-sponsorship-flow"'
    )
    expect(entries).toContain('id: "fiscal-sponsorship-flow"')
    expect(entries).toContain('projectId: "fiscal-sponsorship"')
    expect(sidebarTree).toContain('label: "Fiscal Sponsorship"')
    expect(sidebarTree).toContain(
      'DEFAULT_PROTOTYPE_LAB_ENTRY_ID = "fiscal-sponsorship-flow"'
    )
    expect(panel).toContain('entryId === "fiscal-sponsorship-flow"')
    expect(panel).toContain("fiscalSponsorshipPrototype")
    expect(route).toContain("FiscalSponsorshipPanel")
  })

  it("does not route the fiscal flow through dummy PDF placeholders", () => {
    const data = readSource(
      "src/features/fiscal-sponsorship/lib/prototype-data.ts"
    )
    const drawer = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-step-drawer.tsx"
    )
    const runPanels = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-run-panels.tsx"
    )

    expect(data).not.toContain("/fiscal-sponsorship/placeholders/")
    expect(drawer).not.toContain("/fiscal-sponsorship/placeholders/")
    expect(drawer).not.toContain("placeholder PDF")
    expect(drawer).not.toContain("sample agreement")
    expect(runPanels).not.toContain("placeholder")
  })

  it("includes the full fiscal sponsorship handbook markdown for user review", () => {
    const handbook = readSource(
      "public/fiscal-sponsorship/2026-ch-fiscal-sponsorship-handbook.md"
    )

    expect(handbook).toContain("# FS: How this works")
    expect(handbook).toContain("# **FISCAL SPONSORSHIP GRANT AGREEMENT**")
    expect(handbook).toContain("# **FUNDRAISING APPROVAL & DISCLOSURE POLICY**")
    expect(handbook).toContain("## **Grant Request Form (Grantee Submission)**")
    expect(handbook).toContain("Internal Financial Controls")
  })
})
