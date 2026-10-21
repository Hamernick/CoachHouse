import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const readActiveOrganizationCookieMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/organization/active-org-cookie", () => ({
  readActiveOrganizationCookie: readActiveOrganizationCookieMock,
}))

import { resolveActiveOrganization } from "@/lib/organization/active-org"

const ROOT = process.cwd()

type MembershipRow = {
  org_id: string
  role: string | null
  created_at: string | null
}

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function createSupabase(memberships: MembershipRow[]) {
  return {
    from(table: string) {
      expect(table).toBe("organization_memberships")
      return {
        select() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("member_id")
              expect(value).toBeTruthy()
              return {
                returns: async () => ({ data: memberships }),
              }
            },
          }
        },
      }
    },
  }
}

describe("organization switching", () => {
  beforeEach(() => {
    readActiveOrganizationCookieMock.mockReset()
  })

  it("uses the active organization cookie when callers do not pass an explicit preference", async () => {
    readActiveOrganizationCookieMock.mockResolvedValue("org-board")

    const activeOrg = await resolveActiveOrganization(
      createSupabase([
        { org_id: "org-staff", role: "staff", created_at: "2026-01-02T00:00:00.000Z" },
        { org_id: "org-board", role: "board", created_at: "2026-01-01T00:00:00.000Z" },
      ]) as never,
      "user-cookie-preference",
    )

    expect(activeOrg).toEqual({ orgId: "org-board", role: "board" })
    expect(readActiveOrganizationCookieMock).toHaveBeenCalledTimes(1)
  })

  it("lets callers force the default organization resolution when preferredOrgId is explicit", async () => {
    readActiveOrganizationCookieMock.mockResolvedValue("org-board")

    const activeOrg = await resolveActiveOrganization(
      createSupabase([
        { org_id: "org-staff", role: "staff", created_at: "2026-01-02T00:00:00.000Z" },
        { org_id: "org-board", role: "board", created_at: "2026-01-01T00:00:00.000Z" },
      ]) as never,
      "user-explicit-default",
      { preferredOrgId: null },
    )

    expect(activeOrg).toEqual({ orgId: "org-staff", role: "staff" })
    expect(readActiveOrganizationCookieMock).not.toHaveBeenCalled()
  })

  it("keeps the workspace page and switcher wired to the cookie-backed active org", () => {
    const pageSource = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx",
    )
    const adminLayoutSource = readSource("src/app/(admin)/layout.tsx")
    const switcherSource = readSource(
      "src/features/member-workspace/components/shell/member-workspace-org-switcher.tsx",
    )
    const workspaceViewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/my-organization-workspace-view.tsx",
    )
    const actionSource = readSource("src/features/member-workspace/server/actions.ts")
    const appShellSource = readSource("src/components/app-shell/app-shell-inner.tsx")

    expect(pageSource).toContain("resolveOptionalAuthenticatedAppContext")
    expect(pageSource).not.toContain("resolveActiveOrganization(supabase, user.id)")
    expect(adminLayoutSource).toContain("resolveDashboardLayoutState")
    expect(adminLayoutSource).toContain("MemberWorkspaceSidebarHeader")
    expect(adminLayoutSource).toContain("showMemberWorkspace={state.showMemberWorkspace}")
    expect(appShellSource).not.toContain("(!isAdminContext || isAdmin)")
    expect(switcherSource).toContain("defaultValue={activeOrganization.orgId}")
    expect(switcherSource).toContain("value={organization.orgId}")
    expect(switcherSource).toContain("keywords={[organization.name, organization.role]}")
    expect(switcherSource).toContain('aria-current={isActive ? "true" : undefined}')
    expect(switcherSource).toContain(
      'className="[&_[cmdk-group-items]]:space-y-1"',
    )
    expect(switcherSource).toContain("Workspace, Admin, and Documents")
    expect(switcherSource).toContain("window.location.reload()")
    expect(switcherSource).not.toContain("router.refresh()")
    expect(workspaceViewSource).toContain('key={`${seed.orgId}:${seed.boardState.workspaceCanvasId ?? "main"}`}')
    expect(actionSource).toContain('revalidatePath("/admin")')
    expect(actionSource).toContain('revalidatePath("/workspace")')
    expect(actionSource).toContain('revalidatePath("/organization/documents")')
  })
})
