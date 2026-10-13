// Keep camera targets inside the clear screen when its canvas extends behind the page.
export function resolvePublicMapScreenPadding(container?: HTMLElement | null) {
  const screen = container?.closest("[data-public-map-screen]")
  if (!screen || !container) return undefined
  const canvasBounds = container.getBoundingClientRect()
  const screenBounds = screen.getBoundingClientRect()
  return {
    top: Math.max(0, screenBounds.top - canvasBounds.top),
    left: Math.max(0, screenBounds.left - canvasBounds.left),
    right: Math.max(0, canvasBounds.right - screenBounds.right),
    bottom: Math.max(0, canvasBounds.bottom - screenBounds.bottom),
  }
}
