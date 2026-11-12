"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useReactFlow, useViewport } from "@xyflow/react"
import { motion, useReducedMotion } from "motion/react"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import { Button } from "@/components/ui/button"
import { beginWorkspaceCameraIntent } from "@/lib/workspace-canvas/camera-intent"
import { edgeTarget, free, safeTransition, visibleFraction, type Point, type Rect } from "@/lib/workspace-canvas/canvas-chat-geometry"

export const WorkspaceCanvasChatContext = createContext(false)

/** Positions the existing composer; owns no prompts, AI results or persistence. */
export function WorkspaceCanvasChat({ children }: { children: ReactNode }) {
  const enabled = useContext(WorkspaceCanvasChatContext)
  return enabled ? <AnchoredChat>{children}</AnchoredChat> : children
}

const obstacleSelector = '[data-planning-sidebar], [data-workspace-top-navigation], [data-workspace-canvas-viewport-controls], [data-workspace-content-window][aria-hidden="false"]'

function AnchoredChat({ children }: { children: ReactNode }) {
  const chat = useRef<HTMLDivElement>(null)
  const flow = useReactFlow()
  const viewport = useViewport()
  const reduced = useReducedMotion()
  const [surface, setSurface] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<Point>({ x: 0, y: 0 })
  const [anchor, setAnchor] = useState<Point | null>(null)
  const [height, setHeight] = useState(72)
  const [planningHeight, setPlanningHeight] = useState(0)
  const [composerHeight, setComposerHeight] = useState(44)
  const [obstacles, setObstacles] = useState<Rect[]>([])
  const [intro, setIntro] = useState(true)
  const [offscreen, setOffscreen] = useState(false)
  const [returning, setReturning] = useState(false)
  const [notice, setNotice] = useState("")
  const previous = useRef<Point | null>(null)
  const returnVersion = useRef(0)
  const width = Math.min(700, Math.max(240, size.x - 100))
  const projected = anchor ? { x: anchor.x * viewport.zoom + viewport.x, y: anchor.y * viewport.zoom + viewport.y } : { x: size.x / 2, y: size.y * .45 }
  const planningReserve = planningHeight > 0 ? planningHeight + 12 : 0
  const home = { x: size.x / 2, y: size.y - 36 - 64 - planningReserve }
  const target = intro ? { x: size.x / 2, y: size.y * .45 } : home
  const away = Math.hypot(projected.x - target.x, projected.y - target.y) > 16
  const inline = { x: projected.x + width / 2 + 24, y: projected.y }
  const fraction = visibleFraction({ x: projected.x - width / 2, y: projected.y + 36 - height, width, height }, size)
  const destination = offscreen ? edgeTarget(projected, size, obstacles, previous.current) : inline

  useLayoutEffect(() => {
    setSurface(chat.current?.closest<HTMLElement>(".workspace-layout-surface") ?? null)
  }, [])

  useLayoutEffect(() => {
    if (!surface) return
    let frame = 0
    let observedPlanning: HTMLElement | null = null
    const measure = () => {
      const bounds = surface.getBoundingClientRect()
      const nextSize = { x: bounds.width, y: bounds.height }
      setSize(old => old.x === nextSize.x && old.y === nextSize.y ? old : nextSize)
      setHeight(chat.current?.offsetHeight ?? 72)
      const planning = chat.current?.querySelector<HTMLElement>("[data-workspace-chat-planning]") ?? null
      if (planning !== observedPlanning) {
        if (observedPlanning) resize.unobserve(observedPlanning)
        if (planning) resize.observe(planning)
        observedPlanning = planning
      }
      setPlanningHeight(planning?.offsetHeight ?? 0)
      setComposerHeight(chat.current?.querySelector<HTMLElement>('[aria-label="Plan an objective or search Particles"]')?.closest("form")?.offsetHeight ?? 44)
      const next = [...surface.querySelectorAll<HTMLElement>(obstacleSelector)].filter(el => !el.closest('[aria-hidden="true"]') && getComputedStyle(el).visibility !== "hidden").map(el => {
        const rect = el.getBoundingClientRect()
        return { x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height }
      }).filter(rect => rect.width > 0 && rect.height > 0)
      setObstacles(old => JSON.stringify(old) === JSON.stringify(next) ? old : next)
    }
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const resize = new ResizeObserver(queue)
    resize.observe(surface)
    if (chat.current) resize.observe(chat.current)
    const mutation = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element) || (!record.target.closest('[data-workspace-canvas-chat], [data-canvas-chat-return], .react-flow__viewport')))) queue()
    })
    mutation.observe(surface, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "aria-hidden", "data-state"] })
    measure()
    return () => { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame) }
  }, [surface])

  useEffect(() => {
    if (anchor || !surface || !flow.viewportInitialized || !size.x) return
    const bounds = surface.getBoundingClientRect()
    setAnchor(flow.screenToFlowPosition({ x: bounds.x + size.x / 2, y: bounds.y + size.y * .45 }))
  }, [anchor, surface, flow, size])

  useEffect(() => {
    setOffscreen(old => fraction < (old ? .4 : .2) || !free({ x: inline.x, y: inline.y }, size, obstacles, old ? 18 : 10))
  }, [fraction, inline.x, inline.y, size, obstacles])

  useEffect(() => {
    if (!surface || !returning) return
    const cancel = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".react-flow")) return
      returnVersion.current += 1
      setReturning(false)
      beginWorkspaceCameraIntent(flow)
      void flow.setViewport(flow.getViewport(), { duration: 0 })
    }
    surface.addEventListener("pointerdown", cancel, true)
    surface.addEventListener("wheel", cancel, true)
    return () => { surface.removeEventListener("pointerdown", cancel, true); surface.removeEventListener("wheel", cancel, true) }
  }, [surface, flow, returning])

  const recenter = async (focus: boolean) => {
    if (!anchor) return
    setIntro(false)
    setReturning(true)
    const version = ++returnVersion.current
    const current = beginWorkspaceCameraIntent(flow)
    try {
      await flow.setViewport({ x: home.x - anchor.x * viewport.zoom, y: home.y - anchor.y * viewport.zoom, zoom: viewport.zoom }, { duration: reduced ? 0 : 360 })
      if (version !== returnVersion.current || !current()) return
      setNotice("Returned to chat")
      if (focus) chat.current?.querySelector<HTMLElement>('[contenteditable="true"], textarea')?.focus({ preventScroll: true })
    } finally { if (version === returnVersion.current) setReturning(false) }
  }

  const returnButton = away && anchor && destination && surface ? createPortal(
    <motion.div data-canvas-chat-return="true" className="absolute z-30 pointer-events-auto"
      initial={false} animate={{ x: destination.x - 22, y: destination.y - 22 }}
      transition={{ duration: !reduced && safeTransition(previous.current, destination, obstacles) ? .12 : 0 }}
      onUpdate={latest => { previous.current = { x: Number(latest.x) + 22, y: Number(latest.y) + 22 } }}>
      <Button type="button" variant="outline" size="icon" className="canvas-planning-material size-11 rounded-full shadow-none"
        aria-label="Return to chat" title="Return to chat" onClick={() => void recenter(true)}>
        <ArrowUpIcon aria-hidden className="size-4" style={{ transform: `rotate(${Math.atan2(projected.y - destination.y, projected.x - destination.x) * 180 / Math.PI + 90}deg)` }} />
      </Button>
    </motion.div>, surface) : null

  // Keep the conversation size independent of canvas pan/zoom; fit smaller screens at home.
  const panelPlanningReserve = planningHeight > 0 ? Math.min(240, size.y * .3) + 12 : 0
  const panelHeight = Math.max(0, Math.min(560, size.y - 64 - composerHeight - 18 - 56 - panelPlanningReserve))

  return <>
    <div ref={chat} data-workspace-canvas-chat="true" data-chat-state={offscreen ? "offscreen" : away ? "away" : "home"}
      className="group/canvas-chat nodrag nopan nowheel absolute z-[2] pointer-events-auto"
      style={{ "--workspace-chat-panel-height": `${panelHeight}px`, width, maxWidth: "calc(100% - 32px)", left: projected.x, top: projected.y, transform: "translate(-50%, calc(-100% + 36px))", visibility: anchor ? "visible" : "hidden" } as CSSProperties}
      onSubmitCapture={() => { if (intro) void recenter(false) }}
      onKeyDownCapture={event => {
        if (intro && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && (event.target as HTMLElement).closest('[contenteditable="true"], textarea')) void recenter(false)
      }}>
      {intro && height < 120 && <p className="group-has-data-[workspace-chat-session]/canvas-chat:hidden pointer-events-none absolute inset-x-0 bottom-full mb-6 text-center text-xl font-normal">Ready to dive in?</p>}
      {children}
    </div>
    {returnButton}
    <span role="status" className="sr-only">{notice}</span>
  </>
}
