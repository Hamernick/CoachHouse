/** A release outside the bar cancels navigation. */
export function resolveMobileNavigationIndex({
  x,
  y,
  left,
  top,
  width,
  height,
  count,
}: {
  x: number
  y: number
  left: number
  top: number
  width: number
  height: number
  count: number
}): number | null {
  if (
    width <= 0 ||
    count < 1 ||
    x < left ||
    x > left + width ||
    y < top ||
    y > top + height
  )
    return null
  return Math.min(count - 1, Math.floor(((x - left) / width) * count))
}

export function isMobileNavigationPathActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
}
