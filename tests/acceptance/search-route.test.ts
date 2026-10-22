import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/search/route"
import { fetchSidebarTree } from "@/lib/academy"
import { createSupabaseServerClientMock, resetTestMocks } from "./test-utils"

vi.mock("@/lib/academy", () => ({
  fetchSidebarTree: vi.fn(),
}))

vi.mock("@/lib/modules", () => ({
  parseAssignmentFields: vi.fn(() => []),
}))

vi.mock("@/lib/roadmap", () => ({
  resolveRoadmapSections: vi.fn(() => []),
}))

type RpcRow = {
  id: string
  label: string
  subtitle: string | null
  href: string
  group_name: string
  rank: number | null
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function buildSupabaseStub({
  rpcData,
  rpcError,
  isAdmin = false,
  hasAcceleratorPurchase = false,
  membershipResult,
  acceleratorPurchaseResult,
}: {
  rpcData?: RpcRow[]
  rpcError?: unknown
  isAdmin?: boolean
  hasAcceleratorPurchase?: boolean
  membershipResult?: Promise<{
    data: Array<{ org_id: string; role: string; created_at: string }>
    error: null
  }>
  acceleratorPurchaseResult?: Promise<{
    data: { id: string } | null
    error: null
  }>
} = {}) {
  const returns = vi.fn().mockResolvedValue({ data: [], error: null })
  const insert = vi.fn().mockResolvedValue({ error: null })

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returns,
    insert,
  }

  const config = { isAdmin, hasAcceleratorPurchase }

  const from = vi.fn((table: string) => {
    const maybeSingle = vi.fn().mockImplementation(async () => {
      if (table === "profiles") {
        return { data: { role: config.isAdmin ? "admin" : null }, error: null }
      }
      if (table === "accelerator_purchases") {
        if (acceleratorPurchaseResult) {
          return acceleratorPurchaseResult
        }
        return {
          data: config.hasAcceleratorPurchase ? { id: "purchase-1" } : null,
          error: null,
        }
      }
      return { data: null, error: null }
    })

    return {
      ...chain,
      returns:
        table === "organization_memberships" && membershipResult
          ? vi.fn(() => membershipResult)
          : returns,
      maybeSingle,
    }
  })

  const rpcReturns = vi.fn().mockResolvedValue({
    data: rpcData ?? [],
    error: rpcError ?? null,
  })

  const rpc = vi.fn(() => ({ returns: rpcReturns }))
  const auth = {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
  }

  return { supabaseStub: { auth, rpc, from }, rpcReturns }
}

const fetchSidebarTreeMock = vi.mocked(fetchSidebarTree)

describe("search route", () => {
  beforeEach(() => {
    resetTestMocks()
    fetchSidebarTreeMock.mockReset()
  })

  it("links marketplace search results to current Documentation resource pages", async () => {
    const { supabaseStub } = buildSupabaseStub()
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)
    fetchSidebarTreeMock.mockResolvedValue([])
    const response = await GET(new Request("https://example.org/api/search?q=Canva"))
    const body = await response.json()
    const resources = body.results.filter((row: { group: string }) => row.group === "Marketplace")
    expect(resources.length).toBeGreaterThan(0)
    expect(resources.every((row: { href: string }) => row.href.startsWith("/documentation/marketplace/"))).toBe(true)
  })

  it("returns ranked results and filters session rows", async () => {
    const rpcData: RpcRow[] = [
      {
        id: "class:1",
        label: "Session A1 – Foundations",
        subtitle: "Class",
        href: "/accelerator/class/session-a1",
        group_name: "Classes",
        rank: 0.9,
      },
      {
        id: "module:2",
        label: "Theory of Change",
        subtitle: "Strategic Foundations",
        href: "/accelerator/class/strategic-foundations/module/1",
        group_name: "Modules",
        rank: 0.8,
      },
      {
        id: "community:1",
        label: "Open Source Org",
        subtitle: "Education",
        href: "/open-source-org",
        group_name: "Community",
        rank: 0.7,
      },
    ]

    const { supabaseStub, rpcReturns } = buildSupabaseStub({
      rpcData,
      hasAcceleratorPurchase: true,
    })
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)

    const res = await GET(new Request("http://localhost/api/search?q=theory"))
    const json = await res.json()

    expect(supabaseStub.rpc).toHaveBeenCalledWith(
      "search_global",
      expect.objectContaining({ p_query: "theory" })
    )
    expect(rpcReturns).toHaveBeenCalledTimes(1)
    expect(json.results).toEqual([
      {
        id: "module:2",
        label: "Theory of Change",
        subtitle: "Strategic Foundations",
        href: "/accelerator/class/strategic-foundations/module/1",
        group: "Modules",
      },
      {
        id: "community:1",
        label: "Open Source Org",
        subtitle: "Education",
        href: "/open-source-org",
        group: "Community",
      },
    ])
  })

  it("filters accelerator results when the user lacks access", async () => {
    const rpcData: RpcRow[] = [
      {
        id: "module:2",
        label: "Theory of Change",
        subtitle: "Strategic Foundations",
        href: "/accelerator/class/strategic-foundations/module/1",
        group_name: "Modules",
        rank: 0.8,
      },
      {
        id: "community:1",
        label: "Open Source Org",
        subtitle: "Education",
        href: "/open-source-org",
        group_name: "Community",
        rank: 0.7,
      },
    ]

    const { supabaseStub } = buildSupabaseStub({
      rpcData,
      hasAcceleratorPurchase: false,
    })
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)

    const res = await GET(new Request("http://localhost/api/search?q=theory"))
    const json = await res.json()

    expect(json.results).toEqual([
      {
        id: "community:1",
        label: "Open Source Org",
        subtitle: "Education",
        href: "/open-source-org",
        group: "Community",
      },
    ])
  })

  it("falls back to manual search when the RPC fails", async () => {
    const { supabaseStub } = buildSupabaseStub({
      rpcError: { message: "missing function" },
      hasAcceleratorPurchase: true,
    })
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)
    fetchSidebarTreeMock.mockResolvedValue([
      {
        id: "class-1",
        slug: "strategic-foundations",
        title: "Strategic Foundations",
        description: "Core skills",
        published: true,
        modules: [
          {
            id: "module-1",
            index: 1,
            title: "Org profile",
            description: "Basics",
            published: true,
          },
        ],
      },
    ])

    const res = await GET(
      new Request("http://localhost/api/search?q=strategic")
    )
    const json = await res.json()

    expect(fetchSidebarTreeMock).toHaveBeenCalled()
    expect(json.results.map((item: { id: string }) => item.id)).toEqual([
      "class-class-1",
      "module-module-1",
    ])
  })

  it("loads organization and admin context concurrently", async () => {
    const membership = createDeferred<{
      data: Array<{ org_id: string; role: string; created_at: string }>
      error: null
    }>()
    const { supabaseStub } = buildSupabaseStub({
      membershipResult: membership.promise,
    })
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)

    const responsePromise = GET(
      new Request("http://localhost/api/search?q=workspace")
    )

    await vi.waitFor(() => {
      expect(supabaseStub.from).toHaveBeenCalledWith("profiles")
    })

    membership.resolve({ data: [], error: null })
    await responsePromise
  })

  it("starts ranked search while entitlements are loading", async () => {
    const acceleratorPurchase = createDeferred<{
      data: { id: string } | null
      error: null
    }>()
    const { supabaseStub } = buildSupabaseStub({
      acceleratorPurchaseResult: acceleratorPurchase.promise,
    })
    createSupabaseServerClientMock.mockResolvedValue(supabaseStub)

    const responsePromise = GET(
      new Request("http://localhost/api/search?q=workspace")
    )

    await vi.waitFor(() => {
      expect(supabaseStub.rpc).toHaveBeenCalledWith(
        "search_global",
        expect.objectContaining({ p_query: "workspace" })
      )
    })

    acceleratorPurchase.resolve({ data: null, error: null })
    await responsePromise
  })
})
