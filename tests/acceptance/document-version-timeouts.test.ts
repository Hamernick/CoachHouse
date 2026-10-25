import { afterEach, describe, expect, it, vi } from "vitest"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
const mocks=vi.hoisted(()=>({create:vi.fn()}))
vi.mock("@supabase/supabase-js",()=>({createClient:mocks.create}))
vi.mock("@/lib/env",()=>({env:{SUPABASE_SERVICE_ROLE_KEY:"fixture-only",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid"}}))
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
describe("bounded version storage requests",()=>{
  it("preserves ordinary admin clients and isolated actor headers",()=>{
    createSupabaseAdminClient()
    expect(mocks.create.mock.calls[0][2].global).toBeUndefined()
    createSupabaseAdminClient({actorId:"verified-actor"})
    expect(mocks.create.mock.calls[1][2].global).toEqual({headers:{"x-coach-house-actor-id":"verified-actor"}})
  })
  it("bounds explicitly configured requests while preserving caller cancellation",async()=>{
    const network=vi.fn().mockResolvedValue(new Response("ok"))
    vi.stubGlobal("fetch",network)
    createSupabaseAdminClient({actorId:"verified-actor",requestTimeoutMs:10000})
    const options=mocks.create.mock.calls[0][2]
    const controller=new AbortController()
    await options.global.fetch("https://fixture.invalid/storage",{signal:controller.signal})
    const signal=network.mock.calls[0][1].signal as AbortSignal
    expect(signal.aborted).toBe(false)
    controller.abort()
    expect(signal.aborted).toBe(true)
    expect(options.global.headers).toEqual({"x-coach-house-actor-id":"verified-actor"})
  })
  it("rejects invalid request budgets",()=>{
    for(const requestTimeoutMs of [0,-1,30001,NaN,1.5]) expect(()=>createSupabaseAdminClient({requestTimeoutMs})).toThrow("timeout")
  })
})
