import Link from "next/link"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import SproutIcon from "lucide-react/dist/esm/icons/sprout"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function DocumentationFundingBanner() {
  return (
    <section
      aria-labelledby="documentation-funding-title"
      className="my-4 flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <SproutIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="documentation-funding-title" className="text-base font-medium">Fund your first project</h2>
            <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">New</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Explore fiscal sponsorship and see whether your project fits.</p>
        </div>
      </div>
      <Button asChild variant="outline" className="min-h-11 shrink-0 self-start rounded-full shadow-none sm:self-center">
        <Link href="/documentation/fiscal-sponsorship">See requirements<ArrowRightIcon aria-hidden /></Link>
      </Button>
    </section>
  )
}
