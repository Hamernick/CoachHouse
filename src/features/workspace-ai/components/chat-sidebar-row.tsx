"use client"

import { useEffect, useRef, useState } from "react"
import MoreHorizontalIcon from "lucide-react/dist/esm/icons/ellipsis"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import PinIcon from "lucide-react/dist/esm/icons/pin"
import PinOffIcon from "lucide-react/dist/esm/icons/pin-off"
import TrashIcon from "lucide-react/dist/esm/icons/trash-2"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuAction } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import type { ChatMutation, ResearchConversationEntry } from "../lib/research-conversation"

export function ChatSidebarRow({ entry, selected, disabled, onOpen, onUpdate, onDeleted }: {
  entry: ResearchConversationEntry; selected: boolean; disabled: boolean; onOpen: () => void
  onUpdate: (change: ChatMutation) => Promise<string | null>; onDeleted?: () => void
}) {
  const title = entry.title || "Untitled chat"
  const [renaming, setRenaming] = useState(false), [name, setName] = useState(title)
  const [deleting, setDeleting] = useState(false), [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null), row = useRef<HTMLButtonElement>(null)
  const edited = useRef(false)
  useEffect(() => {
    if (!renaming) { if (edited.current) row.current?.focus(); edited.current = false; return }
    edited.current = true
    const frame = requestAnimationFrame(() => { input.current?.focus(); input.current?.select() })
    return () => cancelAnimationFrame(frame)
  }, [renaming])
  const identity = { rootId: entry.rootId, revision: entry.metadataRevision ?? 0 }
  const finish = async (change: ChatMutation) => {
    setPending(true)
    const error = await onUpdate(change)
    setPending(false)
    if (error) { toast.error(error); return }
    if (change.action === "rename") { setRenaming(false); row.current?.focus() }
    if (change.action === "delete") { setDeleting(false); if (selected) onDeleted?.() }
  }
  const pin = () => void finish({ ...identity, action: "pin", pinned: !entry.pinned })
  const Pin = entry.pinned ? PinOffIcon : PinIcon
  return <SidebarMenuItem>
    {renaming ? <form onSubmit={event => { event.preventDefault(); if (name.trim() && !pending) void finish({ ...identity, action: "rename", title: name.trim() }) }}>
      <Input ref={input} aria-label="Chat name" value={name} maxLength={120} disabled={pending} className="h-8 text-sm"
        onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { setRenaming(false); row.current?.focus() } }} />
    </form> : <>
      <SidebarMenuButton type="button" ref={row} className="pr-14 group-has-data-[sidebar=menu-action]/menu-item:pr-14 font-normal data-[active=true]:font-normal" title={title} isActive={selected}
        aria-current={selected ? "page" : undefined} disabled={disabled || pending} onClick={onOpen}><span className="truncate">{title}</span></SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><SidebarMenuAction type="button" showOnHover className="right-7" aria-label={`Options for ${title}`} disabled={disabled || pending}><MoreHorizontalIcon aria-hidden /></SidebarMenuAction></DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-40 rounded-xl shadow-none" onCloseAutoFocus={event => {
          if (renaming) { event.preventDefault(); input.current?.focus(); input.current?.select() }
        }}><DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => { setName(title); setRenaming(true) }}><PencilIcon aria-hidden />Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={pin}><Pin aria-hidden />{entry.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><TrashIcon aria-hidden />Delete</DropdownMenuItem>
        </DropdownMenuGroup></DropdownMenuContent>
      </DropdownMenu>
      <SidebarMenuAction type="button" showOnHover={!entry.pinned} aria-label={`${entry.pinned ? "Unpin" : "Pin"} ${title}`} aria-pressed={Boolean(entry.pinned)} disabled={disabled || pending} onClick={pin}>
        <PinIcon aria-hidden />
      </SidebarMenuAction>
    </>}
    <AlertDialog open={deleting} onOpenChange={open => { if (!pending) setDeleting(open) }}><AlertDialogContent className="sm:max-w-sm">
      <AlertDialogHeader><AlertDialogTitle>Delete chat?</AlertDialogTitle><AlertDialogDescription>“{title}” will be removed from your history. Plans on the board will stay.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={event => { event.preventDefault(); void finish({ ...identity, action: "delete" }) }}>Delete</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </SidebarMenuItem>
}
