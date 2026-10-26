"use client"

import { LoaderCircleIcon, RefreshCwIcon, type LucideIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { CompanionSession } from "../hooks/use-companion-session"

export function PendingIcon({ active, fallback: Icon }: { active: boolean; fallback: LucideIcon }) {
  return active ? <LoaderCircleIcon data-icon="inline-start" className="motion-safe:animate-spin" aria-hidden="true" /> : <Icon data-icon="inline-start" aria-hidden="true" />
}

export function CompanionStatus({ session }: { session: CompanionSession }) {
  return <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-3">
    {session.error && <Alert variant="destructive">
      <AlertTitle>Action needs attention</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{session.error}</p>
        <p>Your unsaved edits are preserved. For a conflict, load the latest saved version and review your changes before saving again.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={Boolean(session.pending)} onClick={() => void session.retry()}>Retry action</Button>
          <Button variant="outline" disabled={Boolean(session.pending)} onClick={() => void session.refresh()}><RefreshCwIcon data-icon="inline-start" />Load latest saved state</Button>
        </div>
      </AlertDescription>
    </Alert>}
    {session.notice && !session.error && <p className="text-sm leading-6 text-muted-foreground">{session.notice}</p>}
  </div>
}
