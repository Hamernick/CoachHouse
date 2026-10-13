import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { BillingCheckoutButton } from "@/app/(dashboard)/billing/billing-checkout-button"

describe("billing checkout button", () => {
  it("renders a real checkout link when enabled", () => {
    const cardProps = {
          plan: "organization",
          className: "w-full rounded-xl",
        children: "Upgrade to Organization",
    } satisfies React.ComponentProps<typeof BillingCheckoutButton>
    const markup = renderToStaticMarkup(
      React.createElement(BillingCheckoutButton, cardProps),
    )

    expect(markup.startsWith("<a ")).toBe(true)
    expect(markup).toContain('href="/api/stripe/checkout?plan=organization&amp;source=billing"')
    expect(markup).toContain(">Upgrade to Organization<")
    expect(markup).not.toMatch(/\sdisabled(?:=|>)/)
  })

  it("renders a disabled button when checkout is unavailable", () => {
    const cardProps = {
          plan: "operations_support",
          disabled: true,
          variant: "secondary",
        children: "Operations plan unavailable",
    } satisfies React.ComponentProps<typeof BillingCheckoutButton>
    const markup = renderToStaticMarkup(
      React.createElement(BillingCheckoutButton, cardProps),
    )

    expect(markup).toContain("disabled")
    expect(markup).not.toContain("/api/stripe/checkout")
  })
})
