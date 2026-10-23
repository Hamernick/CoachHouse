import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }))

import {
  listNotificationsAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications"

const assignment = {
  id: "assignment-1",
  user_id: "viewer",
  title: "Task assigned to you",
  description: "A task was assigned.",
  href: "/tasks",
  tone: "info",
  created_at: "2026-10-03T18:00:00.000Z",
  read_at: null as string | null,
  archived_at: null as string | null,
  type: "task_assigned",
  metadata: null,
}

function mockInbox(rows = [assignment], userId: string | null = "viewer", failures: {
  inboxError?: boolean; unreadError?: boolean; totalError?: boolean; totalCount?: number | null; unreadCount?: number | null
} = {}) {
  const from = vi.fn((_table: string) => {
    const filters: Array<(row: typeof assignment) => boolean> = []
    let update: { read_at: string } | undefined
    let head = false
    let exact = false
    let unreadOnly = false
    let rowLimit = Infinity
    let descending = false
    const result = () => {
      const selected = rows.filter(row => filters.every(filter => filter(row)))
      if (update) selected.forEach(row => Object.assign(row, update))
      if (descending) selected.sort((a, b) => b.created_at.localeCompare(a.created_at))
      return {
        data: head ? null : selected.slice(0, rowLimit),
        count: exact
          ? (unreadOnly ? failures.unreadCount : failures.totalCount) === undefined
            ? selected.length
            : (unreadOnly ? failures.unreadCount : failures.totalCount)
          : null,
        error: (head ? unreadOnly ? failures.unreadError : failures.totalError : failures.inboxError)
          ? { message: "Database unavailable" } : null,
      }
    }
    const query = {
      select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
        head = options?.head ?? false
        exact = options?.count === "exact"
        return query
      }),
      eq: vi.fn((key: keyof typeof assignment, value: unknown) => {
        filters.push(row => row[key] === value)
        return query
      }),
      is: vi.fn((key: keyof typeof assignment, value: unknown) => {
        if (key === "read_at" && value === null) unreadOnly = true
        filters.push(row => row[key] === value)
        return query
      }),
      in: vi.fn((key: keyof typeof assignment, values: unknown[]) => {
        filters.push(row => values.includes(row[key]))
        return query
      }),
      order: vi.fn((_key: string, options: { ascending: boolean }) => {
        descending = !options.ascending
        return query
      }),
      limit: vi.fn((limit: number) => { rowLimit = limit; return query }),
      update: vi.fn((value: { read_at: string }) => { update = value; return query }),
      returns: vi.fn(async () => result()),
      then(resolve: (value: ReturnType<typeof result>) => unknown) {
        return Promise.resolve(result()).then(resolve)
      },
    }
    return query
  })
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from,
  })
  return { from }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe("notification inbox", () => {
  it("returns only saved notices with their unread state when platform tools are unconfigured", async () => {
    vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "")
    const { from } = mockInbox()
    const result = await listNotificationsAction()
    expect(result).toMatchObject({ ok: true, inbox: [{ id: assignment.id, type: "task_assigned", readAt: null }] })
    expect("inbox" in result && result.inbox).toHaveLength(1)
    expect(result).toMatchObject({ totalCount: 1, unreadCount: 1 })
    expect(from).toHaveBeenCalledTimes(2)
    expect(from.mock.calls.every(([table]) => table === "notifications")).toBe(true)
  })

  it("does not manufacture unread notices on repeated empty inbox loads", async () => {
    vi.stubEnv("SUPABASE_MANAGEMENT_API_TOKEN", "")
    mockInbox([])
    expect(await listNotificationsAction()).toEqual({ ok: true, inbox: [], totalCount: 0, unreadCount: 0 })
    expect(await listNotificationsAction()).toEqual({ ok: true, inbox: [], totalCount: 0, unreadCount: 0 })
  })

  it("preserves a saved read timestamp", async () => {
    const readAt = "2026-10-03T18:05:00.000Z"
    mockInbox([{ ...assignment, read_at: readAt }])
    expect(await listNotificationsAction()).toMatchObject({ inbox: [{ readAt }] })
  })

  it("counts the complete private inbox and retrieves older unread notices outside the newest All page", async () => {
    const rows = Array.from({ length: 65 }, (_, index) => ({
      ...assignment, id: `saved-${index}`,
      created_at: new Date(Date.parse(assignment.created_at) + index * 1000).toISOString(),
      read_at: index < 15 ? null : "2026-10-04T00:00:00.000Z",
    }))
    const { from } = mockInbox([
      ...rows,
      { ...assignment, id: "foreign-unread", user_id: "another-viewer" },
      { ...assignment, id: "archived-unread", archived_at: "2026-10-04T00:00:00.000Z" },
    ])
    const result = await listNotificationsAction()
    expect(result).toMatchObject({ ok: true, totalCount: 65, unreadCount: 15 })
    if ("error" in result) throw new Error(result.error)
    expect(result.inbox).toHaveLength(50)
    expect(result.inbox[0].id).toBe("saved-64")
    expect(result.inbox[49].id).toBe("saved-15")
    expect(result.inbox.every(item => item.readAt !== null)).toBe(true)
    expect(from.mock.results[0].value.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" })
    expect(from.mock.results[1].value.select).toHaveBeenCalledWith("id", { count: "exact", head: true })

    const unread = await listNotificationsAction("unread")
    expect(unread).toMatchObject({ ok: true, totalCount: 65, unreadCount: 15 })
    if ("error" in unread) throw new Error(unread.error)
    expect(unread.inbox.map(item => item.id)).toEqual(Array.from({ length: 15 }, (_, index) => `saved-${14 - index}`))
    expect(unread.inbox.every(item => item.readAt === null)).toBe(true)
  })

  it("limits the Unread page to the newest 50 matches while retaining full totals", async () => {
    mockInbox(Array.from({ length: 70 }, (_, index) => ({
      ...assignment, id: `saved-${index}`,
      created_at: new Date(Date.parse(assignment.created_at) + index * 1000).toISOString(),
      read_at: index < 65 ? null : "2026-10-04T00:00:00.000Z",
    })))
    const result = await listNotificationsAction("unread")
    expect(result).toMatchObject({ ok: true, totalCount: 70, unreadCount: 65 })
    if ("error" in result) throw new Error(result.error)
    expect(result.inbox).toHaveLength(50)
    expect(result.inbox[0].id).toBe("saved-64")
    expect(result.inbox[49].id).toBe("saved-15")
    expect(result.inbox.every(item => item.readAt === null)).toBe(true)
  })

  it("does not return a false total if the Unread tab's full-inbox count fails", async () => {
    mockInbox([{ ...assignment }], "viewer", { totalError: true })
    expect(await listNotificationsAction("unread")).toEqual({ error: "Unable to load notifications." })
  })

  it.each(["inboxError", "unreadError"] as const)("does not return misleading counts when %s occurs", async failure => {
    mockInbox([{ ...assignment }], "viewer", { [failure]: true })
    expect(await listNotificationsAction()).toEqual({ error: "Unable to load notifications." })
  })

  it.each([
    { totalCount: null }, { unreadCount: null }, { totalCount: -1 }, { unreadCount: NaN },
  ])("rejects unavailable or invalid exact counts: %j", async counts => {
    mockInbox([{ ...assignment }], "viewer", counts)
    expect(await listNotificationsAction()).toEqual({ error: "Unable to load notifications." })
  })

  it("requires authentication before either inbox count query", async () => {
    const { from } = mockInbox([], null)
    expect(await listNotificationsAction()).toEqual({ error: "Not authenticated." })
    expect(from).not.toHaveBeenCalled()
  })

  it("marks only loaded notices belonging to the viewer read, leaving new arrivals unread", async () => {
    const rows = [
      { ...assignment },
      { ...assignment, id: "arrived-after-refresh" },
      { ...assignment, id: "another-users-notice", user_id: "someone-else" },
    ]
    mockInbox(rows)
    expect(await markAllNotificationsReadAction([assignment.id, "another-users-notice"])).toEqual({ ok: true })
    expect(rows[0].read_at).toEqual(expect.any(String))
    expect(rows[1].read_at).toBeNull()
    expect(rows[2].read_at).toBeNull()
  })

  it("requires authentication for a nonempty selection", async () => {
    const { from } = mockInbox([], null)
    expect(await markAllNotificationsReadAction([assignment.id])).toEqual({ error: "Not authenticated." })
    expect(from).not.toHaveBeenCalled()
  })

  it("marks the full viewer inbox read when no selection is supplied, preserving other users and archived rows", async () => {
    const rows = [
      ...Array.from({ length: 65 }, (_, index) => ({ ...assignment, id: `unread-${index}` })),
      { ...assignment, id: "foreign-unread", user_id: "someone-else" },
      { ...assignment, id: "archived-unread", archived_at: "2026-10-04T00:00:00.000Z" },
      { ...assignment, id: "already-read", read_at: "2026-10-03T18:05:00.000Z" },
    ]
    mockInbox(rows)
    expect(await markAllNotificationsReadAction()).toEqual({ ok: true })
    expect(rows.slice(0, 65).every(row => typeof row.read_at === "string")).toBe(true)
    expect(rows[65].read_at).toBeNull()
    expect(rows[66].read_at).toBeNull()
    expect(rows[67].read_at).toBe("2026-10-03T18:05:00.000Z")
  })

  it("requires authentication for a full-inbox mark-read", async () => {
    const { from } = mockInbox([], null)
    expect(await markAllNotificationsReadAction()).toEqual({ error: "Not authenticated." })
    expect(from).not.toHaveBeenCalled()
  })

  it("does not fall back to clearing the entire inbox for an empty or oversized selection", async () => {
    expect(await markAllNotificationsReadAction([])).toEqual({ ok: true })
    expect(await markAllNotificationsReadAction(Array(51).fill(assignment.id))).toEqual({ error: "Invalid notification selection." })
    expect(createClient).not.toHaveBeenCalled()
  })
})
