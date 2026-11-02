import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const {
  createSupabaseRouteHandlerClientMock,
  createSupabaseAdminClientMock,
  disconnectGoogleDriveMock,
} = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn(),
  disconnectGoogleDriveMock: vi.fn(),
}))

vi.mock("@/features/google-drive", () => ({
  disconnectGoogleDrive: disconnectGoogleDriveMock,
}))

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

const WORKSPACE_AUTHOR_TABLES = [
  "organization_project_assets",
  "organization_project_quick_links",
  "organization_project_notes",
  "organization_task_assignees",
  "organization_tasks",
  "organization_projects",
] as const

function buildRequest() {
  return new NextRequest("http://localhost/api/account/delete", {
    method: "DELETE",
  })
}

function buildRouteSupabaseStub({
  userId = "user-delete",
}: {
  userId?: string | null
} = {}) {
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
      signOut,
    },
  }

  return { supabase, calls: { signOut } }
}

function buildSelectChain(data: Array<{ org_id: string }> = []) {
  return {
    eq: vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        returns: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function buildUpdateChain(error: { message: string } | null = null) {
  const secondEq = vi.fn().mockResolvedValue({ error })
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
  return { eq: firstEq }
}

function buildAdminSupabaseStub({
  sharedOrgIdsByTable = {},
  deleteUserErrors = [null],
  ownershipCounts = [0],
  ownershipError = null,
}: {
  sharedOrgIdsByTable?: Partial<Record<(typeof WORKSPACE_AUTHOR_TABLES)[number], string[]>>
  deleteUserErrors?: Array<{ message: string } | null>
  ownershipCounts?: Array<number | null>
  ownershipError?: { message: string } | null
} = {}) {
  const selectByTable = new Map<string, ReturnType<typeof buildSelectChain>>()
  const updateByTable = new Map<string, ReturnType<typeof buildUpdateChain>>()
  const ownershipEq = vi.fn(async () => ({ count: ownershipCounts.length > 1 ? ownershipCounts.shift() : ownershipCounts[0], error: ownershipError }))
  const organizationDeleteEq = vi.fn()
  const organizationDelete = vi.fn().mockReturnValue({ eq: organizationDeleteEq })

  const from = vi.fn((table: string) => {
    if (table === "organizations") {
      return { delete: organizationDelete, select: vi.fn().mockReturnValue({ eq: ownershipEq }) }
    }

    if (!WORKSPACE_AUTHOR_TABLES.includes(table as (typeof WORKSPACE_AUTHOR_TABLES)[number])) {
      throw new Error(`Unexpected table: ${table}`)
    }

    const orgIds =
      sharedOrgIdsByTable[table as (typeof WORKSPACE_AUTHOR_TABLES)[number]] ?? []
    const selectChain = buildSelectChain(orgIds.map((org_id) => ({ org_id })))
    const updateChain = buildUpdateChain()
    selectByTable.set(table, selectChain)
    updateByTable.set(table, updateChain)
    return {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    }
  })

  const deleteUser = vi.fn(async () => ({
    error: deleteUserErrors.shift() ?? null,
  }))

  return {
    admin: {
      auth: { admin: { deleteUser } },
      from,
    },
    calls: {
      deleteUser,
      from,
      organizationDelete,
      organizationDeleteEq,
      ownershipEq,
      selectByTable,
      updateByTable,
    },
  }
}

describe("account delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    disconnectGoogleDriveMock.mockResolvedValue(undefined)
  })

  it("returns 401 without an authenticated user", async () => {
    const { supabase } = buildRouteSupabaseStub({ userId: null })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "Unauthorized" })
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it("deletes a free self-only account without billing or organization cleanup blockers", async () => {
    const { supabase, calls: routeCalls } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)

    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())

    expect(response.status).toBe(204)
    expect(calls.deleteUser).toHaveBeenCalledWith("user-delete")
    expect(disconnectGoogleDriveMock).toHaveBeenCalledWith({
      admin,
      userId: "user-delete",
      revoke: true,
    })
    expect(calls.organizationDelete).not.toHaveBeenCalled()
    expect(routeCalls.signOut).toHaveBeenCalledTimes(1)
  })

  it("continues local account deletion when provider revocation fails", async () => {
    const { supabase } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)
    disconnectGoogleDriveMock.mockRejectedValue(new Error("provider unavailable"))

    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())

    expect(response.status).toBe(204)
    expect(calls.deleteUser).toHaveBeenCalledWith("user-delete")
  })

  it("reassigns shared workspace authorship before deleting an invited org member", async () => {
    const { supabase } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub({
      sharedOrgIdsByTable: {
        organization_tasks: ["org-owner", "org-owner"],
        organization_project_notes: ["org-owner"],
      },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)

    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())

    expect(response.status).toBe(204)
    expect(calls.updateByTable.get("organization_tasks")?.eq).toHaveBeenCalledWith(
      "created_by",
      "user-delete",
    )
    expect(
      calls.updateByTable.get("organization_tasks")?.eq.mock.results[0]?.value.eq,
    ).toHaveBeenCalledWith("org_id", "org-owner")
    expect(calls.deleteUser).toHaveBeenCalledWith("user-delete")
  })

  it("never deletes organization data or blindly retries after an Auth foreign-key error", async () => {
    const { supabase, calls: routeCalls } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub({
      deleteUserErrors: [{ message: "violates foreign key constraint" }],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)
    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())
    expect(response.status).toBe(500)
    expect(calls.organizationDelete).not.toHaveBeenCalled()
    expect(calls.deleteUser).toHaveBeenCalledTimes(1)
    expect(routeCalls.signOut).not.toHaveBeenCalled()
  })

  it("blocks an owner before connector revocation, shared edits or Auth deletion", async () => {
    const { supabase, calls: routeCalls } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub({ ownershipCounts: [1] })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)
    const { DELETE } = await import("@/app/api/account/delete/route")
    const response = await DELETE(buildRequest())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("closed separately") })
    expect(calls.ownershipEq).toHaveBeenCalledWith("user_id", "user-delete")
    expect(calls.from.mock.calls.map(([table]) => table)).toEqual(["organizations"])
    expect(disconnectGoogleDriveMock).not.toHaveBeenCalled()
    expect(calls.deleteUser).not.toHaveBeenCalled()
    expect(calls.organizationDelete).not.toHaveBeenCalled()
    expect(routeCalls.signOut).not.toHaveBeenCalled()
  })

  it.each([
    { ownershipCounts: [null], ownershipError: null },
    { ownershipCounts: [0], ownershipError: { message: "database unavailable" } },
  ])("fails closed when ownership cannot be established", async (options) => {
    const { supabase } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub(options)
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)
    const { DELETE } = await import("@/app/api/account/delete/route")
    expect((await DELETE(buildRequest())).status).toBe(503)
    expect(disconnectGoogleDriveMock).not.toHaveBeenCalled()
    expect(calls.deleteUser).not.toHaveBeenCalled()
    expect(calls.organizationDelete).not.toHaveBeenCalled()
  })

  it("reports ownership created after preflight without destructive recovery", async () => {
    const { supabase } = buildRouteSupabaseStub()
    const { admin, calls } = buildAdminSupabaseStub({
      ownershipCounts: [0, 1], deleteUserErrors: [{ message: "Database error deleting user" }],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    createSupabaseAdminClientMock.mockReturnValue(admin)
    const { DELETE } = await import("@/app/api/account/delete/route")
    expect((await DELETE(buildRequest())).status).toBe(409)
    expect(calls.deleteUser).toHaveBeenCalledTimes(1)
    expect(calls.organizationDelete).not.toHaveBeenCalled()
  })
})
