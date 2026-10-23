"use client"

import { useRef, useState } from "react"
import GiftIcon from "lucide-react/dist/esm/icons/gift"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PaywallOverlay } from "./paywall-overlay"

export function FeatureUpgradeNotice({ title, children }: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <div className="@container/upgrade mx-auto my-4 w-full max-w-3xl shrink-0 px-4">
        <Alert className="border-border/70 bg-muted/30 px-3 py-3">
          <GiftIcon aria-hidden />
          <div className="col-start-2 flex min-w-0 flex-col items-start gap-3 @md/upgrade:flex-row @md/upgrade:items-center @md/upgrade:justify-between">
            <div className="min-w-0 space-y-1">
              <AlertTitle className="line-clamp-none leading-5">{title}</AlertTitle>
              <AlertDescription className="[&_p]:leading-5">
                <p>{children}</p>
              </AlertDescription>
            </div>
            <Button ref={trigger} type="button" variant="secondary" size="sm" className="h-11 shrink-0 rounded-lg shadow-none @md/upgrade:h-9" aria-haspopup="dialog" onClick={() => setOpen(true)}>
              <GiftIcon className="size-4" aria-hidden />Upgrade
            </Button>
          </div>
        </Alert>
      </div>
      <PaywallOverlay open={open} onOpenChange={setOpen} restoreFocus={() => trigger.current?.focus({ preventScroll: true })} />
    </>
  )
}
