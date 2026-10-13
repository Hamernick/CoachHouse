"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { Button } from "@/components/ui/button"

export function CheckoutActivationStatus({
  returnHref,
  paymentRequired = false,
}: {
  returnHref: string
  paymentRequired?: boolean
}) {
  const router = useRouter()
  const attempts = useRef(0)
  const [automaticChecksFinished, setAutomaticChecksFinished] = useState(false)
  const [checking, startTransition] = useTransition()
  const refresh = () => startTransition(() => router.refresh())

  useEffect(() => {
    if (paymentRequired) return
    const timer = window.setInterval(() => {
      if (attempts.current >= 4) {
        window.clearInterval(timer)
        setAutomaticChecksFinished(true)
        return
      }
      attempts.current += 1
      startTransition(() => router.refresh())
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paymentRequired, router])

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-5">
      <section className="w-full max-w-sm space-y-5" aria-labelledby="activation-title">
        <div className="space-y-2" role="status" aria-live="polite">
          <h1 id="activation-title" className="text-xl font-semibold tracking-tight">
            {paymentRequired ? "Your upgrade needs attention" : "Finishing your upgrade"}
          </h1>
          <p className="text-muted-foreground text-sm leading-5">
            {paymentRequired
              ? "Your subscription is not active yet. Check your billing details, then check again here."
              : automaticChecksFinished
                ? "Access is taking longer to confirm. You can check again or return to your workspace."
                : "We’re confirming your access. You’ll return to your workspace when it’s ready."}
          </p>
          <p className="text-muted-foreground text-sm leading-5">You don’t need to start another purchase.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="min-h-11 rounded-lg" disabled={checking} onClick={refresh}>
            {checking ? <LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden /> : null}
            {checking ? "Checking…" : "Check again"}
          </Button>
          {paymentRequired ? <Button asChild variant="outline" size="sm" className="min-h-11 rounded-lg"><Link href="/billing">Billing details</Link></Button> : null}
          <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-lg"><Link href={returnHref}>Return to workspace</Link></Button>
        </div>
      </section>
    </main>
  )
}
