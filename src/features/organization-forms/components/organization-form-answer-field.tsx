"use client"

import { memo } from "react"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { ParticleTextarea as Textarea } from "@/components/ui/particle-ui"
import { ParticleSelect as Select } from "@/components/ui/particle-ui"
import { Label } from "@/components/ui/label"
import {
  FORM_ANSWER_LIMITS,
  type FormAnswer,
  type FormSnapshotQuestion,
} from "../lib"
import { OrganizationFormChoiceAnswer } from "./organization-form-choice-answer"
import { OrganizationFormGridAnswer } from "./organization-form-grid-answer"
import { OrganizationFormScaleAnswer } from "./organization-form-scale-answer"
import styles from "./organization-form-preview.module.css"

export const OrganizationFormAnswerField = memo(
  function OrganizationFormAnswerField({
    question,
    id,
    value,
    error,
    onChange,
  }: {
    question: FormSnapshotQuestion
    id: string
    value: FormAnswer["value"] | undefined
    error?: string
    onChange: (questionId: string, value: FormAnswer["value"]) => void
  }) {
    const label = (
      <>
        {question.label}
        {question.required && (
          <span className="text-muted-foreground ml-1 text-xs">(required)</span>
        )}
      </>
    )
    const accessibility = {
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${id}-error` : undefined,
      "aria-required": question.required,
    }
    const change = (next: FormAnswer["value"]) => onChange(question.id, next)
    return (
      <div className={styles.field}>
        {question.type === "multiple_choice_grid" || question.type === "checkbox_grid" ? (
          <OrganizationFormGridAnswer question={question} id={id} value={value} error={error} onChange={change} />
        ) : question.type === "linear_scale" || question.type === "rating" ? (
          <OrganizationFormScaleAnswer question={question} id={id} value={value} error={error} onChange={change} />
        ) : question.type === "dropdown" ? (
          <>
            <Label htmlFor={id} className={styles.label}>{label}</Label>
            <Select id={id} {...accessibility} className={`${styles.input} w-full min-w-0`}
              value={typeof value === "string" ? value : ""}
              onChange={event => ((next: string) => change(next === "__empty__" ? "" : next))(event.target.value)}
            ><option value="" disabled>Choose an option…</option>
                <option value="__empty__">No selection</option>
                {question.options.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}

            </Select>
          </>
        ) : question.type === "single_choice" || question.type === "multiple_choice" ? (
          <OrganizationFormChoiceAnswer question={question} id={id} value={value} error={error} onChange={change} />
        ) : (
          <>
            <Label htmlFor={id} className={styles.label}>
              {label}
            </Label>
            {question.type === "paragraph" ? (
              <Textarea size="2xl"
                id={id}
                name={question.id}
                {...accessibility}
                className={styles.textarea}
                value={typeof value === "string" ? value : ""}
                maxLength={FORM_ANSWER_LIMITS.paragraph}
                placeholder="Your answer…"
                onChange={(event) => change(event.target.value)}
              />
            ) : (
              <Input size="2xl"
                id={id}
                name={question.id}
                {...accessibility}
                className={`${styles.input} min-w-0`}
                // Preview answers must never block the host Particle's Add/Save.
                // Email validation belongs to the explicit local check below.
                type={question.type === "date" || question.type === "time" ? question.type : "text"}
                inputMode={
                  question.type === "number"
                    ? "decimal"
                    : question.type === "email"
                      ? "email"
                      : "text"
                }
                autoComplete={question.type === "email" ? "email" : "off"}
                spellCheck={
                  question.type === "email" || question.type === "number"
                    ? false
                    : undefined
                }
                value={
                  typeof value === "string" || typeof value === "number"
                    ? value
                    : ""
                }
                maxLength={
                  question.type === "email"
                    ? FORM_ANSWER_LIMITS.email
                    : FORM_ANSWER_LIMITS.text
                }
                placeholder="Your answer…"
                onChange={(event) => change(event.target.value)}
              />
            )}
          </>
        )}
        {error && (
          <p id={`${id}-error`} className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    )
  }
)
