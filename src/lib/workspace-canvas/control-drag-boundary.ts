const CONTROL_SELECTOR =
  "button,a,input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=combobox]"

/** Apply React Flow's native nodrag token before its mouse/touch start filter.
 * No event cancellation, DOM scanning or per-frame work: control press handlers
 * and browser defaults remain intact. Portals are outside the canvas surface.
 */
export function protectWorkspaceControlDrag(event: {
  target: EventTarget | null
  currentTarget: { contains: (target: Element) => boolean }
}) {
  const target = event.target
  if (!(target instanceof Element) || !event.currentTarget.contains(target))
    return
  if (!target.closest(".nodrag"))
    target.closest(CONTROL_SELECTOR)?.classList.add("nodrag")
}
