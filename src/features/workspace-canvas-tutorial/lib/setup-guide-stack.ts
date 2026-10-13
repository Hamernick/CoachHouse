/** Screen-space allocation shared by the guide and the React Flow camera. */
export function setupGuideStackSpace(height: number, measuredGuideHeight = 360) {
  const padding = 16
  const gap = 20
  const usable = Math.max(1, height - padding * 2)
  const guideHeight = Math.min(360, usable * 0.52, Math.max(1, measuredGuideHeight))
  return { padding, gap, guideHeight, nodeHeight: Math.max(1, usable - guideHeight - gap) }
}

export function setupGuideStackViewport(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  measuredGuideHeight?: number,
) {
  const space = setupGuideStackSpace(viewport.height, measuredGuideHeight)
  const zoom = Math.max(0.05, Math.min(0.78,
    Math.max(1, viewport.width - space.padding * 2) / Math.max(1, bounds.width),
    space.nodeHeight / Math.max(1, bounds.height),
  ))
  const groupHeight = bounds.height * zoom + space.gap + space.guideHeight
  const top = (viewport.height - groupHeight) / 2
  return {
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: top - bounds.y * zoom,
    zoom,
  }
}
