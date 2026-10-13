"use client"

import { Separator } from "@/components/ui/separator"
import type { FiscalSponsorshipApplicationDraft } from "../lib/application-draft"
import {
  BooleanField,
  DraftInputField,
  SelectField,
  DraftTextareaField,
  EditorSection,
  type DraftFieldChange,
  type EditorSectionChromeProps,
} from "./fiscal-sponsorship-application-editor-controls"
import { FUNDRAISING_PERIODS } from "../lib/fundraising-goal"

export function BudgetBenefitSection({
  draft,
  formId,
  onFieldChange,
  sectionChrome,
}: {
  guest?: boolean
  applicationReady: boolean
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
  projectId: string
  sectionChrome: EditorSectionChromeProps
  sourceActivityTitle?: string | null
}) {
  return (
    <EditorSection
      title="Budget, funding, and benefit"
      description="Share your fundraising goal and who will benefit."
      {...sectionChrome}
    >
      <div className="grid items-start gap-4 sm:grid-cols-[2fr_1fr]">
        <DraftInputField
          formId={formId}
          field="fundraisingGoalDollars"
          currency
          label="How much do you anticipate raising? (USD)"
          inputMode="decimal"
          value={draft.fundraisingGoalDollars}
          placeholder="10,000"
          onFieldChange={onFieldChange}
        />
        <SelectField
          label="Timeframe"
          value={draft.fundraisingGoalPeriod}
          placeholder="Choose a timeframe"
          options={[...FUNDRAISING_PERIODS]}
          onValueChange={(value) => onFieldChange("fundraisingGoalPeriod", value as typeof draft.fundraisingGoalPeriod)}
        />
      </div>
      <DraftTextareaField
        formId={formId}
        field="prospectiveFundingSources"
        label="Prospective funding sources"
        value={draft.prospectiveFundingSources}
        placeholder="Donors, foundations, sponsors, community fundraising..."
        onFieldChange={onFieldChange}
      />
      <Separator className="border-t border-dashed bg-transparent" />
      <DraftTextareaField
        formId={formId}
        field="publicBenefit"
        label="Public benefit and community impact"
        value={draft.publicBenefit}
        placeholder="Who benefits, and how?"
        onFieldChange={onFieldChange}
      />
      <DraftTextareaField
        formId={formId}
        field="leadershipBackground"
        label="Leadership background"
        value={draft.leadershipBackground}
        placeholder="Experience or relevant background..."
        onFieldChange={onFieldChange}
      />
      <DraftTextareaField
        formId={formId}
        field="initiativeHistory"
        label="Initiative history"
        value={draft.initiativeHistory}
        placeholder="Brief background of this initiative..."
        onFieldChange={onFieldChange}
      />
    </EditorSection>
  )
}

export function EligibilityAttestationsSection({
  draft,
  formId,
  onFieldChange,
  sectionChrome,
}: {
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
  sectionChrome: EditorSectionChromeProps
}) {
  const needsConcernExplanation =
    draft.operatesOutsideUnitedStates === "yes" ||
    draft.engagesInLobbying === "yes" ||
    draft.hasLegalComplianceFinancialConcerns === "yes"

  return (
    <EditorSection
      title="Eligibility attestations"
      description="Yes answers need an explanation for review; they do not automatically disqualify your project."
      {...sectionChrome}
    >
      <BooleanField
        field="operatesOutsideUnitedStates"
        label="Do you plan to operate outside the United States?"
        value={draft.operatesOutsideUnitedStates}
        onFieldChange={onFieldChange}
      />
      <BooleanField
        field="engagesInLobbying"
        label="Do you plan to engage in lobbying activities?"
        value={draft.engagesInLobbying}
        onFieldChange={onFieldChange}
      />
      <BooleanField
        field="hasLegalComplianceFinancialConcerns"
        label="Any legal, compliance, or financial concerns?"
        value={draft.hasLegalComplianceFinancialConcerns}
        onFieldChange={onFieldChange}
      />
      {needsConcernExplanation ? (
        <DraftTextareaField
          formId={formId}
          field="concernsExplanation"
          label="Explain each answer marked Yes"
          value={draft.concernsExplanation}
          placeholder="Describe the activities, locations, or concerns you marked Yes above."
          onFieldChange={onFieldChange}
        />
      ) : null}
    </EditorSection>
  )
}
