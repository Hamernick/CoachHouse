import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PaywallOverlay } from "@/components/paywall/paywall-overlay"

import {
  buildStripeCheckoutPath,
  buildDismissedPaywallHref,
  getSafeInternalPaywallPath,
  resolvePaywallOverlayDisplayPlanTier,
  shouldAutoDismissPaywallOverlay,
} from "@/components/paywall/paywall-overlay/config"

describe("paywall overlay query handling", () => {
  it("strips paywall query keys and preserves unrelated params", () => {
    const href = buildDismissedPaywallHref({
      pathname: "/organization",
      searchParams: new URLSearchParams(
        "paywall=organization&plan=organization&source=accelerator&upgrade=accelerator-access&checkout_error=checkout_failed&paywall_preview=1&redirect=%2Fworkspace&cancel=%2Ffind&foo=bar",
      ),
    })

    expect(href).toBe("/organization?foo=bar")
  })

  it("auto-dismisses stale paywall overlays for paid plans", () => {
    expect(
      shouldAutoDismissPaywallOverlay({
        currentPlanTier: "organization",
        paywallKind: "organization",
      }),
    ).toBe(true)
    expect(
      shouldAutoDismissPaywallOverlay({
        currentPlanTier: "operations_support",
        paywallKind: "accelerator",
      }),
    ).toBe(true)
  })

  it("keeps preview paywalls open for platform-admin testing", () => {
    expect(
      shouldAutoDismissPaywallOverlay({
        currentPlanTier: "organization",
        paywallKind: "organization",
        preview: true,
      }),
    ).toBe(false)
  })

  it("renders preview paywalls as free-plan dialogs so admins can test upgrade CTAs", () => {
    expect(
      resolvePaywallOverlayDisplayPlanTier({
        currentPlanTier: "organization",
        preview: true,
      }),
    ).toBe("free")
    expect(
      resolvePaywallOverlayDisplayPlanTier({
        currentPlanTier: "operations_support",
        preview: false,
      }),
    ).toBe("operations_support")
  })

  it("builds safe Stripe checkout paths with sidebar return targets", () => {
    expect(
      buildStripeCheckoutPath({
        plan: "organization",
        source: "sidebar_upgrade",
        redirectTarget: "/workspace",
        cancelTarget: "/find",
      }),
    ).toBe(
      "/api/stripe/checkout?plan=organization&source=sidebar_upgrade&redirect=%2Fworkspace&cancel=%2Ffind",
    )
  })

  it("drops unsafe paywall redirect targets before checkout", () => {
    expect(getSafeInternalPaywallPath("https://bad.example")).toBeNull()
    expect(getSafeInternalPaywallPath("//bad.example/path")).toBeNull()
    expect(getSafeInternalPaywallPath("/workspace")).toBe("/workspace")
    expect(getSafeInternalPaywallPath("/\\bad.example")).toBeNull()
    expect(getSafeInternalPaywallPath("/\t/bad.example")).toBeNull()
    expect(
      buildStripeCheckoutPath({
        plan: "operations_support",
        source: null,
        redirectTarget: "https://bad.example",
        cancelTarget: "//bad.example",
      }),
    ).toBe("/api/stripe/checkout?plan=operations_support&source=billing")
  })

  it("keeps the overlay open for free plans or when there is no paywall query", () => {
    expect(
      shouldAutoDismissPaywallOverlay({
        currentPlanTier: "free",
        paywallKind: "organization",
      }),
    ).toBe(false)
    expect(
      shouldAutoDismissPaywallOverlay({
        currentPlanTier: "organization",
        paywallKind: null,
      }),
    ).toBe(false)
  })
})


const overlayMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  query: "drawer=people&focus=team",
  onOpenChange: null as null | ((open: boolean) => void),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({ replace: overlayMocks.replace }),
  useSearchParams: () => new URLSearchParams(overlayMocks.query),
}))
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => {
    overlayMocks.onOpenChange = onOpenChange
    return open ? children : null
  },
  DialogContent: ({ children, className }: { children: ReactNode; className: string }) => createElement("section", { className }, children),
  DialogClose: ({ children }: { children: ReactNode }) => children,
  DialogHeader: ({ children }: { children: ReactNode }) => children,
  DialogTitle: ({ children }: { children: ReactNode }) => children,
  DialogDescription: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/paywall/paywall-overlay/paywall-tier-card", () => ({
  PaywallTierCard: ({ redirectTarget, cancelTarget }: { redirectTarget: string; cancelTarget: string }) => createElement("div", { "data-return": redirectTarget, "data-cancel": cancelTarget }),
}))

describe("in-place pricing overlay", () => {
  beforeEach(() => {
    overlayMocks.replace.mockReset()
    overlayMocks.query = "drawer=people&focus=team"
    overlayMocks.onOpenChange = null
  })

  it("closes locally without routing and retains the exact workspace return URL", () => {
    const onOpenChange = vi.fn()
    const markup = renderToStaticMarkup(createElement(PaywallOverlay, { open: true, onOpenChange }))
    expect(markup).toContain("h-dvh")
    expect(markup).not.toContain("Back to workspace")
    expect(markup).not.toContain("Open billing settings")
    expect(markup).toContain('aria-label="Close pricing"')
    expect(markup).toContain('data-return="/workspace?drawer=people&amp;focus=team"')
    expect(markup).toContain('data-cancel="/workspace?drawer=people&amp;focus=team"')
    overlayMocks.onOpenChange?.(false)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(overlayMocks.replace).not.toHaveBeenCalled()
  })

  it("keeps a locally closed overlay closed even when another paywall owns the URL", () => {
    overlayMocks.query = "paywall=organization&drawer=people"
    expect(renderToStaticMarkup(createElement(PaywallOverlay, { open: false, onOpenChange: vi.fn() }))).toBe("")
  })

  it("preserves legacy query-driven paywall dismissal", () => {
    overlayMocks.query = "paywall=organization&drawer=people"
    renderToStaticMarkup(createElement(PaywallOverlay))
    overlayMocks.onOpenChange?.(false)
    expect(overlayMocks.replace).toHaveBeenCalledWith("/workspace?drawer=people", { scroll: false })
  })
})
