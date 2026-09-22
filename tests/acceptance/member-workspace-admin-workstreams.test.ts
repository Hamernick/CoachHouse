import "./test-utils"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { simplifyWorkstreamCategories } from "@/features/member-workspace/server/workstream-categories"
import { revalidatePathMock, resetTestMocks } from "./test-utils"

const { resolveMemberWorkspaceActorContextMock } = vi.hoisted(() => ({
  resolveMemberWorkspaceActorContextMock: vi.fn(),
}))

vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({
    resolveMemberWorkspaceActorContext: resolveMemberWorkspaceActorContextMock,
  })
)

import {
  deletePlatformAdminWorkstreamCategoryAction,
  restorePlatformAdminWorkstreamDefaultsAction,
} from "@/features/member-workspace/server/admin-workstreams"

type CategoryRow = {
  id: string
  owner_id: string
  name: string
  color: string
  position: number
  default_key: string | null
  created_at: string
  updated_at: string
}

const defaultCategoryValues = [
  ["backlog", "New Intake", "slate", 0],
  ["planned", "Coach Action", "amber", 1],
  ["waiting_on_organization", "Waiting on Organization", "rose", 2],
  ["review_approval", "Review & Approval", "blue", 3],
  ["active", "Ongoing Support", "violet", 4],
  ["completed", "Complete", "emerald", 5],
] as const

const defaultRows: CategoryRow[] = defaultCategoryValues.map(
  ([defaultKey, name, color, position]) => ({
    id: `category-${defaultKey}`,
    owner_id: "admin-1",
    name,
    color,
    position,
    default_key: defaultKey,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
  })
)

function mockAdminActor(supabase: { from: ReturnType<typeof vi.fn> }) {
  resolveMemberWorkspaceActorContextMock.mockResolvedValue({
    supabase,
    userId: "admin-1",
    isAdmin: true,
    activeOrg: { orgId: "org-1", role: "owner" },
    canEdit: true,
  })
}

function createCategoryLookupQuery(
  category: {
    id: string
    default_key: string | null
  } | null
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: category, error: null }),
  }
}

function createCategoryRowsQuery(rows = defaultRows) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
}

describe("platform admin workstream category actions", () => {
  beforeEach(() => {
    resetTestMocks()
    resolveMemberWorkspaceActorContextMock.mockReset()
  })

  it("rejects deletion of a default category before issuing a delete", async () => {
    const lookupQuery = createCategoryLookupQuery({
      id: "category-backlog",
      default_key: "backlog",
    })
    const supabase = { from: vi.fn(() => lookupQuery) }
    mockAdminActor(supabase)

    await expect(
      deletePlatformAdminWorkstreamCategoryAction("category-backlog")
    ).resolves.toEqual({
      error:
        "Default workstream categories cannot be deleted. Rename them or restore their original names.",
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("reports a stale custom deletion when no row was deleted", async () => {
    const lookupQuery = createCategoryLookupQuery({
      id: "category-custom",
      default_key: null,
    })
    const deleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    let categoryCall = 0
    const supabase = {
      from: vi.fn(() => {
        categoryCall += 1
        return categoryCall === 1 ? lookupQuery : deleteQuery
      }),
    }
    mockAdminActor(supabase)

    await expect(
      deletePlatformAdminWorkstreamCategoryAction("category-custom")
    ).resolves.toEqual({ error: "That category is no longer available." })

    expect(deleteQuery.select).toHaveBeenCalledWith("id")
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("returns the verified row for a successful custom deletion", async () => {
    const lookupQuery = createCategoryLookupQuery({
      id: "category-custom",
      default_key: null,
    })
    const deleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "category-custom" },
        error: null,
      }),
    }
    let categoryCall = 0
    const supabase = {
      from: vi.fn(() => {
        categoryCall += 1
        return categoryCall === 1 ? lookupQuery : deleteQuery
      }),
    }
    mockAdminActor(supabase)

    await expect(
      deletePlatformAdminWorkstreamCategoryAction("category-custom")
    ).resolves.toEqual({ ok: true, id: "category-custom" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
  })

  it("restores four defaults with one multi-row upsert", async () => {
    const rowsQuery = createCategoryRowsQuery()
    const upsertQuery = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    let categoryCall = 0
    const supabase = {
      from: vi.fn(() => {
        categoryCall += 1
        return categoryCall === 1 ? rowsQuery : upsertQuery
      }),
    }
    mockAdminActor(supabase)

    await expect(
      restorePlatformAdminWorkstreamDefaultsAction()
    ).resolves.toEqual({ ok: true })

    expect(upsertQuery.upsert).toHaveBeenCalledTimes(1)
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "category-backlog",
          default_key: "backlog",
          name: "Intake",
          position: 0,
        }),
        expect.objectContaining({
          id: "category-completed",
          default_key: "completed",
          name: "Complete",
          position: 3,
        }),
      ]),
      { onConflict: "id" }
    )
    expect(upsertQuery.upsert.mock.calls[0]?.[0]).toHaveLength(4)
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
  })

  it("fails before mutation when a default category is missing", async () => {
    const rowsQuery = createCategoryRowsQuery(defaultRows.slice(0, -1))
    const supabase = { from: vi.fn(() => rowsQuery) }
    mockAdminActor(supabase)

    await expect(
      restorePlatformAdminWorkstreamDefaultsAction()
    ).resolves.toEqual({
      error:
        "Default workstream categories are missing: Complete. Reload the page before restoring defaults.",
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("fails clearly when a custom category occupies a default name", async () => {
    const rows = [
      ...defaultRows.map((row) =>
        row.default_key === "completed"
          ? { ...row, name: "Finished work" }
          : row
      ),
      {
        ...defaultRows[0],
        id: "category-custom-complete",
        default_key: null,
        name: "Complete",
        position: 6,
      },
    ]
    const rowsQuery = createCategoryRowsQuery(rows)
    const supabase = { from: vi.fn(() => rowsQuery) }
    mockAdminActor(supabase)

    await expect(
      restorePlatformAdminWorkstreamDefaultsAction()
    ).resolves.toEqual({
      error: "Rename the custom “Complete” category before restoring defaults.",
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("surfaces an atomic upsert conflict without reporting success", async () => {
    const rowsQuery = createCategoryRowsQuery()
    const upsertQuery = {
      upsert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
    }
    let categoryCall = 0
    const supabase = {
      from: vi.fn(() => {
        categoryCall += 1
        return categoryCall === 1 ? rowsQuery : upsertQuery
      }),
    }
    mockAdminActor(supabase)

    await expect(
      restorePlatformAdminWorkstreamDefaultsAction()
    ).resolves.toEqual({
      error:
        "A custom category now uses a default name. Rename it before restoring defaults.",
    })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe("simplified organization workstreams", () => {
  const categories = defaultRows.map((row) => ({ id: row.id, name: row.name, color: row.color, position: row.position, defaultKey: row.default_key }))
  it("groups six defaults into four without changing saved rows", () => {
    const result = simplifyWorkstreamCategories(categories)
    expect(result.categories.map((category) => category.name)).toEqual(["Intake", "In progress", "Waiting", "Complete"])
    const progress = categories.find((category) => category.defaultKey === "planned")!
    for (const key of ["active", "review_approval"]) {
      expect(result.aliases.get(categories.find((category) => category.defaultKey === key)!.id)).toBe(progress.id)
    }
    expect(categories.map((category) => category.name)).toContain("Ongoing Support")
  })
  it("preserves custom categories and renamed defaults", () => {
    const input = categories.map((category) => category.defaultKey === "active" ? { ...category, name: "Fundraising" } : category)
    input.push({ id: "custom", name: "Special projects", color: "rose", position: 8, defaultKey: null })
    const result = simplifyWorkstreamCategories(input)
    expect(result.categories.map((category) => category.name)).toContain("Fundraising")
    expect(result.categories.map((category) => category.name)).toContain("Special projects")
    expect(result.aliases.has(input.find((category) => category.defaultKey === "active")!.id)).toBe(false)
  })
})
