"use client"

import { lazy, Suspense } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const PublicMapClaimDialog = lazy(() =>
  import("@/features/public-map-claims").then((module) => ({
    default: module.PublicMapClaimDialog,
  }))
)

export function PublicMapAboutContent() {
  return <div className="text-muted-foreground space-y-2 text-sm leading-5">
          <p>Find local resources and run your nonprofit with shared plans, documents, and a calendar.</p>
          <p>
            Google connections are optional. Sign in with Google and manage
            your Drive connection in Workspace Tools. Drive file import and
            Google Calendar syncing are coming soon.
          </p>
  </div>
}

export function PublicMapClaimPrompt() {
  return <div className="min-h-[68px]"><Suspense fallback={null}><PublicMapClaimDialog /></Suspense></div>
}

export function PublicMapFooter({ showClaim = true }: { showClaim?: boolean }) {
  return (
    <footer aria-label="Coach House" className="mx-auto w-full max-w-xl pt-6 text-center">
      {showClaim ? <PublicMapClaimPrompt /> : null}
      <Collapsible>
        <CollapsibleContent className="text-muted-foreground space-y-2 px-2 pb-3 text-sm leading-5">
          <PublicMapAboutContent />
        </CollapsibleContent>
      <nav aria-label="Legal" className="flex items-center justify-center gap-1">
        {[["/privacy", "Privacy Policy"], ["/terms", "Terms"]].map(([href, label]) => (
          <Button
            key={href}
            asChild
            variant="link"
            size="sm"
            className="text-muted-foreground hover:text-foreground active:text-foreground focus-visible:text-foreground h-11 touch-manipulation px-2 text-xs sm:h-8"
          >
            <Link href={href}>{label}</Link>
          </Button>
        ))}
        <CollapsibleTrigger asChild>
          <Button variant="link" size="sm" className="text-muted-foreground h-11 px-2 text-xs sm:h-8">
            About
          </Button>
        </CollapsibleTrigger>
      </nav>
      </Collapsible>
    </footer>
  )
}
