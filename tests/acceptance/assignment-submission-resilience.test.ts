import { readFileSync } from "node:fs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssignmentFormSubmitRow } from "@/components/training/module-detail/assignment-form/assignment-form-submit-row"
import {
  buildAssignmentDraft,
  readAssignmentDraft,
} from "@/components/training/module-detail/assignment-form/assignment-draft"
import { submitAssignmentWithRecovery } from "@/components/training/module-detail/assignment-submission-request"
import type { ModuleAssignmentField } from "@/lib/modules"
import { createSupabaseServerClientServerMock } from "./test-utils"

vi.mock("@/lib/organization/active-org", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/organization/active-org")>(),
  resolveActiveOrganization: async (_client: unknown, id: string) => ({ orgId: id, role: "owner" }),
}))

const fields: ModuleAssignmentField[] = [
  {
    name: "why",
    label: "Why?",
    type: "long_text",
    required: false,
  },
]

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("assignment submission resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifies a committed save after the POST response is lost", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          answers: { why: "Start Dee's Resource Center" },
          status: "submitted",
          updatedAt: "2026-08-17T19:15:00.000Z",
        })
      )

    const result = await submitAssignmentWithRecovery({
      assignmentFields: fields,
      fetcher: fetcher as typeof fetch,
      moduleId: "module-1",
      values: { why: "  Start Dee's Resource Center  " },
    })

    expect(result).toMatchObject({
      saved: true,
      message: "Saved. Verified after a connection interruption.",
      status: "submitted",
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/modules/module-1/assignment-submission",
      { method: "GET", cache: "no-store" }
    )
  })

  it("does not claim recovery when the persisted answers differ", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          answers: { why: "Older answer" },
          status: "submitted",
        })
      )

    const result = await submitAssignmentWithRecovery({
      assignmentFields: fields,
      fetcher: fetcher as typeof fetch,
      moduleId: "module-1",
      values: { why: "New answer" },
    })

    expect(result).toEqual({
      saved: false,
      error: "Unable to save. Your answers remain on this device; try again.",
    })
  })

  it("honors the legacy submissionSaved contract", async () => {
    const result = await submitAssignmentWithRecovery({
      assignmentFields: fields,
      fetcher: vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: "Homework saved, but organization details did not update.",
            submissionSaved: true,
          },
          500
        )
      ) as typeof fetch,
      moduleId: "module-1",
      values: { why: "Safe answer" },
    })

    expect(result).toMatchObject({
      saved: true,
      answers: { why: "Safe answer" },
      message: "Homework saved, but organization details did not update.",
    })
  })

  it("recovers a committed save after a generic server error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Internal error" }, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          answers: { why: "Safe answer" },
          status: "submitted",
          updatedAt: "2026-08-17T19:15:00.000Z",
        })
      )

    const result = await submitAssignmentWithRecovery({
      assignmentFields: fields,
      fetcher: fetcher as typeof fetch,
      moduleId: "module-1",
      values: { why: "Safe answer" },
    })

    expect(result).toMatchObject({
      saved: true,
      message: "Saved. Verified after a connection interruption.",
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("keeps validation errors as failures without a recovery read", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: "Missing required answers", missing: ["Why?"] },
          400
        )
      )

    const result = await submitAssignmentWithRecovery({
      assignmentFields: fields,
      fetcher: fetcher as typeof fetch,
      moduleId: "module-1",
      values: { why: "" },
    })

    expect(result).toEqual({ saved: false, error: "Please complete: Why?" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("lets current server answers outrank an unverifiable legacy draft", () => {
    expect(
      readAssignmentDraft({
        initialValues: { why: "Saved server answer" },
        raw: JSON.stringify({ values: { why: "Stale local answer" } }),
      })
    ).toBeNull()
  })

  it("restores a versioned draft only against the server state it started from", () => {
    const raw = buildAssignmentDraft({
      initialValues: { why: "Saved server answer" },
      values: { why: "New unsaved draft" },
    })

    expect(
      readAssignmentDraft({
        initialValues: { why: "Saved server answer" },
        raw,
      })
    ).toEqual({ why: "New unsaved draft" })
    expect(
      readAssignmentDraft({
        initialValues: { why: "Newer server answer" },
        raw,
      })
    ).toBeNull()
  })

  it("renders accessible save feedback and a retry action", () => {
    const savedMarkup = renderToStaticMarkup(
      React.createElement(AssignmentFormSubmitRow, {
        isStepper: true,
        hasMeta: true,
        helperText: "Saved.",
        errorMessage: null,
        statusNote: null,
        autoSaving: false,
        nextHref: null,
        currentStep: 1,
        totalSteps: 2,
        pending: false,
        onRetry: () => undefined,
      })
    )
    const errorMarkup = renderToStaticMarkup(
      React.createElement(AssignmentFormSubmitRow, {
        isStepper: true,
        hasMeta: true,
        helperText: null,
        errorMessage: "Unable to save.",
        statusNote: null,
        autoSaving: false,
        nextHref: null,
        currentStep: 1,
        totalSteps: 2,
        pending: false,
        onRetry: () => undefined,
      })
    )

    expect(savedMarkup).toContain('aria-live="polite"')
    expect(savedMarkup).toContain("Saved.")
    expect(errorMarkup).toContain("Retry save")
  })

  it("keeps save feedback visible in the Workspace stepper", () => {
    const formSource = readFileSync(
      "src/components/training/module-detail/assignment-form.tsx",
      "utf8"
    )
    const workspaceSource = readFileSync(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-step-node-card-body.tsx",
      "utf8"
    )

    expect(workspaceSource).toContain("showStepNavigation={false}")
    expect(formSource.match(/<AssignmentFormSubmitRow/g)).toHaveLength(2)
    expect(formSource).toContain("onRetry={() => onSubmit(values)}")

    const valuesHookSource = readFileSync(
      "src/components/training/module-detail/assignment-form/hooks/use-assignment-form-values.ts",
      "utf8"
    )
    expect(valuesHookSource).toContain("if (saved !== false)")
  })

  it("returns the authenticated user's persisted submission for reconciliation", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        answers: { why: "Saved server answer" },
        status: "submitted",
        updated_at: "2026-08-17T19:15:00.000Z",
      },
      error: null,
    })
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    }
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(chain),
    })
    const { GET } =
      await import("@/app/api/modules/[id]/assignment-submission/route")

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ id: "module-1" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      answers: { why: "Saved server answer" },
      status: "submitted",
      updatedAt: "2026-08-17T19:15:00.000Z",
    })
    expect(chain.eq).toHaveBeenNthCalledWith(1, "module_id", "module-1")
    expect(chain.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1")
  })

  it("rejects unauthenticated recovery reads", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })
    const { GET } =
      await import("@/app/api/modules/[id]/assignment-submission/route")

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ id: "module-1" }),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })
})
