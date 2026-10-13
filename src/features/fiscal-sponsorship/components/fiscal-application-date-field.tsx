"use client"

import { useState } from "react"
import { format, isValid, parseISO } from "date-fns"
import CalendarIcon from "lucide-react/dist/esm/icons/calendar"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FiscalFieldError, useFiscalFieldError } from "./fiscal-public-field-errors"
import type { DraftFieldChange } from "./fiscal-sponsorship-application-editor-controls"

export function FiscalApplicationDateField({ field, formId, label, value, disabled = false, onFieldChange }: {
  field: "temporaryStartDate" | "temporaryEndDate"
  formId: string
  label: string
  value: string
  disabled?: boolean
  onFieldChange: DraftFieldChange
}) {
  const [open, setOpen] = useState(false)
  const error = useFiscalFieldError(field)
  const id = `${formId}-${field}`
  // Application dates are calendar dates, not UTC instants.
  const parsed = value ? parseISO(value) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  return (
    <Field className="min-w-0 content-start gap-2" data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" disabled={disabled}
            aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            className={cn("h-11 w-full min-w-0 justify-between rounded-md bg-white px-3 font-normal shadow-none dark:bg-input/30", !date && "text-muted-foreground")}>
            <span className="truncate">{disabled ? "Not set" : date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Choose date"}</span>
            <CalendarIcon data-icon="inline-end" className="text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} aria-label={`${label} calendar`}
          className="w-auto max-w-[calc(100vw-1.5rem)] rounded-xl p-0 shadow-none">
          <Calendar mode="single" selected={date} defaultMonth={date} autoFocus
            onSelect={(next) => { onFieldChange(field, next ? format(next, "yyyy-MM-dd") : ""); setOpen(false) }} />
          {date ? <Button type="button" variant="ghost" className="m-2 h-11" onClick={() => { onFieldChange(field, ""); setOpen(false) }}>Clear date</Button> : null}
        </PopoverContent>
      </Popover>
      <FiscalFieldError field={field} id={`${id}-error`} />
    </Field>
  )
}
