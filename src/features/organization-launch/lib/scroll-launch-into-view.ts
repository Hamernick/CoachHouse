// Keep focus scrolling inside the drawer. Element.scrollIntoView also scrolls
// overflow-hidden ancestors, which can shift the canvas without changing its snap.
export function scrollLaunchIntoView(card: HTMLElement) {
  const viewport = card.closest<HTMLElement>(
    '[data-workspace-accelerator-drawer-scroll="true"]'
  )
  if (!viewport) return
  viewport.scrollTo({
    top: viewport.scrollTop + card.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
    behavior: "instant",
  })
}
