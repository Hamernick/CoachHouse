"use client"

import { ParticleAlertDialogCancel as AlertDialogCancel, ParticleButton as Button } from "@/components/ui/particle-ui"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog"

import type { useParticleCloseGuard } from "../hooks/use-particle-close-guard"

export function ParticleDiscardDialog({ guard }: { guard: ReturnType<typeof useParticleCloseGuard> }) {
  return <AlertDialog open={guard.open} onOpenChange={(open) => { if (!open) guard.cancel() }}>
    <AlertDialogContent className="rounded-3xl border-border/70 bg-card p-5 shadow-none sm:max-w-sm" onCloseAutoFocus={(event) => {
      event.preventDefault()
      const target = guard.returnFocus.current
      if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true })
    }}>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base">Discard unsaved changes?</AlertDialogTitle>
        <AlertDialogDescription>Your changes to this card haven’t been saved.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="h-11 rounded-full shadow-none sm:h-9" onClick={guard.cancel}>Keep editing</AlertDialogCancel>
        <Button color="danger" size="lg" variant="solid" className="h-11 rounded-full shadow-none sm:h-9" onClick={guard.discard}>Discard changes</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
