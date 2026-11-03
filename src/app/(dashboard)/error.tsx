"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { reportPageHealthError } from "@/components/providers/page-health-reporter"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error", error)
    reportPageHealthError({
      error,
      eventType: "route_error",
      source: "error_boundary",
    })
  }, [error])

  return (
    <div className="bg-background text-foreground flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-6 text-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-balance">
            We hit a snag loading your dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-sm text-balance">
            Try again in a moment or visit our support page for help.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button className="min-h-11" onClick={() => reset()}>Retry</Button>
          <Button asChild variant="outline" className="min-h-11">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Leave the failed dashboard tree with a full document navigation. */}
            <a href="/status">Get help</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
