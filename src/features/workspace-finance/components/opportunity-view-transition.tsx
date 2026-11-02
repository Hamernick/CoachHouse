"use client"

import { useSyncExternalStore, type ReactNode, type Ref } from "react"
import { motion, useIsPresent } from "framer-motion"

const reducedQuery = "(prefers-reduced-motion: reduce)"
const subscribeReducedMotion = (notify: () => void) => {
  const media = window.matchMedia(reducedQuery)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}
const readReducedMotion = () => window.matchMedia(reducedQuery).matches
const serverReducedMotion = () => false
const useReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion)

export function OpportunityView({ kind, rootRef, onEntered, children }: {
  kind: "list" | "editor" | "detail"; rootRef: Ref<HTMLDivElement>; onEntered: () => void; children: ReactNode
}) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  const offset = reduced ? 0 : kind !== "list" ? 12 : -12
  return <motion.div ref={rootRef} data-opportunity-view={kind} inert={!present} aria-hidden={!present}
    className="flex min-w-0 flex-col gap-3" initial="enter" animate="visible" exit="exit"
    variants={{ enter: { opacity: 0, x: offset }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: offset, transition: { duration: reduced ? 0 : 0.1 } } }}
    transition={{ duration: reduced ? 0 : 0.16, ease: [0.4, 0, 0.2, 1] }}
    onAnimationStart={state => { if (state === "visible" && present) onEntered() }}>
    {children}
  </motion.div>
}

// Portals live outside the body's DOM, so animate and disable them explicitly.
export function OpportunityViewControls({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  return <motion.div inert={!present} aria-hidden={!present} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.1 }}>{children}</motion.div>
}
