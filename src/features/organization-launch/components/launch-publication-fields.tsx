"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { loadLaunchPublicationReviewAction, setOrganizationPublicationAction } from "../actions"

export function LaunchPublicationFields() {
  const router = useRouter()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadLaunchPublicationReviewAction>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    let cancelled = false
    loadLaunchPublicationReviewAction().then((result) => {
      if (!cancelled) setData(result)
    }).catch(() => { if (!cancelled) setError("Couldn’t load your saved profile. Try again.") })
    return () => { cancelled = true }
  }, [revision])
  const review = data && !("error" in data.review) ? data.review : null
  const loadError = data && "error" in data.review ? data.review.error : null
  const reload = () => { setError(null); setData(null); setRevision((value) => value + 1) }
  return <div className="space-y-3 text-xs leading-4">
    {!data && !error ? <p role="status" className="text-muted-foreground">Loading your saved profile…</p> : null}
    {review ? <>
      <div className="space-y-1.5 rounded-lg border p-3">
        <p className="font-medium">{review.organization.name}</p>
        <p className="text-muted-foreground break-words">{review.organization.description || review.organization.mission || "No description yet."}</p>
        <p className="text-muted-foreground">{review.location.label}. {review.location.detail}</p>
        {review.organization.programs.length ? <><p className="pt-1 font-medium">Public programs</p><ul className="space-y-1">{review.organization.programs.map((program) => <li key={program.id}>{program.title}</li>)}</ul></> : <p className="text-muted-foreground">No programs selected for public display.</p>}
        <Link href="/workspace/profile-preview" className="focus-ring inline-flex min-h-11 items-center underline underline-offset-4">Review full profile</Link>
      </div>
      <p className="text-muted-foreground">{review.isPublic ? "Your profile is public. Making it private keeps your saved work." : "Publishing makes your profile and selected programs visible to everyone."}</p>
      {!data?.available && !review.isPublic ? <p>Public sharing isn’t available yet. Your draft is saved.</p> : null}
      {!review.organization.publicSlug ? <p>Save a profile URL name above before publishing.</p> : null}
      <Button size="sm" className="min-h-11 sm:min-h-9" variant={review.isPublic ? "outline" : "default"} disabled={pending || (!review.isPublic && (!data?.available || !review.organization.publicSlug))} onClick={() => {
        startTransition(async () => {
          setError(null); setMessage(null)
          try {
            const result = await setOrganizationPublicationAction({ revision: review.revision, isPublic: !review.isPublic })
            if ("error" in result) { setError(result.error ?? "Couldn’t save visibility."); return }
            setMessage(review.isPublic ? "Your profile is now private." : "Your profile is published.")
            reload(); router.refresh()
          } catch { setError("Couldn’t confirm the change. Reload the preview to check your saved visibility.") }
        })
      }}>{pending ? <LoaderCircleIcon aria-hidden="true" className="size-3.5 motion-safe:animate-spin" /> : null}{review.isPublic ? "Make private" : "Publish profile"}</Button>
    </> : null}
    {error || loadError ? <div role="alert" className="space-y-2"><p className="text-destructive">{error || loadError}</p><Button size="sm" variant="outline" className="min-h-11" disabled={pending} onClick={reload}>Reload preview</Button></div> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>
}
