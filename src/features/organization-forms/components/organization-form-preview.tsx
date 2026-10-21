"use client"

import { useCallback, useId, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"

import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import {
  validateFormAnswers,
  normalizeFormAnswerInputs,
  type FormAnswer,
  type FormAnswerIssue,
  type FormSnapshot,
} from "../lib"
import { OrganizationFormAnswerField } from "./organization-form-answer-field"
import styles from "./organization-form-preview.module.css"

/** Local rehearsal, never submission. No nested form inside the Particle editor. */
export function OrganizationFormPreview({
  snapshot,
}: {
  snapshot: FormSnapshot
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [answers, setAnswers] = useState<FormAnswer[]>([])
  const [issues, setIssues] = useState<FormAnswerIssue[]>([])
  const [checked, setChecked] = useState(false)
  const change = useCallback(
    (questionId: string, value: FormAnswer["value"]) => {
      setAnswers((current) => [
        ...current.filter((answer) => answer.questionId !== questionId),
        { questionId, value },
      ])
      setIssues((current) =>
        current.filter((issue) => issue.questionId !== questionId)
      )
      setChecked(false)
    },
    []
  )
  const check = () => {
    const normalized = normalizeFormAnswerInputs(snapshot, answers)
    const result = validateFormAnswers(snapshot, normalized)
    setChecked(result.ok)
    setIssues(result.ok ? [] : result.issues)
    if (!result.ok) {
      const first = result.issues.find((issue) => issue.questionId)?.questionId
      // The input already exists; focus does not wait for a rerender or a timer.
      if (first)
        root.current
          ?.querySelector<HTMLElement>(`[id="${id}-${first}"]`)
          ?.focus()
    }
  }
  return (
    <motion.div
      ref={root}
      className={styles.preview}
      role="group"
      aria-label="Form preview"
      initial={reducedMotion ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion ? { duration: 0 } : WORKSPACE_SURFACE_MOTION.enterOpacity
      }
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return
        const target = event.target
        const textInput =
          target instanceof HTMLInputElement &&
          target.type !== "checkbox" &&
          target.type !== "radio"
        const textArea =
          target instanceof HTMLTextAreaElement &&
          (event.metaKey || event.ctrlKey)
        if (textInput || textArea) {
          event.preventDefault()
          event.stopPropagation()
          check()
        }
      }}

    >
      <p className="text-muted-foreground text-xs">
        Try your questions. Preview answers aren’t saved.
      </p>
      {snapshot.questions.map((question) => (
        <OrganizationFormAnswerField
          key={question.id}
          id={`${id}-${question.id}`}
          question={question}
          value={
            answers.find((answer) => answer.questionId === question.id)?.value
          }
          error={
            issues.find((issue) => issue.questionId === question.id)?.message
          }
          onChange={change}
        />
      ))}
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.check}
          onClick={check}
        >
          Check answers
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-xs"
        >
          {checked
            ? "Answers look good. Nothing was submitted."
            : issues.length
              ? (issues.find((issue) => !issue.questionId)?.message ??
                "Check the highlighted questions.")
              : ""}
        </p>
      </div>
    </motion.div>
  )
}
