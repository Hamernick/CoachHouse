import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { CalendarError } from "@/features/google-calendar/types"

const calendarSecret = "calendar-scheduler-secret-".repeat(2)
const vercelSecret = "vercel-scheduler-secret-".repeat(2)
const mocks = vi.hoisted(() => ({
  env: { GOOGLE_CALENDAR_CRON_SECRET: "" },
  admin: vi.fn(), config: vi.fn(), sync: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: mocks.env }))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: vi.fn() }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: vi.fn() }))
vi.mock("@/features/google-calendar/server/config", () => ({
  calendarConfig: mocks.config, CALENDAR_LIST_SCOPE: "list", CALENDAR_READ_SCOPE: "read",
}))
vi.mock("@/features/google-calendar/server/service", () => ({
  calendarChoices: vi.fn(), calendarSummary: vi.fn(), disconnectCalendar: vi.fn(),
  personalCalendarEvents: vi.fn(), saveCalendarSettings: vi.fn(), setCalendarEnabled: vi.fn(),
}))
vi.mock("@/features/google-calendar/server/oauth", () => ({
  completeCalendarConnection: vi.fn(), startCalendarConnection: vi.fn(),
}))
vi.mock("@/features/google-calendar/server/sync", () => ({ syncCalendar: mocks.sync }))
import { calendarCron } from "@/features/google-calendar/server/actions"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.env.GOOGLE_CALENDAR_CRON_SECRET = calendarSecret
  vi.stubEnv("CRON_SECRET", vercelSecret)
  mocks.sync.mockResolvedValue({ complete: true })
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ user_id: "calendar-user" }], error: null }),
  }
  mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(query) })
})
afterEach(() => { vi.unstubAllEnvs() })

function request(authorization?: string) {
  return new NextRequest("https://coachhouse.app/api/integrations/google-calendar/cron", {
    headers: authorization === undefined ? {} : { authorization },
  })
}

describe("Calendar scheduler authentication", () => {
  it.each([calendarSecret, vercelSecret])("runs the existing bounded sync with either configured scheduler credential", async (secret) => {
    const result = await calendarCron(request(`Bearer ${secret}`))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ processed: 1 })
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith("calendar-user", expect.any(Number))
  })

  it.each([undefined, "Bearer wrong-key", `Basic ${vercelSecret}`, vercelSecret])("rejects an unauthenticated or forged scheduler before any database/provider work", async (authorization) => {
    expect((await calendarCron(request(authorization))).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it.each(["", "short-key"])("rejects missing or short configured credentials", async (secret) => {
    mocks.env.GOOGLE_CALENDAR_CRON_SECRET = secret
    vi.stubEnv("CRON_SECRET", secret)
    expect((await calendarCron(request(`Bearer ${secret}`))).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it("retains the configuration/activation gate for a valid Vercel invocation", async () => {
    mocks.config.mockImplementation(() => { throw new CalendarError("not_configured", 503) })
    expect((await calendarCron(request(`Bearer ${vercelSecret}`))).status).toBe(503)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
