import type { Rect, Viewport } from "@xyflow/react"

const valid = (rect: Rect) => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0

/** Largest useful empty rectangle, in canvas-local screen pixels. No graph writes. */
export function workspaceFocusViewport(frame: Rect, target: Rect, obstacles: readonly Rect[]): Viewport | null {
  if (!valid(frame) || !valid(target)) return null
  const boxes = obstacles.filter(valid).map(box => ({
    x: Math.max(0, box.x), y: Math.max(0, box.y),
    right: Math.min(frame.width, box.x + box.width), bottom: Math.min(frame.height, box.y + box.height),
  })).filter(box => box.right > box.x && box.bottom > box.y)
  const xs = [...new Set([0, frame.width, ...boxes.flatMap(box => [box.x, box.right])])].sort((a, b) => a - b)
  let best = { rect: frame, zoom: 0, area: 0 }
  const consider = (x: number, right: number, y: number, bottom: number) => {
    const width = right - x - 48, height = bottom - y - 48
    if (width <= 0 || height <= 0) return
    const zoom = Math.min(1, width / target.width, height / target.height)
    const area = width * height
    if (zoom > best.zoom || (zoom === best.zoom && area > best.area))
      best = { rect: { x: x + 24, y: y + 24, width, height }, zoom, area }
  }
  for (let left = 0; left < xs.length - 1; left++) {
    for (let right = left + 1; right < xs.length; right++) {
      const occupied = boxes.filter(box => box.x < xs[right] && box.right > xs[left]).sort((a, b) => a.y - b.y)
      let top = 0
      for (const box of occupied) {
        consider(xs[left], xs[right], top, box.y)
        top = Math.max(top, box.bottom)
      }
      consider(xs[left], xs[right], top, frame.height)
    }
  }
  // Do not zoom below the canvas floor or claim a fully obscured card fits.
  if (best.zoom < 0.2) return null
  const { rect, zoom } = best
  return {
    x: rect.x + rect.width / 2 - (target.x + target.width / 2) * zoom,
    y: rect.y + rect.height / 2 - (target.y + target.height / 2) * zoom,
    zoom,
  }
}

/** Undefined means unmeasured. Only painted surfaces count. */
export function readWorkspaceCanvasSpace(): { frame: Rect; obstacles: Rect[] } | undefined {
  if (typeof document === "undefined") return undefined
  const frame = document.querySelector<HTMLElement>("[data-workspace-canvas-flow-frame]")
  if (!frame) return undefined
  const bounds = frame.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return undefined
  const surface = frame.closest(".workspace-layout-surface") ?? frame
  const obstacles = [...surface.querySelectorAll<HTMLElement>("[data-workspace-canvas-occluder], [data-workspace-top-navigation], [data-workspace-content-window]")]
    .filter(element => !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none")
    .map(element => {
      const box = element.getBoundingClientRect()
      return { x: box.left - bounds.left, y: box.top - bounds.top, width: box.width, height: box.height }
    })
  return { frame: { x: 0, y: 0, width: bounds.width, height: bounds.height }, obstacles }
}

export function readWorkspaceFocusViewport(target: Rect): Viewport | null | undefined {
  const space = readWorkspaceCanvasSpace()
  return space && workspaceFocusViewport(space.frame, target, space.obstacles)
}
