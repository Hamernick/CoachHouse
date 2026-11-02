import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { GET } from "@/app/api/roadmap/calendar.ics/route"
const event = { id: "10000000-0000-4000-8000-000000000001", title: "Meeting, planning", description: "First\nSecond", event_type: "board_meeting", starts_at: "2026-11-02T12:00:00Z", ends_at: null, all_day: false, status: "active", updated_at: "2026-11-02T10:00:00Z" }
describe("calendar feed closure RPC", () => {
 beforeEach(() => rpc.mockReset())
 it.each(["public", "internal"])("renders authorized %s projection through one atomic read", async (type) => {
  rpc.mockResolvedValue({data:[event],error:null})
  const response=await GET(new Request(`https://example.test/api/roadmap/calendar.ics?token=synthetic&type=${type}`))
  expect(response.status).toBe(200)
  expect(rpc).toHaveBeenCalledExactlyOnceWith("read_roadmap_calendar_feed",{p_token:"synthetic",p_type:type})
  expect(response.headers.get("cache-control")).toContain("no-store")
  const body=await response.text()
  expect(body).toContain("SUMMARY:Meeting\\, planning")
  expect(body).toContain("DESCRIPTION:First\\nSecond")
 })
 it("returns no calendar after closure/revocation", async () => {
  rpc.mockResolvedValue({data:null,error:null})
  const response=await GET(new Request("https://example.test/?token=synthetic"))
  expect(response.status).toBe(404)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.text()).not.toContain("VCALENDAR")
 })
 it.each([{data:null,error:{message:"private"}}, {data:[{...event,starts_at:"invalid"}],error:null}, {data:{},error:null}])("fails closed for unavailable or malformed RPC result", async (result) => {
  rpc.mockResolvedValue(result)
  const response=await GET(new Request("https://example.test/?token=synthetic"))
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("private")
 })
 it("rejects invalid scope before database admission", async () => {
  expect((await GET(new Request("https://example.test/?token=synthetic&type=other"))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
 })
})
