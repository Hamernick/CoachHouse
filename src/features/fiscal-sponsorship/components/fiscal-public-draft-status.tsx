"use client"

import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { GuestDraftState } from "../lib/guest-draft-controller"

export function FiscalPublicLeaveDialog({ open, onCancel, onLeave }: {
  open: boolean; onCancel: () => void; onLeave: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <AlertDialogContent className="rounded-2xl shadow-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your latest answers haven’t been confirmed as saved. Stay here to keep them.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="shadow-none">Stay here</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave} className="shadow-none">Leave page</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function FiscalPublicDraftStatus({ state, onRetry, onReload }: {
  state: GuestDraftState; onRetry: () => void; onReload: () => void;
}) {
  if (state.phase === "preview" || state.phase === "submitted") return null
  const text = state.phase === "loading" ? "Checking for a saved draft…"
    : state.phase === "saving" ? "Saving…"
      : state.phase === "conflict" ? "Another tab has a different saved draft. Your answers here haven’t been replaced."
        : state.error ?? (state.dirty ? "Unsaved changes" : state.saved ? "Saved" : "Your draft will save as you type.")
  return (
    <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
      <p role="status" aria-live="polite" aria-atomic="true">{text}</p>
      {state.phase === "ready" && state.expiresAt && (
        <p>Private to this browser. Available until {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(state.expiresAt))}.</p>
      )}
      {(state.phase === "error" || state.phase === "expired") && (
        <Button type="button" variant="outline" onClick={onRetry} className="h-11 rounded-full bg-background px-3 text-xs shadow-none">
          {state.phase === "expired" ? "Resume saving" : "Retry"}
        </Button>
      )}
      {state.phase === "conflict" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="h-11 rounded-full bg-background px-3 text-xs shadow-none">Load saved draft</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl shadow-none">
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the answers in this tab?</AlertDialogTitle>
              <AlertDialogDescription>Loading the saved draft will discard unsaved changes here. Copy anything you want to keep first.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="shadow-none">Keep my answers</AlertDialogCancel>
              <AlertDialogAction onClick={onReload} className="shadow-none">Load saved draft</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
