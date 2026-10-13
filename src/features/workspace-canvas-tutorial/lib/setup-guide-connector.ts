import type { GuideRect } from "./setup-guide-placement"

export function setupGuideConnectorPath(card: GuideRect, target: GuideRect) {
  const cx = card.left + card.width / 2
  const cy = card.top + card.height / 2
  const tx = target.left + target.width / 2
  const ty = target.top + target.height / 2
  const vertical = card.top + card.height <= target.top || target.top + target.height <= card.top
  const start = vertical
    ? { x: cx, y: ty > cy ? card.top + card.height : card.top }
    : { x: tx > cx ? card.left + card.width : card.left, y: cy }
  const end = vertical
    ? { x: tx, y: ty > cy ? target.top : target.top + target.height }
    : { x: tx > cx ? target.left : target.left + target.width, y: ty }
  if (vertical) {
    const middle = (start.y + end.y) / 2
    return `M ${start.x} ${start.y} C ${start.x} ${middle}, ${end.x} ${middle}, ${end.x} ${end.y}`
  }
  const middle = (start.x + end.x) / 2
  return `M ${start.x} ${start.y} C ${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`
}
