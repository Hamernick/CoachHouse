import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ load: vi.fn(), staff: vi.fn(), notFound: vi.fn() }))
vi.mock("@/features/member-workspace", () => ({ loadPlatformAdminOrganizationProjectDetailPage: mocks.load }))
vi.mock("@/features/coaching-booking", () => ({}))
vi.mock("@/features/organization-coach-assignments", () => ({}))
vi.mock("@/features/admin-organization-billing", () => ({}))
vi.mock("@/features/fiscal-sponsorship", () => ({}))
vi.mock("@/lib/admin/auth", () => ({ requirePlatformCapability: mocks.staff }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))

import ProjectPage from "@/app/(dashboard)/projects/[id]/page"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.staff.mockResolvedValue({ userId: "reviewer" })
  mocks.notFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND") })
})

describe("fiscal review route recovery", () => {
  it("renders the recoverable message on the actual project route without loading extra panels", async () => {
    mocks.load.mockResolvedValue({
      state: "fiscal-review-unavailable",
      message: "The application could not be loaded. Refresh to try again.",
    })
    const html = renderToStaticMarkup(await ProjectPage({ params: Promise.resolve({ id: "project" }) }))
    expect(html).toContain("Application unavailable")
    expect(html).toContain("The application could not be loaded. Refresh to try again.")
    expect(mocks.load).toHaveBeenCalledWith({ projectId: "project", userId: "reviewer" })
    expect(mocks.notFound).not.toHaveBeenCalled()
  })
  it("keeps denied access as not-found instead of exposing the recovery state", async () => {
    mocks.load.mockResolvedValue({ state: "not-found" })
    await expect(ProjectPage({ params: Promise.resolve({ id: "project" }) })).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
