const OBSTACLES = "[data-workspace-canvas-occluder], [data-workspace-top-navigation], [data-workspace-content-window]"
const GEOMETRY = `${OBSTACLES}, .react-flow__viewport, .react-flow__node`

/** One coalesced geometry read per frame, only while a personal inspection is open. */
export function observeWorkspaceCanvasSpace(onChange: () => void) {
  const frame = document.querySelector<HTMLElement>("[data-workspace-canvas-flow-frame]")
  if (!frame) return () => {}
  const surface = frame.closest(".workspace-layout-surface") ?? frame
  let stopped = false
  let queued = 0
  const moving = new Set<Element>()
  const schedule = () => {
    if (stopped || queued) return
    queued = requestAnimationFrame(() => {
      queued = 0
      if (stopped) return
      onChange()
      // CSS/Web Animations can move an overlay without attribute mutations.
      for (const element of moving) {
        if (!element.isConnected || !element.getAnimations().some(animation => animation.playState === "running")) moving.delete(element)
      }
      if (moving.size) schedule()
    })
  }
  const observed = new Set<Element>()
  const resize = new ResizeObserver(schedule)
  const discover = () => {
    const elements = new Set<Element>([frame, ...surface.querySelectorAll(GEOMETRY)])
    for (const element of observed) if (!elements.has(element)) { resize.unobserve(element); observed.delete(element) }
    for (const element of elements) if (!observed.has(element)) { resize.observe(element); observed.add(element) }
  }
  const relevant = (target: Node) => target instanceof Element && (target === frame || target === surface || Boolean(target.closest(GEOMETRY)) || Boolean(target.querySelector(OBSTACLES)))
  const mutations = new MutationObserver(records => {
    if (!records.some(record => relevant(record.target))) return
    if (records.some(record => record.type === "childList")) discover()
    schedule()
  })
  const motion = (event: Event) => {
    if (!(event.target instanceof Element) || !relevant(event.target)) return
    moving.add(event.target)
    schedule()
  }
  discover()
  mutations.observe(surface, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden", "inert", "aria-hidden"] })
  for (const name of ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"]) surface.addEventListener(name, motion, true)
  window.addEventListener("resize", schedule)
  window.addEventListener("scroll", schedule, true)
  window.visualViewport?.addEventListener("resize", schedule)
  window.visualViewport?.addEventListener("scroll", schedule)
  schedule()
  return () => {
    stopped = true
    cancelAnimationFrame(queued)
    resize.disconnect()
    mutations.disconnect()
    moving.clear()
    for (const name of ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"]) surface.removeEventListener(name, motion, true)
    window.removeEventListener("resize", schedule)
    window.removeEventListener("scroll", schedule, true)
    window.visualViewport?.removeEventListener("resize", schedule)
    window.visualViewport?.removeEventListener("scroll", schedule)
  }
}
