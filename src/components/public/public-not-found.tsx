import Link from "next/link"

import { Button } from "@/components/ui/button"

export function PublicNotFound() {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <p className="text-sm font-semibold">Coach House</p>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm font-medium tabular-nums">
            404
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-pretty text-base">
            This page may have moved or the link may be incorrect. Return home
            or explore resources to keep going.
          </p>
        </div>
        <nav
          aria-label="Page recovery"
          className="flex w-full flex-col justify-center gap-3 sm:flex-row"
        >
          <Button asChild className="min-h-11 touch-manipulation">
            <Link href="/">Return Home</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-11 touch-manipulation"
          >
            <Link href="/resources">Explore Resources</Link>
          </Button>
        </nav>
      </div>
    </main>
  )
}
