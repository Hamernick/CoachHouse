import Link from "next/link"

import { Button } from "@/components/ui/button"

export function PricingCallToActionSection() {
  return (
    <section>
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-8 py-14 text-center">
        <h2 className="text-balance text-3xl font-normal tracking-tight sm:text-4xl">Ready to start building?</h2>
        <Button asChild className="min-h-11 rounded-full px-8 shadow-none">
          <Link href="/sign-up?intent=build">Get started</Link>
        </Button>
      </div>
    </section>
  )
}
