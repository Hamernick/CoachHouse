"use client"

import { useMemo, useState } from "react"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import BookOpenIcon from "lucide-react/dist/esm/icons/book-open"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { PublicMapItem } from "@/lib/public-map/resource-map-items"
import { PublicMapCollectedTabLabel } from "./collected-tab-label"
import { publicMapListItemMatchesQuery } from "./map-items-state"
import type { PublicMapResourceGuide } from "./resource-guides"

export type PublicMapCollectedMenuProps = {
  count: number
  items: PublicMapItem[]
  guides: PublicMapResourceGuide[]
  unresolvedCount: number
  loading: boolean
  error?: string | null
  onRetry?: () => void
  onSelectOrganization: (id: string) => void
  onSelectResource?: (id: string) => void
  onSelectGuide?: (id: string) => void
}

export function PublicMapCollectedMenu({ count, items, guides, unresolvedCount, loading, error, onRetry, onSelectOrganization, onSelectResource, onSelectGuide }: PublicMapCollectedMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(50)
  const entries = useMemo(() => [
    ...items.filter((item) => publicMapListItemMatchesQuery({ item, query })).map((item) => ({
      key: `${item.itemType}:${item.id}`,
      title: item.title,
      image: item.itemType === "platform_organization" ? item.organization.logoUrl : item.logoUrl ?? item.faviconUrl ?? null,
      guide: false,
      select: () => item.itemType === "platform_organization" ? onSelectOrganization(item.organization.id) : onSelectResource?.(item.id),
    })),
    ...guides.filter((guide) => `${guide.title} ${guide.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())).map((guide) => ({
      key: `guide:${guide.id}`,
      title: guide.title,
      image: null,
      guide: true,
      select: () => onSelectGuide?.(guide.id),
    })),
  ], [items, guides, query, onSelectOrganization, onSelectResource, onSelectGuide])

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setQuery(""); setVisibleCount(50) } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative h-8 min-w-0 touch-manipulation rounded-full px-3 py-0 text-sm data-[state=open]:bg-accent after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2">
          <BookmarkIcon aria-hidden />
          <PublicMapCollectedTabLabel count={count} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={12} collisionPadding={12} aria-label="Collected resources" className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-1.5 shadow-none motion-reduce:animate-none">
        <Command shouldFilter={false} label="Search your collection" className="rounded-xl **:data-[slot=command-input-wrapper]:h-12">
          <CommandInput value={query} onValueChange={(value) => { setQuery(value); setVisibleCount(50) }} placeholder="Search collected resources…" aria-label="Search collected resources" className="h-11 text-base md:text-sm" />
          <CommandList className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-7rem))] overscroll-contain" data-lenis-prevent>
            <CommandEmpty>{query ? "No matching collected resources." : unresolvedCount > 0 ? (loading ? "Loading your collection…" : "Some saved resources are unavailable.") : "Nothing collected yet. Save a resource to keep it here."}</CommandEmpty>
            <CommandGroup>
              {entries.slice(0, visibleCount).map((entry) => (
                <CommandItem key={entry.key} value={entry.key} onSelect={() => { setOpen(false); setQuery(""); setVisibleCount(50); entry.select() }} className="min-h-11 gap-3 rounded-xl px-3 py-2">
                  <Avatar className="size-7 shrink-0 rounded-md">
                    <AvatarImage src={entry.image ?? undefined} alt="" className="object-cover" />
                    <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                      {entry.guide ? <BookOpenIcon aria-hidden /> : <BookmarkIcon aria-hidden />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate">{entry.title}</span>
                </CommandItem>
              ))}
              {entries.length > visibleCount ? <CommandItem value="show-more-collected" onSelect={() => setVisibleCount((current) => current + 50)} className="min-h-11 rounded-xl">Show more collected resources</CommandItem> : null}
            </CommandGroup>
          </CommandList>
        </Command>
        {unresolvedCount > 0 ? (
          <div role="status" className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span>{loading ? "Loading saved resources…" : error || "Some saved resources are unavailable."}</span>
            {!loading && onRetry ? <Button variant="ghost" size="sm" className="h-11 shrink-0" onClick={onRetry}>Retry</Button> : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
