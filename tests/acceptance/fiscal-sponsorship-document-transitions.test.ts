import "./test-utils"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createSupabaseAdminClientMock,
  notifyDocumentConnectedMock,
  notifyDocumentReviewedMock,
  resolveAuthenticatedAppContextMock,
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  notifyDocumentConnectedMock: vi.fn(),
  notifyDocumentReviewedMock: vi.fn(),
  resolveAuthenticatedAppContextMock: vi.fn(),
}))

vi.mock("@/lib/auth/request-context", () => ({
  resolveAuthenticatedAppContext: resolveAuthenticatedAppContextMock,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

vi.mock("@/features/fiscal-sponsorship/server/workflow-notifications", () => ({
  notifyFiscalApplicationReviewed: vi.fn(),
  notifyFiscalApplicationSubmitted: vi.fn(),
  notifyFiscalDocumentConnected: notifyDocumentConnectedMock,
  notifyFiscalDocumentReviewed: notifyDocumentReviewedMock,
}))

import {
  connectFiscalSponsorshipDocumentAsset,
  reviewFiscalSponsorshipDocument,
} from "@/features/fiscal-sponsorship/server/workflow-actions"
import { revalidatePathMock, resetTestMocks } from "./test-utils"

const DOCUMENT_UPDATED_AT = "2026-08-05T22:45:00.000Z"

function queryResult<T>(data: T) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function createWorkflowClient({
  assignedCoach = true,
  document = {
    asset_id: "asset-1",
    document_key: "budget_support",
    id: "document-1",
    kind: "application",
    mime: "application/pdf",
    review_notes: null,
    review_status: "pending",
    status: "draft",
    title: "Project budget",
    updated_at: DOCUMENT_UPDATED_AT,
  },
}: {
  assignedCoach?: boolean
  document?: Record<string, unknown>
} = {}) {
  const application = {
    id: "application-1",
    org_id: "org-1",
    project_id: "project-1",
    status: "submitted",
    updated_at: "2026-08-05T22:30:00.000Z",
  }
  const asset = {
    asset_type: "file",
    description: "Current budget",
    external_url: null,
    id: "asset-1",
    mime: "application/pdf",
    name: "Budget.pdf",
    org_id: "org-1",
    project_id: "project-1",
    size_bytes: 42_000,
    storage_path: "org-1/project-1/budget.pdf",
  }

  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn((table: string) => {
      if (table === "organization_projects") {
        return queryResult({ id: "project-1", org_id: "org-1" })
      }
      if (table === "fiscal_sponsorship_applications") {
        return queryResult(application)
      }
      if (table === "organization_project_assets") return queryResult(asset)
      if (table === "organization_coach_assignments") {
        return queryResult(assignedCoach ? { coach_user_id: "coach-1" } : null)
      }
      if (table === "fiscal_sponsorship_documents") {
        return queryResult(document)
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

function setOwnerContext(
  workflowClient: ReturnType<typeof createWorkflowClient>
) {
  resolveAuthenticatedAppContextMock.mockResolvedValue({
    activeOrg: { orgId: "org-1", role: "owner" },
    profileAudience: {
      isAdmin: false,
      isPlatformStaff: false,
      platformAccessLevel: null,
    },
    supabase: workflowClient,
    user: { id: "owner-1" },
  })
}

function setCoachContext(
  workflowClient: ReturnType<typeof createWorkflowClient>
) {
  resolveAuthenticatedAppContextMock.mockResolvedValue({
    activeOrg: { orgId: "org-other", role: "member" },
    profileAudience: {
      isAdmin: false,
      isPlatformStaff: true,
      platformAccessLevel: "coach",
    },
    supabase: { from: vi.fn() },
    user: { id: "coach-1" },
  })
  createSupabaseAdminClientMock.mockReturnValueOnce(workflowClient)
}

describe("fiscal sponsorship document transitions", () => {
  beforeEach(() => {
    resetTestMocks()
    createSupabaseAdminClientMock.mockReset()
    notifyDocumentConnectedMock.mockReset()
    notifyDocumentReviewedMock.mockReset()
    resolveAuthenticatedAppContextMock.mockReset()
  })

  it("connects an owned project asset through one atomic transition", async () => {
    const workflowClient = createWorkflowClient()
    setOwnerContext(workflowClient)
    const rpc = vi.fn().mockResolvedValue({
      data: {
        documentId: "document-1",
        documentKey: "budget_support",
        ok: true,
        transitioned: true,
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    await expect(
      connectFiscalSponsorshipDocumentAsset({
        assetId: "asset-1",
        documentKey: "budget_support",
        projectId: "project-1",
      })
    ).resolves.toEqual({ documentId: "document-1", ok: true })

    expect(rpc).toHaveBeenCalledWith(
      "connect_fiscal_sponsorship_document_transition",
      expect.objectContaining({
        p_actor_id: "owner-1",
        p_application_id: "application-1",
        p_asset_id: "asset-1",
        p_document_key: "budget_support",
        p_title: "Budget.pdf",
      })
    )
    expect(notifyDocumentConnectedMock).toHaveBeenCalledOnce()
    expect(revalidatePathMock).toHaveBeenCalledWith("/my-organization")
  })

  it("does not repeat connection notifications for the same latest asset", async () => {
    const workflowClient = createWorkflowClient()
    setOwnerContext(workflowClient)
    createSupabaseAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          documentId: "document-1",
          documentKey: "budget_support",
          ok: true,
          transitioned: false,
        },
        error: null,
      }),
    })

    await expect(
      connectFiscalSponsorshipDocumentAsset({
        assetId: "asset-1",
        documentKey: "budget_support",
        projectId: "project-1",
      })
    ).resolves.toEqual({ documentId: "document-1", ok: true })
    expect(notifyDocumentConnectedMock).not.toHaveBeenCalled()
  })

  it("reviews a scoped document with its expected revision", async () => {
    const workflowClient = createWorkflowClient()
    setCoachContext(workflowClient)
    const rpc = vi.fn().mockResolvedValue({
      data: {
        documentId: "document-1",
        documentKey: "budget_support",
        ok: true,
        transitioned: true,
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValueOnce({ rpc })

    await expect(
      reviewFiscalSponsorshipDocument({
        decision: "needs_info",
        documentId: "document-1",
        notes: "  Add projections.  ",
        projectId: "project-1",
      })
    ).resolves.toEqual({ documentId: "document-1", ok: true })

    expect(rpc).toHaveBeenCalledWith(
      "review_fiscal_sponsorship_document_transition",
      {
        p_actor_id: "coach-1",
        p_application_id: "application-1",
        p_decision: "needs_info",
        p_document_id: "document-1",
        p_expected_updated_at: DOCUMENT_UPDATED_AT,
        p_notes: "Add projections.",
      }
    )
    expect(notifyDocumentReviewedMock).toHaveBeenCalledOnce()
  })

  it("returns a retryable document error on a stale review", async () => {
    const workflowClient = createWorkflowClient()
    setCoachContext(workflowClient)
    createSupabaseAdminClientMock.mockReturnValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: { code: "stale", ok: false },
        error: null,
      }),
    })

    await expect(
      reviewFiscalSponsorshipDocument({
        decision: "accepted",
        documentId: "document-1",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      error: "This document changed. Refresh before trying again.",
    })
    expect(notifyDocumentReviewedMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("locks version, review, W-9, audit, and RLS invariants", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260805231500_atomic_fiscal_document_transitions.sql"
      ),
      "utf8"
    )

    expect(sql.match(/for update;/g)).toHaveLength(3)
    expect(sql).toContain("select coalesce(max(version), 0) + 1")
    expect(sql).toContain("v_document.updated_at is distinct from")
    expect(sql).toContain("version = coalesce(v_tax_form_version")
    expect(
      sql.match(/insert into public\.fiscal_sponsorship_events/g)
    ).toHaveLength(2)
    expect(sql).toContain(
      'drop policy if exists "fiscal_sponsorship_documents_insert"'
    )
    expect(sql).toContain(
      'drop policy if exists "fiscal_sponsorship_documents_update"'
    )
    expect(sql).not.toContain(
      'create policy "fiscal_sponsorship_documents_insert"'
    )
    expect(sql).toContain("from public, anon, authenticated")
    expect(sql.match(/to service_role;/g)).toHaveLength(2)
    expect(sql.match(/set row_security = off/g)).toHaveLength(2)
  })
})
