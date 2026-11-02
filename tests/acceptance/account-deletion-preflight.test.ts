import { describe, expect, it } from "vitest"

import { getAccountDeletionPreflight } from "@/lib/account-deletion/server"

function buildCountQuery(count: number, error: { message: string } | null = null) {
  return {
    count,
    error,
    eq() {
      return this
    },
    neq() {
      return this
    },
    or() {
      return this
    },
  }
}

function buildSubscriptionQuery(subscription: Record<string, unknown> | null) {
  return {
    eq() {
      return this
    },
    in() {
      return this
    },
    not() {
      return this
    },
    order() {
      return this
    },
    limit() {
      return this
    },
    maybeSingle: async () => ({ data: subscription, error: null }),
  }
}

function buildAdminStub({
  subscription = null,
  counts = {},
}: {
  subscription?: Record<string, unknown> | null
  counts?: Record<string, number>
} = {}) {
  const from = (table: string) => {
    if (table === "subscriptions") {
      return {
        select: () => buildSubscriptionQuery(subscription),
      }
    }

    return {
      select: () => buildCountQuery(counts[table] ?? 0),
    }
  }

  return { from }
}

describe("account deletion preflight", () => {
  it("classifies free self-only accounts without billing risk", async () => {
    const preflight = await getAccountDeletionPreflight({
      admin: buildAdminStub() as never,
      userId: "free-user",
      isAdmin: false,
    })

    expect(preflight).toMatchObject({
      canDelete: true,
      accountType: "free",
      billing: {
        hasCancellationRisk: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
      counts: {
        ownedOrganizations: 0,
        joinedOrganizations: 0,
        sharedWorkspaceAuthorReferences: 0,
      },
    })
    expect(preflight.cleanupPreview).toContainEqual(
      expect.objectContaining({
        id: "profile",
        disposition: "deleted",
      }),
    )
  })

  it("surfaces paid owner, owned org, member, and shared workspace warnings", async () => {
    const preflight = await getAccountDeletionPreflight({
      admin: buildAdminStub({
        subscription: {
          status: "active",
          stripe_customer_id: "cus_paid",
          stripe_subscription_id: "sub_paid",
          metadata: { plan_tier: "organization", planName: "Organization" },
        },
        counts: {
          organizations: 1,
          organization_memberships: 2,
          organization_tasks: 4,
          organization_project_notes: 1,
          organization_access_requests: 3,
          organization_invites: 2,
        },
      }) as never,
      userId: "paid-user",
      isAdmin: false,
    })

    expect(preflight.canDelete).toBe(false)
    expect(preflight.blockingIssues).toContainEqual(expect.objectContaining({
      id: "organization-closure-required", description: expect.stringContaining("closed separately"),
    }))
    expect(preflight.accountType).toBe("paid_owner")
    expect(preflight.billing).toMatchObject({
      hasCancellationRisk: true,
      stripeCustomerId: "cus_paid",
      stripeSubscriptionId: "sub_paid",
      status: "active",
      planLabel: "Organization",
    })
    expect(preflight.counts).toMatchObject({
      ownedOrganizations: 1,
      ownedOrganizationMembers: 2,
      joinedOrganizations: 2,
      sharedWorkspaceAuthorReferences: 5,
      pendingAccessRequests: 3,
      pendingInvitesSent: 2,
    })
    expect(preflight.warnings.map((warning) => warning.id)).toEqual(
      expect.arrayContaining([
        "billing-risk",
        "joined-organizations",
        "shared-workspace-author-references",
      ]),
    )
    expect(preflight.cleanupPreview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "owned-organizations",
          count: 1,
          disposition: "retained",
        }),
        expect.objectContaining({
          id: "shared-workspace-author-references",
          count: 5,
          disposition: "retained",
        }),
      ]),
    )
  })
  it("blocks an unpaid owner too, while a non-owner remains independently deletable", async () => {
    const owner = await getAccountDeletionPreflight({ admin: buildAdminStub({ counts: { organizations: 1 } }) as never, userId: "owner", isAdmin: true })
    expect(owner.canDelete).toBe(false)
    expect(owner.blockingIssues[0]?.id).toBe("organization-closure-required")
    const member = await getAccountDeletionPreflight({ admin: buildAdminStub({ counts: { organization_memberships: 1 } }) as never, userId: "member", isAdmin: false })
    expect(member.canDelete).toBe(true)
    expect(member.counts.joinedOrganizations).toBe(1)
  })
})
