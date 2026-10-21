"use client"

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useAnimationControls, useMotionValue } from "motion/react"
import type { WorkspaceContentWindowGeometry } from "./workspace-content-window-geometry"
import {
  createWorkspaceWindowMotionDriver,
  readWorkspaceReducedMotion,
  subscribeWorkspaceReducedMotion,
  workspaceReducedMotionServerSnapshot,
  resolveWorkspaceWindowOrigin,
  WORKSPACE_WINDOW_MOTION,
  workspaceWindowTransition,
  WORKSPACE_WINDOW_OPEN,
} from "./workspace-content-window-motion"

export function useWorkspaceContentWindowMotion({
  geometry,
  collapsed,
  getAnchorRect,
}: {
  geometry?: WorkspaceContentWindowGeometry | null
  collapsed: boolean
  getAnchorRect?: () => DOMRect | null
}) {
  const controls = useAnimationControls()
  const willChange = useMotionValue("auto")
  const active = useRef({ presence: false, layout: false })
  const markActive = useCallback(
    (channel: "presence" | "layout", value: boolean) => {
      active.current[channel] = value
      willChange.set(
        active.current.presence || active.current.layout ? "transform" : "auto"
      )
    },
    [willChange]
  )
  const resetActivity = useCallback(() => {
    active.current = { presence: false, layout: false }
    willChange.set("auto")
  }, [willChange])
  // The installed Motion hook only captures the initial preference. Subscribe
  // here so enabling reduced motion cancels an in-flight transition immediately.
  const reducedMotion = useSyncExternalStore(
    subscribeWorkspaceReducedMotion,
    readWorkspaceReducedMotion,
    workspaceReducedMotionServerSnapshot
  )
  const driver = useMemo(
    () => createWorkspaceWindowMotionDriver(controls),
    [controls]
  )
  const surfaceRef = useRef<HTMLElement>(null)
  const wasHidden = useRef(true)
  const settled = useRef(false)
  const origin = useRef<ReturnType<typeof resolveWorkspaceWindowOrigin>>({
    originX: 0.5,
    originY: 1,
    x: 0,
    y: WORKSPACE_WINDOW_MOTION.travel,
  })
  const [exitFinished, setExitFinished] = useState(collapsed)
  const [previousCollapsed, setPreviousCollapsed] = useState(collapsed)
  const [lastGeometry, setLastGeometry] = useState(geometry)
  const desktop = Boolean(geometry)
  if (previousCollapsed !== collapsed) {
    setPreviousCollapsed(collapsed)
    if (!collapsed) setExitFinished(false)
  }
  if (
    !collapsed &&
    (lastGeometry?.width !== geometry?.width ||
      lastGeometry?.height !== geometry?.height)
  )
    setLastGeometry(geometry)
  const present = !collapsed || (desktop && !reducedMotion && !exitFinished)
  const paintedGeometry =
    collapsed && present ? (lastGeometry ?? geometry) : geometry

  // Do not stop motion in the per-update cleanup: reversals must retarget the
  // running spring. Unmount and explicit static-mode resets still cancel it.
  useLayoutEffect(
    () => () => {
      driver.stop()
      resetActivity()
    },
    [driver, resetActivity]
  )

  useLayoutEffect(() => {
    if (!desktop || reducedMotion) {
      resetActivity()
      driver.set(WORKSPACE_WINDOW_OPEN)
      wasHidden.current = collapsed
      setExitFinished(collapsed)
      settled.current = false
      return
    }
    if (collapsed && exitFinished) {
      resetActivity()
      driver.set({ ...WORKSPACE_WINDOW_OPEN, opacity: 0 })
      wasHidden.current = true
      settled.current = false
      return
    }
    if (wasHidden.current || (settled.current && !active.current.layout)) {
      const rect = surfaceRef.current?.getBoundingClientRect()
      if (rect)
        origin.current = resolveWorkspaceWindowOrigin(
          rect,
          getAnchorRect?.() ?? null
        )
      driver.set({
        originX: origin.current.originX,
        originY: origin.current.originY,
      })
    }
    const closed = {
      opacity: 0,
      scale: WORKSPACE_WINDOW_MOTION.closedScale,
      x: origin.current.x,
      y: origin.current.y,
    }
    if (!collapsed && wasHidden.current) driver.set(closed)
    settled.current = false
    wasHidden.current = false
    markActive("presence", true)
    driver.animate(
      {
        ...(collapsed ? closed : WORKSPACE_WINDOW_OPEN),
        transition: workspaceWindowTransition(collapsed),
      },
      () => {
        markActive("presence", false)
        settled.current = !collapsed
        if (collapsed) {
          wasHidden.current = true
          setExitFinished(true)
        }
      }
    )
  }, [
    collapsed,
    desktop,
    driver,
    exitFinished,
    getAnchorRect,
    reducedMotion,
    markActive,
    resetActivity,
  ])

  return {
    controls,
    surfaceRef,
    present,
    paintedGeometry,
    reducedMotion,
    willChange,
    onLayoutAnimationStart: () => markActive("layout", true),
    onLayoutAnimationComplete: () => markActive("layout", false),
  }
}
