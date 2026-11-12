"use client"

import { useEffect, useState, type ReactNode } from "react"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Minimize presentation only: keep the conversation, stream and draft mounted. */
export function ParticleComposerConversation({ active, panel, openVersion = 0, hasInput = false, children }: {
  active: boolean; panel: ReactNode; openVersion?: number; hasInput?: boolean; children: ReactNode
}) {
  const [state, setState] = useState({ version: 0, open: false })
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const open = entered && active && (state.version === openVersion ? state.open : openVersion > 0)
  const label = open ? "Minimize chat" : "Open"
  return <Collapsible data-workspace-chat-session={active ? "true" : undefined} open={open} onOpenChange={value => setState({ version: openVersion, open: value })}
    className={cn("group/conversation relative", active && "canvas-glass canvas-planning-material flex flex-col border before:absolute before:inset-x-0 before:bottom-full before:h-12", active && (open ? "rounded-2xl" : "rounded-[24px]"))}>
    {active && <>
      <Tooltip><TooltipTrigger asChild><CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label}
          className={cn("absolute right-0 bottom-full mb-1 size-6 rounded-full text-muted-foreground [&_svg]:size-3.5 [@media(pointer:coarse)]:size-11 motion-reduce:transition-none", !open && !hasInput && "pointer-events-none opacity-0 group-hover/conversation:pointer-events-auto group-hover/conversation:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100")}>
          {open ? <MinusIcon aria-hidden /> : <Maximize2Icon aria-hidden />}
        </Button>
      </CollapsibleTrigger></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
      <CollapsibleContent forceMount aria-hidden={!open} inert={!open}>
        <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden rounded-t-2xl"><div className="h-[var(--workspace-chat-panel-height,min(70dvh,calc(100dvh-12rem)))]">{panel}</div></div>
        </div>
      </CollapsibleContent>
    </>}
    {children}
  </Collapsible>
}
