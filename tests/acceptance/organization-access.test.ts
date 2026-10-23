import { describe, expect, it } from "vitest"

import {
  buildOrganizationAccessEmailPreviews,
  buildOrganizationAccessRequestNotificationMetadata,
  readOrganizationAccessRequestNotificationMetadata,
} from "@/features/organization-access"

describe("organization access feature", () => {
  it("builds a complete preview gallery for app and auth email templates", () => {
    const previews = buildOrganizationAccessEmailPreviews("https://coachhouse.app")

    expect(previews).toHaveLength(8)
    expect(previews.map((preview) => preview.id)).toEqual(
      expect.arrayContaining([
        "organization-external-invite",
        "organization-existing-user-request",
        "supabase-confirm-sign-up",
        "supabase-invite-user",
        "supabase-magic-link",
        "supabase-change-email",
        "supabase-reset-password",
        "supabase-reauthentication",
      ]),
    )
    expect(previews.every((preview) => preview.html.includes("coach-house-logo-dark.png"))).toBe(true)
  })

  it("threads a custom review URL into the existing-user request email html", () => {
    const requestPreview = buildOrganizationAccessEmailPreviews("https://coachhouse.app").find(
      (preview) => preview.id === "organization-existing-user-request",
    )

    expect(requestPreview?.html).toContain("https://coachhouse.app/access-requests")
  })

  it("round-trips access request notification metadata", () => {
    const metadata = buildOrganizationAccessRequestNotificationMetadata({
      requestId: "request-123",
      organizationName: "South Side Youth Alliance",
      inviterName: "Joel Hamernick",
      role: "staff",
      status: "pending",
    })

    expect(readOrganizationAccessRequestNotificationMetadata(metadata)).toEqual(metadata)
  })

  it("rejects malformed access request notification metadata", () => {
    expect(
      readOrganizationAccessRequestNotificationMetadata({
        requestId: "",
        organizationName: "Coach House",
        role: "staff",
        status: "pending",
      }),
    ).toBeNull()
  })
})
