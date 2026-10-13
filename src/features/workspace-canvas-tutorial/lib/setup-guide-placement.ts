import { setupGuideStackSpace } from "./setup-guide-stack"

export type GuideRect = { left: number; top: number; width: number; height: number }
export type GuideViewport = {
  width: number
  height: number
  left?: number
  top?: number
  insets?: { top: number; right: number; bottom: number; left: number }
}

export function placeSetupGuide(
  target: GuideRect | null,
  viewport: GuideViewport,
  card: { width: number; height: number },
  options: { compact?: boolean; contextual?: boolean; above?: boolean; stack?: boolean } = {},
) {
  const gap = 20
  const leftEdge = (viewport.left ?? 0) + 16 + (viewport.insets?.left ?? 0)
  const topEdge = (viewport.top ?? 0) + 16 + (viewport.insets?.top ?? 0)
  const rightEdge = (viewport.left ?? 0) + viewport.width - 16 - (viewport.insets?.right ?? 0)
  const bottomEdge = (viewport.top ?? 0) + viewport.height - 16 - (viewport.insets?.bottom ?? 0)
  const mobile = viewport.width < 768
  const width = Math.max(1, Math.min(options.compact ? 304 : card.width, rightEdge - leftEdge))
  const availableHeight = Math.max(1, bottomEdge - topEdge)
  const contextual = options.contextual ?? Boolean(target)
  const maxHeight = mobile && contextual && !options.compact
    ? Math.min(availableHeight, 420, Math.max(280, viewport.height * 0.55))
    : availableHeight
  const height = Math.min(card.height, maxHeight)
  const clampX = (x: number) => Math.max(leftEdge, Math.min(x, rightEdge - width))
  const clampY = (y: number) => Math.max(topEdge, Math.min(y, bottomEdge - height))
  const result = (left: number, top: number) => ({ left: clampX(left), top: clampY(top), width, maxHeight, mobile, panelHeight: undefined as number | undefined })

  if (options.stack && target) {
    const { guideHeight: heightLimit } = setupGuideStackSpace(viewport.height)
    const guideHeight = Math.min(card.height, heightLimit)
    return {
      left: clampX((leftEdge + rightEdge - width) / 2),
      top: Math.max(topEdge, Math.min(target.top + target.height + gap, bottomEdge - guideHeight)),
      width, maxHeight: heightLimit, panelHeight: undefined, mobile,
    }
  }
  if (options.above && target) {
    // On short screens the panel scrolls internally, leaving the introduced tab exposed.
    const roomAbove = Math.max(1, target.top - topEdge - gap)
    const roomBelow = Math.max(1, bottomEdge - target.top - target.height - gap)
    const above = roomAbove >= 120 || roomAbove >= roomBelow
    const limit = Math.min(maxHeight, above ? roomAbove : roomBelow)
    const visibleHeight = Math.min(card.height, limit)
    return {
      left: clampX((leftEdge + rightEdge - width) / 2),
      top: above ? Math.max(topEdge, target.top - gap - visibleHeight) : target.top + target.height + gap,
      width, maxHeight: limit, panelHeight: undefined, mobile,
    }
  }
  if (options.compact) return result(rightEdge - width, topEdge + 56)
  if (!target) return result((leftEdge + rightEdge - width) / 2, (topEdge + bottomEdge - height) / 2)
  if (mobile) {
    // Keep the highlighted control exposed whenever either side has room.
    if (target.top - height - gap >= topEdge) return result(leftEdge, target.top - height - gap)
    if (target.top + target.height + gap + height <= bottomEdge) return result(leftEdge, target.top + target.height + gap)
    return result(leftEdge, bottomEdge - height)
  }
  const right = target.left + target.width + gap
  const left = target.left - width - gap
  let x = right + width <= rightEdge ? right : left >= leftEdge ? left : rightEdge - width
  let y = target.top + Math.min(32, target.height / 4)
  if (left < leftEdge && right + width > rightEdge) {
    y = target.top + target.height + gap
    if (y + height > bottomEdge) y = target.top - height - gap
    x = target.left
  }
  return result(x, y)
}
