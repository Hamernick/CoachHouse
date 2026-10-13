"use client"

import { useCallback, useRef, type KeyboardEvent } from "react"

const RESULT_TRIGGER_SELECTOR = "[data-public-map-result-trigger='true']"
const SEARCH_INPUT_SELECTOR = "[data-public-map-search-input='true']"

export function usePublicMapSearchKeyboardNavigation() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const focusBoundaryResult = useCallback((edge: "first" | "last") => {
    const triggers = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>(
        RESULT_TRIGGER_SELECTOR
      ) ?? []
    )
    const target = edge === "first" ? triggers[0] : triggers.at(-1)
    target?.focus()
  }, [])

  const handleResultKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const currentTrigger = target.closest<HTMLButtonElement>(
        RESULT_TRIGGER_SELECTOR
      )
      if (!currentTrigger) return

      if (event.key === "Escape") {
        event.preventDefault()
        const scope = containerRef.current?.closest("[data-slot=sidebar-inset]") ?? containerRef.current
        scope
          ?.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)
          ?.focus()
        return
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return

      const triggers = Array.from(
        containerRef.current?.querySelectorAll<HTMLButtonElement>(
          RESULT_TRIGGER_SELECTOR
        ) ?? []
      )
      const currentIndex = triggers.indexOf(currentTrigger)
      if (currentIndex === -1) return
      const direction = event.key === "ArrowDown" ? 1 : -1
      const nextIndex =
        (currentIndex + direction + triggers.length) % triggers.length
      event.preventDefault()
      triggers[nextIndex]?.focus()
    },
    []
  )

  return { containerRef, focusBoundaryResult, handleResultKeyDown }
}
