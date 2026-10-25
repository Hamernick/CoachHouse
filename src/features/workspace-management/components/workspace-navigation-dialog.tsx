"use client"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { useWorkspaceNavigation } from "../hooks/use-workspace-navigation"

export function WorkspaceNavigationDialog({ navigation }: { navigation: ReturnType<typeof useWorkspaceNavigation> }) {
  return <AlertDialog open={navigation.open} onOpenChange={(open) => { if (!open) navigation.cancel() }}>
    <AlertDialogContent className="rounded-3xl border-border/70 bg-card p-5 shadow-none sm:max-w-sm" onCloseAutoFocus={(event) => {
      event.preventDefault()
      if (navigation.returnFocus.current?.isConnected) navigation.returnFocus.current.focus({ preventScroll: true })
    }}>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base">Discard unsaved changes?</AlertDialogTitle>
        <AlertDialogDescription>Your changes haven’t been saved. Switch workspaces anyway?</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel asChild><Button variant="ghost" className="h-11 rounded-full shadow-none sm:h-9" onClick={navigation.cancel}>Keep editing</Button></AlertDialogCancel>
        <Button variant="destructive" className="h-11 rounded-full shadow-none sm:h-9" onClick={navigation.discard}>Discard changes</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
