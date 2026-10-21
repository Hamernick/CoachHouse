import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { AdminOrganizationBillingPanel } from "@/features/admin-organization-billing"
import {
  formatAdminOrganizationBillingCurrency,
  resolveAdminOrganizationBillingPlan,
} from "@/features/admin-organization-billing/lib"
import type { AdminOrganizationBillingState } from "@/features/admin-organization-billing/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const readyBilling: AdminOrganizationBillingState = {
  mode: "ready",
  summary: {
    cancelAtPeriodEnd: false,
    currency: "usd",
    currentPeriodEnd: "2026-09-05T19:24:58.000Z",
    dashboardUrl: "https://dashboard.stripe.com/customers/cus_123",
    latestPayment: {
      amountCents: 5800,
      createdAt: "2026-08-05T19:24:59.000Z",
      currency: "usd",
      refundableAmountCents: 3800,
      refundedAmountCents: 2000,
      status: "succeeded",
    },
    orgId: "org-1",
    plan: "organization",
    priceAmountCents: 2000,
    status: "active",
  },
}

describe("admin organization billing", () => {
  it("renders live plan, renewal, payment, and guarded actions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminOrganizationBillingPanel, {
        billing: readyBilling,
        changePlanAction: async () => ({ ok: true as const }),
        refundLatestPaymentAction: async () => ({ ok: true as const }),
      })
    )

    expect(markup).toContain("Live Stripe subscription and payment status.")
    expect(markup).toContain("Organization · $20.00/month")
    expect(markup).toContain("Next Renewal")
    expect(markup).toContain("$58.00 · Succeeded")
    expect(markup).toContain("Change to Operations Support…")
    expect(markup).toContain("Refund $38.00")
    expect(markup).toContain("Open Stripe")

  })

  it("shows a recovery path when no subscription is linked", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminOrganizationBillingPanel, {
        billing: { mode: "none", orgId: "org-1" },
        changePlanAction: async () => ({ ok: true as const }),
        refundLatestPaymentAction: async () => ({ ok: true as const }),
      })
    )

    expect(markup).toContain("No paid Stripe subscription is linked")
    expect(markup).toContain("Open Stripe Customers")
  })

  it("resolves live Stripe prices before falling back to metadata", () => {
    expect(
      resolveAdminOrganizationBillingPlan({
        metadataPlan: "operations_support",
        operationsSupportPriceId: "price_58",
        organizationPriceId: "price_20",
        priceId: "price_20",
      })
    ).toBe("organization")
    expect(
      resolveAdminOrganizationBillingPlan({
        metadataPlan: "operations_support",
        operationsSupportPriceId: "price_58",
        organizationPriceId: "price_20",
        priceId: "price_legacy",
      })
    ).toBe("operations_support")
    expect(
      formatAdminOrganizationBillingCurrency({
        amountCents: 5800,
        currency: "usd",
        locale: "en-US",
      })
    ).toBe("$58.00")
  })

  it("keeps billing mutations developer-only, idempotent, and non-prorated", () => {
    const actions = readFileSync(
      join(
        process.cwd(),
        "src/features/admin-organization-billing/server/actions.ts"
      ),
      "utf8"
    )
    const context = readFileSync(
      join(
        process.cwd(),
        "src/features/admin-organization-billing/server/context.ts"
      ),
      "utf8"
    )
    const loader = readFileSync(
      join(
        process.cwd(),
        "src/features/admin-organization-billing/server/loaders.ts"
      ),
      "utf8"
    )
    const route = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/organizations/[id]/page.tsx"),
      "utf8"
    )
    const rightPanel = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-right-meta-panel.tsx"
      ),
      "utf8"
    )

    expect(actions.match(/await requireAdmin\(\)/g)).toHaveLength(2)
    expect(actions).toContain('proration_behavior: "none"')
    expect(actions).toContain("items: [{ id: item.id, price: priceId")
    expect(actions).toContain("charge: latestPayment.charge.id")
    expect(actions).toContain("idempotencyKey")
    expect(context).toContain("client.invoicePayments.list")
    expect(context).toContain('status: "paid"')
    expect(context).toContain("MissingLinkedStripeSubscriptionError")
    expect(loader).toContain(
      "error instanceof MissingLinkedStripeSubscriptionError"
    )
    expect(loader).toContain(
      'logger.warn("admin_organization_billing_link_unavailable"'
    )
    expect(loader).toContain(
      'logger.error("admin_organization_billing_load_failed"'
    )
    expect(route).toContain('staff.accessLevel === "developer"')
    expect(route).toContain("await Promise.all([")
    expect(route).toContain(
      "loadFiscalSponsorshipProjectWorkflowSummary(result.project.id)"
    )
    expect(route).toContain(
      "loadAdminOrganizationBilling(result.organizationSummary.orgId)"
    )
    expect(route).toContain("<AdminOrganizationBillingPanel")
    expect(rightPanel).toContain("{adminBilling}")
  })
})
