import "./test-utils"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSupabaseAdminClientMock } = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

import { transitionOrganizationProjectDeletion } from "@/features/member-workspace/server/project-deletion-transition-support"

const input = {
  actorId: "owner-1",
  expectedOrgId: "org-1",
  expectedUpdatedAt: "2026-08-06T00:31:00.000Z",
  projectId: "project-1",
}

describe("member workspace project deletion transitions", () => {
  beforeEach(() => createSupabaseAdminClientMock.mockReset())

  it("deletes through one scoped service RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, projectId: "project-1" },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })
    await expect(transitionOrganizationProjectDeletion(input)).resolves.toEqual(
      { ok: true, projectId: "project-1" }
    )
    expect(rpc).toHaveBeenCalledWith("delete_organization_project_transition", {
      p_actor_id: "owner-1",
      p_expected_org_id: "org-1",
      p_expected_updated_at: "2026-08-06T00:31:00.000Z",
      p_project_id: "project-1",
    })
  })

  it("rejects a canonical row under the deletion lock", async () => {
    createSupabaseAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { code: "canonical", ok: false },
        error: null,
      }),
    })
    await expect(transitionOrganizationProjectDeletion(input)).resolves.toEqual(
      {
        error:
          "Canonical organization records cannot be deleted from this screen.",
      }
    )
  })

  it("locks scope, revision, and canonical protection before deletion", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260806007000_atomic_organization_project_deletion.sql"
      ),
      "utf8"
    )
    expect(sql).toContain("for update;")
    expect(sql).toContain("v_project.updated_at is distinct from")
    expect(sql).toContain("v_project.canonical_org_id is not null")
    expect(sql).toContain("delete from public.organization_projects")
    expect(sql).toContain("from public, anon, authenticated;")
    expect(sql).toContain("to service_role;")
  })

  it("routes standard deletion through the atomic transition", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/server/project-actions.ts"
      ),
      "utf8"
    )
    const deletionSource = source
      .split("export async function deleteMemberWorkspaceProjectAction")[1]
      .split(
        "export async function clearMemberWorkspaceStarterDataAction"
      )[0]
    expect(deletionSource).toContain("transitionOrganizationProjectDeletion")
    expect(deletionSource).toContain("expectedUpdatedAt:")
    expect(deletionSource).not.toContain(
      '.from("organization_projects")\n    .delete('
    )
  })
})
