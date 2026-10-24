"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { motion, useIsPresent, useReducedMotion } from "motion/react"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"

export type DecisionEditorContent = {
  id: string
  label: string
  description: string
  positionLabel: string
  content: ReactNode
  actions: ReactNode
}

export type DecisionEditorOrigin = {
  x: number
  y: number
  scaleX: number
  scaleY: number
}

const expanded = { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }
const variants = {
  expanded,
  collapsed: (origin: DecisionEditorOrigin | null) => ({
    ...(origin ?? expanded),
    opacity: 0,
  }),
}

export function DecisionCanvasEditor({
  editor,
  origin,
  onClose,
}: {
  editor: DecisionEditorContent
  origin: DecisionEditorOrigin | null
  onClose: () => void
}) {
  const reducedMotion = useReducedMotion()
  const present = useIsPresent()
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [editor.id])

  return (
    <motion.section
      data-canvas-editor
      data-editor-state={present ? "expanded" : "collapsing"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-hidden={!present || undefined}
      inert={!present || undefined}
      className="bg-card text-card-foreground absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl shadow-sm"
      style={{ transformOrigin: "top left" }}
      custom={reducedMotion ? null : origin}
      variants={variants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      transition={{
        duration: reducedMotion ? 0 : present ? 0.28 : 0.18,
        ease: [0.22, 1, 0.36, 1],
      }}

    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs">
            {editor.positionLabel}
          </p>
          <h4
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className="text-sm font-semibold"
          >
            {editor.label}
          </h4>
          <p
            id={descriptionId}
            className="text-muted-foreground text-xs leading-4"
          >
            {editor.description}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          aria-label="Collapse step"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </header>
      <div
        ref={body}
        data-planner-editor
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <motion.div
          key={editor.id}
          className="mx-auto w-full max-w-2xl min-w-0 py-3"
          initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          {editor.content}
        </motion.div>
      </div>
    </motion.section>
  )
}
