"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react"
import { motion, useReducedMotion } from "motion/react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import CircleHelpIcon from "lucide-react/dist/esm/icons/circle-help"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import { useRegisterAppShellAccountMenuAction } from "@/components/app-shell/account-menu-actions-context"
import { Button } from "@/components/ui/button"
import { setupGuideFocusCard, nextSetupGuideStage, resolveSetupGuideStage, SETUP_GUIDE_STAGE_IDS, type SetupGuideEvidence } from "../lib/setup-guide"
import { useSetupGuide } from "../hooks/use-setup-guide"
import { useSetupGuideAnchor } from "../hooks/use-setup-guide-anchor"
import { useSetupGuideStackResize } from "../hooks/use-setup-guide-stack-resize"
import { useSetupGuidePreview } from "../hooks/use-setup-guide-preview"
import { SetupGuideSummary } from "./setup-guide-art"
import { SetupGuidePanel } from "./setup-guide-panel"
import { SetupGuideConnector } from "./setup-guide-connector"
import styles from "./workspace-setup-guide.module.css"

export function WorkspaceSetupGuide({ scope, initialActive, restartKey, evidence, onClose, onFocusCard }: {
  scope: string
  initialActive: boolean
  restartKey: number
  evidence: SetupGuideEvidence
  onClose: () => void
  onFocusCard: (id: "organization-overview" | "programs" | "accelerator") => void
}) {
  const { progress, storageAvailable, open, navigate, close } = useSetupGuide({ scope, initialActive, restartKey, onClose })
  const { cardRef, position, target } = useSetupGuideAnchor(progress.stage, open)
  const reducedMotion = useReducedMotion()
  useSetupGuidePreview(open)
  useSetupGuideStackResize(open && (progress.stage === "identity" || progress.stage === "identity-edit"), () => onFocusCard("organization-overview"))
  useLayoutEffect(() => {
    if (cardRef.current) cardRef.current.scrollTop = 0
  }, [progress.stage, cardRef])
  const heading = useRef<HTMLHeadingElement>(null)
  const focusCard = useRef(onFocusCard)
  focusCard.current = onFocusCard
  const router = useRouter()
  const helpAction = useMemo(() => ({ id: "workspace-setup-guide", label: "Resume setup guide", icon: CircleHelpIcon, onSelect: () => router.push("/workspace?guide=1", { scroll: false }), priority: 15, visibility: "all" as const }), [router])
  useRegisterAppShellAccountMenuAction(helpAction)
  useEffect(() => {
    if (!open) return
    const targetCard = setupGuideFocusCard(progress.stage)
    if (targetCard) focusCard.current(targetCard)
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, progress.stage])
  if (!open) return null
  const stage = resolveSetupGuideStage(progress.stage, evidence)
  const index = SETUP_GUIDE_STAGE_IDS.indexOf(progress.stage)
  const welcome = progress.stage === "welcome"
  const finished = progress.stage === "next"
  const advance = () => navigate(nextSetupGuideStage(progress.stage))
  return createPortal(
    <div className={`${styles.root} pointer-events-none fixed inset-0 z-[60]`} data-workspace-setup-walkthrough="true" data-setup-guide-stage={progress.stage} style={{ paddingTop: "env(safe-area-inset-top)", paddingRight: "env(safe-area-inset-right)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)" }}>
      <SetupGuideConnector cardRef={cardRef} target={target} position={position} />
      <motion.aside
        ref={cardRef}
        layout={reducedMotion ? false : "size"}
        initial={false}
        animate={{ x: position?.left ?? 16, y: position?.top ?? 16 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Workspace walkthrough"
        className="nodrag nopan pointer-events-auto fixed left-0 top-0 flex flex-col overflow-x-hidden overflow-y-auto border border-border/80 bg-popover text-popover-foreground shadow-lg"
        style={{ borderRadius: 22, width: position?.width ?? 380, maxHeight: position?.maxHeight ?? "calc(100dvh - 2rem)", "--setup-guide-available-height": `${position?.maxHeight ?? 480}px`, visibility: position ? "inherit" : "hidden" } as CSSProperties}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close() } }}
      >
        <SetupGuidePanel
          contentKey={progress.stage}
          headingRef={heading}
          title={stage.title}
          body={stage.body}
          storageAvailable={storageAvailable}
          onClose={() => close()}
          closeLabel={welcome ? "Close introduction" : "Close walkthrough"}
          actions={welcome ? (
            <Button className="min-h-11 max-w-full whitespace-normal rounded-full px-6 py-2" onClick={advance}>{stage.label}</Button>
          ) : (
            <nav aria-label="Walkthrough steps" className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="-ml-2 min-h-11 gap-1 rounded-full px-2 text-muted-foreground" onClick={() => navigate(SETUP_GUIDE_STAGE_IDS[index - 1])}><ChevronLeftIcon className="size-3.5" aria-hidden />Back</Button>
              <Button variant={finished ? "default" : "ghost"} size="sm" className="min-h-11 gap-1 rounded-full px-3" onClick={finished ? () => close(true, stage.href ?? "/workspace") : advance}>{finished ? stage.label : "Next"}{!finished ? <ChevronRightIcon className="size-3.5" aria-hidden /> : null}</Button>
            </nav>
          )}
        >
          {finished ? <div className="mt-4 text-left"><SetupGuideSummary evidence={evidence} /></div> : null}
        </SetupGuidePanel>
      </motion.aside>
    </div>, document.body,
  )
}
