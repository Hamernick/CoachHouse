"use client"

import { OrganizationFormationStatusPicker } from "@/components/organization/organization-formation-status-picker"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { FiscalFieldError, useFiscalFieldError } from "./fiscal-public-field-errors"
import {
  isFormationStatus,
} from "@/lib/organization/formation-status"
import type { FormationStatus } from "@/lib/organization/org-profile-brand-types"

import {
  FISCAL_SPONSORSHIP_LEGAL_ENTITY_OPTIONS,
  type FiscalSponsorshipBooleanChoice,
  type FiscalSponsorshipApplicationDraft,
} from "../lib/application-draft"
import type { FiscalSponsorshipLegalEntityType } from "../types"
import {
  DraftInputField,
  DraftTextareaField,
  EditorSection,
  EMPTY_SELECT_VALUE,
  SelectField,
  type DraftFieldChange,
  type EditorSectionChromeProps,
} from "./fiscal-sponsorship-application-editor-controls"
import { FiscalSponsorshipProjectTimelineFields } from "./fiscal-sponsorship-project-timeline-fields"

const LEGAL_ENTITY_REQUIREMENT_SUMMARIES = {
  individual: {
    title: "Individual applicant",
    description:
      "We only ask for the person responsible, U.S. tax identity confirmation, budget support, and fundraising materials. Entity formation documents stay hidden unless Coach House asks for them.",
    completeItems: ["Contact and mailing address", "Project and budget"],
    neededItems: ["U.S. tax ID confirmation"],
  },
  informal_group_with_ein: {
    title: "Informal group with EIN",
    description:
      "Coach House needs the EIN/tax identity plus a simple record of who controls the project and can sign.",
    completeItems: ["Project and budget", "Fundraising materials"],
    neededItems: ["EIN confirmation", "Governing or control document"],
  },
  llc: {
    title: "LLC",
    description:
      "The agreement and grant review need the entity identity, operating authority, and good-standing context when available.",
    completeItems: ["Project and budget", "Fundraising materials"],
    neededItems: [
      "EIN confirmation",
      "Operating agreement",
      "Formation or good standing",
    ],
  },
  corporation: {
    title: "Corporation",
    description:
      "The agreement and review need the corporate identity, governing authority, and formation or good-standing support.",
    completeItems: ["Project and budget", "Fundraising materials"],
    neededItems: ["EIN confirmation", "Bylaws", "Formation or good standing"],
  },
  partnership: {
    title: "Partnership",
    description:
      "Coach House needs the partnership tax identity and documentation showing who is authorized to sign and receive grants.",
    completeItems: ["Project and budget", "Fundraising materials"],
    neededItems: [
      "Tax ID confirmation",
      "Partnership agreement",
      "Formation or good standing",
    ],
  },
  other: {
    title: "Other structure",
    description:
      "Start with tax identity, budget, and fundraising materials. Coach House may request additional legal or control documents after review.",
    completeItems: ["Project and budget", "Fundraising materials"],
    neededItems: ["Tax ID confirmation", "Additional legal context"],
  },
} satisfies Record<
  FiscalSponsorshipLegalEntityType,
  {
    completeItems: string[]
    description: string
    neededItems: string[]
    title: string
  }
>

const FISCAL_FORMATION_STATUS_VALUES = {
  pre_501c3: {
    formationStatus: "Pre-501(c)(3)",
    legalEntityHas501c3: "no",
  },
  in_progress: {
    formationStatus: "501(c)(3) in progress",
    legalEntityHas501c3: "no",
  },
  approved: {
    formationStatus: "Approved 501(c)(3)",
    legalEntityHas501c3: "yes",
  },
} satisfies Record<
  FormationStatus,
  {
    formationStatus: string
    legalEntityHas501c3: FiscalSponsorshipBooleanChoice
  }
>

function resolveFormationStatusValue({
  formationStatus,
  legalEntityHas501c3,
}: {
  formationStatus: string
  legalEntityHas501c3: FiscalSponsorshipBooleanChoice
}): FormationStatus | "" {
  if (isFormationStatus(formationStatus)) return formationStatus
  if (legalEntityHas501c3 === "yes") return "approved"

  const normalized = formationStatus.toLowerCase()
  if (normalized.includes("approved")) return "approved"
  if (normalized.includes("progress")) return "in_progress"
  if (normalized.includes("pre")) return "pre_501c3"

  return ""
}

function LegalEntityField({
  draft,
  onFieldChange,
}: {
  draft: FiscalSponsorshipApplicationDraft
  onFieldChange: DraftFieldChange
}) {
  return (
    <SelectField
      field="legalEntityType"
      label="Legal entity type"
      value={draft.legalEntityType || EMPTY_SELECT_VALUE}
      placeholder="Choose legal entity..."
      options={[
        { value: EMPTY_SELECT_VALUE, label: "Not set" },
        ...FISCAL_SPONSORSHIP_LEGAL_ENTITY_OPTIONS,
      ]}
      description="This drives tax reporting identity and agreement language."
      onValueChange={(value) => {
        const nextLegalEntityType =
          value === EMPTY_SELECT_VALUE
            ? ""
            : (value as FiscalSponsorshipLegalEntityType)

        onFieldChange("legalEntityType", nextLegalEntityType)

        if (nextLegalEntityType === "individual") {
          onFieldChange("formationStatus", "")
          onFieldChange("legalEntityHas501c3", "unknown")
        }
      }}
    />
  )
}

function LegalEntityRequirementSummary({
  legalEntityType,
}: {
  legalEntityType: FiscalSponsorshipApplicationDraft["legalEntityType"]
}) {
  if (!legalEntityType) {
    return (
      <div className="border-border/70 bg-background/60 rounded-xl border p-3">
        <p className="text-sm font-medium">Choose a legal structure</p>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          The next questions and upload list will adapt once this is set.
        </p>
      </div>
    )
  }

  const summary = LEGAL_ENTITY_REQUIREMENT_SUMMARIES[legalEntityType]

  return (
    <div className="border-border/70 bg-background/60 rounded-xl border p-3">
      <p className="text-sm font-medium">{summary.title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-snug">
        {summary.description}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          {summary.completeItems.map((item) => (
            <div key={item} className="flex min-w-0 items-center gap-2">
              <span
                className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="text-muted-foreground text-xs">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {summary.neededItems.map((item) => (
            <div key={item} className="flex min-w-0 items-center gap-2">
              <span
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                aria-hidden
              />
              <span className="text-muted-foreground text-xs">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FormationStatusCardPicker({
  draft,
  formId,
  onFieldChange,
}: {
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
}) {
  const labelId = `${formId}-formation-status-label`
  const descriptionId = `${formId}-formation-status-description`
  const error = useFiscalFieldError("formationStatus")
  const selectedValue = resolveFormationStatusValue({
    formationStatus: draft.formationStatus,
    legalEntityHas501c3: draft.legalEntityHas501c3,
  })

  return (
    <Field tabIndex={error ? -1 : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${formId}-formation-error` : undefined}>
      <FieldLabel id={labelId}>Formation status</FieldLabel>
      <OrganizationFormationStatusPicker
        value={selectedValue}
        onValueChange={(value) => {
          const nextStatus = FISCAL_FORMATION_STATUS_VALUES[value]
          onFieldChange("formationStatus", nextStatus.formationStatus)
          onFieldChange("legalEntityHas501c3", nextStatus.legalEntityHas501c3)
        }}
        labelledBy={labelId}
        describedBy={descriptionId}
      />
      <FieldDescription id={descriptionId}>
        This sets formation status and 501(c)(3) status together.
      </FieldDescription>
      <FiscalFieldError field="formationStatus" id={`${formId}-formation-error`} />
    </Field>
  )
}

export function ApplicantContactSection({
  lockEmail = false,
  draft,
  formId,
  onFieldChange,
  sectionChrome,
}: {
  draft: FiscalSponsorshipApplicationDraft
  formId: string
  onFieldChange: DraftFieldChange
  sectionChrome: EditorSectionChromeProps
  lockEmail?: boolean
}) {
  return (
    <EditorSection
      title="Applicant and contact"
      description="Confirm the person responsible for the fiscal sponsorship relationship."
      {...sectionChrome}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DraftInputField
          formId={formId}
          field="applicantFirstName"
          label="First name"
          value={draft.applicantFirstName}
          placeholder="First name..."
          autoComplete="given-name"
          onFieldChange={onFieldChange}
        />
        <DraftInputField
          formId={formId}
          field="applicantLastName"
          label="Last name"
          value={draft.applicantLastName}
          placeholder="Last name..."
          autoComplete="family-name"
          onFieldChange={onFieldChange}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DraftInputField
          formId={formId}
          field="phoneNumber"
          label="Phone number"
          value={draft.phoneNumber}
          placeholder="Phone number..."
          inputMode="tel"
          autoComplete="tel"
          onFieldChange={onFieldChange}
        />
        <DraftInputField
          formId={formId}
          field="primaryEmail"
          readOnly={lockEmail}
          label="Primary email"
          type="email"
          value={draft.primaryEmail}
          placeholder="name@example.com..."
          inputMode="email"
          autoComplete="email"
          onFieldChange={onFieldChange}
        />
      </div>
      <DraftInputField
        formId={formId}
        field="mailingStreetAddress"
        label="Mailing street address"
        value={draft.mailingStreetAddress}
        placeholder="Street address..."
        autoComplete="address-line1"
        onFieldChange={onFieldChange}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DraftInputField
          formId={formId}
          field="mailingStreetAddress2"
          label="Address line 2"
          value={draft.mailingStreetAddress2}
          placeholder="Suite, unit, or floor..."
          autoComplete="address-line2"
          onFieldChange={onFieldChange}
        />
        <DraftInputField
          formId={formId}
          field="mailingCity"
          label="City"
          value={draft.mailingCity}
          placeholder="City..."
          autoComplete="address-level2"
          onFieldChange={onFieldChange}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DraftInputField
          formId={formId}
          field="mailingState"
          label="State / province"
          value={draft.mailingState}
          placeholder="State..."
          autoComplete="address-level1"
          onFieldChange={onFieldChange}
        />
        <DraftInputField
          formId={formId}
          field="mailingPostalCode"
          label="Postal code"
          value={draft.mailingPostalCode}
          placeholder="Postal code..."
          autoComplete="postal-code"
          onFieldChange={onFieldChange}
        />
      </div>
    </EditorSection>
  )
}

export function LegalTaxSection({
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
  return (
    <EditorSection
      title="Legal entity and tax"
      description="Capture the legal structure that will appear in review and agreement templates."
      {...sectionChrome}
    >
      <LegalEntityField draft={draft} onFieldChange={onFieldChange} />
      <LegalEntityRequirementSummary legalEntityType={draft.legalEntityType} />
      {draft.legalEntityType && draft.legalEntityType !== "individual" ? (
        <FormationStatusCardPicker
          draft={draft}
          formId={formId}
          onFieldChange={onFieldChange}
        />
      ) : null}
    </EditorSection>
  )
}

export function ProjectScopeSection({
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
  return (
    <EditorSection
      title="Project scope"
      description="Describe the charitable project, program, or initiative being sponsored."
      {...sectionChrome}
    >
      <DraftInputField
        formId={formId}
        field="projectName"
        label="Project, program, or initiative name"
        value={draft.projectName}
        placeholder="Project name..."
        onFieldChange={onFieldChange}
      />
      <FiscalSponsorshipProjectTimelineFields
        draft={draft}
        formId={formId}
        onFieldChange={onFieldChange}
      />
      <DraftInputField
        formId={formId}
        field="focusArea"
        label="Issue or focus area"
        value={draft.focusArea}
        placeholder="Community development, education, health, arts..."
        onFieldChange={onFieldChange}
      />
      <DraftInputField
        formId={formId}
        field="projectLocation"
        label="Project location"
        value={draft.projectLocation}
        placeholder="Location if different from mailing address..."
        onFieldChange={onFieldChange}
      />
      <DraftTextareaField
        formId={formId}
        field="projectDescription"
        label="Project description"
        value={draft.projectDescription}
        placeholder="What are you doing, how does it work, and why does it matter?"
        onFieldChange={onFieldChange}
      />
    </EditorSection>
  )
}
