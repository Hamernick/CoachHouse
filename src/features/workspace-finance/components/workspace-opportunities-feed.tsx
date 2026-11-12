"use client"
import { usePlanningComposer } from "@/components/workspace/planning-composer-context"
import MoreHorizontal from "lucide-react/dist/esm/icons/ellipsis"

import { ArrowLeft, Plus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import { OpportunityView, OpportunityViewControls } from "./opportunity-view-transition"
import { reorderWorkspaceOpportunities } from "@/actions/workspace-opportunity-order"
import { OpportunityFeedDrag, SortableOpportunity, type OpportunityCanvasDrop } from "./opportunity-feed-drag"
import { OpportunityComposer } from "./opportunity-composer"
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react"
import { deleteWorkspaceOpportunity, getArchivedWorkspaceOpportunities } from "@/actions/workspace-opportunity-lifecycle"
import { notifyOpportunityChanged } from "../lib/opportunity-events"
import { toast } from "@/lib/toast"
import { matchesOpportunityFilter, type OpportunityFeedFilter } from "../lib/opportunity-feed-filters"
import { Button } from "@/components/ui/button"
import { updateWorkspaceFinanceOpportunityStatus } from "@/actions/workspace-finance"
import type { WorkspaceFinanceDataState, WorkspaceFinanceOpportunityInput, WorkspaceFinanceOpportunityWorkflowStatus } from "../types"
import { WorkspaceOpportunityForm } from "./workspace-opportunity-form"
import { getWorkspaceOpportunitySources } from "@/actions/workspace-opportunity-sources"
import { sourceKey, type OpportunitySourceOption } from "../lib/opportunity-sources"
import { ResourceOpportunityMatches } from "./resource-opportunity-matches"
import { useOpportunityCalendarTarget } from "./use-opportunity-calendar-target"
import { OpportunityReportView } from "./opportunity-report-view"
import { OpportunityFeedStats } from "./opportunity-feed-stats"
import { WorkspaceOpportunityCard } from "./workspace-opportunity-card"
import { opportunityReportSources, readOpportunityReport } from "../lib/opportunity-report"

export function WorkspaceOpportunitiesFeed({ sidebar = false, addTarget, onCreateStart, footerTarget, headerTarget, opportunities = [], state = "idle", canEdit = false, onCountChange, organizationId, onOpenSource, onAddToWorkspace, selectedResource }: {
  sidebar?: boolean
  addTarget?: HTMLDivElement | null
  onCreateStart?: () => void
  headerTarget?: HTMLDivElement | null
  footerTarget?: HTMLDivElement | null
  selectedResource?: {id:string;title:string;revision:number}
  opportunities?: WorkspaceFinanceOpportunityInput[]
  state?: WorkspaceFinanceDataState
  canEdit?: boolean
  onCountChange?: (count: number) => void
  organizationId?: string
  onOpenSource?: (id: string) => boolean
  onAddToWorkspace?: (item: WorkspaceFinanceOpportunityInput, position?: OpportunityCanvasDrop) => Promise<boolean>
}) {
  const planningComposer = usePlanningComposer()
  const router = useRouter()
  const [retrying, retry] = useTransition()
  const panelId = useId()
  const [filter, setFilter] = useState<OpportunityFeedFilter>("all")
  const [archived, setArchived] = useState<WorkspaceFinanceOpportunityInput[]>([])
  const [archiveState, setArchiveState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const archiveRequest = useRef(false)
  const loadArchive = useCallback(async () => {
    if (!organizationId || archiveRequest.current) return
    archiveRequest.current = true; setArchiveState("loading")
    try {
      const result = await getArchivedWorkspaceOpportunities(organizationId)
      if ("error" in result) throw new Error(result.error)
      setArchived(result.opportunities); setArchiveState("ready")
    } catch { setArchiveState("error") }
    finally { archiveRequest.current = false }
  }, [organizationId])
  useEffect(() => { if (filter === "archived" && archiveState === "idle") void loadArchive() }, [filter, archiveState, loadArchive])
  const [view, setView] = useState<{ kind: "list" } | { kind: "create" } | { kind: "edit" | "detail"; item: WorkspaceFinanceOpportunityInput }>({ kind: "list" })
  useEffect(() => {
    if (view.kind !== "list") return
    const refresh = () => { if (document.visibilityState === "visible") retry(() => router.refresh()) }
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh) }
  }, [view.kind, router])
  const viewRoot = useRef<HTMLDivElement>(null)
  const returnTo = useRef<{ scroll: number; itemId?: string } | null>(null)
  const viewKey = "item" in view ? `${view.kind}:${view.item.id}` : view.kind
  const editorReturn = useRef<string | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [added, setAdded] = useState<WorkspaceFinanceOpportunityInput[]>([])
  const [sourceOptions, setSourceOptions] = useState<OpportunitySourceOption[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const sourceRequest = useRef(false)
  const sourcesLoaded = useRef(false)
  const loadSources = useCallback(() => {
    if (!organizationId || sourceRequest.current || sourcesLoaded.current) return
    sourceRequest.current = true; setSourcesLoading(true); setSourcesError(null)
    void getWorkspaceOpportunitySources(organizationId).then(result => {
      if ("error" in result) setSourcesError(result.error ?? "Sources couldn’t be loaded.")
      else { setSourceOptions(result.options); sourcesLoaded.current = true }
    }).catch(() => setSourcesError("Sources couldn’t be loaded. Try typing @ again."))
      .finally(() => { sourceRequest.current = false; setSourcesLoading(false) })
  }, [organizationId])
  const hasReferences = [...opportunities, ...archived].some(item => [...(item.sources ?? []), ...opportunityReportSources(readOpportunityReport(item.report))].some(source => source.kind !== "link" && source.kind !== "text"))
  useEffect(() => { if (hasReferences) loadSources() }, [hasReferences, loadSources])
  const addButton = useRef<HTMLButtonElement>(null)
  const [orderChanges, setOrderChanges] = useState<Record<string, { feedPosition?: number; updatedAt?: string }>>({})
  const [reordering, setReordering] = useState(false)
  const reorderBusy = useRef(false)
  const [changes, setChanges] = useState<Record<string, WorkspaceFinanceOpportunityWorkflowStatus>>({})
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set())
  const latest = new Map<string, WorkspaceFinanceOpportunityInput>()
  for (const item of [...archived, ...opportunities, ...added]) {
    const previous = latest.get(item.id)
    if (!previous || Date.parse(item.updatedAt ?? "") >= Date.parse(previous.updatedAt ?? "") || !previous.updatedAt) latest.set(item.id, item)
  }
  const items = [...latest.values()].map(item => {
    const local = orderChanges[item.id]
    const newer = item.updatedAt && local?.updatedAt && Date.parse(item.updatedAt) > Date.parse(local.updatedAt)
    return { ...item, ...(newer ? {} : local), status: !newer && changes[item.id] ? changes[item.id] : item.status }
  }).sort((a, b) => (a.feedPosition ?? Number.MAX_SAFE_INTEGER) - (b.feedPosition ?? Number.MAX_SAFE_INTEGER))
  const activeItems = items.filter(item => !deleted.has(item.id) && item.status !== "dismissed")
  const activeCount = activeItems.length
  const visible = items.filter(item => !deleted.has(item.id) && matchesOpportunityFilter(filter, item.status, item.origin))
  useEffect(() => { onCountChange?.(activeCount) }, [onCountChange, activeCount])
  const enterView = (item?: WorkspaceFinanceOpportunityInput) => {
    if (!item) onCreateStart?.()
    const scroller = viewRoot.current?.closest<HTMLElement>('[data-scroll-fade-managed="true"]')
    editorReturn.current = view.kind === "detail" ? view.item.id : null
    if (view.kind === "list") returnTo.current = { scroll: scroller?.scrollTop ?? 0, itemId: item?.id }
    loadSources()
    setView(item ? { kind: "edit", item } : { kind: "create" })
  }
  const openReport = (item: WorkspaceFinanceOpportunityInput) => {
    if (view.kind === "list") {
      const scroller = viewRoot.current?.closest<HTMLElement>('[data-scroll-fade-managed="true"]')
      returnTo.current = { scroll: scroller?.scrollTop ?? 0, itemId: item.id }
    }
    loadSources()
    setView({ kind: "detail", item })
  }
  useOpportunityCalendarTarget(activeItems, organizationId, item => { onCreateStart?.(); openReport(item) }, view.kind === "list" || view.kind === "detail")
  const restoreView = () => {
    const scroller = viewRoot.current?.closest<HTMLElement>('[data-scroll-fade-managed="true"]')
    if (view.kind !== "list") { if (scroller) scroller.scrollTop = 0; if (view.kind === "detail") requestAnimationFrame(() => (headerTarget ?? viewRoot.current)?.querySelector<HTMLButtonElement>("[data-opportunity-back]")?.focus({ preventScroll: true })); return }
    const destination = returnTo.current
    if (!destination) return
    requestAnimationFrame(() => {
      const itemButton = destination.itemId ? viewRoot.current?.querySelector<HTMLButtonElement>(`[data-opportunity-id="${CSS.escape(destination.itemId)}"] button[aria-haspopup="menu"]`) : null
      const target = itemButton ?? footerTarget?.querySelector<HTMLInputElement>("input") ?? addButton.current
      target?.focus({ preventScroll: true })
      if (scroller) scroller.scrollTop = destination.scroll
    })
  }
  async function change(item: WorkspaceFinanceOpportunityInput, status: WorkspaceFinanceOpportunityWorkflowStatus) {
    if (!canEdit || pending.has(item.id) || reorderBusy.current) return false
    const previous = changes[item.id] ?? item.status
    if (!matchesOpportunityFilter(filter, status, item.origin)) {
      document.getElementById(panelId)?.focus({ preventScroll: true })
      requestAnimationFrame(() => document.getElementById(panelId)?.focus({ preventScroll: true }))
    }
    setPending(value => new Set(value).add(item.id))
    setChanges(value => ({ ...value, [item.id]: status }))
    try {
      const result = await updateWorkspaceFinanceOpportunityStatus({ opportunityId: item.id, status })
      if ("error" in result) throw new Error(result.error)
      if (result.updatedAt) setOrderChanges(value => ({ ...value, [item.id]: { ...value[item.id], updatedAt: result.updatedAt } }))
      notifyOpportunityChanged(item.id)
      if (status === "dismissed") toast.success("Opportunity archived", { action: { label: "Undo", onClick: () => void change(item, previous) } })
      return true
    } catch (error) {
      setChanges(value => ({ ...value, [item.id]: previous }))
      toast.error(error instanceof Error ? error.message : "Unable to update opportunity.")
      return false
    } finally {
      setPending(value => { const next = new Set(value); next.delete(item.id); return next })
    }
  }
  async function remove(item: WorkspaceFinanceOpportunityInput) {
    if (!canEdit || !organizationId || pending.has(item.id)) return false
    setPending(value => new Set(value).add(item.id))
    try {
      const result = await deleteWorkspaceOpportunity({ organizationId, id: item.id, updatedAt: item.updatedAt ?? "" })
      if ("error" in result) throw new Error(result.error)
      setDeleted(value => new Set(value).add(item.id)); notifyOpportunityChanged(item.id)
      toast.success("Opportunity deleted")
      return true
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete opportunity."); return false }
    finally { setPending(value => { const next = new Set(value); next.delete(item.id); return next }) }
  }
  async function addToWorkspace(item: WorkspaceFinanceOpportunityInput, position?: OpportunityCanvasDrop) {
    if (!canEdit || pending.has(item.id)) return
    setPending(value => new Set(value).add(item.id))
    try { if (await onAddToWorkspace?.(item, position)) toast.success("Opportunity added to workspace"); else toast.error("Unable to place this opportunity. Check for locked cards or unsaved changes.") }
    catch { toast.error("Unable to add opportunity to workspace.") }
    finally { setPending(value => { const next = new Set(value); next.delete(item.id); return next }) }
  }
  async function reorder(id: string, target: string) {
    if (!organizationId || !canEdit || pending.size || reorderBusy.current) return
    const previous = visible.map(item => item.id)
    const ordered = [...previous]
    const from = ordered.indexOf(id), to = ordered.indexOf(target)
    if (from < 0 || to < 0 || from === to) return
    ordered.splice(to, 0, ordered.splice(from, 1)[0])
    const slots = visible.map((item, index) => item.feedPosition ?? index + 1)
    const before = orderChanges
    reorderBusy.current = true; setReordering(true)
    setOrderChanges(value => ({ ...value, ...Object.fromEntries(ordered.map((id, index) => [id, { ...value[id], feedPosition: slots[index] }])) }))
    try {
      const result = await reorderWorkspaceOpportunities({ organizationId, previous, ordered })
      if ("error" in result) throw new Error(result.error)
      setOrderChanges(value => ({ ...value, ...Object.fromEntries(result.items.map(item => [item.id, { feedPosition: item.feedPosition, updatedAt: item.updatedAt }])) }))
    } catch (error) { setOrderChanges(before); toast.error(error instanceof Error ? error.message : "Order couldn’t be saved.") }
    finally { reorderBusy.current = false; setReordering(false) }
  }
  function moveTo(item: WorkspaceFinanceOpportunityInput, destination: OpportunityFeedFilter) {
    if (destination !== "archived") return
    void change(item, "dismissed").then(ok => { if (ok) setFilter(destination) })
  }
  const closeForm = (updated?: WorkspaceFinanceOpportunityInput) => {
    const item = updated ?? items.find(item => item.id === editorReturn.current)
    setView(editorReturn.current && item ? { kind: "detail", item } : { kind: "list" })
  }
  const form = { organizationId: organizationId ?? "", sourceOptions, loadSources, sourcesLoading, sourcesError, onSourceOptionsAdded: (items: OpportunitySourceOption[]) => setSourceOptions(current => [...new Map([...current, ...items].map(item => [sourceKey(item.source), item])).values()]) }
  const saved = (item: WorkspaceFinanceOpportunityInput, reveal = true) => { if (reveal) setFilter("all"); setAdded(value => [item, ...value.filter(existing => existing.id !== item.id)]); setOrderChanges(value => ({ ...value, [item.id]: { feedPosition: item.feedPosition ?? value[item.id]?.feedPosition, updatedAt: item.updatedAt } })); notifyOpportunityChanged(item.id) }
  const editor = (view.kind === "create" || view.kind === "edit") && canEdit && organizationId ? <OpportunityView key={viewKey} kind="editor" rootRef={viewRoot} onEntered={restoreView}>
    <WorkspaceOpportunityForm {...form} initial={view.kind === "edit" ? view.item : undefined} initialTitle={draftTitle} headerTarget={sidebar ? headerTarget : undefined} onCancel={() => closeForm()} onCreated={item => { saved(item, view.kind === "create"); if (view.kind === "create") setDraftTitle(""); closeForm(item) }} />
  </OpportunityView> : null
  const detailItem = view.kind === "detail" ? items.find(item => item.id === view.item.id) ?? view.item : null
  const detailIndex = visible.findIndex(item => item.id === detailItem?.id)
  const detail = detailItem && view.kind === "detail" ? <OpportunityView key={viewKey} kind="detail" rootRef={viewRoot} onEntered={restoreView}>
    <OpportunityReportView headerTarget={headerTarget} onBack={() => setView({ kind: "list" })}
      onPrevious={detailIndex > 0 ? () => openReport(visible[detailIndex - 1]) : undefined} onNext={detailIndex >= 0 && detailIndex < visible.length - 1 ? () => openReport(visible[detailIndex + 1]) : undefined}
      card={{ item: detailItem, status: detailItem.status, canEdit, pending: pending.has(detailItem.id), form, onOpenSource,
        onEdit: () => enterView(detailItem), onAdd: onAddToWorkspace ? () => addToWorkspace(detailItem) : undefined,
        onStatus: status => { void change(detailItem, status).then(ok => { if (ok) setView({ kind: "list" }) }) },
        onDelete: async () => { const ok = await remove(detailItem); if (ok) setView({ kind: "list" }); return ok },
      }} />
  </OpportunityView> : null
  const addControl = canEdit && organizationId && <Button ref={addButton} variant="outline" className="rounded-full shadow-none" onClick={() => enterView()}>Add opportunity</Button>
  const composer = !planningComposer && sidebar && footerTarget && canEdit && organizationId ? createPortal(<OpportunityViewControls><OpportunityComposer value={draftTitle} onChange={setDraftTitle} onSubmit={() => enterView()} /></OpportunityViewControls>, footerTarget) : null
  const matching = organizationId && selectedResource ? <ResourceOpportunityMatches target={{organizationId,resourceId:selectedResource.id,resourceRevision:selectedResource.revision}} title={selectedResource.title} canEdit={canEdit} onSaved={saved}/> : null
  const summary = <div className="pb-2">{filter === "archived" ? <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-md px-2 text-xs" onClick={() => setFilter("all")}><ArrowLeft className="size-3.5" aria-hidden />Back to opportunities</Button> : <OpportunityFeedStats items={activeItems} state={retrying ? "loading" : state} />}</div>
  const feedUnavailable = filter !== "archived" && (state === "error" || state === "loading")
  const archiveUnavailable = filter === "archived" && archiveState !== "ready" && Boolean(organizationId)
  const startComposer = () => planningComposer?.choose({ kind: "opportunity", maxLength: 200, submit: async title => {
    if (!canEdit || !organizationId) return false
    setDraftTitle(title); enterView(); return true
  } })
  const addMenuContent = organizationId ? <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Opportunity actions" disabled={view.kind !== "list"} className="size-[30px] rounded-[10px] text-muted-foreground [@media(pointer:coarse)]:size-11">{planningComposer ? <MoreHorizontal aria-hidden /> : <Plus aria-hidden />}</Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-2xl p-2">
    {canEdit && !planningComposer && <DropdownMenuItem onSelect={() => enterView()}>Add opportunity</DropdownMenuItem>}
    <DropdownMenuItem onSelect={() => { setFilter("archived"); void loadArchive(); onCreateStart?.() }}>View archive</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu> : null
  const addActions = planningComposer ? <div className="flex items-center gap-0.5">{canEdit && organizationId && <Button variant="ghost" size="icon" aria-label="Add opportunity" disabled={view.kind !== "list" || planningComposer.pending} className="size-[30px] rounded-[10px] text-muted-foreground [@media(pointer:coarse)]:size-11" onClick={startComposer}><Plus aria-hidden /></Button>}{addMenuContent}</div> : addMenuContent
  const addMenu = addTarget ? createPortal(addActions, addTarget) : addActions
  return <>{addMenu}<OpportunityFeedDrag items={visible} disabled={!canEdit || feedUnavailable || reordering || pending.size > 0} onReorder={(id, target) => void reorder(id, target)} onStage={moveTo} onCanvas={onAddToWorkspace ? (item, point) => void addToWorkspace(item, point) : undefined}><AnimatePresence initial={false} mode="wait">{editor ?? detail ?? <OpportunityView key="list" kind="list" rootRef={viewRoot} onEntered={restoreView}>
    {headerTarget ? createPortal(<OpportunityViewControls>{summary}</OpportunityViewControls>, headerTarget) : summary}{composer}
    {filter !== "archived" && state === "error" && <div role="alert" className="px-2 py-4 text-center text-sm text-muted-foreground">Opportunities couldn’t be loaded.<Button type="button" variant="link" disabled={retrying} onClick={() => retry(() => router.refresh())}>{retrying ? "Retrying…" : "Retry"}</Button></div>}
    {filter !== "archived" && state === "loading" && !visible.length && <p role="status" className="px-2 py-4 text-center text-sm text-muted-foreground">Loading opportunities…</p>}
    <div id={panelId} role="region" aria-label={filter === "archived" ? "Archived opportunities" : "Current opportunities"} tabIndex={0} className="flex min-w-0 flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {filter === "all" && matching}
      {archiveUnavailable ? archiveState === "error" ? <div role="alert" className="px-2 py-4 text-center text-sm text-muted-foreground">Archived opportunities couldn’t be loaded.<Button variant="link" onClick={() => void loadArchive()}>Retry</Button></div> : <p role="status" className="px-2 py-4 text-center text-sm text-muted-foreground">Loading archived opportunities…</p> : !visible.length ? feedUnavailable ? null : <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-4 py-6"><p className="text-sm text-muted-foreground">{filter === "all" ? "No opportunities yet." : "No archived opportunities."}</p></div> : <ul aria-label="Opportunities feed" className={sidebar ? "flex flex-col gap-0.5" : "space-y-3"}>
        {visible.map(item => <SortableOpportunity key={item.id} item={item} disabled={!canEdit || feedUnavailable || reordering || pending.size > 0}>{renderTitle => <WorkspaceOpportunityCard renderTitle={renderTitle} compact={sidebar} onOpen={() => openReport(item)} key={item.id} item={item} status={item.status} canEdit={canEdit} pending={pending.has(item.id)} onStatus={status => void change(item, status)} onEdit={() => enterView(item)} onDelete={() => remove(item)} onAdd={onAddToWorkspace ? () => addToWorkspace(item) : undefined} onOpenSource={onOpenSource} form={form} />}</SortableOpportunity>)}
      </ul>}
    </div>
    {!sidebar && addControl && <div className="flex justify-center">{addControl}</div>}
  </OpportunityView>}</AnimatePresence></OpportunityFeedDrag></>
}
