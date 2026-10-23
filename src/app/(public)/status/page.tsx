import type { Metadata } from "next"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { SUPPORT_EMAIL } from "@/components/app-shell/constants"
import { PublicHeader } from "@/components/public/public-header"

export const metadata: Metadata = {
  title: "System status",
  description:
    "Live status reporting is not configured for Coach House. Contact support for a current service check or help with an issue.",
  alternates: { canonical: "/status" },
}

export default function StatusPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <PublicHeader />
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-[min(960px,100%)] flex-col gap-8 px-4 pt-28 pb-12">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            System status
          </p>
          <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
            Live status reporting is not configured
          </h1>
          <p className="text-muted-foreground text-sm">
            Coach House does not currently publish automated component health.
            This page will not claim that services are healthy without measured
            checks.
          </p>
        </div>
        <Card className="border-border/60 bg-card/60 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Public status unavailable</Badge>
            <span className="text-muted-foreground text-xs">
              Contact support for a current service check.
            </span>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <h2 className="font-semibold">Need help now?</h2>
            <p className="text-muted-foreground">
              Include the affected page, the approximate time, and what you were
              trying to do. Do not send passwords, payment details, or private
              documents.
            </p>
            <a
              className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              href={`mailto:${SUPPORT_EMAIL}?subject=Coach%20House%20service%20issue`}
            >
              Email {SUPPORT_EMAIL}
            </a>
          </div>
        </Card>
      </div>
    </main>
  )
}
