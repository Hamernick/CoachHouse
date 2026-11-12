"use client"

import { useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAiUsage } from "./ai-usage-provider"
import { creditSummary } from "../lib/usage-summary"

function UsageRow({ label, value, help }: { label: string; value: ReactNode; help: string }) {
  return <Tooltip delayDuration={200}><TooltipTrigger asChild><div tabIndex={0} className="flex min-h-9 items-center justify-between gap-6 rounded-lg px-2 text-sm outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring">
    <span>{label}</span><span className="shrink-0 tabular-nums">{value}</span>
  </div></TooltipTrigger><TooltipContent side="right" sideOffset={8} showArrow={false} className="max-w-64 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-none">{help}</TooltipContent></Tooltip>
}

export function AiUsageSidebar() {
  const usage = useAiUsage()
  const [open, setOpen] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  if (!usage) return null
  const summary = usage.data ? creditSummary(usage.data.account) : null
  const quote = usage.quote?.organizationId === usage.data?.organizationId ? usage.quote : null
  const label = usage.error ? "Usage unavailable" : summary ? summary.percent === null ? `${summary.available.toLocaleString()} credits available` : `Included · ${summary.percent}% left` : "Loading usage…"
  return <div className={`absolute right-full top-1/2 z-10 -translate-y-1/2 pr-2 transition-opacity motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0 group-hover/conversation:pointer-events-auto group-hover/conversation:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"}`} data-ai-usage-sidebar>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) usage.refresh() }}>
      <Tooltip delayDuration={150}><TooltipTrigger asChild><PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`AI usage: ${label}`} className="size-10 rounded-xl bg-muted/50 shadow-none hover:bg-muted motion-reduce:transition-none">
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true" className="size-7 shrink-0 text-foreground/75">
            <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
            <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(summary?.percent ?? (summary?.available ? 100 : 0)) * .69115} 69.115`} transform="rotate(-90 14 14)" />
            <rect x="10.5" y="10.5" width="7" height="7" rx="1.5" fill="currentColor" opacity=".55" transform="rotate(45 14 14)" />
          </svg>
        </Button>
      </PopoverTrigger></TooltipTrigger>{!open && <TooltipContent side="top" sideOffset={8} showArrow={false} className="rounded-full border bg-popover px-3 py-2 text-sm font-normal text-popover-foreground shadow-none">{label}</TooltipContent>}</Tooltip>
      <PopoverContent ref={content} onOpenAutoFocus={event => { event.preventDefault(); content.current?.focus() }} aria-label="AI usage" side="top" align="start" sideOffset={8} className="w-72 max-w-[calc(100vw-24px)] rounded-2xl p-2 text-left shadow-none">
        <p className="px-2 py-2 text-sm text-muted-foreground">Usage source: Workspace credits</p>
        <div className="my-1 border-t" />
        {summary ? <>
          <UsageRow label="Included credits" value={summary.percent === null ? summary.included.toLocaleString() : `${summary.percent}% left`} help={summary.expires ? `Expires ${new Date(summary.expires).toLocaleString()}` : `${summary.included.toLocaleString()} included credits available.`} />
          <UsageRow label="Credits" value={`${summary.purchased.toLocaleString()} credits`} help="Additional credits can be used when your included allowance runs out." />
          {summary.reserved > 0 && <UsageRow label="Reserved" value={summary.reserved.toLocaleString()} help="Credits reserved for requests that are still running." />}
          {quote && <UsageRow label="This request" value={`Up to ${quote.maximumCredits}`} help={[quote.provider, quote.model].filter(Boolean).join(" · ") || "Maximum credits for the request currently being reviewed."} />}
        </> : <p role="status" className="px-2 py-2 text-sm text-muted-foreground">{usage.error ?? "Loading usage…"}</p>}
        {usage.error && <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={usage.refresh}>Retry loading usage</Button>}
        <div className="my-1 border-t" />
        <Button variant="ghost" className="h-9 w-full justify-start rounded-lg px-2 font-normal" onClick={() => { setOpen(false); usage.openManage() }}>Manage usage</Button>
      </PopoverContent>
    </Popover>
  </div>
}
