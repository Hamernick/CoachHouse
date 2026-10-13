import Link from "next/link"

import { Button } from "@/components/ui/button"

export function PricingFeatureBreakdownIntroSection() {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <h2 className="text-balance text-3xl font-normal tracking-tight sm:text-4xl">Feature breakdown</h2>
      <p className="mt-2 text-balance text-sm text-muted-foreground sm:text-base">
        Compare Individual, Organization, and Operations Support at a glance.
      </p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
        <Button asChild className="min-h-11 rounded-full shadow-none">
          <Link href="/sign-up?intent=build">Get started</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-full shadow-none">
          <a href="mailto:joel@coachhousesolutions.org?subject=Coach%20House%20Features">Talk to us</a>
        </Button>
      </div>
    </section>
  )
}
