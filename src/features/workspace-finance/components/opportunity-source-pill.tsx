"use client"
import { useEffect, useRef, useState } from "react"
import { CalendarDays, FileText, Globe, Link, UserRound, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { previewOpportunityLink } from "@/actions/workspace-opportunity-sources"
import type { OpportunitySource, OpportunitySourceOption } from "../lib/opportunity-sources"

export function SourceIcon({ category }: { category: string }) {
  const Icon = /person|people/i.test(category) ? UserRound : /calendar|event/i.test(category) ? CalendarDays : /tool/i.test(category) ? Wrench : /link/i.test(category) ? Globe : FileText
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
}

export function OpportunitySourcePill({ source, option, organizationId, onRemove, disabled, onOpen }: {
  source: OpportunitySource; option?: OpportunitySourceOption; organizationId?: string; disabled?: boolean
  onRemove?: () => void; onOpen?: (id: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<{ title?: string; description?: string; siteName?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinned = useRef(false)
  const url = source.kind === "link" ? source.url : undefined
  const title = option?.title ?? (source.kind === "text" ? source.label : url ? new URL(url).hostname.replace(/^www\./, "") : "Unavailable source")
  const category = option?.category ?? (url ? "Link" : "Source")
  const stay = () => { if (timer.current) clearTimeout(timer.current) }
  const leave = () => { stay(); if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 180) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!open || !url || !organizationId || attempted) return
    let active = true
    setLoading(true)
    void previewOpportunityLink(organizationId, url).then(result => {
      if (active) { if (result.metadata) setPreview(result.metadata); setAttempted(true); setLoading(false) }
    }).catch(() => { if (active) { setAttempted(true); setLoading(false) } })
    return () => { active = false }
  }, [open, url, organizationId, attempted])
  return <span className="inline-flex max-w-full items-center rounded-full bg-muted">
    <Popover open={open} onOpenChange={value => { if (!value) pinned.current = false; setOpen(value) }}>
      <PopoverTrigger asChild><Button type="button" variant="ghost" disabled={disabled} className="h-8 min-w-0 max-w-60 gap-1.5 rounded-full px-2.5 text-xs font-normal [@media(pointer:coarse)]:min-h-11" onClick={event => { event.preventDefault(); stay(); pinned.current = true; setOpen(true) }} onPointerEnter={event => { if (!disabled && event.pointerType === "mouse") { stay(); setOpen(true) } }} onPointerLeave={leave} aria-label={`Preview ${title}`}><SourceIcon category={category} /><span className="truncate">{title}</span></Button></PopoverTrigger>
      <PopoverContent align="start" side="bottom" collisionPadding={12} className="w-80 max-w-[calc(100vw-24px)] space-y-2 rounded-3xl p-4 shadow-sm" onOpenAutoFocus={event => event.preventDefault()} onPointerEnter={stay} onPointerLeave={leave} onEscapeKeyDown={event => event.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><SourceIcon category={category} /><span className="truncate">{preview?.siteName ?? category}</span></div>
        <p className="break-words text-sm font-medium">{preview?.title ?? title}</p>
        {option?.startsAt && <time dateTime={option.startsAt} className="block text-xs text-muted-foreground">{new Date(option.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>}
        {loading ? <p role="status" className="text-xs text-muted-foreground">Loading preview…</p> : <p className="line-clamp-4 break-words text-sm text-muted-foreground">{preview?.description || option?.description || (url ? url : option ? "Linked workspace source" : source.kind === "text" ? source.label : "This source was removed or is no longer available to you.")}</p>}
        {(url || option?.href) && <Button asChild variant="secondary" size="sm" className="rounded-full"><a href={url ?? option?.href} target={url ? "_blank" : undefined} rel={url ? "noopener noreferrer" : undefined} onClick={event => { if (source.kind === "particle" && onOpen?.(source.id)) { event.preventDefault(); pinned.current = false; setOpen(false) } }}><Link aria-hidden="true" className="size-3.5" />Open</a></Button>}
      </PopoverContent>
    </Popover>
    {onRemove && <Button type="button" variant="ghost" size="icon" disabled={disabled} className="mr-0.5 size-7 shrink-0 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Remove ${title}`} onClick={onRemove}><X className="size-3" aria-hidden="true" /></Button>}
  </span>
}
