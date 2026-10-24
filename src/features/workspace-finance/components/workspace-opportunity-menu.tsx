"use client"
import { useRef, useState } from "react"
import { Archive, Ellipsis, LayoutDashboard, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

export function WorkspaceOpportunityMenu({ title, pending, onEdit, onAdd, onArchive, onDelete }: {
  title: string; pending: boolean; onEdit: () => void; onAdd?: () => Promise<void>; onArchive: () => void; onDelete: () => Promise<boolean>
}) {
  const [confirm, setConfirm] = useState(false)
  const editAfterClose = useRef(false)
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="secondary" disabled={pending} className="h-9 w-10 shrink-0 rounded-lg shadow-none [@media(pointer:coarse)]:size-11" aria-label={`Options for ${title}`}><Ellipsis className="size-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5" onCloseAutoFocus={event => { if (editAfterClose.current) { event.preventDefault(); editAfterClose.current = false; onEdit() } }}>
        <DropdownMenuItem onSelect={() => { editAfterClose.current = true }}><Pencil aria-hidden="true" />Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={!onAdd} onSelect={() => void onAdd?.()}><LayoutDashboard aria-hidden="true" />Add to workspace</DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchive}><Archive aria-hidden="true" />Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete opportunity?</AlertDialogTitle><AlertDialogDescription>“{title}” will be permanently deleted. Linked documents and files will be kept.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} className="bg-destructive text-white hover:bg-destructive/90" onClick={async event => { event.preventDefault(); if (await onDelete()) setConfirm(false) }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
