import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  schema: vi.fn(),
  model: vi.fn(),
  modelClient: vi.fn(),
  managementClient: vi.fn(),
}))
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SUPABASE_URL: "https://project.test" } }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }))
vi.mock("openapi-fetch", () => ({ default: mocks.managementClient }))
vi.mock("openai", () => ({ default: class { constructor() { mocks.modelClient() } responses = { create: mocks.model } } }))

import { POST as generateSql } from "@/app/api/ai/sql/route"
import * as proxy from "@/app/api/supabase-proxy/[...path]/route"
import { requireSupabaseManagementAccess } from "@/lib/supabase/management-api-auth"

let access: string | null
let legacyRole: string
let user: { id: string } | null
let authError: unknown
let staffError: unknown
let staffThrows: boolean
const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "test-token")
  vi.stubEnv("OPENAI_API_KEY", "test-key")
  vi.stubGlobal("fetch", fetchMock)
  access = "developer"
  legacyRole = "member"
  user = { id: "viewer" }
  authError = null
  staffError = null
  staffThrows = false
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  mocks.server.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from: (table: string) => ({ select: () => ({ eq: (_column: string, id: string) => ({
      maybeSingle: async () => {
        expect(id).toBe("viewer")
        if (table === "profiles") return { data: { role: legacyRole }, error: null }
        expect(table).toBe("platform_staff_members")
        if (staffThrows) throw new Error("Staff unavailable")
        return { data: access === null ? null : { access_level: access }, error: staffError }
      },
    }) }) }),
  })
  mocks.managementClient.mockReturnValue({ POST: mocks.schema })
  mocks.schema.mockResolvedValue({ data: [] })
  mocks.model.mockResolvedValue({ output_text: "SELECT 1" })
  fetchMock.mockImplementation(async () => new Response(JSON.stringify([{ value: 1 }]), { status: 200 }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const proxyMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const
const routes = [
  { name: "AI", call: () => generateSql(new Request("https://app.test/api/ai/sql", {
    method: "POST", body: JSON.stringify({ prompt: "Count rows", projectRef: "project" }),
  })) },
  ...proxyMethods.map(method => ({ name: method, call: () => proxy[method](
    new Request("https://app.test/api/supabase-proxy/v1/projects/project/database/query", { method }),
    { params: Promise.resolve({ path: ["v1", "projects", "project", "database", "query"] }) },
  ) })),
]
function expectNoProviderCalls() {
  expect(mocks.managementClient).not.toHaveBeenCalled()
  expect(mocks.schema).not.toHaveBeenCalled()
  expect(mocks.modelClient).not.toHaveBeenCalled()
  expect(mocks.model).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
}

describe.each(routes)("management authority through $name", ({ name, call }) => {
  it.each([
    ["coach reassignment with legacy admin", "coach", "admin"],
    ["staff removal with legacy admin", null, "admin"],
    ["ordinary member", null, "member"],
    ["unknown staff level", "admin", "admin"],
  ])("denies %s before provider calls", async (_label, level, role) => {
    access = level; legacyRole = role!
    expect((await call()).status).toBe(403)
    expectNoProviderCalls()
  })
  it("denies anonymous requests before provider calls", async () => {
    user = null
    expect((await call()).status).toBe(401)
    expectNoProviderCalls()
  })
  it("denies authentication errors even with a user", async () => {
    authError = new Error("Auth unavailable")
    expect((await call()).status).toBe(401)
    expectNoProviderCalls()
  })
  it.each(["42P01", "PGRST205", "42501"])("fails closed for staff lookup error %s", async code => {
    staffError = { code }; legacyRole = "admin"
    expect((await call()).status).toBe(500)
    expectNoProviderCalls()
  })
  it("fails closed when staff lookup rejects", async () => {
    staffThrows = true; legacyRole = "admin"
    expect((await call()).status).toBe(500)
    expectNoProviderCalls()
  })
  it("allows current developers with legacy member roles", async () => {
    const response = await call()
    expect(response.status).toBe(200)
    if (name === "AI") {
      expect(await response.json()).toEqual({ sql: "SELECT 1" })
      expect(mocks.schema).toHaveBeenCalledTimes(1)
      expect(mocks.model).toHaveBeenCalledTimes(1)
      expect(fetchMock).not.toHaveBeenCalled()
    } else {
      expect(await response.json()).toEqual([{ value: 1 }])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.supabase.com/v1/projects/project/database/query")
      expect(mocks.model).not.toHaveBeenCalled()
    }
  })
  it("rechecks authority after reassignment and removal", async () => {
    legacyRole = "admin"
    expect((await call()).status).toBe(200)
    vi.clearAllMocks()
    access = "coach"
    expect((await call()).status).toBe(403)
    access = null
    expect((await call()).status).toBe(403)
    expectNoProviderCalls()
  })
})

describe("management configuration and project checks", () => {
  it.each([[undefined, 400], ["another-project", 403]] as const)("rejects project %s", async (project, status) => {
    const result = await requireSupabaseManagementAccess(project)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(status)
    expect(mocks.server).not.toHaveBeenCalled()
    expectNoProviderCalls()
  })
  it("fails closed without the management token", async () => {
    vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "")
    const result = await requireSupabaseManagementAccess("project")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(500)
    expectNoProviderCalls()
  })
})
