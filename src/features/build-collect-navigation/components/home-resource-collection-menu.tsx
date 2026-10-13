"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { PublicMapCollectedTabLabel } from "@/components/public/public-map-index/collected-tab-label"
import type { HomeResource } from "../lib/home-resource-preview"

export function HomeResourceCollectionMenu({ items, count, loading, onOpen }: { items: HomeResource[]; count: number; loading: boolean; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return <Popover open={open} onOpenChange={(value) => { setOpen(value); if (value) onOpen() }}>
    <PopoverTrigger asChild><Button variant="ghost" className="relative h-8 min-w-0 rounded-full px-3 py-0 text-sm after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2"><BookmarkIcon aria-hidden /><PublicMapCollectedTabLabel count={count} /></Button></PopoverTrigger>
    <PopoverContent side="top" align="start" collisionPadding={12} className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-1.5 shadow-none">
      <Command className="rounded-xl">
        <CommandInput placeholder="Search collected resources…" aria-label="Search collected resources" />
        <CommandList className="max-h-64">
          <CommandEmpty>{loading ? "Loading collection…" : count ? "No matching resources." : "Save a resource to keep it here."}</CommandEmpty>
          {items.map((item) => <CommandItem key={`${item.kind}:${item.id}`} value={`${item.title} ${item.id}`} onSelect={() => { setOpen(false); router.push(item.href) }} className="min-h-11 rounded-xl">
            {item.title}
          </CommandItem>)}
        </CommandList>
      </Command>
      {items.length < count && !loading ? <p role="status" className="p-3 text-xs text-muted-foreground">Some saved resources are unavailable.</p> : null}
    </PopoverContent>
  </Popover>
}
