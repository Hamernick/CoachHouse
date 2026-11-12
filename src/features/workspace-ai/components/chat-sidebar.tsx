"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChatSidebarRow } from "./chat-sidebar-row"
import SquarePenIcon from "lucide-react/dist/esm/icons/square-pen"
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { useResearchConversation } from "./use-research-conversation"

const SidebarSlot = createContext<{ host: HTMLDivElement | null; setHost: (host: HTMLDivElement | null) => void } | null>(null)

export function WorkspaceChatNavigationProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  return <SidebarSlot.Provider value={{ host, setHost }}>{children}</SidebarSlot.Provider>
}

export function WorkspaceChatSidebarSlot() {
  const slot = useContext(SidebarSlot)
  return slot ? <div ref={slot.setHost} data-workspace-chat-sidebar /> : null
}

export function WorkspaceChatSidebar({ conversation, disabled, onNew, onDeleted }: {
  conversation: ReturnType<typeof useResearchConversation>; disabled: boolean; onNew: () => void; onDeleted?: () => void
}) {
  const slot = useContext(SidebarSlot)
  const [open, setOpen] = useState(true)
  const blocked = disabled || conversation.mutating
  const entries = [...conversation.entries].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt.localeCompare(a.createdAt) || b.rootId.localeCompare(a.rootId))
  if (!slot?.host) return null
  return createPortal(<SidebarGroup aria-label="Chats">
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex h-8 items-center justify-between px-2">
        <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="group/recents h-7 gap-1 px-0 has-[>svg]:px-0 text-xs font-normal text-muted-foreground hover:bg-transparent" aria-label="Recents">
          Recents<ChevronDownIcon aria-hidden className={`size-3 transition-transform motion-reduce:transition-none opacity-0 group-hover/recents:opacity-100 group-focus-visible/recents:opacity-100 [@media(hover:none)]:opacity-100 ${open ? "" : "-rotate-90"}`} />
        </Button></CollapsibleTrigger>
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 rounded-md text-muted-foreground" onClick={onNew} disabled={blocked} aria-label="New chat"><SquarePenIcon aria-hidden className="size-3.5" /></Button></TooltipTrigger><TooltipContent>New chat</TooltipContent></Tooltip>
      </div>
      <CollapsibleContent><SidebarGroupContent>
        {conversation.error ? <SidebarMenu><SidebarMenuItem><SidebarMenuButton type="button" onClick={() => void conversation.retry()} disabled={blocked}>Retry loading chats</SidebarMenuButton></SidebarMenuItem></SidebarMenu>
          : <SidebarMenu>{entries.map(entry => <ChatSidebarRow key={entry.rootId} entry={entry} selected={conversation.rootId === entry.rootId} disabled={blocked}
            onOpen={() => void conversation.show(entry.rootId)} onUpdate={conversation.update} onDeleted={onDeleted} />)}</SidebarMenu>}
        {!conversation.error && entries.length === 0 && <p role="status" className="px-2 py-1 text-sm text-muted-foreground">{conversation.loading ? "Loading chats…" : "No chats"}</p>}
      </SidebarGroupContent></CollapsibleContent>
    </Collapsible>
  </SidebarGroup>, slot.host)
}
