"use client"

// Adapted from https://lab.xevrion.dev/r/overflow-tabs.json. Reuses our Button
// and Motion installation; panels stay mounted so filtering preserves drafts.
import { useId, useRef, type ReactNode } from "react"
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOverflowTabs } from "@/components/ui/use-overflow-tabs"
import { cn } from "@/lib/utils"

export function OverflowTabs({ tabs, value, onChange, label, panelId, id, wrapTab }: {
  tabs: readonly { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  label: string
  panelId: string
  id: string
  wrapTab?: (id: string, tab: ReactNode) => ReactNode
}) {
  const layoutId = useId()
  const reduce = useReducedMotion() ?? false
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const { scrollerRef, edges, mask, stopGlide, page } = useOverflowTabs(reduce)
  const index = Math.max(0, tabs.findIndex(tab => tab.id === value))
  if (!tabs.length) return null
  return <LayoutGroup id={layoutId}>
    <div className="group/overflow-tabs relative min-w-0">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-border/60" />
      <motion.div ref={scrollerRef} layoutScroll style={{ maskImage: mask, WebkitMaskImage: mask }} className="scroll-px-12 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label={label} aria-orientation="horizontal" className="flex w-max gap-0.5 px-0.5" onKeyDown={event => {
          const target = ({ ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[event.key]
          if (target === undefined) return
          event.preventDefault()
          const next = tabs[(target + tabs.length) % tabs.length].id
          onChange(next)
          const button = refs.current.get(next)
          button?.focus({ preventScroll: true })
          stopGlide.current()
          button?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" })
        }}>
          {tabs.map(tab => { const button = <Button key={tab.id} ref={el => { if (el) refs.current.set(tab.id, el); else refs.current.delete(tab.id) }} type="button" variant="ghost" role="tab" id={`${id}-${tab.id}`} aria-selected={tab.id === value} aria-controls={panelId} tabIndex={tab.id === value ? 0 : -1} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onChange(tab.id) }}
            className={cn("relative h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [@media(pointer:coarse)]:h-11", tab.id === value && "text-foreground")}>
            {tab.label}
            {tab.id === value && <motion.span aria-hidden layoutId="underline" className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-foreground" transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.25, bounce: 0 }} />}
          </Button>; return wrapTab ? wrapTab(tab.id, button) : button })}
        </div>
      </motion.div>
      {([-1, 1] as const).map(direction => <Button key={direction} type="button" variant="secondary" size="icon" tabIndex={-1} aria-hidden onMouseDown={event => event.preventDefault()} onClick={() => page(direction)} className={cn("pointer-events-none absolute top-1 size-8 rounded-full opacity-0 shadow-none transition-opacity motion-reduce:transition-none", direction === -1 ? "left-0" : "right-0", (direction === -1 ? edges.start : edges.end) && "group-hover/overflow-tabs:pointer-events-auto group-hover/overflow-tabs:opacity-100")}>
        {direction === -1 ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
      </Button>)}
    </div>
  </LayoutGroup>
}
