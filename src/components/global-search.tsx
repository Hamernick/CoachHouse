"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { useIsMobile } from "@/hooks/use-mobile"
import type { SidebarClass } from "@/lib/academy"
import type { SearchResult } from "@/lib/search/types"
import { GlobalSearchCommandDialog } from "@/components/global-search/global-search-command-dialog"
import {
  buildBaseSearchItems,
  SEARCH_MIN_WIDTH,
  formatClassTitle,
  groupSearchResults,
  resolveGlobalSearchResultHref,
} from "@/components/global-search/global-search-helpers"
import { platformLabEnabled } from "@/lib/feature-flags"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"
import { GlobalSearchTriggers } from "@/components/global-search/global-search-triggers"

export type GlobalSearchProps = {
  isAdmin?: boolean
  showOrgAdmin?: boolean
  context?: "platform" | "accelerator"
  classes?: SidebarClass[]
  showAccelerator?: boolean
  showMemberWorkspace?: boolean
  renderTrigger?: (onOpen: () => void) => ReactNode
}

export function GlobalSearch({
  isAdmin = false,
  showOrgAdmin = false,
  context = "platform",
  classes = [],
  showAccelerator = false,
  showMemberWorkspace = false,
  renderTrigger,
}: GlobalSearchProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [remoteItems, setRemoteItems] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const enableAccelerator = Boolean(isAdmin || showAccelerator)
  const showPlatformLab = isAdmin && platformLabEnabled

  useEffect(() => {
    if (typeof window === "undefined") return
    const node = document.getElementById("site-header-actions-center")
    if (!node) return

    const update = () => {
      const width = node.getBoundingClientRect().width
      const next = width < SEARCH_MIN_WIDTH
      setCompact((prev) => (prev === next ? prev : next))
    }

    update()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update)
      observer.observe(node)
    } else {
      window.addEventListener("resize", update)
    }

    return () => {
      observer?.disconnect()
      if (!observer) {
        window.removeEventListener("resize", update)
      }
    }
  }, [])

  const logEvent = useCallback(
    (payload: {
      eventType: "open" | "select"
      query?: string
      resultId?: string
      resultGroup?: string
      resultHref?: string
    }) => {
      const body = {
        eventType: payload.eventType,
        query: payload.query?.slice(0, 200),
        resultId: payload.resultId,
        resultGroup: payload.resultGroup,
        resultHref: payload.resultHref,
        context,
      }
      void fetch("/api/search/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    [context]
  )

  const baseItems = useMemo<SearchResult[]>(() => {
    return buildBaseSearchItems({
      enableAccelerator,
      showOrgAdmin,
      showMemberWorkspace,
      showPlatformLab,
    })
  }, [enableAccelerator, showMemberWorkspace, showOrgAdmin, showPlatformLab])

  const acceleratorItems = useMemo<SearchResult[]>(
    () =>
      context === "accelerator" && enableAccelerator
        ? [
            {
              id: "accelerator-overview",
              label: "Accelerator overview",
              href: getWorkspaceDrawerPath({ tab: "accelerator" }),
              group: "Accelerator",
              keywords: ["overview"],
            },
          ]
        : [],
    [context, enableAccelerator]
  )

  const acceleratorClasses = useMemo<SearchResult[]>(() => {
    if (!enableAccelerator || classes.length === 0) return []
    return classes
      .filter((klass) => (isAdmin ? true : klass.published))
      .flatMap((klass) => {
        const classTitle = formatClassTitle(klass.title)
        const visibleModules = klass.modules.filter((module) =>
          isAdmin ? true : module.published
        )
        const firstModuleId = visibleModules[0]?.id ?? null
        const classItem: SearchResult = {
          id: `class-${klass.id}`,
          label: classTitle,
          subtitle: "Class",
          href: getWorkspaceDrawerPath({
            tab: "accelerator",
            moduleId: firstModuleId,
          }),
          group: "Classes",
          keywords: [klass.slug, klass.title],
        }
        const moduleItems = visibleModules.map((module) => ({
          id: `module-${module.id}`,
          label: module.title,
          subtitle: classTitle,
          href: getWorkspaceDrawerPath({
            tab: "accelerator",
            moduleId: module.id,
          }),
          group: "Modules",
          keywords: [classTitle, module.title, `${module.index}`],
        }))
        return [classItem, ...moduleItems]
      })
  }, [classes, enableAccelerator, isAdmin])

  const items = useMemo(() => {
    const merged = new Map<string, SearchResult>()
    for (const item of [
      ...acceleratorItems,
      ...acceleratorClasses,
      ...baseItems,
      ...remoteItems,
    ]) {
      merged.set(item.id, item)
    }
    const values = Array.from(merged.values())
    const entitledValues = enableAccelerator
      ? values
      : values.filter((item) => !item.href.startsWith("/accelerator"))
    return entitledValues.map((item) => ({
      ...item,
      href: resolveGlobalSearchResultHref(item),
    }))
  }, [
    acceleratorClasses,
    acceleratorItems,
    baseItems,
    enableAccelerator,
    remoteItems,
  ])

  const grouped = useMemo(() => groupSearchResults(items), [items])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setRemoteItems([])
      setIsLoading(false)
      setError(null)
    } else {
      logEvent({ eventType: "open" })
    }
  }, [logEvent, open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setRemoteItems([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&context=${context}`,
          {
            signal: controller.signal,
          }
        )
        if (!response.ok) {
          throw new Error("Search unavailable.")
        }
        const payload = (await response.json().catch(() => ({}))) as {
          results?: SearchResult[]
        }
        setRemoteItems(Array.isArray(payload.results) ? payload.results : [])
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setError("Search unavailable.")
        setRemoteItems([])
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 180)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [context, open, query])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const showCompact = isMobile || compact
  const showCenterCompact = showCompact && !isMobile

  return (
    <>
      {renderTrigger ? renderTrigger(() => setOpen(true)) : <GlobalSearchTriggers
        showCompact={showCompact}
        showCenterCompact={showCenterCompact}
        onOpen={() => setOpen(true)}
      />}

      <GlobalSearchCommandDialog
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        isLoading={isLoading}
        error={error}
        grouped={grouped}
        onSelectItem={(item) => {
          logEvent({
            eventType: "select",
            query: query.trim(),
            resultId: item.id,
            resultGroup: item.group,
            resultHref: item.href,
          })
          setOpen(false)
          router.push(item.href)
        }}
      />
    </>
  )
}
