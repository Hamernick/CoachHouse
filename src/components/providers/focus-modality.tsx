"use client"

import { useEffect } from "react"

const navigationKeys = new Set([
  "Tab", "Escape", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown",
])
const modifierKeys = new Set(["Shift", "Control", "Alt", "Meta"])

/** Appearance only: never blur controls or interfere with dialog focus management. */
export function FocusModality() {
  useEffect(() => {
    const root = document.documentElement
    const pointer = () => {
      if (root.dataset.focusModality !== "pointer") root.dataset.focusModality = "pointer"
    }
    const keyboard = () => root.removeAttribute("data-focus-modality")
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || modifierKeys.has(event.key)) return
      const target = event.target
      const editing = target instanceof HTMLElement &&
        (target.matches("input, textarea") || target.isContentEditable)
      // Typing after clicking an input should not flash its ring. Navigation,
      // activation, and shortcuts restore indicators before focus can move.
      if (!editing || navigationKeys.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) {
        keyboard()
      }
    }
    const onClick = (event: MouseEvent) => {
      // Keyboard and assistive-technology activation may have no preceding keydown.
      if (event.detail === 0) keyboard()
    }
    window.addEventListener("pointerdown", pointer, true)
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("click", onClick, true)
    window.addEventListener("blur", keyboard)
    return () => {
      window.removeEventListener("pointerdown", pointer, true)
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("click", onClick, true)
      window.removeEventListener("blur", keyboard)
      keyboard()
    }
  }, [])

  return null
}
