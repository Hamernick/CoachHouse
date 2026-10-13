import { PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three"

import { createLaunchGlobeScene } from "./organization-launch-globe-scene"
import type { LaunchGlobeLocation } from "../lib/globe-location"

/** Adapted from the user-supplied Framer University globe; no Framer runtime. */
export function mountLaunchGlobe(container: HTMLElement, onUnavailable: () => void, initialLocation: LaunchGlobeLocation | null = null) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor("#050505", 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  const canvas = renderer.domElement
  canvas.className = "absolute inset-0 h-full w-full"
  canvas.setAttribute("aria-hidden", "true")
  const scene = new Scene()
  const camera = new PerspectiveCamera(26, 16 / 9, 0.1, 20)
  camera.position.z = 2.7
  const model = createLaunchGlobeScene()
  const location = initialLocation
  model.setLocation(location)
  scene.add(model.globe)
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const events = new AbortController()
  let disposed = false
  let lost = false
  let visible = true
  let pointer: number | null = null
  let lastX = 0
  let lastY = 0
  let velocity = 0
  let yaw = model.globe.rotation.y
  let pitch = model.globe.rotation.x
  let frame: number | null = null
  let previousTime = 0

  const render = () => {
    if (!disposed && !lost) renderer.render(scene, camera)
  }
  const canAnimate = () => !disposed && !lost && visible && document.visibilityState !== "hidden"
  const tick = (time: number) => {
    frame = null
    if (!canAnimate()) return
    const delta = Math.min((time - previousTime) / 1000, 0.05)
    previousTime = time
    if (pointer === null && !reducedMotion.matches) {
      yaw += velocity * delta
      velocity *= Math.exp(-7 * delta)
    }
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-10 * delta)
    model.globe.rotation.y += (yaw - model.globe.rotation.y) * ease
    model.globe.rotation.x += (pitch - model.globe.rotation.x) * ease
    render()
    if (Math.abs(velocity) > 0.001 || Math.abs(yaw - model.globe.rotation.y) > 0.0001 || Math.abs(pitch - model.globe.rotation.x) > 0.0001) {
      frame = requestAnimationFrame(tick)
    }
  }
  const start = () => {
    if (frame === null && canAnimate()) {
      previousTime = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }
  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }
  const resize = () => {
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    render()
  }
  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    pointer = null
    if (event.type === "pointercancel" || reducedMotion.matches) velocity = 0
    start()
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (location || !event.isPrimary || event.button !== 0) return
    event.stopPropagation()
    pointer = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    velocity = 0
    canvas.setPointerCapture(event.pointerId)
  }, { signal: events.signal })
  canvas.addEventListener("pointermove", (event) => {
    if (pointer !== event.pointerId) return
    const dx = event.clientX - lastX
    yaw += dx * 0.009
    // Vertical touch gestures belong to the drawer's scroll viewport.
    if (event.pointerType !== "touch") pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + (event.clientY - lastY) * 0.009))
    velocity = reducedMotion.matches ? 0 : Math.max(-2, Math.min(2, dx * 0.08))
    lastX = event.clientX
    lastY = event.clientY
    start()
  }, { signal: events.signal })
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) canvas.addEventListener(name, release, { signal: events.signal })
  container.addEventListener("keydown", (event) => {
    if (location || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === "ArrowLeft") yaw -= 0.15
    if (event.key === "ArrowRight") yaw += 0.15
    if (event.key === "ArrowUp") pitch -= 0.15
    if (event.key === "ArrowDown") pitch += 0.15
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))
    start()
  }, { signal: events.signal })
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault()
    lost = true
    stop()
    canvas.style.visibility = "hidden"
    onUnavailable()
  }, { signal: events.signal })
  document.addEventListener("visibilitychange", () => { if (canAnimate()) start(); else stop() }, { signal: events.signal })
  reducedMotion.addEventListener("change", () => { velocity = 0; start() }, { signal: events.signal })
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    if (visible) start(); else stop()
  })
  const observer = new ResizeObserver(resize)
  resize()
  container.appendChild(canvas)
  observer.observe(container)
  intersection.observe(container)
  start()
  return { dispose() {
    disposed = true
    stop()
    events.abort()
    observer.disconnect()
    intersection.disconnect()
    model.dispose()
    renderer.dispose()
    canvas.remove()
  } }
}
