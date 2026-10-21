"use client"

import { useId, useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import EyeIcon from "lucide-react/dist/esm/icons/eye"

import { Empty } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  FORM_QUESTION_LABELS,
  createFormQuestion,
  createFormSnapshot,
  publishedFormDefinitionSchema,
} from "../lib"
import type { FormDefinition, FormQuestion } from "../types"
import { OrganizationFormQuestionEditor } from "./organization-form-question-editor"
import { OrganizationFormPreview } from "./organization-form-preview"
import styles from "./organization-form-builder.module.css"

/** Controlled draft editor. Its host owns Save, concurrency and authorization. */
export function OrganizationFormBuilder({
  definition,
  disabled = false,
  onChange,
  preview: controlledPreview,
  onPreviewChange,
  showPreviewControl = true,
}: {
  definition: FormDefinition
  preview?: boolean
  onPreviewChange?: (preview: boolean) => void
  showPreviewControl?: boolean
  disabled?: boolean
  onChange: (value: FormDefinition) => void
}) {
  const id = useId()
  const reducedMotion = useReducedMotion()
  const [expanded, setExpanded] = useState<string | null>(
    definition.questions[0]?.id ?? null
  )
  const [newQuestion, setNewQuestion] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState(false)
  const preview = controlledPreview ?? localPreview
  const setPreview = (value: boolean) => {
    setLocalPreview(value)
    onPreviewChange?.(value)
  }
  const previewSnapshot = useMemo(() => {
    if (
      !preview ||
      !publishedFormDefinitionSchema.safeParse(definition).success
    )
      return null
    return createFormSnapshot(definition)
  }, [definition, preview])
  const previewKey = useMemo(
    () => (previewSnapshot ? JSON.stringify(previewSnapshot) : ""),
    [previewSnapshot]
  )
  const update = (question: FormQuestion) =>
    onChange({
      ...definition,
      questions: definition.questions.map((item) =>
        item.id === question.id ? question : item
      ),
    })
  return (
    <section
      aria-label="Form questions"
      className={styles.builder}

    >
      <div className={styles.toolbar}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.pill}
          disabled={disabled || preview || definition.questions.length >= 50}
          onClick={() => {
            const question = createFormQuestion(crypto.randomUUID())
            onChange({
              ...definition,
              questions: [question, ...definition.questions],
            })
            setExpanded(question.id)
            setNewQuestion(question.id)
          }}
        >
          <PlusIcon aria-hidden /> Add question
        </Button>
        {showPreviewControl && <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.pill}
            aria-pressed={preview}
            aria-controls={`${id}-content`}
            onClick={() => setPreview(!preview)}
          >
            <EyeIcon aria-hidden /> {preview ? "Edit" : "Preview"}
          </Button>}
      </div>
      <div id={`${id}-content`}>
        {preview ? (
          previewSnapshot ? (
            <OrganizationFormPreview
              key={previewKey}
              snapshot={previewSnapshot}
            />
          ) : (
            <p
              role="status"
              className="text-muted-foreground px-2 py-4 text-sm"
            >
              Add a question, finish its label, and give each choice question at
              least two distinct options before previewing. Choose Edit to continue.
            </p>
          )
        ) : definition.questions.length === 0 ? (
          <Empty title="No questions yet" description="Add your first question to get started." className={styles.empty} />
        ) : (
          <div className={styles.rows}>
            {definition.questions.map((question, index) => (
              <Collapsible
                key={question.id}
                open={expanded === question.id}
                onOpenChange={(open) => setExpanded(open ? question.id : null)}
                className={styles.row}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={styles.questionTrigger}
                  >
                    <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">{index + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                      <span className="truncate font-medium">{question.label.trim() || `Question ${index + 1}`}</span>
                      <span className="text-muted-foreground text-xs">{FORM_QUESTION_LABELS[question.type]}</span>
                    </span>
                    {question.required && (
                      <span className="text-muted-foreground text-xs">
                        Required
                      </span>
                    )}
                    <ChevronDownIcon className="transition-transform duration-150 motion-reduce:transition-none" style={{ transform: expanded === question.id ? "rotate(180deg)" : undefined }} aria-hidden />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : WORKSPACE_SURFACE_MOTION.enterOpacity
                    }
                  >
                    <OrganizationFormQuestionEditor
                      question={question}
                      index={index}
                      definition={definition}
                      id={`${id}-${question.id}`}
                      disabled={disabled}
                      autoFocus={newQuestion === question.id}
                      onChange={update}
                      onDefinitionChange={onChange}
                      onRemove={() => {
                        onChange({
                          ...definition,
                          questions: definition.questions.filter(
                            (q) => q.id !== question.id
                          ),
                        })
                        setExpanded(null)
                      }}
                    />
                  </motion.div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
