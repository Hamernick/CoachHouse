import "./test-utils"

import { describe, expect, it, vi } from "vitest"

import { loadMemberWorkspacePersonOptionsForOrganizations } from "@/features/member-workspace/server/person-options"

describe("member workspace person options", () => {
  it("loads the organization owner and membership roles for org-scoped assignment", async () => {
    const organizationsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [{ user_id: "org-1" }],
          error: null,
        })
      ),
    }

    const membershipsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              org_id: "org-1",
              member_id: "staff-1",
              member_email: "staff@example.com",
              role: "staff",
            },
            {
              org_id: "org-1",
              member_id: "board-1",
              member_email: "board@example.com",
              role: "board",
            },
          ],
          error: null,
        })
      ),
    }

    const profilesQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "org-1",
              full_name: "Owner Person",
              avatar_url: null,
              email: "owner@example.com",
              role: "member",
            },
            {
              id: "staff-1",
              full_name: "Staff Person",
              avatar_url: null,
              email: "staff@example.com",
              role: "member",
            },
            {
              id: "board-1",
              full_name: "Board Person",
              avatar_url: null,
              email: "board@example.com",
              role: "member",
            },
          ],
          error: null,
        })
      ),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organizations") return organizationsQuery
        if (table === "organization_memberships") return membershipsQuery
        if (table === "profiles") return profilesQuery
        throw new Error(`Unexpected table query: ${table}`)
      }),
    } as never

    const options = await loadMemberWorkspacePersonOptionsForOrganizations({
      orgIds: ["org-1"],
      supabase,
    })

    expect(options).toEqual([
      expect.objectContaining({
        id: "board-1",
        name: "Board Person",
        roleLabel: "Board member",
        groupKey: "organization-team",
      }),
      expect.objectContaining({
        id: "org-1",
        name: "Owner Person",
        roleLabel: "Owner",
        groupKey: "organization-team",
      }),
      expect.objectContaining({
        id: "staff-1",
        name: "Staff Person",
        roleLabel: "Staff",
        groupKey: "organization-team",
      }),
    ])
  })

  it("includes Coach House staff ahead of the organization team when requested", async () => {
    const organizationsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [{ user_id: "org-1" }],
          error: null,
        })
      ),
    }

    const membershipsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              org_id: "org-1",
              member_id: "staff-1",
              member_email: "staff@example.com",
              role: "staff",
            },
          ],
          error: null,
        })
      ),
    }

    const platformStaffQuery = {
      select: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              user_id: "platform-admin-1",
              access_level: "developer",
            },
            {
              user_id: "platform-admin-2",
              access_level: "coach",
            },
            { user_id: "7e2b7e15-5ccd-4d0c-bcdf-644a39e94f89", access_level: "coach" },
          ],
          error: null,
        })
      ),
    }

    const profilesByIdQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "org-1",
              full_name: "Owner Person",
              avatar_url: null,
              email: "owner@example.com",
              role: "member",
            },
            {
              id: "staff-1",
              full_name: "Staff Person",
              avatar_url: null,
              email: "staff@example.com",
              role: "member",
            },
            {
              id: "platform-admin-1",
              full_name: "Alex Admin",
              avatar_url: null,
              email: "alex.admin@example.com",
              role: "admin",
            },
            {
              id: "7e2b7e15-5ccd-4d0c-bcdf-644a39e94f89",
              full_name: "Test Coach",
              email: "test@example.com",
              avatar_url: null,
              role: "admin",
            },
            {
              id: "platform-admin-2",
              full_name: " ",
              avatar_url: null,
              email: "paula.admin@example.com",
              role: "admin",
            },
          ],
          error: null,
        })
      ),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organizations") return organizationsQuery
        if (table === "organization_memberships") return membershipsQuery
        if (table === "platform_staff_members") return platformStaffQuery
        if (table === "profiles") return profilesByIdQuery
        throw new Error(`Unexpected table query: ${table}`)
      }),
    } as never

    const options = await loadMemberWorkspacePersonOptionsForOrganizations({
      orgIds: ["org-1"],
      supabase,
      includePlatformAdmins: true,
    })

    expect(options[0]).toMatchObject({
      id: "platform-admin-1",
      groupKey: "platform-admins",
      groupLabel: "Coach House staff",
      roleLabel: "Developer",
    })
    expect(options[1]).toMatchObject({
      id: "platform-admin-2",
      groupKey: "platform-admins",
      roleLabel: "Coach",
    })
    expect(options[1].name).toBe("paula.admin@example.com")
    expect(options.some((option) => option.name === "Test Coach")).toBe(false)
    expect(options.some((option) => option.id === "staff-1")).toBe(true)
  })
})
