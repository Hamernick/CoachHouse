"use client"

import { useCallback, useEffect, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import XIcon from "lucide-react/dist/esm/icons/x"

import {
  OVERLAY_TIERS,
  buildDismissedPaywallHref,
  getCheckoutErrorMessage,
  getSafeInternalPaywallPath,
  resolvePaywallOverlayDisplayPlanTier,
  shouldAutoDismissPaywallOverlay,
} from "@/components/paywall/paywall-overlay/config"
import { PaywallTierCard } from "@/components/paywall/paywall-overlay/paywall-tier-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"

type PaywallOverlayProps = {
  currentPlanTier?: PricingPlanTier
  open?: boolean
  onOpenChange?: (open: boolean) => void
  restoreFocus?: () => void
}

export function PaywallOverlay({ currentPlanTier = "free", open, onOpenChange, restoreFocus }: PaywallOverlayProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const isLocalOverlay = open !== undefined
  const paywallKind = isLocalOverlay ? "organization" : searchParams.get("paywall")
  const source = isLocalOverlay ? "sidebar_upgrade" : searchParams.get("source")
  const isOpen = open ?? Boolean(paywallKind)
  const isPreview = searchParams.get("paywall_preview") === "1"
  const currentHref = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`
  const redirectTarget = isLocalOverlay ? currentHref : getSafeInternalPaywallPath(searchParams.get("redirect"))
  const cancelTarget = isLocalOverlay ? currentHref : getSafeInternalPaywallPath(searchParams.get("cancel"))
  const checkoutErrorCode = searchParams.get("checkout_error")
  const checkoutErrorDetail = searchParams.get("checkout_detail")
  const checkoutErrorDebug = searchParams.get("checkout_debug")
  const checkoutErrorMessage = getCheckoutErrorMessage(checkoutErrorCode)
  const dismissHref = useMemo(
    () => buildDismissedPaywallHref({ pathname, searchParams }),
    [pathname, searchParams],
  )
  const shouldAutoDismiss = shouldAutoDismissPaywallOverlay({
    currentPlanTier,
    paywallKind,
    preview: isPreview,
  })
  const displayPlanTier = resolvePaywallOverlayDisplayPlanTier({
    currentPlanTier,
    preview: isPreview,
  })

  const close = useCallback(() => {
    if (isLocalOverlay) {
      onOpenChange?.(false)
      return
    }
    router.replace(dismissHref, { scroll: false })
  }, [dismissHref, isLocalOverlay, onOpenChange, router])

  useEffect(() => {
    if (!shouldAutoDismiss) return
    close()
  }, [close, shouldAutoDismiss])

  if (shouldAutoDismiss) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        data-pricing-overlay="true"
        showCloseButton={false}
        overlayClassName="motion-reduce:animate-none"
        onCloseAutoFocus={restoreFocus ? (event) => { event.preventDefault(); restoreFocus() } : undefined}
        className={cn(
          "[--background:var(--surface)] flex max-h-[92vh] w-[min(1240px,96vw)] max-w-[1240px] flex-col gap-0 overflow-hidden rounded-3xl border border-border/70 p-0 sm:max-w-[1240px] motion-reduce:animate-none",
          isLocalOverlay && "inset-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-none sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
        )}
      >
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4 z-10 size-9 rounded-md" aria-label="Close pricing">
            <XIcon className="size-4" aria-hidden />
          </Button>
        </DialogClose>
        <DialogTitle className="sr-only">Choose your plan</DialogTitle>
        <DialogDescription className="sr-only">Compare plans and upgrade your workspace.</DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-[min(1000px,92%)] flex-col gap-6 py-20 sm:py-24">
            {checkoutErrorMessage ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <p>{checkoutErrorMessage}</p>
                {checkoutErrorDetail || checkoutErrorDebug ? (
                  <p className="mt-1 text-xs opacity-80">
                    {checkoutErrorDetail ? `Reason: ${checkoutErrorDetail}. ` : ""}
                    {checkoutErrorDebug ? `Ref: ${checkoutErrorDebug}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {OVERLAY_TIERS.map((tier) => (
                <PaywallTierCard
                  key={tier.id}
                  tier={tier}
                  currentPlanTier={displayPlanTier}
                  source={source}
                  redirectTarget={redirectTarget}
                  cancelTarget={cancelTarget}
                />
              ))}
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
