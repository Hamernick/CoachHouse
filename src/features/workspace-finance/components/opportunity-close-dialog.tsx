"use client"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { WorkspaceFinanceOpportunityInput } from "../types"

export function OpportunityCloseDialog({ item, pending, onCancel, onSelect }: {
  item: WorkspaceFinanceOpportunityInput | null; pending: boolean; onCancel: () => void
  onSelect: (status: "awarded" | "not_awarded") => void
}) {
  return <AlertDialog open={Boolean(item)} onOpenChange={open => { if (!open && !pending) onCancel() }}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>What was the outcome?</AlertDialogTitle><AlertDialogDescription>{item?.title}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><Button variant="outline" disabled={pending} onClick={() => onSelect("not_awarded")}>Not awarded</Button><Button disabled={pending} onClick={() => onSelect("awarded")}>Awarded</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
