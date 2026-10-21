"use client"

import { memo } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  FORM_ANSWER_LIMITS,
  type FormAnswer,
  type FormSnapshotQuestion,
} from "../lib"
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
    const options = "options" in question ? question.options : null
    return (
      <div className={styles.field}>
        {options ? (
          <fieldset className={styles.choices}>
            <legend className={styles.label}>{label}</legend>
            {question.type === "single_choice" ? (
              <RadioGroup
                id={id}
                aria-label={question.label}
                tabIndex={-1}
                {...accessibility}
                value={typeof value === "string" ? value : ""}
                onValueChange={change}
                className="focus-ring gap-0"
              >
                {options.map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={`${id}-${option.id}`}
                    className={styles.choice}
                  >
                    <RadioGroupItem
                      id={`${id}-${option.id}`}
                      value={option.id}
                    />
                    <span className="min-w-0 break-words">{option.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            ) : (
              <div
                id={id}
                role="group"
                aria-label={question.label}
                tabIndex={-1}
                {...accessibility}
                aria-required={undefined}
                className="focus-ring rounded-xl"
              >
                {options.map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={`${id}-${option.id}`}
                    className={styles.choice}
                  >
                    <Checkbox
                      id={`${id}-${option.id}`}
                      checked={
                        Array.isArray(value) && value.includes(option.id)
                      }
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(value) ? value : []
                        change(
                          checked === true
                            ? [
                                ...current.filter(
                                  (entry) => entry !== option.id
                                ),
                                option.id,
                              ]
                            : current.filter((entry) => entry !== option.id)
                        )
                      }}
                    />
                    <span className="min-w-0 break-words">{option.label}</span>
                  </Label>
                ))}
              </div>
            )}
          </fieldset>
        ) : (
          <>
            <Label htmlFor={id} className={styles.label}>
              {label}
            </Label>
            {question.type === "paragraph" ? (
              <Textarea
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
              <Input
                id={id}
                name={question.id}
                {...accessibility}
                className={styles.input}
                // Preview answers must never block the host Particle's Add/Save.
                // Email validation belongs to the explicit local check below.
                type="text"
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
