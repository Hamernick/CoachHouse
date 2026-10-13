"use client"

import * as React from "react"

import { parseFundraisingAmount } from "../lib/fundraising-goal"
import type { FiscalSponsorshipApplicationDraft } from "../lib/application-draft"
import {
  ApplicantContactSection,
  LegalTaxSection,
  ProjectScopeSection,
} from "./fiscal-sponsorship-application-editor-primary-sections"
import {
  BudgetBenefitSection,
  EligibilityAttestationsSection,
} from "./fiscal-sponsorship-application-editor-review-sections"
import type {
  DraftFieldChange,
  EditorSectionChromeProps,
} from "./fiscal-sponsorship-application-editor-controls"

type ApplicationSectionId =
  | "applicant"
  | "legal"
  | "project"
  | "budget"
  | "eligibility"

const APPLICATION_SECTION_IDS: ApplicationSectionId[] = [
  "applicant",
  "legal",
  "project",
  "budget",
  "eligibility",
]

type FiscalSponsorshipApplicationEditorFieldsProps = {
  showAllSections?: boolean
  guest?: boolean
  lockEmail?: boolean
  applicationReady: boolean
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
  projectId: string
  sourceActivityTitle?: string | null
}

function hasText(value: string) {
  return value.trim().length > 0
}

function resolveApplicationSectionCompletion(
  draft: FiscalSponsorshipApplicationDraft
): Record<ApplicationSectionId, boolean> {
  const applicant =
    hasText(draft.applicantFirstName) &&
    hasText(draft.applicantLastName) &&
    hasText(draft.primaryEmail) &&
    hasText(draft.mailingStreetAddress) &&
    hasText(draft.mailingCity) &&
    hasText(draft.mailingState) &&
    hasText(draft.mailingPostalCode)
  const legal =
    hasText(draft.legalEntityType) &&
    (draft.legalEntityType === "individual" || hasText(draft.formationStatus))
  const project =
    hasText(draft.projectName) &&
    hasText(draft.projectDurationType) &&
    hasText(draft.projectDescription)
  const budget =
    parseFundraisingAmount(draft.fundraisingGoalDollars) !== null &&
    hasText(draft.prospectiveFundingSources) &&
    hasText(draft.publicBenefit)
  const hasRiskSignal = [
    draft.operatesOutsideUnitedStates,
    draft.engagesInLobbying,
    draft.hasLegalComplianceFinancialConcerns,
  ].includes("yes")
  const eligibility =
    draft.operatesOutsideUnitedStates !== "unknown" &&
    draft.engagesInLobbying !== "unknown" &&
    draft.hasLegalComplianceFinancialConcerns !== "unknown" &&
    (!hasRiskSignal || hasText(draft.concernsExplanation))

  return {
    applicant,
    legal,
    project,
    budget,
    eligibility,
  }
}

export function FiscalSponsorshipApplicationEditorFields({
  showAllSections = false,
  applicationReady,
  guest = false,
  lockEmail = false,
  draft,
  formId,
  onFieldChange,
  projectId,
  sourceActivityTitle,
}: FiscalSponsorshipApplicationEditorFieldsProps) {
  const sectionCompletion = React.useMemo(
    () => resolveApplicationSectionCompletion(draft),
    [draft]
  )
  const firstIncompleteSectionId =
    APPLICATION_SECTION_IDS.find(
      (sectionId) => !sectionCompletion[sectionId]
    ) ?? "eligibility"
  const [openSectionId, setOpenSectionId] =
    React.useState<ApplicationSectionId | null>(() => firstIncompleteSectionId)

  function getSectionChrome(
    sectionId: ApplicationSectionId
  ): EditorSectionChromeProps {
    return {
      complete: sectionCompletion[sectionId],
      open: showAllSections || openSectionId === sectionId,
      onOpenChange: (open) => setOpenSectionId(open ? sectionId : null),
    }
  }

  return (
    <div className={guest ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
      <ApplicantContactSection
        lockEmail={lockEmail}
        draft={draft}
        formId={formId}
        sectionChrome={getSectionChrome("applicant")}
        onFieldChange={onFieldChange}
      />
      <LegalTaxSection
        draft={draft}
        formId={formId}
        sectionChrome={getSectionChrome("legal")}
        onFieldChange={onFieldChange}
      />
      <ProjectScopeSection
        draft={draft}
        formId={formId}
        sectionChrome={getSectionChrome("project")}
        onFieldChange={onFieldChange}
      />
      <BudgetBenefitSection
        guest={guest}
        applicationReady={applicationReady}
        draft={draft}
        formId={formId}
        projectId={projectId}
        sourceActivityTitle={sourceActivityTitle}
        sectionChrome={getSectionChrome("budget")}
        onFieldChange={onFieldChange}
      />
      <EligibilityAttestationsSection
        draft={draft}
        formId={formId}
        sectionChrome={getSectionChrome("eligibility")}
        onFieldChange={onFieldChange}
      />
    </div>
  )
}
