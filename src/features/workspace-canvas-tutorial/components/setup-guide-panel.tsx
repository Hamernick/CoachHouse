import { motion, useReducedMotion } from "motion/react"
import type { ReactNode, RefObject } from "react"
import { SetupGuideArt } from "./setup-guide-art"
import { SetupGuideCloseButton } from "./setup-guide-close-button"

/** Shared presentation keeps every tour stop in the welcome's visual language. */
export function SetupGuidePanel({ headingRef, title, body, storageAvailable, onClose, closeLabel, children, actions, contentKey }: {
  contentKey?: string
  headingRef: RefObject<HTMLHeadingElement | null>
  title: string
  body: string
  storageAvailable: boolean
  onClose: () => void
  closeLabel?: string
  children?: ReactNode
  actions: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <>
      <div className="relative shrink-0 overflow-hidden">
        <SetupGuideArt />
        <SetupGuideCloseButton className="absolute right-3 top-3" overImage label={closeLabel} onClose={onClose} />
      </div>
      <motion.div key={contentKey} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }} className="min-h-20 shrink-0 px-5 pt-4 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="text-balance text-lg font-semibold leading-tight tracking-tight outline-none focus-visible:underline">
          {title}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-pretty text-sm leading-5 text-muted-foreground">
          {body}
        </p>
        {children}
        {!storageAvailable ? <p role="status" className="mt-2 text-xs text-muted-foreground">Guide progress can’t be saved on this device.</p> : null}
      </motion.div>
      <div className="shrink-0 px-5 pb-4 pt-3 text-center">
        {actions}
      </div>
    </>
  )
}
