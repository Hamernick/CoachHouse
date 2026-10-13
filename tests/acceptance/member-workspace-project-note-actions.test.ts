import "./test-utils"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { revalidatePathMock, resetTestMocks } from "./test-utils"

const { resolveMemberWorkspaceActorContextMock } = vi.hoisted(() => ({
  resolveMemberWorkspaceActorContextMock: vi.fn(),
}))

vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({
    resolveMemberWorkspaceActorContext: resolveMemberWorkspaceActorContextMock,
  })
)

import {
  createMemberWorkspaceProjectNoteAction,
  updateMemberWorkspaceProjectNoteAction,
} from "@/features/member-workspace/server/project-detail-actions"
import { MEMBER_WORKSPACE_UPGRADE_MESSAGE } from "@/features/member-workspace/server/access"

function createProjectQuery(project: { id: string; org_id: string }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: project,
      error: null,
    }),
  }
}

describe("member workspace project note actions", () => {
  beforeEach(() => {
    resetTestMocks()
    resolveMemberWorkspaceActorContextMock.mockReset()
  })

  it("allows platform admins to create organization notes", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const insertedPayloads: unknown[] = []
    const notesTable = {
      insert: vi.fn((payload: unknown) => {
        insertedPayloads.push(payload)
        return notesTable
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "note-admin-1" },
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_projects") {
          return projectQuery
        }
        if (table === "organization_project_notes") {
          return notesTable
        }
        throw new Error(`Unexpected table query: ${table}`)
      }),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "platform-admin-1",
      isAdmin: true,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
    })

    await expect(
      createMemberWorkspaceProjectNoteAction({
        projectId: "project-1",
        title: "Internal notes",
        content: "Keep this private to admins",
      })
    ).resolves.toEqual({
      ok: true,
      noteId: "note-admin-1",
    })

    expect(insertedPayloads[0]).toMatchObject({
      org_id: "org-1",
      project_id: "project-1",
      title: "Internal notes",
      created_by: "platform-admin-1",
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations/project-1")
  })

  it("rejects free users before loading project detail mutations", async () => {
    const supabase = {
      from: vi.fn(),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase,
      userId: "free-user-1",
      isAdmin: false,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
      hasMemberWorkspaceAccess: false,
    })

    await expect(
      createMemberWorkspaceProjectNoteAction({
        projectId: "project-1",
        title: "Free notes",
        content: "Should not write",
      })
    ).resolves.toEqual({ error: MEMBER_WORKSPACE_UPGRADE_MESSAGE })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("persists audio note type when creating uploaded audio notes", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const insertedPayloads: unknown[] = []
    const notesTable = {
      insert: vi.fn((payload: unknown) => {
        insertedPayloads.push(payload)
        return notesTable
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "note-1" },
        error: null,
      }),
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            return projectQuery
          }
          if (table === "organization_project_notes") {
            return notesTable
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "user-1",
      isAdmin: false,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
      hasMemberWorkspaceAccess: true,
    })

    await expect(
      createMemberWorkspaceProjectNoteAction({
        projectId: "project-1",
        title: "Board recording",
        content: "<p>Attached recording</p>",
        noteType: "audio",
      })
    ).resolves.toEqual({
      ok: true,
      noteId: "note-1",
    })

    expect(insertedPayloads[0]).toMatchObject({
      project_id: "project-1",
      org_id: "org-1",
      note_type: "audio",
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations/project-1")
  })

  it("updates note type when an edited note changes to audio", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const updatePayloads: unknown[] = []
    const notesTable = {
      update: vi.fn((payload: unknown) => {
        updatePayloads.push(payload)
        return notesTable
      }),
      eq: vi.fn().mockReturnThis(),
      error: null,
    }

    resolveMemberWorkspaceActorContextMock.mockResolvedValue({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "organization_projects") {
            return projectQuery
          }
          if (table === "organization_project_notes") {
            return notesTable
          }
          throw new Error(`Unexpected table query: ${table}`)
        }),
      },
      userId: "user-1",
      isAdmin: false,
      activeOrg: { orgId: "org-1", role: "owner" },
      canEdit: true,
      hasMemberWorkspaceAccess: true,
    })

    await expect(
      updateMemberWorkspaceProjectNoteAction({
        projectId: "project-1",
        noteId: "note-1",
        title: "Board recording",
        content: "<p>Updated with a recording link</p>",
        noteType: "audio",
      })
    ).resolves.toEqual({
      ok: true,
      noteId: "note-1",
    })

    expect(updatePayloads[0]).toMatchObject({
      title: "Board recording",
      note_type: "audio",
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations/project-1")
  })
})

// These fixtures represent ordinary projects; guest scope has a separate denial suite.
vi.mock("@/lib/workspace/ordinary-project-access", () => ({ isOrdinaryWorkspaceProject: async () => true }))
