import { expect, it, vi } from "vitest"
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("@/lib/admin/organization-coach-scope", () => ({
  loadOrganizationCoachScopeStatus: async () => ({ enabled: true }),
  loadOrganizationCoachActorScope: vi.fn(),
}))
import { loadOrganizationCoachAssignmentData } from "@/features/organization-coach-assignments/server/loaders"
it("includes developer filters, excludes confirmed fixtures, and preserves assignment eligibility", async () => {
  const staff = [
    { user_id: "caleb", access_level: "developer" },
    { user_id: "joel", access_level: "coach" },
    { user_id: "7e2b7e15-5ccd-4d0c-bcdf-644a39e94f89", access_level: "coach" },
    { user_id: "47c8d9b7-880b-4dfb-84c1-8ab5cdcae522", access_level: "coach" },
    { user_id: "e5b8b0c9-656f-4db0-a44b-92fb749df186", access_level: "developer" },
  ]
  const profiles = staff.map(row => ({ id: row.user_id, full_name: row.user_id, email: null, avatar_url: null }))
  const client = { from(table: string) {
    let data: unknown[] = table === "platform_staff_members" ? staff : profiles
    const chain = {
      select() { return chain },
      in(key: string, values: string[]) {
        data = data.filter(row => values.includes((row as Record<string,string>)[key]))
        return chain
      },
      returns() { return Promise.resolve({ data, error: null }) },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data, error: null }).then(resolve) },
    }
    return chain
  } }
  const result = await loadOrganizationCoachAssignmentData({ organizationIds: [], supabase: client as never })
  expect(result.coachOptions.map(option => option.id)).toEqual(["caleb", "joel"])
  expect(result.coachOptions.find(option => option.id === "caleb")?.assignable).toBe(false)
  expect(result.coachOptions.find(option => option.id === "joel")?.assignable).toBe(true)
})
