"use client"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import {
  changeFormQuestionType,
  formQuestionTypeSchema,
  FORM_QUESTION_LABELS,
  FORM_QUESTION_TYPES,
  moveFormQuestion,
} from "../lib"
import type { FormDefinition, FormQuestion } from "../types"
import styles from "./organization-form-builder.module.css"

export function OrganizationFormQuestionEditor({
  question,
  index,
  definition,
  id,
  disabled,
  autoFocus,
  onChange,
  onDefinitionChange,
  onRemove,
}: {
  question: FormQuestion
  index: number
  definition: FormDefinition
  id: string
  disabled: boolean
  autoFocus: boolean
  onChange: (value: FormQuestion) => void
  onDefinitionChange: (value: FormDefinition) => void
  onRemove: () => void
}) {
  return (
    <FieldGroup className={styles.questionFields}>
      <Field>
        <FieldLabel htmlFor={`${id}-label`} className="sr-only">
          Question {index + 1} label
        </FieldLabel>
        <Input
          id={`${id}-label`}
          autoFocus={autoFocus}
          value={question.label}
          maxLength={240}
          placeholder="What would you like to ask?"
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...question, label: event.target.value })
          }
        />
      </Field>
      <div className={styles.toolbar}>
        <Field className={styles.typeField}>
          <FieldLabel className="sr-only" htmlFor={`${id}-type`}>
            Question {index + 1} type
          </FieldLabel>
          <Select
            value={question.type}
            disabled={disabled}
            onValueChange={(value) => {
              const parsed = formQuestionTypeSchema.safeParse(value)
              if (parsed.success)
                onChange(changeFormQuestionType(question, parsed.data))
            }}
          >
            <SelectTrigger id={`${id}-type`} className={styles.pill}>
              <SelectValue>{FORM_QUESTION_LABELS[question.type]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FORM_QUESTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FORM_QUESTION_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal" className={styles.required}>
          <FieldLabel htmlFor={`${id}-required`}>Required</FieldLabel>
          <Switch
            id={`${id}-required`}
            disabled={disabled}
            checked={question.required}
            onCheckedChange={(required) => onChange({ ...question, required })}
          />
        </Field>
      </div>
      {"options" in question && (
        <Field>
          <FieldLabel htmlFor={`${id}-options`}>Options</FieldLabel>
          <Textarea
            id={`${id}-options`}
            disabled={disabled}
            value={question.options.join("\n")}
            maxLength={12049}
            placeholder="One option per line…"
            onChange={(event) =>
              onChange({ ...question, options: event.target.value.split("\n") })
            }
          />
        </Field>
      )}
      <div className={styles.actions}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={styles.iconAction}
          aria-label={`Move question ${index + 1} up`}
          disabled={disabled || index === 0}
          onClick={() =>
            onDefinitionChange(moveFormQuestion(definition, question.id, -1))
          }
        >
          <ArrowUpIcon aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={styles.iconAction}
          aria-label={`Move question ${index + 1} down`}
          disabled={disabled || index === definition.questions.length - 1}
          onClick={() =>
            onDefinitionChange(moveFormQuestion(definition, question.id, 1))
          }
        >
          <ArrowDownIcon aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={styles.iconAction}
          aria-label={`Remove question ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
    </FieldGroup>
  )
}
