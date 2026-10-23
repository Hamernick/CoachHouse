import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadFindResourceQuery } from "@/features/find-resource-index/lib/client-cache"
import { loadResourceMapPages } from "@/features/find-resource-index/lib/map-pages"
import type { FindResourceCatalogResponse } from "@/features/find-resource-index/lib/catalog-query"
vi.mock("@/features/find-resource-index/lib/client-cache", () => ({ loadFindResourceQuery: vi.fn() }))
const load = vi.mocked(loadFindResourceQuery)
const url = "/api/public/resource-map/index?mode=map&limit=500&bounds=-180,-85,180,85&q=food"
const page = (ids: string[], cursor: string | null, revision = "a") => ({revision, resourceItems: ids.map(id=>({id})), page:{hasMore:Boolean(cursor),nextCursor:cursor,totalCount:502,limit:500}} as FindResourceCatalogResponse)
beforeEach(()=>load.mockReset())
describe("complete viewport marker pages",()=>{
  it("loads pins beyond 500, including shared-location members on the next page",async()=>{
    load.mockResolvedValueOnce(page(Array.from({length:500},(_,i)=>String(i)),"499")).mockResolvedValueOnce(page(["500","501"],null))
    const result=await loadResourceMapPages(url)
    expect(result.resourceItems).toHaveLength(502)
    expect(result.resourceItems.at(-1)?.id).toBe("501")
    expect(load.mock.calls[1][0]).toContain("cursor=499")
    expect(load.mock.calls[1][0]).toContain("q=food")
    expect(result.page.hasMore).toBe(false)
  })
  it("does not combine pages from different catalog revisions",async()=>{
    load.mockResolvedValueOnce(page(["a"],"a")).mockResolvedValueOnce(page(["b"],null,"b"))
    await expect(loadResourceMapPages(url)).rejects.toThrow("catalog changed")
  })
  it("stops fetching after the viewport is superseded",async()=>{
    load.mockResolvedValueOnce(page(["a"],"a"))
    await expect(loadResourceMapPages(url,false,()=>false)).rejects.toThrow("superseded")
    expect(load).toHaveBeenCalledTimes(1)
  })
  it("rejects repeating cursors instead of looping",async()=>{
    load.mockResolvedValue(page(["a"],"a"))
    await expect(loadResourceMapPages(url)).rejects.toThrow("cursor did not advance")
    expect(load).toHaveBeenCalledTimes(2)
  })
  it("surfaces later-page failures and revalidates every page on retry",async()=>{
    load.mockResolvedValueOnce(page(["a"],"a")).mockRejectedValueOnce(new Error("offline"))
    await expect(loadResourceMapPages(url,true)).rejects.toThrow("offline")
    expect(load.mock.calls.every(call=>call[1]===true)).toBe(true)
  })
})
