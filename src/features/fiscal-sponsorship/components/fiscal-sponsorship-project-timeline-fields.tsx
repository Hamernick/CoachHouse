"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { FiscalApplicationDateField } from "./fiscal-application-date-field"

import {
  FISCAL_SPONSORSHIP_PROJECT_DURATION_OPTIONS,
  type FiscalSponsorshipApplicationDraft,
} from "../lib/application-draft"
import type { FiscalSponsorshipProjectDurationType } from "../types"
import {
  EMPTY_SELECT_VALUE,
  SelectField,
  type DraftFieldChange,
} from "./fiscal-sponsorship-application-editor-controls"

function ProjectDurationField({
  draft,
  onFieldChange,
}: {
  draft: FiscalSponsorshipApplicationDraft
  onFieldChange: DraftFieldChange
}) {
  return (
    <SelectField
      field="projectDurationType"
      label="Project duration"
      value={draft.projectDurationType || EMPTY_SELECT_VALUE}
      placeholder="Choose duration..."
      options={[
        { value: EMPTY_SELECT_VALUE, label: "Not set" },
        ...FISCAL_SPONSORSHIP_PROJECT_DURATION_OPTIONS,
      ]}
      onValueChange={(value) => {
        const nextDuration =
          value === EMPTY_SELECT_VALUE
            ? ""
            : (value as FiscalSponsorshipProjectDurationType)

        onFieldChange("projectDurationType", nextDuration)

        if (nextDuration === "ongoing_multi_year") {
          onFieldChange("temporaryEndDate", "")
        }
      }}
    />
  )
}

function ProjectTimelineFields({
  draft,
  formId,
  onFieldChange,
}: {
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
}) {
  const projectDurationType = draft.projectDurationType
  const [hasNoProposedEndDate, setHasNoProposedEndDate] = React.useState(
    draft.temporaryEndDate.length === 0
  )
  const noEndDateInputId = `${formId}-temporaryEndDateUnknown`

  React.useEffect(() => {
    setHasNoProposedEndDate(draft.temporaryEndDate.length === 0)
  }, [draft.temporaryEndDate])

  if (!projectDurationType) {
    return (
      <Field>
        <FieldLabel>Timeline</FieldLabel>
        <FieldDescription>
          Choose a project duration to set the timeline fields.
        </FieldDescription>
      </Field>
    )
  }

  if (projectDurationType === "ongoing_multi_year") {
    return (
      <FieldGroup className="max-w-56 gap-2">
        <FiscalApplicationDateField
          formId={formId}
          field="temporaryStartDate"
          label="Launch or start date"
          value={draft.temporaryStartDate}
          onFieldChange={onFieldChange}
        />
        <FieldDescription>No end date required for ongoing projects.</FieldDescription>
      </FieldGroup>
    )
  }

  return (
    <FieldGroup className="max-w-md gap-x-4 gap-y-2 sm:grid-cols-2 sm:items-start">
      <FiscalApplicationDateField
        formId={formId}
        field="temporaryStartDate"
        label="Start date"
        value={draft.temporaryStartDate}
        onFieldChange={onFieldChange}
      />
      <FiscalApplicationDateField
        formId={formId}
        field="temporaryEndDate"
        label="Proposed end date"
        value={draft.temporaryEndDate}
        disabled={hasNoProposedEndDate}
        onFieldChange={onFieldChange}
      />
      <Field orientation="horizontal" className="min-h-11 grid-cols-[auto_1fr] items-center justify-start gap-2 sm:col-span-2">
        <Checkbox
          className="shadow-none"
          id={noEndDateInputId}
          checked={hasNoProposedEndDate}
          onCheckedChange={(checked) => {
            const nextChecked = checked === true
            setHasNoProposedEndDate(nextChecked)
            if (nextChecked) onFieldChange("temporaryEndDate", "")
          }}
        />
        <FieldLabel
          htmlFor={noEndDateInputId}
          className="text-muted-foreground flex min-h-11 cursor-pointer items-center text-xs leading-snug font-normal"
        >
          No proposed end date yet
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}

export function FiscalSponsorshipProjectTimelineFields({
  draft,
  formId,
  onFieldChange,
}: {
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
}) {
  return (
    <>
      <ProjectDurationField draft={draft} onFieldChange={onFieldChange} />
      <ProjectTimelineFields
        draft={draft}
        formId={formId}
        onFieldChange={onFieldChange}
      />
    </>
  )
}
