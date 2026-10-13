"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import UserRoundIcon from "lucide-react/dist/esm/icons/user-round"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { useResourceDirectory } from "@/features/find-resource-index/client"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PublicMapSearchCard } from "@/components/public/public-map-index/search-card"
import { HOME_SEARCH_DOCK_SURFACE_CLASSNAME } from "@/components/public/home-canvas-dock-slot"
import { PublicMapDockAvatar, PublicMapDockViewerContext } from "@/components/public/public-map-index/dock-viewer"
import { homeCollectionReturnHref, toHomeResource, type HomeResource } from "../lib/home-resource-preview"
import { HomeResourceAuth } from "./home-resource-auth"
import { HomeResourceResults } from "./home-resource-results"
import { HomeResourceCollectionMenu } from "./home-resource-collection-menu"
import { useHomeResourceCollection } from "./use-home-resource-collection"

const EMPTY: ExternalResourceMapItem[] = []

export function HomeResourcePreviewPanel({ organizations }: { organizations: HomeResource[] }) {
  const [query, setQuery] = useState("")
  const [collectionRequested, setCollectionRequested] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const results = useRef<HTMLDivElement>(null)
  const collectTrigger = useRef<HTMLElement | null>(null)
  const wasSaving = useRef(false)
  const mapRef = useRef(null)
  const saved = useHomeResourceCollection(setQuery)
  const directory = useResourceDirectory({ endpoint: "/api/public/resource-map/index", initialResourceItems: EMPTY, query, category: "all", guide: null, mapRef, mapLoadVersion: 0, retainedIds: collectionRequested ? saved.collection.collectedResourceIds : [] })
  const rows = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/)
    const platform = organizations.filter((item) => words.every((word) => `${item.title} ${item.subtitle}`.toLowerCase().includes(word)))
    return [...platform, ...directory.directoryItems.map(toHomeResource)]
  }, [organizations, query, directory.directoryItems])
  const collected = useMemo(() => [...organizations, ...directory.resourceItems.map(toHomeResource)].filter((item) => saved.collection[item.kind === "organization" ? "favorites" : "collectedResourceIds"].includes(item.id)), [organizations, directory.resourceItems, saved.collection])
  useEffect(() => { setVisibleCount(6); results.current?.scrollTo({ top: 0 }) }, [query])
  useEffect(() => {
    if (wasSaving.current && !saved.saving && collectTrigger.current?.isConnected) collectTrigger.current.focus({ preventScroll: true })
    wasSaving.current = saved.saving
  }, [saved.saving])
  const count = saved.collection.favorites.length + saved.collection.collectedResourceIds.length
  const more = rows.length > visibleCount || directory.pagination?.hasMore
  const exploreHref = `/resources${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`

  return <div className="w-full min-w-0 space-y-3" data-home-resource-preview {...getReactGrabOwnerProps({
    ownerId: "public-home:resource-preview", component: "HomeResourcePreviewPanel", source: "src/features/build-collect-navigation/components/home-resource-preview-panel.tsx", slot: "resource-preview", tokenSource: "src/components/public/home-canvas-dock-slot.tsx",
  })}>
    <div className="relative h-[22rem] w-full min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-muted/30 sm:aspect-video sm:h-auto sm:min-h-[22rem] sm:rounded-[40px]">
      <div ref={results} hidden={saved.authOpen} className="absolute inset-0 overflow-y-auto overscroll-y-auto px-3 py-3 sm:px-5 sm:py-4" aria-busy={directory.pending}>
        <header className="mb-1 flex items-center justify-between gap-3 px-2">
          <h4 className="text-sm font-medium">{query ? "Search results" : "Explore resources"}</h4>
          <Button asChild variant="ghost" className="-mr-2 h-11 rounded-full px-2 text-xs text-primary has-[>svg]:px-2"><Link href={exploreHref}>View all<ArrowUpRightIcon data-icon="inline-end" aria-hidden /></Link></Button>
        </header>
        {directory.pending && rows.length === 0 ? <div role="status" className="space-y-5 px-2 py-4"><span className="sr-only">Searching resources…</span>{[0, 1, 2].map((id) => <Skeleton key={id} className="h-12 rounded-xl motion-reduce:animate-none" />)}</div> : null}
        <HomeResourceResults items={rows.slice(0, visibleCount)} isCollected={saved.isCollected} disabled={!saved.authReady || saved.saving || Boolean(saved.viewer && !saved.loaded)} onCollect={(item) => { collectTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; saved.toggle(item, query) }} />
        {!directory.pending && !directory.error && rows.length === 0 ? <p role="status" className="px-2 py-12 text-center text-sm text-muted-foreground">No matches yet. Try another name or location.</p> : null}
        {directory.error ? <div role="status" className="px-2 py-3 text-sm text-muted-foreground">Some resources couldn’t load. <Button variant="ghost" className="h-11 rounded-full px-2 text-primary" onClick={directory.retry}>Retry</Button></div> : null}
        {more ? <Button variant="ghost" className="mt-2 h-11 w-full rounded-xl" disabled={directory.pending || directory.pagination?.loading} onClick={async () => {
          if (visibleCount >= rows.length) await directory.pagination?.loadMore()
          setVisibleCount((value) => value + 6)
        }}>{directory.pagination?.loading ? "Loading…" : "Show more"}</Button> : null}
        {directory.pagination?.error ? <p role="status" className="p-2 text-xs text-muted-foreground">Couldn’t load more. Try Show more again.</p> : null}
      </div>
      {saved.authOpen ? <HomeResourceAuth redirectTo={homeCollectionReturnHref(saved.pending, query)} onAuthenticated={saved.authenticated} onClose={saved.closeAuth} /> : null}
    </div>
    <div inert={saved.authOpen || undefined} className={HOME_SEARCH_DOCK_SURFACE_CLASSNAME}>
      <div className="flex h-12 items-center justify-between gap-2 px-1 pb-1">
        <HomeResourceCollectionMenu onOpen={() => setCollectionRequested(true)} items={collected} count={count} loading={Boolean(saved.viewer && !saved.loaded) || directory.pending} />
        {saved.viewer ? <PublicMapDockViewerContext.Provider value={{ id: saved.viewer.id, email: saved.viewer.email ?? null, displayName: saved.viewer.user_metadata?.full_name ?? null, avatarUrl: saved.viewer.user_metadata?.avatar_url ?? null }}><PublicMapDockAvatar /></PublicMapDockViewerContext.Provider> : <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Sign in to collect resources" disabled={!saved.authReady} onClick={saved.openAuth}><Avatar className="size-8 border"><AvatarImage alt="" /><AvatarFallback><UserRoundIcon className="size-4" aria-hidden /></AvatarFallback></Avatar></Button>}
      </div>
      <PublicMapSearchCard dock compact query={query} onQueryChange={(value) => setQuery(value.slice(0, 160))} searchPending={directory.pending} onNavigateResults={(edge) => {
        const links = results.current?.querySelectorAll<HTMLAnchorElement>("[data-home-resource-result]")
        if (links?.length) links[edge === "first" ? 0 : links.length - 1].focus()
      }} />
    </div>
    {saved.error ? <div role="alert" className="flex items-center justify-between gap-2 px-3 text-xs text-destructive"><span>{saved.error}</span><Button variant="ghost" className="h-11" disabled={saved.saving} onClick={saved.retry}>Retry</Button></div> : <p role="status" className="sr-only">{saved.saving ? "Saving resource…" : saved.notice}</p>}
  </div>
}
