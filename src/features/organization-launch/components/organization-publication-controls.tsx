"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { setOrganizationPublicationAction } from "../actions"

export function OrganizationPublicationControls({ revision, isPublic, available, publicHref, hasSlug, returnHref }: {
  returnHref: string
  revision: string
  isPublic: boolean
  available: boolean
  publicHref: string | null
  hasSlug: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const saving = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  function save(next: boolean) {
    if (saving.current) return
    saving.current = true
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await setOrganizationPublicationAction({ revision, isPublic: next })
        if ("error" in result) { setError(result.error ?? "Couldn’t update visibility. Try again."); return }
        setMessage(next ? "Your profile is published. Selected programs are public too." : "Your profile is private. Your programs and saved work are kept.")
        router.refresh()
      } catch {
        setError("We couldn’t confirm the change. Reload to check your saved visibility before trying again.")
      } finally {
        saving.current = false
      }
    })
  }
  return (
    <div className="bg-background sticky bottom-0 space-y-3 border-t p-4 sm:px-6">
      {error ? <div role="alert" className="text-destructive flex flex-wrap items-center gap-2 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={() => { setError(null); router.refresh() }} disabled={pending}>Reload preview</Button></div> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {!available && !isPublic ? <p className="text-muted-foreground text-sm">Public sharing isn’t available yet. Your draft is saved.</p> : null}
      {!hasSlug && !isPublic ? <p className="text-muted-foreground text-sm">Choose a public profile URL in your organization settings before publishing.</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" className="min-h-11"><Link href={returnHref}>{isPublic || message ? "Back to setup" : "Keep private"}</Link></Button>
        {isPublic ? <>
          <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => save(false)}>{pending ? "Saving…" : "Make private"}</Button>
          {publicHref ? <Button asChild className="min-h-11"><a href={publicHref} target="_blank" rel="noreferrer">View public profile</a></Button> : null}
        </> : <Button className="min-h-11" disabled={pending || !available || !hasSlug} onClick={() => save(true)}>{pending ? "Publishing…" : "Publish profile"}</Button>}
      </div>
    </div>
  )
}
