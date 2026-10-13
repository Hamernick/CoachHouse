"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { reportPageHealthError } from "@/components/providers/page-health-reporter"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error("App route error", error)
    if (process.env.NODE_ENV === "development" && error.stack) {
      console.error("App route error stack", error.stack)
    }
    reportPageHealthError({
      error,
      eventType: "route_error",
      source: "error_boundary",
    })
  }, [error])

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Our team has been notified. You can try again or return to your
        workspace.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/workspace">Return to Workspace</Link>
        </Button>
      </div>
    </div>
  )
}
