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
      <Alert className="border-border/70 bg-muted/30">
        <GiftIcon aria-hidden />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <p>{children}</p>
          <Button ref={trigger} type="button" variant="secondary" size="sm" className="rounded-lg shadow-none" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <GiftIcon className="size-4" aria-hidden />Upgrade
          </Button>
        </AlertDescription>
      </Alert>
      <PaywallOverlay open={open} onOpenChange={setOpen} restoreFocus={() => trigger.current?.focus({ preventScroll: true })} />
    </>
  )
}
