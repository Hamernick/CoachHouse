import { describe, expect, it, vi } from "vitest"

import {
  addActiveOrganizationResults,
  attachOrganizationImages,
} from "@/app/api/search/_lib/query-sources/organization"
import { addFallbackResults } from "@/app/api/search/_lib/query-sources/fallback"
vi.mock("@/lib/academy", () => ({ fetchSidebarTree: async () => [] }))
vi.mock("@/lib/modules", () => ({ parseAssignmentFields: () => [] }))
import type { SearchResult } from "@/lib/search/types"

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function createQueryBuilder<T>(result: Promise<T>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returns: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
  }
}

describe("global search query source concurrency", () => {
  it("loads active-organization programs and profile concurrently", async () => {
    const programs = createDeferred<{
      data: Array<{
        id: string
        title: string
        subtitle: string | null
        status_label: string | null
      }>
    }>()
    const organization = createDeferred<{
      data: { profile: Record<string, unknown> } | null
    }>()
    const from = vi.fn((table: string) => {
      if (table === "programs") return createQueryBuilder(programs.promise)
      if (table === "organizations") {
        return createQueryBuilder(organization.promise)
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    const results: SearchResult[] = []

    const pending = addActiveOrganizationResults({
      supabase: { from } as never,
      orgId: "org-1",
      actorId: "reader-1",
      tokens: ["youth"],
      pushResult: (result) => results.push(result),
    })

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "programs",
      "organizations",
    ])

    programs.resolve({
      data: [
        {
          id: "program-1",
          title: "Youth services",
          subtitle: null,
          status_label: null,
        },
      ],
    })
    organization.resolve({
      data: { profile: { name: "Youth House" } },
    })
    await pending

    expect(results.map((result) => result.id)).toEqual([
      "program:program-1",
      "org:org-1",
    ])
  })

  it("loads self and community logos concurrently", async () => {
    const self = createDeferred<{
      data: { profile: Record<string, unknown> } | null
    }>()
    const community = createDeferred<{
      data: Array<{
        public_slug: string | null
        profile: Record<string, unknown> | null
      }>
    }>()
    const from = vi
      .fn()
      .mockImplementationOnce(() => createQueryBuilder(self.promise))
      .mockImplementationOnce(() => createQueryBuilder(community.promise))

    const pending = attachOrganizationImages({
      supabase: { from } as never,
      orgId: "org-1",
      results: [
        {
          id: "org:org-1",
          label: "My organization",
          href: "/workspace?view=editor&tab=company",
          group: "My organization",
        },
        {
          id: "community-1",
          label: "Neighbor",
          href: "/neighbor",
          group: "Community",
        },
      ],
    })

    expect(from).toHaveBeenCalledTimes(2)

    self.resolve({ data: { profile: { logoUrl: "/self.png" } } })
    community.resolve({
      data: [
        {
          public_slug: "neighbor",
          profile: { logoUrl: "/neighbor.png" },
        },
      ],
    })

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: "org:org-1", image: "/self.png" }),
      expect.objectContaining({
        id: "community-1",
        image: "/neighbor.png",
      }),
    ])
  })
})

const sourceAccess = vi.hoisted(() => ({ blocked: [] as string[], failed: false }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: async (name: string, args: { p_ids?: string[]; p_org_ids?: string[] }) => ({ data: name === "read_public_document_audiences" ? (args.p_org_ids ?? []).map(organizationId => ({ organizationId, blockedSectionIds: sourceAccess.blocked, complete: false })) : name === "filter_public_organization_ids" ? args.p_ids : { blockedSectionIds: sourceAccess.blocked, complete: false }, error: sourceAccess.failed ? { message: "Private details" } : null }) }) }))


it("searches only readable profile sections and aliases, and rechecks on each query", async () => {
  const profile = { name: "Organization", mission: "Secret mission", roadmap: { sections: [
    { id: "mission_vision_values", content: "Secret mission" },
    { id: "vision", title: "Secret title", content: "Secret body" },
    { id: "values", title: "Readable values", content: "Readable body" },
    { id: "drive", title: "Drive document", content: "Inactive editor body", documentSource: "google_drive" },
  ] } }
  const supabase = { from: (table: string) => createQueryBuilder(Promise.resolve({ data: table === "organizations" ? { profile } : [] })) } as never
  const search = async (token: string) => { const results: SearchResult[] = []; await addActiveOrganizationResults({ supabase, orgId: "org-1", actorId: "reader-1", tokens: [token], pushResult: item => results.push(item) }); return results }
  try {
    sourceAccess.blocked = ["mission_vision_values", "vision"]
    expect(await search("secret")).toEqual([])
    expect(await search("readable")).toHaveLength(1)
    expect(await search("inactive")).toEqual([])
    sourceAccess.blocked = []
    expect((await search("secret")).length).toBeGreaterThan(0)
    sourceAccess.failed = true
    await expect(search("secret")).rejects.toThrow("Document sources could not be verified")
    expect(profile.mission).toBe("Secret mission")
  } finally { sourceAccess.blocked = []; sourceAccess.failed = false }
})


it("fallback search also filters private copies and uses public narrative status for community matches", async () => {
 const profile = { name: "Community", mission: "Secret fallback", roadmap: { sections: [{ id: "mission_vision_values", content: "Secret draft", status: "in_progress", publicProfileStatusControlled: true }] } }
 const supabase = { from: (table: string) => {
   const builder = createQueryBuilder(Promise.resolve({ data: table === "organizations" ? [{ user_id: "10000000-0000-4000-8000-000000000001", public_slug: "community", profile }] : [] }))
   return { ...builder, maybeSingle: async () => ({ data: table === "organizations" ? { user_id: "org-1", profile } : null }) }
 } } as never
 const search = async (token: string) => { const results: SearchResult[] = []; await addFallbackResults({ supabase, orgId: "org-1", actorId: "reader-1", isAdmin: false, tokens: [token], pushResult: item => results.push(item) }); return results }
 try {
  sourceAccess.blocked = ["mission_vision_values"]
  expect(await search("secret")).toEqual([])
  expect((await search("community")).some(item => item.group === "Community")).toBe(true)
 } finally { sourceAccess.blocked = [] }
})


it("community search cannot match a published but folder-restricted mission",async()=>{
 const profile={name:"Community",mission:"restrictedneedle"}
 const supabase={from:(table:string)=>({...createQueryBuilder(Promise.resolve({data:table==="organizations"?[{user_id:"10000000-0000-4000-8000-000000000001",public_slug:"community",profile}]:[]})),maybeSingle:async()=>({data:null})})} as never
 const search=async(token:string)=>{const results:SearchResult[]=[];await addFallbackResults({supabase,orgId:"org-1",actorId:"reader-1",isAdmin:false,tokens:[token],pushResult:result=>results.push(result)});return results}
 try {
  sourceAccess.blocked=[];expect(await search("restrictedneedle")).toHaveLength(1)
  sourceAccess.blocked=["mission_vision_values"];expect(await search("restrictedneedle")).toEqual([])
  expect(await search("community")).toHaveLength(1)
  sourceAccess.failed=true;await expect(search("community")).rejects.toThrow("could not be verified")
 } finally {sourceAccess.blocked=[];sourceAccess.failed=false}
})
