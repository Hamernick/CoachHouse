import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, from, request } = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), request: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc, from }),
}))
vi.mock("@/features/google-calendar/server/google-api", () => ({
  calendarRequest: request,
}))

import { canExportOrganization, type Connection } from "@/features/google-calendar/server/store"
import { exportBoardEvents } from "@/features/google-calendar/server/sync-export"

describe("organization closure Calendar export admission", () => {
  beforeEach(() => vi.resetAllMocks())

  it("uses current server admission even for the organization owner and fails closed", async () => {
    for (const result of [
      { data: true, error: null },
      { data: false, error: null },
      { data: null, error: null },
      { data: true, error: { code: "PGRST202" } },
    ]) {
      rpc.mockResolvedValueOnce(result)
      expect(await canExportOrganization("owner", "owner"))
        .toBe(result.data === true && !result.error)
    }
    expect(rpc).toHaveBeenCalledWith("authorize_organization_calendar_export", {
      p_actor_id: "owner", p_org_id: "owner",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("denies closed export before loading organization content or calling Google", async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const persist = vi.fn()
    await expect(exportBoardEvents("synthetic", {
      user_id: "owner", export_org_id: "organization",
    } as Connection, { selected: [], caches: {}, destinations: {} }, vi.fn(), persist))
      .rejects.toMatchObject({ code: "access_lost" })
    expect(from).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it("rechecks closure before the next provider effect after an admitted content read", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.range.mockResolvedValue({ data: [], error: null })
    from.mockReturnValue(query)
    const persist = vi.fn()
    const state = { selected: [], caches: {}, destinations: {} }
    await expect(exportBoardEvents("synthetic", {
      user_id: "owner", export_org_id: "organization", time_zone: "UTC",
    } as Connection, state, vi.fn(), persist)).rejects.toMatchObject({ code: "access_lost" })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(from).toHaveBeenCalledWith("roadmap_calendar_internal_events")
    expect(request).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
    expect(state.destinations).toEqual({})
  })
})
